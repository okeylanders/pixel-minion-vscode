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
  accountEpoch: 0,
  fetchedAt: 1_700_000_000_000,
};

describe('MessageHandler', () => {
  let postMessage: jest.Mock;
  let handler: MessageHandler;
  let unsubscribe: jest.Mock;
  let balanceService: {
    getBalance: jest.Mock;
    invalidate: jest.Mock;
    accountEpoch: jest.Mock;
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
      accountEpoch: jest.fn().mockReturnValue(0),
      scheduleRefresh: jest.fn(),
      addRefreshListener: jest.fn(() => unsubscribe),
    };
    handler = new MessageHandler(
      postMessage,
      mockSecretStorage as never,
      mockLogger as never,
      balanceService as never,
      {} as never // image orchestrator: ImageGenerationHandler is mocked
    );
  });

  describe('constructor', () => {
    it('should initialize and register routes', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MessageHandler initialized with routes',
        expect.arrayContaining([MessageType.REQUEST_OPENROUTER_BALANCE])
      );
    });

    it('posts nothing until something happens', () => {
      expect(postMessage).not.toHaveBeenCalled();
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

    it('treats every *_RESPONSE type as terminal, so a new AI response cannot silently skip the refresh', () => {
      const responseTypes = Object.values(MessageType).filter((type) => type.endsWith('_RESPONSE'));
      expect(responseTypes.length).toBeGreaterThan(0);

      for (const type of responseTypes) {
        balanceService.scheduleRefresh.mockClear();
        domainPostMessage()(createEnvelope(type, 'extension.imageGeneration', {}));
        expect({ type, armed: balanceService.scheduleRefresh.mock.calls.length })
          .toEqual({ type, armed: 1 });
      }
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

    it('clears the old figures, then re-fetches for the new key, after the key is saved, replaced or cleared', async () => {
      balanceService.accountEpoch.mockReturnValue(1);
      onSecretsChanged()();
      await flushPromises();

      expect(balanceService.invalidate).toHaveBeenCalledTimes(1);
      expect(balanceService.getBalance).toHaveBeenCalledWith(true);
      const posted = postMessage.mock.calls.map(([message]) => message as MessageEnvelope);
      expect(posted.map((message) => message.type)).toEqual([
        MessageType.OPENROUTER_BALANCE_RESET,
        MessageType.OPENROUTER_BALANCE_DATA,
      ]);
      expect(posted[0].payload).toEqual({ accountEpoch: 1 });
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
    it('reports each request\'s usage as the last request, without session totals', () => {
      const usage: TokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costUsd: 0.01,
      };

      handler.applyTokenUsage(usage);

      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenCalledWith({
        type: MessageType.TOKEN_USAGE_UPDATE,
        source: 'extension.settings',
        payload: { lastRequest: usage, requestedAt: expect.any(Number) },
        timestamp: expect.any(Number),
      });
    });

    it('replaces rather than accumulates across requests', () => {
      handler.applyTokenUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150, costUsd: 0.01 });
      postMessage.mockClear();
      const second: TokenUsage = { promptTokens: 200, completionTokens: 0, totalTokens: 200 };

      handler.applyTokenUsage(second);

      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        payload: { lastRequest: second, requestedAt: expect.any(Number) },
      }));
    });
  });
});
