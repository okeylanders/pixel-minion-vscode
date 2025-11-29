/**
 * MessageHandler tests
 *
 * Tests the main message dispatcher and token accumulation
 */
import { MessageHandler } from '../../../application/handlers/MessageHandler';
import { MessageType, createEnvelope, TokenUsage } from '@messages';

// Mock dependencies
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockSecretStorage = {
  getApiKey: jest.fn(),
  setApiKey: jest.fn(),
  deleteApiKey: jest.fn(),
  hasApiKey: jest.fn(),
  onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
};

// Mock the domain handlers
jest.mock('../../../application/handlers/domain/HelloWorldHandler', () => ({
  HelloWorldHandler: jest.fn().mockImplementation(() => ({
    handleRequest: jest.fn(),
  })),
}));

jest.mock('../../../application/handlers/domain/SettingsHandler', () => ({
  SettingsHandler: jest.fn().mockImplementation(() => ({
    handleRequestSettings: jest.fn(),
    handleUpdateSetting: jest.fn(),
    handleApiKeyStatusRequest: jest.fn(),
    handleSaveApiKey: jest.fn(),
    handleClearApiKey: jest.fn(),
  })),
}));

jest.mock('../../../application/handlers/domain/TextHandler', () => ({
  TextHandler: jest.fn().mockImplementation(() => ({
    handleConversationRequest: jest.fn(),
    handleClearConversation: jest.fn(),
  })),
}));

describe('MessageHandler', () => {
  let postMessage: jest.Mock;
  let handler: MessageHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    postMessage = jest.fn();
    handler = new MessageHandler(
      postMessage,
      mockSecretStorage as never,
      mockLogger as never
    );
  });

  describe('constructor', () => {
    it('should initialize and register routes', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MessageHandler initialized with routes',
        expect.any(Array)
      );
    });

    it('should broadcast initial token usage on construction', () => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.TOKEN_USAGE_UPDATE,
          payload: {
            totals: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              costUsd: 0,
            },
          },
        })
      );
    });
  });

  describe('handleMessage', () => {
    it('should ignore messages from extension sources', async () => {
      const message = createEnvelope(
        MessageType.HELLO_WORLD_REQUEST,
        'extension.helloWorld',
        { text: 'test' }
      );

      await handler.handleMessage(message);

      // Should not log handling since it's from extension
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Handling message')
      );
    });

    it('should log warning for unhandled message types', async () => {
      // Create a message with an unregistered type by casting
      const message = {
        type: 'UNKNOWN_TYPE' as MessageType,
        source: 'webview.helloWorld' as const,
        payload: {},
        timestamp: Date.now(),
      };

      await handler.handleMessage(message);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No handler registered')
      );
    });
  });

  describe('applyTokenUsage', () => {
    it('should accumulate token usage correctly', () => {
      postMessage.mockClear();

      const usage1: TokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costUsd: 0.01,
      };

      handler.applyTokenUsage(usage1);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.TOKEN_USAGE_UPDATE,
          payload: {
            totals: {
              promptTokens: 100,
              completionTokens: 50,
              totalTokens: 150,
              costUsd: 0.01,
            },
          },
        })
      );
    });

    it('should accumulate multiple usages', () => {
      const usage1: TokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costUsd: 0.01,
      };

      const usage2: TokenUsage = {
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        costUsd: 0.02,
      };

      handler.applyTokenUsage(usage1);
      postMessage.mockClear();
      handler.applyTokenUsage(usage2);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.TOKEN_USAGE_UPDATE,
          payload: {
            totals: {
              promptTokens: 300,
              completionTokens: 150,
              totalTokens: 450,
              costUsd: 0.03,
            },
          },
        })
      );
    });

    it('should handle partial token usage', () => {
      postMessage.mockClear();

      const partialUsage: TokenUsage = {
        promptTokens: 100,
        completionTokens: 0,
        totalTokens: 100,
      };

      handler.applyTokenUsage(partialUsage);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            totals: expect.objectContaining({
              promptTokens: 100,
              completionTokens: 0,
              totalTokens: 100,
            }),
          },
        })
      );
    });
  });

  describe('resetTokenUsage', () => {
    it('should reset token usage via message', async () => {
      // First apply some usage
      handler.applyTokenUsage({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costUsd: 0.01,
      });

      postMessage.mockClear();

      // Send reset message
      const resetMessage = createEnvelope(
        MessageType.RESET_TOKEN_USAGE,
        'webview.settings',
        {}
      );

      await handler.handleMessage(resetMessage);

      expect(mockLogger.info).toHaveBeenCalledWith('Token usage reset');
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.TOKEN_USAGE_UPDATE,
          payload: {
            totals: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              costUsd: 0,
            },
          },
        })
      );
    });
  });
});
