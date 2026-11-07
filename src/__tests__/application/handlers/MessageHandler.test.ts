/**
 * MessageHandler tests
 *
 * Tests the main message dispatcher and token accumulation
 */
import { MessageHandler } from '../../../application/handlers/MessageHandler';
import { SettingsHandler } from '../../../application/handlers/domain/SettingsHandler';
import { ImageGenerationHandler } from '../../../application/handlers/domain/ImageGenerationHandler';
import {
  MessageEnvelope,
  MessageType,
  OpenRouterBalancePayload,
  createEnvelope,
  TokenUsage,
} from '@messages';

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
    resetClient: jest.fn(),
  })),
}));

jest.mock('../../../application/handlers/domain/ImageGenerationHandler', () => ({
  ImageGenerationHandler: jest.fn().mockImplementation(() => ({})),
}));

const BALANCE: OpenRouterBalancePayload = {
  status: 'ok',
  credits: { totalCredits: 20, totalUsage: 7.66, remaining: 12.34 },
  creditsStatus: 'ok',
  fetchedAt: 1_700_000_000_000,
};

describe('MessageHandler', () => {
  let postMessage: jest.Mock;
  let handler: MessageHandler;
  let unsubscribe: jest.Mock;
  let balanceService: {
    getBalance: jest.Mock;
    invalidate: jest.Mock;
    scheduleRefresh: jest.Mock;
    addRefreshListener: jest.Mock;
  };

  /** The (wrapped) postMessage MessageHandler hands to its domain handlers. */
  const domainPostMessage = (): ((message: MessageEnvelope) => void) =>
    (ImageGenerationHandler as unknown as jest.Mock).mock.calls[0][0];

  /** SettingsHandler's onSecretsChanged callback (runs after key save/clear). */
  const onSecretsChanged = (): (() => void) =>
    (SettingsHandler as unknown as jest.Mock).mock.calls[0][4];

  const balancePosts = () => postMessage.mock.calls
    .map(([message]) => message as MessageEnvelope)
    .filter((message) => message.type === MessageType.OPENROUTER_BALANCE_DATA);

  const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    jest.clearAllMocks();
    postMessage = jest.fn();
    unsubscribe = jest.fn();
    balanceService = {
      getBalance: jest.fn().mockResolvedValue(BALANCE),
      invalidate: jest.fn(),
      scheduleRefresh: jest.fn(),
      addRefreshListener: jest.fn(() => unsubscribe),
    };
    handler = new MessageHandler(
      postMessage,
      mockSecretStorage as never,
      mockLogger as never,
      balanceService as never
    );
  });

  describe('constructor', () => {
    it('should initialize and register routes', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MessageHandler initialized with routes',
        expect.arrayContaining([MessageType.REQUEST_OPENROUTER_BALANCE])
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

  describe('OpenRouter balance', () => {
    it('routes REQUEST_OPENROUTER_BALANCE to the shared service, honoring forceRefresh', async () => {
      await handler.handleMessage(createEnvelope(
        MessageType.REQUEST_OPENROUTER_BALANCE,
        'webview.account',
        { forceRefresh: true },
        'corr-9'
      ));

      expect(balanceService.getBalance).toHaveBeenCalledWith(true);
      expect(balancePosts()).toEqual([expect.objectContaining({
        source: 'extension.account',
        payload: BALANCE,
        correlationId: 'corr-9',
      })]);
    });

    it.each([
      MessageType.IMAGE_GENERATION_RESPONSE,
      MessageType.SVG_GENERATION_RESPONSE,
      MessageType.ENHANCE_PROMPT_RESPONSE,
      MessageType.AI_CONVERSATION_RESPONSE,
    ])('arms the post-request refresh when a handler posts %s', (type) => {
      const message = createEnvelope(type, 'extension.imageGeneration', {});

      domainPostMessage()(message);

      expect(postMessage).toHaveBeenCalledWith(message);
      expect(balanceService.scheduleRefresh).toHaveBeenCalledTimes(1);
    });

    it.each([
      MessageType.STATUS,
      MessageType.ERROR,
      MessageType.IMAGE_SAVE_RESULT,
      MessageType.TOKEN_USAGE_UPDATE,
    ])('does not arm a refresh for non-terminal %s', (type) => {
      domainPostMessage()(createEnvelope(type, 'extension.imageGeneration', {}));

      expect(balanceService.scheduleRefresh).not.toHaveBeenCalled();
    });

    it('does not depend on usage being reported to refresh', () => {
      handler.applyTokenUsage({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });

      expect(balanceService.scheduleRefresh).not.toHaveBeenCalled();
    });

    it('re-fetches for the new key after the API key is saved, replaced or cleared', async () => {
      onSecretsChanged()();
      await flushPromises();

      expect(balanceService.invalidate).toHaveBeenCalledTimes(1);
      expect(balanceService.getBalance).toHaveBeenCalledWith(true);
      expect(balancePosts()).toEqual([expect.objectContaining({ payload: BALANCE })]);
    });

    it('posts scheduled refreshes to its webview until disposed', () => {
      const listener = balanceService.addRefreshListener.mock.calls[0][0] as
        (payload: OpenRouterBalancePayload) => void;

      listener(BALANCE);
      expect(balancePosts()).toEqual([expect.objectContaining({ payload: BALANCE })]);

      handler.dispose();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
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
            lastRequest: usage1,
            requestedAt: expect.any(Number),
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
            lastRequest: usage2,
            requestedAt: expect.any(Number),
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
            lastRequest: partialUsage,
            requestedAt: expect.any(Number),
          },
        })
      );
    });
  });

});
