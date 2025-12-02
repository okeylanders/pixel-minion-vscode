/**
 * OpenRouterDynamicTextClient tests
 *
 * Tests the dynamic text client implementation with focus on:
 * - Concurrent requests with different models (race condition fix)
 * - Model override via options.model
 * - Fallback to currentModel when no override
 * - setModel() deprecation warning
 */
import { OpenRouterDynamicTextClient } from '../../../../infrastructure/ai/clients/OpenRouterDynamicTextClient';
import { SecretStorageService } from '../../../../infrastructure/secrets/SecretStorageService';
import { LoggingService } from '../../../../infrastructure/logging/LoggingService';
import { TextMessage } from '../../../../infrastructure/ai/clients/TextClient';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('OpenRouterDynamicTextClient', () => {
  let client: OpenRouterDynamicTextClient;
  let mockSecretStorage: jest.Mocked<SecretStorageService>;
  let mockLogger: jest.Mocked<LoggingService>;

  const createMockApiResponse = (content: string = '<svg></svg>') => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: { content },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        native_tokens_prompt: 12,
        native_tokens_completion: 22,
        cost: 0.0001
      },
      id: 'test-completion-id'
    })
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SecretStorageService
    mockSecretStorage = {
      getApiKey: jest.fn().mockResolvedValue('test-api-key'),
      hasApiKey: jest.fn().mockResolvedValue(true),
      storeSecret: jest.fn().mockResolvedValue(undefined),
      getSecret: jest.fn().mockResolvedValue('test-api-key'),
      deleteSecret: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock LoggingService
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      separator: jest.fn(),
      show: jest.fn(),
      clear: jest.fn(),
      getChannel: jest.fn(),
    } as any;

    // Create client with default model
    client = new OpenRouterDynamicTextClient(
      mockSecretStorage,
      mockLogger,
      'anthropic/claude-sonnet-4'
    );

    // Mock successful API response by default
    mockFetch.mockResolvedValue(createMockApiResponse());
  });

  describe('constructor', () => {
    it('should initialize with default model', () => {
      const newClient = new OpenRouterDynamicTextClient(
        mockSecretStorage,
        mockLogger,
        'google/gemini-3-pro-preview'
      );

      expect(newClient.getModel()).toBe('google/gemini-3-pro-preview');
    });

    it('should use fallback default model if none provided', () => {
      const newClient = new OpenRouterDynamicTextClient(
        mockSecretStorage,
        mockLogger
      );

      expect(newClient.getModel()).toBe('openai/gpt-5.1');
    });
  });

  describe('setModel()', () => {
    it('should update the current model', () => {
      client.setModel('google/gemini-3-pro-preview');

      expect(client.getModel()).toBe('google/gemini-3-pro-preview');
    });

    it('should log deprecation warning', () => {
      client.setModel('google/gemini-3-pro-preview');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'setModel() is deprecated. Pass model to createCompletion() options instead.'
      );
    });

    it('should log debug message with new model', () => {
      client.setModel('google/gemini-3-pro-preview');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OpenRouterDynamicTextClient model set to: google/gemini-3-pro-preview'
      );
    });
  });

  describe('isConfigured()', () => {
    it('should return true when API key exists', async () => {
      mockSecretStorage.hasApiKey.mockResolvedValue(true);

      const result = await client.isConfigured();

      expect(result).toBe(true);
      expect(mockSecretStorage.hasApiKey).toHaveBeenCalled();
    });

    it('should return false when API key does not exist', async () => {
      mockSecretStorage.hasApiKey.mockResolvedValue(false);

      const result = await client.isConfigured();

      expect(result).toBe(false);
    });
  });

  describe('createCompletion() - model selection', () => {
    const testMessages: TextMessage[] = [
      { role: 'user', content: 'Generate an SVG circle' }
    ];

    it('should use model from options.model when provided', async () => {
      const overrideModel = 'google/gemini-3-pro-preview';

      await client.createCompletion(testMessages, {
        model: overrideModel
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(`"model":"${overrideModel}"`)
        })
      );
    });

    it('should fall back to currentModel when options.model not provided', async () => {
      // Client initialized with 'anthropic/claude-sonnet-4'
      await client.createCompletion(testMessages);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('"model":"anthropic/claude-sonnet-4"')
        })
      );
    });

    it('should use currentModel after setModel() if no options.model', async () => {
      client.setModel('google/gemini-3-pro-preview');

      await client.createCompletion(testMessages);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('"model":"google/gemini-3-pro-preview"')
        })
      );
    });

    it('should prefer options.model over currentModel', async () => {
      // Set currentModel
      client.setModel('anthropic/claude-sonnet-4');

      // Pass different model in options
      await client.createCompletion(testMessages, {
        model: 'google/gemini-3-pro-preview'
      });

      // Should use options.model, not currentModel
      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('"model":"google/gemini-3-pro-preview"')
        })
      );
    });

    it('should log the model being used', async () => {
      await client.createCompletion(testMessages, {
        model: 'google/gemini-3-pro-preview'
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Calling OpenRouter text completion',
        expect.objectContaining({
          model: 'google/gemini-3-pro-preview',
          messageCount: 1
        })
      );
    });
  });

  describe('createCompletion() - concurrent requests with different models', () => {
    const testMessages: TextMessage[] = [
      { role: 'user', content: 'Generate SVG' }
    ];

    it('should handle concurrent requests with different models correctly', async () => {
      // Create multiple promises with different models
      const request1 = client.createCompletion(testMessages, {
        model: 'anthropic/claude-sonnet-4'
      });

      const request2 = client.createCompletion(testMessages, {
        model: 'google/gemini-3-pro-preview'
      });

      const request3 = client.createCompletion(testMessages, {
        model: 'openai/gpt-5.1'
      });

      // Wait for all to complete
      await Promise.all([request1, request2, request3]);

      // Verify all three requests were made with correct models
      const fetchCalls = mockFetch.mock.calls;
      expect(fetchCalls).toHaveLength(3);

      // Extract model from each request body
      const models = fetchCalls.map(call => {
        const body = JSON.parse(call[1].body);
        return body.model;
      });

      expect(models).toEqual([
        'anthropic/claude-sonnet-4',
        'google/gemini-3-pro-preview',
        'openai/gpt-5.1'
      ]);
    });

    it('should not have race conditions when requests complete out of order', async () => {
      // Mock delayed responses to simulate out-of-order completion
      let resolveFirst: ((value: any) => void) | undefined;
      let resolveSecond: ((value: any) => void) | undefined;

      const promise1 = new Promise(resolve => { resolveFirst = resolve; });
      const promise2 = new Promise(resolve => { resolveSecond = resolve; });

      mockFetch
        .mockImplementationOnce(() => promise1)
        .mockImplementationOnce(() => promise2);

      // Start requests
      const request1Promise = client.createCompletion(testMessages, {
        model: 'model-one'
      });

      const request2Promise = client.createCompletion(testMessages, {
        model: 'model-two'
      });

      // Allow promises to be created
      await new Promise(resolve => setTimeout(resolve, 0));

      // Complete second request first
      resolveSecond!(createMockApiResponse('second'));
      const result2 = await request2Promise;

      // Complete first request second
      resolveFirst!(createMockApiResponse('first'));
      const result1 = await request1Promise;

      // Verify each request got its own response
      expect(result1.content).toBe('first');
      expect(result2.content).toBe('second');

      // Verify models used in requests
      const fetchCalls = mockFetch.mock.calls;
      const model1 = JSON.parse(fetchCalls[0][1].body).model;
      const model2 = JSON.parse(fetchCalls[1][1].body).model;

      expect(model1).toBe('model-one');
      expect(model2).toBe('model-two');
    });

    it('should handle mix of requests with and without model override', async () => {
      // Set a default model
      client.setModel('default-model');

      // Start concurrent requests - some with override, some without
      const withOverride = client.createCompletion(testMessages, {
        model: 'override-model'
      });

      const withoutOverride = client.createCompletion(testMessages);

      const anotherOverride = client.createCompletion(testMessages, {
        model: 'another-override'
      });

      await Promise.all([withOverride, withoutOverride, anotherOverride]);

      // Verify models used
      const fetchCalls = mockFetch.mock.calls;
      const models = fetchCalls.map(call => {
        const body = JSON.parse(call[1].body);
        return body.model;
      });

      expect(models).toEqual([
        'override-model',
        'default-model',  // Used currentModel
        'another-override'
      ]);
    });
  });

  describe('createCompletion() - API interaction', () => {
    const testMessages: TextMessage[] = [
      { role: 'system', content: 'You are an SVG generator' },
      { role: 'user', content: 'Create a circle' }
    ];

    it('should throw error when API key not configured', async () => {
      mockSecretStorage.getApiKey.mockResolvedValue(undefined);

      await expect(client.createCompletion(testMessages)).rejects.toThrow(
        'API key not configured. Please add your OpenRouter API key in Settings.'
      );
    });

    it('should send correct request headers', async () => {
      await client.createCompletion(testMessages);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
            'HTTP-Referer': 'https://github.com/pixel-minion-vscode',
            'X-Title': 'Pixel Minion VS Code Extension',
          }
        })
      );
    });

    it('should send messages in correct format', async () => {
      await client.createCompletion(testMessages);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(requestBody.messages).toEqual([
        { role: 'system', content: 'You are an SVG generator' },
        { role: 'user', content: 'Create a circle' }
      ]);
    });

    it('should use default temperature and maxTokens', async () => {
      await client.createCompletion(testMessages);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(requestBody.temperature).toBe(0.7);
      expect(requestBody.max_tokens).toBe(16384);
    });

    it('should use custom temperature and maxTokens from options', async () => {
      await client.createCompletion(testMessages, {
        temperature: 0.9,
        maxTokens: 8000
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(requestBody.temperature).toBe(0.9);
      expect(requestBody.max_tokens).toBe(8000);
    });

    it('should include usage tracking in request', async () => {
      await client.createCompletion(testMessages);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(requestBody.usage).toEqual({ include: true });
    });

    it('should handle abort signal', async () => {
      const abortController = new AbortController();

      await client.createCompletion(testMessages, {
        signal: abortController.signal
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: abortController.signal
        })
      );
    });
  });

  describe('createCompletion() - response handling', () => {
    const testMessages: TextMessage[] = [
      { role: 'user', content: 'Test' }
    ];

    it('should return completion result with content', async () => {
      const result = await client.createCompletion(testMessages);

      expect(result).toEqual({
        content: '<svg></svg>',
        finishReason: 'stop',
        usage: {
          promptTokens: 12,
          completionTokens: 22,
          totalTokens: 34,
          costUsd: 0.0001
        },
        id: 'test-completion-id'
      });
    });

    it('should prefer native token counts over normalized', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'test' }, finish_reason: 'stop' }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            native_tokens_prompt: 15,
            native_tokens_completion: 25
          },
          id: 'test-id'
        })
      });

      const result = await client.createCompletion(testMessages);

      expect(result.usage).toEqual({
        promptTokens: 15,  // Native tokens used
        completionTokens: 25,
        totalTokens: 40,
        costUsd: undefined
      });
    });

    it('should fall back to normalized tokens if native not available', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'test' }, finish_reason: 'stop' }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20
          },
          id: 'test-id'
        })
      });

      const result = await client.createCompletion(testMessages);

      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        costUsd: undefined
      });
    });

    it('should handle missing usage data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'test' }, finish_reason: 'stop' }],
          id: 'test-id'
        })
      });

      const result = await client.createCompletion(testMessages);

      expect(result.usage).toBeUndefined();
    });

    it('should log debug messages for request and response', async () => {
      await client.createCompletion(testMessages, {
        model: 'test-model'
      });

      // Request log
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Calling OpenRouter text completion',
        expect.objectContaining({
          model: 'test-model',
          messageCount: 1
        })
      );

      // Response log
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OpenRouter response received',
        expect.objectContaining({
          hasUsage: true,
          usage: expect.any(Object)
        })
      );
    });
  });

  describe('createCompletion() - error handling', () => {
    const testMessages: TextMessage[] = [
      { role: 'user', content: 'Test' }
    ];

    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad request - invalid model'
      });

      await expect(client.createCompletion(testMessages)).rejects.toThrow(
        'OpenRouter API error (400): Bad request - invalid model'
      );
    });

    it('should log API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      await expect(client.createCompletion(testMessages)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'OpenRouter API error: 401 Unauthorized'
      );
    });

    it('should throw error when no completion choice returned', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [],
          id: 'test-id'
        })
      });

      await expect(client.createCompletion(testMessages)).rejects.toThrow(
        'No completion choice returned from OpenRouter'
      );
    });

    it('should handle missing message content gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              finish_reason: 'stop'
            }
          ],
          id: 'test-id'
        })
      });

      const result = await client.createCompletion(testMessages);

      expect(result.content).toBe('');
    });
  });

  describe('createCompletion() - multimodal content', () => {
    it('should handle multimodal message content', async () => {
      const multimodalMessages: TextMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } }
          ]
        }
      ];

      await client.createCompletion(multimodalMessages);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(requestBody.messages[0].content).toEqual([
        { type: 'text', text: 'Analyze this image' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } }
      ]);
    });
  });
});
