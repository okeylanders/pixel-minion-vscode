/**
 * MessageHandler - Main message dispatcher
 *
 * Pattern: Facade + Strategy - routes messages to domain handlers
 * Responsibilities:
 * - Receives all messages from webview
 * - Routes to appropriate domain handler using MessageRouter
 * - Coordinates between handlers
 *
 * Reference: docs/example-repo/src/application/handlers/MessageHandler.ts
 */
import {
  MessageType,
  MessageEnvelope,
  HelloWorldRequestPayload,
  UpdateSettingPayload,
  SaveApiKeyPayload,
  AIConversationRequestPayload,
  ImageGenerationRequestPayload,
  ImageGenerationContinuePayload,
  ImageSaveRequestPayload,
  SVGGenerationRequestPayload,
  SVGGenerationContinuePayload,
  SVGSaveRequestPayload,
  TokenUsage,
  TokenUsageUpdatePayload,
  createEnvelope,
} from '@messages';
import { MessageRouter } from './MessageRouter';
import { HelloWorldHandler, SettingsHandler, AIHandler, ImageGenerationHandler, SVGGenerationHandler } from './domain';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';
import { OpenRouterImageClient, ImageOrchestrator } from '@ai';

export class MessageHandler {
  private readonly router: MessageRouter;
  private readonly helloWorldHandler: HelloWorldHandler;
  private readonly settingsHandler: SettingsHandler;
  private readonly aiHandler: AIHandler;
  private readonly imageGenerationHandler: ImageGenerationHandler;
  private readonly svgGenerationHandler: SVGGenerationHandler;

  // Token usage accumulator - tracks total usage across the session
  private tokenTotals: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
  };

  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    secretStorage: SecretStorageService,
    private readonly logger: LoggingService
  ) {
    this.router = new MessageRouter();

    // Initialize domain handlers with token usage callback
    this.helloWorldHandler = new HelloWorldHandler(postMessage, logger);
    this.settingsHandler = new SettingsHandler(postMessage, secretStorage, logger);
    this.aiHandler = new AIHandler(
      postMessage,
      secretStorage,
      logger,
      (usage) => this.applyTokenUsage(usage)
    );
    // Create image generation orchestrator and inject client
    const imageOrchestrator = new ImageOrchestrator(logger);
    imageOrchestrator.setClient(new OpenRouterImageClient(secretStorage, logger));
    this.imageGenerationHandler = new ImageGenerationHandler(
      postMessage,
      imageOrchestrator,
      logger
    );
    this.svgGenerationHandler = new SVGGenerationHandler(
      postMessage,
      secretStorage,
      logger
    );

    // Register routes
    this.registerRoutes();
    this.logger.info('MessageHandler initialized with routes', this.router.getRegisteredTypes());

    // Send initial token usage (zeros) to webview
    this.broadcastTokenUsage();
  }

  /**
   * Apply token usage from an AI operation - accumulates to session totals
   */
  applyTokenUsage(usage: TokenUsage): void {
    try {
      // Add to running totals
      this.tokenTotals.promptTokens += usage.promptTokens || 0;
      this.tokenTotals.completionTokens += usage.completionTokens || 0;
      this.tokenTotals.totalTokens += usage.totalTokens || 0;

      // Accumulate cost if available
      if (typeof usage.costUsd === 'number') {
        this.tokenTotals.costUsd = (this.tokenTotals.costUsd || 0) + usage.costUsd;
      }

      this.logger.debug('Token usage applied', this.tokenTotals);
      this.broadcastTokenUsage();
    } catch (error) {
      this.logger.error('Failed to apply token usage update', error);
    }
  }

  /**
   * Reset token usage to zero
   */
  private resetTokenUsage(): void {
    this.tokenTotals = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
    };
    this.logger.info('Token usage reset');
    this.broadcastTokenUsage();
  }

  /**
   * Broadcast current token totals to webview
   */
  private broadcastTokenUsage(): void {
    const message = createEnvelope<TokenUsageUpdatePayload>(
      MessageType.TOKEN_USAGE_UPDATE,
      'extension.settings',
      { totals: { ...this.tokenTotals } }
    );
    this.postMessage(message);
  }

  /**
   * Register all message routes
   */
  private registerRoutes(): void {
    // Hello World domain
    this.router.register(
      MessageType.HELLO_WORLD_REQUEST,
      (msg) => this.helloWorldHandler.handleRequest(
        msg as MessageEnvelope<HelloWorldRequestPayload>
      )
    );

    // Settings domain
    this.router.register(
      MessageType.REQUEST_SETTINGS,
      (msg) => this.settingsHandler.handleRequestSettings(msg)
    );
    this.router.register(
      MessageType.UPDATE_SETTING,
      (msg) => this.settingsHandler.handleUpdateSetting(
        msg as MessageEnvelope<UpdateSettingPayload>
      )
    );

    // API Key management (secure)
    this.router.register(
      MessageType.REQUEST_API_KEY_STATUS,
      (msg) => this.settingsHandler.handleApiKeyStatusRequest(msg)
    );
    this.router.register(
      MessageType.SAVE_API_KEY,
      (msg) => this.settingsHandler.handleSaveApiKey(
        msg as MessageEnvelope<SaveApiKeyPayload>
      )
    );
    this.router.register(
      MessageType.CLEAR_API_KEY,
      (msg) => this.settingsHandler.handleClearApiKey(msg)
    );

    // AI domain
    this.router.register(
      MessageType.AI_CONVERSATION_REQUEST,
      (msg) => this.aiHandler.handleConversationRequest(
        msg as MessageEnvelope<AIConversationRequestPayload>
      )
    );
    this.router.register(
      MessageType.AI_CONVERSATION_CLEAR,
      (msg) => this.aiHandler.handleClearConversation(
        msg as MessageEnvelope<{ conversationId: string }>
      )
    );

    // Token usage
    this.router.register(
      MessageType.RESET_TOKEN_USAGE,
      () => this.resetTokenUsage()
    );

    // Image Generation domain
    this.router.register(
      MessageType.IMAGE_GENERATION_REQUEST,
      (msg) => this.imageGenerationHandler.handleGenerationRequest(
        msg as MessageEnvelope<ImageGenerationRequestPayload>
      )
    );
    this.router.register(
      MessageType.IMAGE_GENERATION_CONTINUE,
      (msg) => this.imageGenerationHandler.handleContinueRequest(
        msg as MessageEnvelope<ImageGenerationContinuePayload>
      )
    );
    this.router.register(
      MessageType.IMAGE_GENERATION_CLEAR,
      (msg) => this.imageGenerationHandler.handleClearConversation(
        msg as MessageEnvelope<{ conversationId: string }>
      )
    );
    this.router.register(
      MessageType.IMAGE_SAVE_REQUEST,
      (msg) => this.imageGenerationHandler.handleSaveRequest(
        msg as MessageEnvelope<ImageSaveRequestPayload>
      )
    );

    // SVG Generation domain
    this.router.register(
      MessageType.SVG_GENERATION_REQUEST,
      (msg) => this.svgGenerationHandler.handleGenerationRequest(
        msg as MessageEnvelope<SVGGenerationRequestPayload>
      )
    );
    this.router.register(
      MessageType.SVG_GENERATION_CONTINUE,
      (msg) => this.svgGenerationHandler.handleContinueRequest(
        msg as MessageEnvelope<SVGGenerationContinuePayload>
      )
    );
    this.router.register(
      MessageType.SVG_GENERATION_CLEAR,
      (msg) => this.svgGenerationHandler.handleClearConversation(
        msg as MessageEnvelope<{ conversationId: string }>
      )
    );
    this.router.register(
      MessageType.SVG_SAVE_REQUEST,
      (msg) => this.svgGenerationHandler.handleSaveRequest(
        msg as MessageEnvelope<SVGSaveRequestPayload>
      )
    );
  }

  /**
   * Handle an incoming message
   */
  async handleMessage(message: MessageEnvelope): Promise<void> {
    // Ignore messages from extension (echo prevention)
    if (message.source?.startsWith('extension.')) {
      return;
    }

    this.logger.debug(`Handling message: ${message.type}`);
    const handled = await this.router.route(message);

    if (!handled) {
      this.logger.warn(`No handler registered for message type: ${message.type}`);
    }
  }
}
