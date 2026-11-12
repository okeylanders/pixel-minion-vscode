// Ported from frame-minion@40e7949 packages/core/src/infrastructure/ai/orchestration/ImageOrchestrator.ts; keep in sync
/**
 * ImageOrchestrator - Coordinates image generation without knowing which client is used
 *
 * Pattern: Dependency Injection - client is injected, orchestrator is agnostic
 * Responsibilities:
 * - Coordinates between ImageConversationManager and ImageGenerationClient
 * - Owns each thread's settings (mode, model, aspect ratio, resolution)
 * - Saves Conversation transcripts for restart recovery and restores them
 * - Handles conversation lifecycle and re-hydration
 * - Provides clean interface for handlers
 *
 * Pixel delta from Frame: a failed turn also restores the turn number and the
 * last images (P2), not only the messages and seed.
 */
import {
  ImageGenerationClient,
  ImageGenerationResult,
} from '../clients/ImageGenerationClient';
import { TokenUsage, ImageGenerationMode, ImageThreadSettings, AspectRatio, ImageResolution } from '@messages';
import { ImageTranscriptTooLargeError, isImageConversationId, type ImageConversationStore } from './ImageConversationStore';
import { imageRouteCapabilities } from '../../../shared/models';
import { ImageConversationManager, RehydrationTurn } from './ImageConversationManager';
import { LoggingService } from '@logging';

export interface ImageGenerationOptions {
  mode?: ImageGenerationMode;
  model: string;
  aspectRatio: string;
  resolution?: string;
  seed?: number;
  referenceImages?: string[];
  referenceSvgText?: string;
}

export interface ImageTurnResult {
  settings: ImageThreadSettings;
  recoveryWarning?: string;
  conversationId: string;
  result: ImageGenerationResult;
  turnNumber: number;
  aspectRatio: string;
  usage?: TokenUsage;
}

export class ImageOrchestrator {
  private readonly conversationManager: ImageConversationManager;
  private client: ImageGenerationClient | null = null;
  /** Threads with a provider request outstanding (one at a time each). */
  private readonly inFlight = new Set<string>();

  constructor(private readonly logger: LoggingService, private readonly store?: ImageConversationStore) {
    this.conversationManager = new ImageConversationManager(logger);
  }

  /**
   * Set the image generation client (dependency injection)
   */
  setClient(client: ImageGenerationClient): void {
    this.client = client;
    this.logger.debug('ImageOrchestrator client configured');
  }

  /**
   * Check if a client is configured
   */
  hasClient(): boolean {
    return this.client !== null;
  }

  /**
   * Check if client is configured with API key
   */
  async isConfigured(): Promise<boolean> {
    return this.client !== null && await this.client.isConfigured();
  }

  /**
   * Generate an image (new conversation or continue existing)
   */
  async generateImage(
    prompt: string,
    options: ImageGenerationOptions,
    conversationId?: string
  ): Promise<ImageTurnResult> {
    if (!this.client) {
      throw new Error('No image generation client configured. Call setClient() first.');
    }

    if (options.mode !== undefined && options.mode !== 'conversation' && options.mode !== 'edit') throw new Error('Unknown image generation mode');
    // Sidebar requests name a mode; an id they send must name a live thread.
    // A caller without a mode keeps the historical create-on-unseen-id rule.
    if (options.mode !== undefined && conversationId && !this.conversationManager.get(conversationId)) throw new Error('Image thread is unavailable. Start a new thread.');

    if (options.mode === 'conversation' && !imageRouteCapabilities(options.model, 'conversation')) {
      throw new Error('This model has no verified Conversation route. Choose another model or use Single Shot.');
    }

    // Get or create conversation
    const conversation = this.conversationManager.getOrCreate(
      conversationId,
      options.model,
      options.aspectRatio,
      options.resolution === 'auto' ? undefined : options.resolution,
      options.mode ?? 'edit'
    );
    if (conversation.mode !== (options.mode ?? 'edit') || conversation.model !== options.model ||
        conversation.aspectRatio !== options.aspectRatio || conversation.resolution !== (options.resolution === 'auto' ? undefined : options.resolution)) {
      throw new Error('Image thread settings cannot change. Start a new thread.');
    }
    // One provider request per thread: an overlapping continuation would
    // interleave its user message into the request already being built.
    if (this.inFlight.has(conversation.id)) throw new Error('This image thread is already generating');
    this.inFlight.add(conversation.id);
    // Everything a turn may change, so a failure anywhere in it (including
    // after the response was recorded) leaves the conversation as it was.
    const previous = {
      messageCount: conversation.messages.length,
      turnNumber: conversation.turnNumber,
      lastSeed: conversation.lastSeed,
      lastImages: conversation.lastImages,
    };
    try {
      if (!(await this.client.isConfigured())) {
        throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
      }

      // Use provided seed or generate new one
      const seed = options.seed ?? this.generateSeed();

      this.logger.debug(`Generating image for conversation ${conversation.id} (seed: ${seed})`);

      // Add user message
      this.conversationManager.addUserMessage(conversation.id, prompt, options.referenceImages, options.referenceSvgText);
      conversation.lastSeed = seed;

      // Call the client
      const result = await this.client.generateImages({
        mode: options.mode,
        messages: conversation.messages,
        model: conversation.model,
        aspectRatio: conversation.aspectRatio,
        resolution: conversation.resolution,
        seed,
      });

      // Add assistant response
      this.conversationManager.addAssistantResponse(conversation.id, result);
      let recoveryWarning: string | undefined;
      if (conversation.mode === 'conversation' && this.store) {
        try { await this.store.write(conversation); }
        catch (error) {
          this.logger.warn('Could not save image conversation for restart recovery', { conversationId: conversation.id, error: error instanceof Error ? error.message : String(error) });
          recoveryWarning = error instanceof ImageTranscriptTooLargeError
            ? 'This conversation is now too large to recover after a restart. It continues while VS Code stays open; to keep restart recovery, start a new conversation from an image.'
            : 'The image was generated, but conversation recovery could not be saved. Keep this session open or start a new conversation from an image after restarting.';
        }
      }

      this.logger.info(`Image generation complete (turn ${conversation.turnNumber})`);

      // Transform client usage to TokenUsage format
      const usage: TokenUsage | undefined = result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        costUsd: result.usage.costUsd,
      } : undefined;

      return {
        settings: { mode: conversation.mode, model: conversation.model, aspectRatio: conversation.aspectRatio as AspectRatio, resolution: (conversation.resolution ?? 'auto') as ImageResolution },
        recoveryWarning,
        conversationId: conversation.id,
        result,
        turnNumber: conversation.turnNumber,
        aspectRatio: conversation.aspectRatio,
        usage,
      };
    } catch (error) {
      // A failed turn must not enter the next request's conversation history.
      conversation.messages.splice(previous.messageCount);
      conversation.turnNumber = previous.turnNumber;
      conversation.lastSeed = previous.lastSeed;
      conversation.lastImages = previous.lastImages;
      // A conversation whose first turn failed was never shown to the user.
      if (conversation.turnNumber === 0) this.conversationManager.clear(conversation.id);
      throw error;
    } finally { this.inFlight.delete(conversation.id); }
  }

  /**
   * Continue an existing conversation with re-hydration support
   */
  async continueConversation(
    conversationId: string,
    prompt: string,
    history?: RehydrationTurn[],
    model?: string,
    aspectRatio?: string,
    resolution?: string,
    referenceSvgText?: string,
    mode: ImageGenerationMode = 'edit'
  ): Promise<ImageTurnResult> {
    let conversation = this.conversationManager.get(conversationId);
    if (!conversation && mode === 'conversation') {
      if (this.inFlight.has(conversationId)) throw new Error('This image thread is already generating');
      this.inFlight.add(conversationId);
      try {
        conversation = await this.store?.read(conversationId);
        if (!conversation) throw new Error('The original conversation transcript is unavailable. Start a new conversation from an image; display history cannot restore provider signatures.');
        this.conversationManager.restore(conversation);
      } finally {
        this.inFlight.delete(conversationId);
      }
    }

    // Re-hydrate if conversation not found but history provided
    if (!conversation && history && history.length > 0 && model && aspectRatio) {
      this.logger.info(`Re-hydrating conversation ${conversationId} from ${history.length} turns`);
      conversation = this.conversationManager.rehydrate(conversationId, model, aspectRatio, history, resolution === 'auto' ? undefined : resolution);
    }

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found and no history provided for re-hydration.`);
    }
    if (mode === 'conversation' && history && conversation.turnNumber !== history.length) throw new Error('Saved conversation and visible history differ. Start a new conversation from an image.');
    if (conversation.mode !== mode || (model && model !== conversation.model) ||
        (aspectRatio && aspectRatio !== conversation.aspectRatio) ||
        (resolution !== undefined && (resolution === 'auto' ? undefined : resolution) !== conversation.resolution)) {
      throw new Error('Image thread settings cannot change. Start a new thread.');
    }

    // Continue with existing conversation settings, reusing last seed
    return this.generateImage(prompt, {
      mode,
      model: conversation.model,
      aspectRatio: conversation.aspectRatio,
      resolution: conversation.resolution,
      seed: conversation.lastSeed,
      referenceImages: conversation.lastImages,
      referenceSvgText,
    }, conversationId);
  }

  /**
   * Clear a thread and, for a conversational one, tombstone its transcript.
   * Refused while a turn is generating: the turn would otherwise complete into
   * a thread the user already discarded.
   */
  async clearConversation(conversationId: string): Promise<void> {
    if (this.inFlight.has(conversationId)) throw new Error('Wait for image generation to finish before clearing this thread');
    this.inFlight.add(conversationId);
    try {
      const conversation = this.conversationManager.get(conversationId);
      // Only conversational threads have host transcripts. Ids that are not
      // `img-…` never name a record in this store.
      if (isImageConversationId(conversationId) && (!conversation || conversation.mode === 'conversation')) {
        await this.store?.clear(conversationId);
      }
      this.conversationManager.clear(conversationId);
    } finally {
      this.inFlight.delete(conversationId);
    }
  }

  /**
   * Clear all conversations
   */
  clearAll(): void {
    this.conversationManager.clearAll();
  }

  /**
   * Get conversation info
   */
  getConversation(conversationId: string) {
    return this.conversationManager.get(conversationId);
  }

  /**
   * Generate a random seed (0 to 2^31-1)
   */
  private generateSeed(): number {
    return Math.floor(Math.random() * 2147483647);
  }
}
