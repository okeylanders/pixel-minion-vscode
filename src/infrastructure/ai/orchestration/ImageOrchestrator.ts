/**
 * ImageOrchestrator - Coordinates image generation without knowing which client is used
 *
 * Pattern: Dependency Injection - client is injected, orchestrator is agnostic
 * Responsibilities:
 * - Coordinates between ImageConversationManager and ImageGenerationClient
 * - Handles conversation lifecycle and re-hydration
 * - Provides clean interface for handlers
 */
import {
  ImageGenerationClient,
  ImageGenerationResult,
} from '../clients/ImageGenerationClient';
import { TokenUsage } from '@messages';
import { ImageConversationManager, RehydrationTurn } from './ImageConversationManager';
import { LoggingService } from '@logging';

export interface ImageGenerationOptions {
  model: string;
  aspectRatio: string;
  seed?: number;
  referenceImages?: string[];
  referenceSvgText?: string;
}

export interface ImageTurnResult {
  conversationId: string;
  result: ImageGenerationResult;
  turnNumber: number;
  usage?: TokenUsage;
}

export class ImageOrchestrator {
  private readonly conversationManager: ImageConversationManager;
  private client: ImageGenerationClient | null = null;
  /** Conversations with a provider request outstanding (one at a time each). */
  private readonly inFlight = new Set<string>();

  constructor(private readonly logger: LoggingService) {
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

    if (!(await this.client.isConfigured())) {
      throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
    }

    // Get or create conversation
    const conversation = this.conversationManager.getOrCreate(
      conversationId,
      options.model,
      options.aspectRatio
    );

    // One provider request per conversation: an overlapping continuation would
    // interleave its user message into the request already being built.
    if (this.inFlight.has(conversation.id)) {
      throw new Error('This image conversation is already generating. Wait for it to finish.');
    }
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
      // Use provided seed or generate new one
      const seed = options.seed ?? this.generateSeed();

      this.logger.debug(`Generating image for conversation ${conversation.id} (seed: ${seed})`);

      // Add user message
      this.conversationManager.addUserMessage(conversation.id, prompt, options.referenceImages, options.referenceSvgText);
      conversation.lastSeed = seed;

      // Call the client
      const result = await this.client.generateImages({
        messages: conversation.messages,
        model: conversation.model,
        aspectRatio: conversation.aspectRatio,
        seed,
      });

      // Add assistant response
      this.conversationManager.addAssistantResponse(conversation.id, result);

      this.logger.info(`Image generation complete (turn ${conversation.turnNumber})`);

      // Transform client usage to TokenUsage format
      const usage: TokenUsage | undefined = result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        costUsd: result.usage.costUsd,
      } : undefined;

      return {
        conversationId: conversation.id,
        result,
        turnNumber: conversation.turnNumber,
        usage,
      };
    } catch (error) {
      // A failed turn must not enter the next request's history
      // (frame-minion@40e7949 ImageOrchestrator.ts:160).
      conversation.messages.splice(previous.messageCount);
      conversation.turnNumber = previous.turnNumber;
      conversation.lastSeed = previous.lastSeed;
      conversation.lastImages = previous.lastImages;
      // A conversation whose first turn failed was never shown to the user.
      if (conversation.turnNumber === 0) {
        this.conversationManager.clear(conversation.id);
      }
      throw error;
    } finally {
      this.inFlight.delete(conversation.id);
    }
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
    referenceSvgText?: string
  ): Promise<ImageTurnResult> {
    let conversation = this.conversationManager.get(conversationId);

    // Re-hydrate if conversation not found but history provided
    if (!conversation && history && history.length > 0 && model && aspectRatio) {
      this.logger.info(`Re-hydrating conversation ${conversationId} from ${history.length} turns`);
      conversation = this.conversationManager.rehydrate(conversationId, model, aspectRatio, history);
    }

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found and no history provided for re-hydration.`);
    }

    // Continue with existing conversation settings, reusing last seed
    return this.generateImage(prompt, {
      model: conversation.model,
      aspectRatio: conversation.aspectRatio,
      seed: conversation.lastSeed,
      referenceImages: conversation.lastImages,
      referenceSvgText,
    }, conversationId);
  }

  /**
   * Clear a conversation. Refused while a turn is generating: the turn would
   * otherwise complete into a conversation the user already discarded.
   */
  clearConversation(conversationId: string): void {
    if (this.inFlight.has(conversationId)) {
      throw new Error('Wait for image generation to finish before clearing this conversation.');
    }
    this.conversationManager.clear(conversationId);
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
