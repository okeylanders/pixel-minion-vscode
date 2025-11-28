/**
 * AIHandler - Handles AI conversation messages
 *
 * Pattern: Domain handler with AI orchestration integration
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
import { AIOrchestrator, OpenRouterClient } from '@ai';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';

export class AIHandler {
  private readonly orchestrator: AIOrchestrator;
  private readonly configSection = 'templateExtension';

  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService,
    private readonly applyTokenUsageCallback?: (usage: TokenUsage) => void
  ) {
    const config = vscode.workspace.getConfiguration(this.configSection);
    const maxTurns = config.get<number>('maxConversationTurns', 10);

    this.orchestrator = new AIOrchestrator({
      maxTurns,
      systemPrompt: 'You are a helpful assistant integrated into a VSCode extension. Help users with their coding tasks.',
    });
    this.logger.debug(`AIHandler initialized with maxTurns: ${maxTurns}`);
  }

  /**
   * Handle AI conversation request
   */
  async handleConversationRequest(message: MessageEnvelope<AIConversationRequestPayload>): Promise<void> {
    const { message: userMessage, conversationId } = message.payload;
    this.logger.info(`AI conversation request: ${userMessage.substring(0, 50)}...`);

    // Send loading status
    this.postMessage(createEnvelope<StatusPayload>(
      MessageType.STATUS,
      'extension.ai',
      { message: 'Processing...', isLoading: true },
      message.correlationId
    ));

    try {
      // Ensure client is configured
      await this.ensureClientConfigured();

      // Get or create conversation
      const activeConversationId = conversationId ?? this.orchestrator.startConversation();
      this.logger.debug(`Using conversation: ${activeConversationId}`);

      // Send the message
      const result = await this.orchestrator.sendMessage(activeConversationId, userMessage);
      this.logger.info(`AI response received (turn ${result.turnNumber})`);

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
    } catch (error) {
      this.logger.error('AI request failed', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.ai',
        {
          message: error instanceof Error ? error.message : 'AI request failed',
          code: 'AI_REQUEST_ERROR',
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
   * Ensure the AI client is configured with API key
   */
  private async ensureClientConfigured(): Promise<void> {
    if (this.orchestrator.hasClient()) {
      return;
    }

    this.logger.debug('Configuring AI client...');
    const apiKey = await this.secretStorage.getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
    }

    const config = vscode.workspace.getConfiguration(this.configSection);
    const model = config.get<string>('openRouterModel', 'anthropic/claude-sonnet-4');

    const client = new OpenRouterClient(apiKey, model);
    this.orchestrator.setClient(client);
    this.logger.info(`AI client configured with model: ${model}`);
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
    this.logger.info('Resetting AI client');
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
