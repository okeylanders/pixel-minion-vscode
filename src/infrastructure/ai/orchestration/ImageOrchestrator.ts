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

    // Use provided seed or generate new one
    const seed = options.seed ?? this.generateSeed();

    this.logger.debug(`Generating image for conversation ${conversation.id} (seed: ${seed})`);

    // Add user message
    this.conversationManager.addUserMessage(conversation.id, prompt, options.referenceImages);
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
  }

  /**
   * Continue an existing conversation with re-hydration support
   */
  async continueConversation(
    conversationId: string,
    prompt: string,
    history?: RehydrationTurn[],
    model?: string,
    aspectRatio?: string
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
    }, conversationId);
  }

  /**
   * Clear a conversation
   */
  clearConversation(conversationId: string): void {
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
