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
  EnhancePromptRequestPayload,
  RequestOpenRouterBalancePayload,
  TokenUsage,
  TokenUsageUpdatePayload,
  createEnvelope,
  SettingsPayload,
  ErrorPayload,
} from '@messages';
import { MessageRouter } from './MessageRouter';
import {
  HelloWorldHandler,
  SettingsHandler,
  TextHandler,
  ImageGenerationHandler,
  SVGGenerationHandler,
  EnhanceHandler,
  AccountBalanceHandler,
} from './domain';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';
import {
  ImageOrchestrator,
  OpenRouterDynamicTextClient,
  OpenRouterImageSVGClient,
  SVGOrchestrator,
} from '@ai';
import { AccountBalanceService } from '../../infrastructure/account';

/**
 * Outgoing message types that end an OpenRouter request that may have spent
 * credits. Posting one arms the shared service's trailing balance refresh, so
 * any handler that answers a generation participates without extra wiring.
 * Deliberately excluded: ERROR (failed requests are normally not billed; the
 * cache TTL or a manual refresh covers the exception), STATUS progress
 * updates, and file-save results (no spend). MessageHandler.test.ts fails if
 * a `*_RESPONSE` message type is missing from this set.
 */
const TERMINAL_AI_RESPONSE_TYPES: ReadonlySet<MessageType> = new Set([
  MessageType.IMAGE_GENERATION_RESPONSE,
  MessageType.SVG_GENERATION_RESPONSE,
  MessageType.ENHANCE_PROMPT_RESPONSE,
  MessageType.AI_CONVERSATION_RESPONSE,
]);

export class MessageHandler {
  private readonly router: MessageRouter;
  private readonly helloWorldHandler: HelloWorldHandler;
  private readonly settingsHandler: SettingsHandler;
  private readonly textHandler: TextHandler;
  private readonly imageGenerationHandler: ImageGenerationHandler;
  private readonly svgGenerationHandler: SVGGenerationHandler;
  private readonly enhanceHandler: EnhanceHandler;
  private readonly accountBalanceHandler: AccountBalanceHandler;
  private readonly unsubscribeBalanceRefresh: () => void;

  /**
   * Posts to this handler's webview and, for terminal AI responses, schedules
   * the balance refresh. Every domain handler receives this wrapped function.
   */
  private readonly postMessage: (message: MessageEnvelope) => void;

  constructor(
    postToWebview: (message: MessageEnvelope) => void,
    secretStorage: SecretStorageService,
    private readonly logger: LoggingService,
    private readonly accountBalanceService: AccountBalanceService,
    /**
     * The extension's one image orchestrator (built in extension.ts, like the
     * balance service). Its thread map and in-flight registry must outlive
     * this handler: a re-resolved view gets a new MessageHandler, and a clear
     * from it must still see a turn the previous view started.
     */
    imageOrchestrator: ImageOrchestrator
  ) {
    const postMessage = (message: MessageEnvelope): void => {
      postToWebview(message);
      if (TERMINAL_AI_RESPONSE_TYPES.has(message.type)) {
        this.accountBalanceService.scheduleRefresh();
      }
    };
    this.postMessage = postMessage;
    this.router = new MessageRouter();

    // Initialize domain handlers with token usage callback
    this.helloWorldHandler = new HelloWorldHandler(postMessage, logger);
    this.textHandler = new TextHandler(
      postMessage,
      secretStorage,
      logger,
      (usage) => this.applyTokenUsage(usage)
    );
    this.settingsHandler = new SettingsHandler(
      postMessage,
      secretStorage,
      logger,
      (settings) => this.handleSettingsChanged(settings),
      () => this.resetClients()
    );
    this.imageGenerationHandler = new ImageGenerationHandler(
      postMessage,
      imageOrchestrator,
      logger,
      (usage) => this.applyTokenUsage(usage)
    );

    // Create SVG generation orchestrator and inject both text and vector-image clients
    const svgOrchestrator = new SVGOrchestrator(logger);
    svgOrchestrator.setClient(new OpenRouterDynamicTextClient(secretStorage, logger));
    svgOrchestrator.setVectorImageClient(new OpenRouterImageSVGClient(secretStorage, logger));
    this.svgGenerationHandler = new SVGGenerationHandler(
      postMessage,
      svgOrchestrator,
      logger,
      (usage) => this.applyTokenUsage(usage)
    );

    // Create enhance handler for prompt enhancement
    this.enhanceHandler = new EnhanceHandler(
      postMessage,
      secretStorage,
      logger,
      (usage) => this.applyTokenUsage(usage)
    );
    this.accountBalanceHandler = new AccountBalanceHandler(
      postMessage,
      accountBalanceService,
      logger
    );
    this.unsubscribeBalanceRefresh = accountBalanceService.addRefreshListener(
      (balance) => this.accountBalanceHandler.postBalance(balance)
    );

    // Register routes
    this.registerRoutes();
    this.logger.info('MessageHandler initialized with routes', this.router.getRegisteredTypes());
  }

  /**
   * Report a completed AI request's usage to the webview (the balance card's
   * "Last request" row). The balance refresh is armed separately, by the
   * terminal response type (TERMINAL_AI_RESPONSE_TYPES).
   */
  applyTokenUsage(usage: TokenUsage): void {
    try {
      this.logger.debug('Token usage reported', usage);
      this.postMessage(createEnvelope<TokenUsageUpdatePayload>(
        MessageType.TOKEN_USAGE_UPDATE,
        'extension.settings',
        { lastRequest: { ...usage }, requestedAt: Date.now() }
      ));
    } catch (error) {
      this.logger.error('Failed to report token usage', error);
    }
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

    // Text conversation domain
    this.router.register(
      MessageType.AI_CONVERSATION_REQUEST,
      (msg) => this.textHandler.handleConversationRequest(
        msg as MessageEnvelope<AIConversationRequestPayload>
      )
    );
    this.router.register(
      MessageType.AI_CONVERSATION_CLEAR,
      (msg) => this.textHandler.handleClearConversation(
        msg as MessageEnvelope<{ conversationId: string }>
      )
    );

    // OpenRouter account balance
    this.router.register(
      MessageType.REQUEST_OPENROUTER_BALANCE,
      (msg) => this.accountBalanceHandler.handleRequest(
        msg as MessageEnvelope<RequestOpenRouterBalancePayload | undefined>
      )
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

    // Prompt Enhancement domain
    this.router.register(
      MessageType.ENHANCE_PROMPT_REQUEST,
      (msg) => this.enhanceHandler.handleEnhanceRequest(
        msg as MessageEnvelope<EnhancePromptRequestPayload>
      )
    );
  }

  /**
   * Handle an incoming message
   */
  async handleMessage(message: MessageEnvelope): Promise<void> {
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
      this.logger.warn('Ignoring a webview message that is not a message envelope');
      return;
    }

    // Ignore messages from extension (echo prevention)
    if (message.source?.startsWith('extension.')) {
      return;
    }

    this.logger.debug(`Handling message: ${message.type}`);
    try {
      const handled = await this.router.route(message);
      if (!handled) {
        this.logger.warn(`No handler registered for message type: ${message.type}`);
      }
    } catch (error) {
      // Domain handlers answer their own failures, but a throw outside their
      // try (e.g. a malformed payload) would otherwise leave the request's
      // spinner running forever. Answer it with an error carrying the
      // request's id; if the handler already answered, the webview treats
      // this one as stale and drops it.
      this.logger.error(`Unhandled error while handling ${message.type}`, error);
      this.postMessage(createEnvelope<ErrorPayload>(
        MessageType.ERROR,
        'extension.router',
        {
          message: 'Pixel Minion could not handle this request. See the Pixel Minion output log for details.',
          code: 'UNHANDLED_ERROR',
        },
        message.correlationId
      ));
    }
  }

  /**
   * React to configuration changes (invoked by WebviewViewProvider)
   */
  handleConfigurationChanged(): void {
    const settings = this.settingsHandler.getCurrentSettings();
    this.handleSettingsChanged(settings);
    this.postMessage(createEnvelope<SettingsPayload>(
      MessageType.SETTINGS_DATA,
      'extension.settings',
      settings
    ));
  }

  private handleSettingsChanged(settings: SettingsPayload): void {
    this.textHandler.updateMaxTurns(settings.maxConversationTurns);
    // Reset text client so model changes take effect on next request
    this.textHandler.resetClient();
    // Forward selected models to orchestrators if needed in future
  }

  /** Called when the API key is saved, replaced or cleared. */
  private resetClients(): void {
    this.textHandler.resetClient();
    void this.accountBalanceHandler.handleApiKeyChanged();
  }

  /** The webview went away: stop receiving scheduled balance refreshes. */
  dispose(): void {
    this.unsubscribeBalanceRefresh();
  }
}
