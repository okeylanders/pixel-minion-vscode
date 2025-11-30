/**
 * TextHandler - Handles text conversation messages
 *
 * Pattern: Domain handler with text orchestration integration
 */
import * as vscode from 'vscode';
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  AIConversationRequestPayload,
  AIConversationResponsePayload,
  StatusPayload,
  TokenUsage,
} from '@messages';
import { TextOrchestrator, OpenRouterTextClient } from '@ai';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';

export class TextHandler {
  private readonly orchestrator: TextOrchestrator;
  private readonly configSection = 'pixelMinion';
  private readonly defaultSystemPrompt = 'You are a helpful assistant integrated into a VSCode extension. Help users with their coding tasks.';
  private currentModel?: string;

  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService,
    private readonly applyTokenUsageCallback?: (usage: TokenUsage) => void
  ) {
    const config = vscode.workspace.getConfiguration(this.configSection);
    const maxTurns = config.get<number>('maxConversationTurns', 10);

    this.orchestrator = new TextOrchestrator({
      maxTurns,
      systemPrompt: this.defaultSystemPrompt,
    });
    this.logger.debug(`TextHandler initialized with maxTurns: ${maxTurns}`);
  }

  /**
   * Handle text conversation request
   */
  async handleConversationRequest(message: MessageEnvelope<AIConversationRequestPayload>): Promise<void> {
    const { message: userMessage, conversationId, history, model, systemPrompt } = message.payload;
    this.logger.info(`Text conversation request: ${userMessage.substring(0, 50)}...`);

    // Send loading status
    this.postMessage(createEnvelope<StatusPayload>(
      MessageType.STATUS,
      'extension.ai',
      { message: 'Processing...', isLoading: true },
      message.correlationId
    ));

    try {
      // Ensure client is configured
      await this.ensureClientConfigured(model);

      // Get or create conversation
      let activeConversationId = conversationId;
      if (conversationId) {
        if (!this.orchestrator.hasConversation(conversationId)) {
          if (history?.length) {
            this.logger.info(`Rehydrating text conversation ${conversationId} from history (${history.length} turns)`);
            this.orchestrator.rehydrateConversation(conversationId, history, systemPrompt ?? this.defaultSystemPrompt);
          } else {
            this.logger.warn(`Conversation ${conversationId} missing; starting new conversation`);
            activeConversationId = this.orchestrator.startConversation(systemPrompt ?? this.defaultSystemPrompt);
          }
        }
      } else {
        activeConversationId = this.orchestrator.startConversation(systemPrompt ?? this.defaultSystemPrompt);
      }

      if (!activeConversationId) {
        throw new Error('Failed to initialize conversation');
      }
      this.logger.debug(`Using conversation: ${activeConversationId}`);

      // Send the message
      const result = await this.orchestrator.sendMessage(activeConversationId, userMessage);
      this.logger.info(`Text response received (turn ${result.turnNumber})`);

      // Send response
      this.postMessage(createEnvelope<AIConversationResponsePayload>(
        MessageType.AI_CONVERSATION_RESPONSE,
        'extension.ai',
        {
          response: result.response,
          conversationId: result.conversationId,
          turnNumber: result.turnNumber,
          isComplete: result.isComplete,
        },
        message.correlationId
      ));

      if (result.usage) {
        this.applyTokenUsage(result.usage);
      }
    } catch (error) {
      this.logger.error('Text request failed', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.ai',
        {
          message: error instanceof Error ? error.message : 'Text request failed',
          code: 'TEXT_REQUEST_ERROR',
        },
        message.correlationId
      ));
    } finally {
      // Clear loading status
      this.postMessage(createEnvelope<StatusPayload>(
        MessageType.STATUS,
        'extension.ai',
        { message: '', isLoading: false },
        message.correlationId
      ));
    }
  }

  /**
   * Handle conversation clear request
   */
  handleClearConversation(message: MessageEnvelope<{ conversationId: string }>): void {
    const { conversationId } = message.payload;
    this.logger.info(`Clearing conversation: ${conversationId}`);
    this.orchestrator.clearConversation(conversationId);
  }

  /**
   * Ensure the text client is configured with API key
   */
  private async ensureClientConfigured(requestedModel?: string): Promise<void> {
    if (this.orchestrator.hasClient() && (!requestedModel || requestedModel === this.currentModel)) {
      return;
    }

    this.logger.debug('Configuring text client...');
    const apiKey = await this.secretStorage.getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
    }

    const config = vscode.workspace.getConfiguration(this.configSection);
    const legacyConfig = vscode.workspace.getConfiguration('templateExtension');
    const model = requestedModel ?? config.get<string>('openRouterModel', legacyConfig.get('openRouterModel', 'anthropic/claude-sonnet-4'));

    const client = new OpenRouterTextClient(apiKey, model);
    this.orchestrator.setClient(client);
    this.currentModel = model;
    this.logger.info(`Text client configured with model: ${model}`);
  }

  /**
   * Update max turns from settings
   */
  updateMaxTurns(maxTurns: number): void {
    this.logger.info(`Updating max turns to: ${maxTurns}`);
    this.orchestrator.setMaxTurns(maxTurns);
  }

  /**
   * Reset client (e.g., when API key changes)
   */
  resetClient(): void {
    this.logger.info('Resetting text client');
    this.currentModel = undefined;
    this.orchestrator.setClient(null as unknown as never); // Force re-initialization on next request
  }

  /**
   * Report token usage to the central accumulator
   */
  private applyTokenUsage(usage: TokenUsage): void {
    if (this.applyTokenUsageCallback) {
      this.applyTokenUsageCallback(usage);
    }
  }
}
