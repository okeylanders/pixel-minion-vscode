/**
 * TextHandler tests
 *
 * Tests text conversation handling and orchestration
 */
import { TextHandler } from '../../../../application/handlers/domain/TextHandler';
import {
  MessageType,
  createEnvelope,
  AIConversationRequestPayload,
  TokenUsage,
} from '@messages';
import * as vscode from 'vscode';

// Mock the AI infrastructure - must match alias used in source
jest.mock('@ai', () => ({
  TextOrchestrator: jest.fn().mockImplementation(() => ({
    hasClient: jest.fn().mockReturnValue(false),
    hasConversation: jest.fn().mockReturnValue(false),
    setClient: jest.fn(),
    startConversation: jest.fn().mockReturnValue('conv-123'),
    rehydrateConversation: jest.fn(),
    sendMessage: jest.fn().mockResolvedValue({
      response: 'Text response',
      conversationId: 'conv-123',
      turnNumber: 1,
      isComplete: false,
    }),
    clearConversation: jest.fn(),
    setMaxTurns: jest.fn(),
  })),
  OpenRouterTextClient: jest.fn().mockImplementation(() => ({})),
}));

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
};

// Mock vscode.workspace.getConfiguration
const mockConfig = {
  get: jest.fn((key: string, defaultValue: unknown) => {
    const settings: Record<string, unknown> = {
      maxConversationTurns: 10,
      openRouterModel: 'anthropic/claude-sonnet-4',
    };
    return settings[key] ?? defaultValue;
  }),
};

describe('TextHandler', () => {
  let postMessage: jest.Mock;
  let applyTokenUsageCallback: jest.Mock;
  let handler: TextHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    postMessage = jest.fn();
    applyTokenUsageCallback = jest.fn();

    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

    handler = new TextHandler(
      postMessage,
      mockSecretStorage as never,
      mockLogger as never,
      applyTokenUsageCallback
    );
  });

  describe('constructor', () => {
    it('should initialize with config values', () => {
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('TextHandler initialized with maxTurns: 10')
      );
    });
  });

  describe('handleConversationRequest', () => {
    beforeEach(() => {
      mockSecretStorage.getApiKey.mockResolvedValue('sk-test-key');
    });

    it('should send loading status before processing', async () => {
      const message = createEnvelope<AIConversationRequestPayload>(
        MessageType.AI_CONVERSATION_REQUEST,
        'webview.ai',
        { message: 'Hello', conversationId: 'conv-123' },
        'correlation-123'
      );

      await handler.handleConversationRequest(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.STATUS,
          payload: { message: 'Processing...', isLoading: true },
        })
      );
    });

    it('should send text response on success', async () => {
      const message = createEnvelope<AIConversationRequestPayload>(
        MessageType.AI_CONVERSATION_REQUEST,
        'webview.ai',
        { message: 'Hello', conversationId: 'conv-123' },
        'correlation-456'
      );

      await handler.handleConversationRequest(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.AI_CONVERSATION_RESPONSE,
          source: 'extension.ai',
          payload: {
            response: 'Text response',
            conversationId: 'conv-123',
            turnNumber: 1,
            isComplete: false,
          },
          correlationId: 'correlation-456',
        })
      );
    });

    it('should clear loading status after processing', async () => {
      const message = createEnvelope<AIConversationRequestPayload>(
        MessageType.AI_CONVERSATION_REQUEST,
        'webview.ai',
        { message: 'Hello' }
      );

      await handler.handleConversationRequest(message);

      // Check that the last STATUS message clears loading
      const statusCalls = postMessage.mock.calls.filter(
        (call) => call[0].type === MessageType.STATUS
      );
      const lastStatusCall = statusCalls[statusCalls.length - 1];

      expect(lastStatusCall[0].payload).toEqual({
        message: '',
        isLoading: false,
      });
    });

    it('should handle missing API key', async () => {
      mockSecretStorage.getApiKey.mockResolvedValue(undefined);

      const message = createEnvelope<AIConversationRequestPayload>(
        MessageType.AI_CONVERSATION_REQUEST,
        'webview.ai',
        { message: 'Hello' },
        'correlation-789'
      );

      await handler.handleConversationRequest(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: {
            message: expect.stringContaining('API key not configured'),
            code: 'TEXT_REQUEST_ERROR',
          },
          correlationId: 'correlation-789',
        })
      );
    });

    it('should start new conversation when no conversationId provided', async () => {
      const { TextOrchestrator } = require('@ai');
      const mockOrchestrator = TextOrchestrator.mock.results[0].value;

      const message = createEnvelope<AIConversationRequestPayload>(
        MessageType.AI_CONVERSATION_REQUEST,
        'webview.ai',
        { message: 'Hello' }
      );

      await handler.handleConversationRequest(message);

      expect(mockOrchestrator.startConversation).toHaveBeenCalled();
    });

    it('rehydrates missing conversation when history provided', async () => {
      const { TextOrchestrator } = require('@ai');
      const mockOrchestrator = TextOrchestrator.mock.results[0].value;
      mockOrchestrator.hasConversation.mockReturnValue(false);

      const message = createEnvelope<AIConversationRequestPayload>(
        MessageType.AI_CONVERSATION_REQUEST,
        'webview.ai',
        {
          message: 'Continue',
          conversationId: 'conv-999',
          history: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }],
        }
      );

      await handler.handleConversationRequest(message);

      expect(mockOrchestrator.rehydrateConversation).toHaveBeenCalledWith(
        'conv-999',
        expect.any(Array),
        expect.any(String)
      );
    });
  });

  describe('handleClearConversation', () => {
    it('should clear the specified conversation', () => {
      const { TextOrchestrator } = require('@ai');
      const mockOrchestrator = TextOrchestrator.mock.results[0].value;

      const message = createEnvelope(
        MessageType.AI_CONVERSATION_CLEAR,
        'webview.ai',
        { conversationId: 'conv-to-clear' }
      );

      handler.handleClearConversation(message as never);

      expect(mockOrchestrator.clearConversation).toHaveBeenCalledWith('conv-to-clear');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Clearing conversation: conv-to-clear'
      );
    });
  });

  describe('updateMaxTurns', () => {
    it('should update max turns on orchestrator', () => {
      const { TextOrchestrator } = require('@ai');
      const mockOrchestrator = TextOrchestrator.mock.results[0].value;

      handler.updateMaxTurns(25);

      expect(mockOrchestrator.setMaxTurns).toHaveBeenCalledWith(25);
      expect(mockLogger.info).toHaveBeenCalledWith('Updating max turns to: 25');
    });
  });

  describe('resetClient', () => {
    it('should reset the text client', () => {
      const { TextOrchestrator } = require('@ai');
      const mockOrchestrator = TextOrchestrator.mock.results[0].value;

      handler.resetClient();

      expect(mockOrchestrator.setClient).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Resetting text client');
    });
  });
});
