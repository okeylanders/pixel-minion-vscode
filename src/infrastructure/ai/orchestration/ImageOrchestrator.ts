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
 * Pixel deltas from Frame: a failed turn also restores the turn number and the
 * last images (P2), not only the messages and seed. A Single Shot thread keeps
 * only what its next request uses (the latest images and seed), not its
 * turns, and a follow-up carries a turn count and (Single Shot) those latest
 * images instead of the whole display history; `continueConversation` takes
 * them as one options object.
 */
import {
  ImageGenerationClient,
  ImageGenerationResult,
} from '../clients/ImageGenerationClient';
import { TokenUsage, ImageGenerationMode, ImageThreadSettings, AspectRatio, ImageResolution } from '@messages';
import { ImageTranscriptTooLargeError, isImageConversationId, type ImageConversationStore } from './ImageConversationStore';
import { imageRouteCapabilities } from '../../../shared/models';
import { ImageConversationManager, RehydrationImage } from './ImageConversationManager';
import { LoggingService } from '@logging';

export interface ImageGenerationOptions {
  mode: ImageGenerationMode;
  model: string;
  aspectRatio: string;
  resolution?: string;
  seed?: number;
  referenceImages?: string[];
  referenceSvgText?: string;
}

/** A follow-up: the thread's mode and what the webview knows about the thread. */
export interface ImageContinuationOptions {
  /** The thread's mode; a follow-up can't change it. */
  mode: ImageGenerationMode;
  /**
   * Turns in the visible thread. A Conversation must have as many (a restored
   * transcript that disagrees is refused); a restarted Single Shot thread
   * numbers its next turn from it.
   */
  turnCount: number;
  /** Single Shot: the latest turn's images, to restart the thread after a host restart. */
  latestImages?: RehydrationImage[];
  /** The thread's settings; a follow-up that names different ones is refused. */
  model?: string;
  aspectRatio?: string;
  resolution?: string;
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

    if (options.mode !== 'conversation' && options.mode !== 'edit') throw new Error('Unknown image generation mode');
    // An id the caller sends must name a live thread; only the host creates ids.
    if (conversationId && !this.conversationManager.get(conversationId)) throw new Error('Image thread is unavailable. Start a new thread.');

    if (options.mode === 'conversation' && !imageRouteCapabilities(options.model, 'conversation')) {
      throw new Error('This model has no verified Conversation route. Choose another model or use Single Shot.');
    }

    // Get or create conversation
    const conversation = this.conversationManager.getOrCreate(
      conversationId,
      options.model,
      options.aspectRatio,
      options.resolution === 'auto' ? undefined : options.resolution,
      options.mode
    );
    if (conversation.mode !== options.mode || conversation.model !== options.model ||
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
      // A Single Shot request sends only the new prompt and the latest
      // images, so earlier turns are never needed again; lastImages and
      // lastSeed carry the latest. (Nothing below can fail the turn.)
      if (conversation.mode === 'edit') conversation.messages.length = 0;
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
   * Continue an existing thread. After a host restart a Conversation restores
   * its saved transcript and a Single Shot thread restarts from the latest
   * images the webview sends. A follow-up carries only its prompt: references
   * and attachments stay with the turns that sent them.
   */
  async continueConversation(
    conversationId: string,
    prompt: string,
    options: ImageContinuationOptions
  ): Promise<ImageTurnResult> {
    const { mode, turnCount, latestImages, model, aspectRatio, resolution } = options;
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

    // A Single Shot thread the host lost restarts from its latest images.
    if (!conversation && mode === 'edit' && latestImages?.length && model && aspectRatio &&
        Number.isInteger(turnCount) && turnCount > 0) {
      this.logger.info(`Re-hydrating Single Shot thread ${conversationId} at turn ${turnCount}`);
      conversation = this.conversationManager.rehydrate(conversationId, model, aspectRatio, latestImages, turnCount, resolution === 'auto' ? undefined : resolution);
    }

    if (!conversation) {
      throw new Error(`Image thread ${conversationId} is unavailable and nothing was sent to restart it. Start a new thread.`);
    }
    if (mode === 'conversation' && conversation.turnNumber !== turnCount) throw new Error('Saved conversation and visible history differ. Start a new conversation from an image.');
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
