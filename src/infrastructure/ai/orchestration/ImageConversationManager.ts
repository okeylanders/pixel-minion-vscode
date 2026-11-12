// Ported from frame-minion@40e7949 packages/core/src/infrastructure/ai/orchestration/ImageConversationManager.ts; keep in sync
/**
 * ImageConversationManager - Manages image generation conversation state
 *
 * Responsibilities:
 * - Store and retrieve conversation state
 * - Build messages for API calls
 * - Handle re-hydration from webview history
 */
import {
  ImageConversationMessage,
  ImageMessageContent,
  ImageGenerationResult,
} from '../clients/ImageGenerationClient';
import { LoggingService } from '@logging';
import type { ImageGenerationMode } from '@messages';

/**
 * State for a single image generation conversation
 */
export interface ImageConversationState {
  mode: ImageGenerationMode;
  id: string;
  messages: ImageConversationMessage[];
  model: string;
  aspectRatio: string;
  resolution?: string;
  turnNumber: number;
  lastSeed?: number;
  lastImages?: string[];
}

/**
 * A generated image the webview hands back to restart a Single Shot thread
 * after a host restart.
 */
export interface RehydrationImage {
  data: string;
  seed: number;
}

export class ImageConversationManager {
  private readonly conversations = new Map<string, ImageConversationState>();

  constructor(private readonly logger: LoggingService) {}

  /**
   * Create a new conversation
   */
  create(model: string, aspectRatio: string, resolution?: string, mode: ImageGenerationMode = 'edit'): ImageConversationState {
    const id = `img-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const conversation: ImageConversationState = {
      id,
      mode,
      messages: [],
      model,
      aspectRatio,
      resolution,
      turnNumber: 0,
      lastImages: [],
    };
    this.conversations.set(id, conversation);
    this.logger.debug(`Created image conversation: ${id}`);
    return conversation;
  }

  /**
   * Get an existing conversation
   */
  get(id: string): ImageConversationState | undefined {
    return this.conversations.get(id);
  }

  /**
   * Get or create a conversation
   */
  getOrCreate(
    id: string | undefined,
    model: string,
    aspectRatio: string,
    resolution?: string,
    mode: ImageGenerationMode = 'edit'
  ): ImageConversationState {
    if (id) {
      const existing = this.conversations.get(id);
      if (existing) {
        return existing;
      }
    }
    return this.create(model, aspectRatio, resolution, mode);
  }

  /**
   * Add a user message to a conversation
   */
  addUserMessage(
    conversationId: string,
    prompt: string,
    referenceImages?: string[],
    referenceSvgText?: string
  ): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const content: ImageMessageContent[] = [
      { type: 'text', text: referenceSvgText ? `${prompt}\n\nReference SVG:\n${referenceSvgText}` : prompt }
    ];

    // Add reference images if provided
    if (referenceImages?.length) {
      for (const imageData of referenceImages) {
        content.push({
          type: 'image_url',
          image_url: { url: imageData }
        });
      }
    }

    conversation.messages.push({
      role: 'user',
      content
    });
  }

  /**
   * Add an assistant response with generated images
   */
  addAssistantResponse(
    conversationId: string,
    result: ImageGenerationResult
  ): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Deep copy (frame-minion@40e7949 ImageConversationManager.ts:141): the
    // stored transcript must not share nested parts with the provider result,
    // which the handler goes on to read, nor be changed by the Gemini
    // stripping below.
    const message: ImageConversationMessage = result.assistantMessage
      ? JSON.parse(JSON.stringify(result.assistantMessage)) as ImageConversationMessage
      : {
          role: 'assistant',
          content: result.assistantContent ?? [{ type: 'text', text: 'Generated images' }],
          images: result.assistantImages ?? result.images.map(img => ({ image_url: { url: img.data } })),
        };

    // Preserve reasoning_details for Gemini multi-turn conversations
    if (result.reasoning_details) {
      message.reasoning_details = result.reasoning_details;
    }

    // Gemini image continuation is strict about thought signatures on model image parts.
    // If the provider response does not include signatures, do not replay assistant image parts.
    // We pass image context as user reference images on continuation instead.
    if (this.isGeminiModel(conversation.model) && !this.hasThoughtSignatures(message)) {
      if (Array.isArray(message.images) && message.images.length > 0) {
        delete message.images;
      }
      if (!Array.isArray(message.content)) {
        message.content = [{ type: 'text', text: typeof message.content === 'string' ? message.content : 'Generated images' }];
      } else {
        message.content = message.content.filter(block => block.type !== 'image_url');
      }
    }

    conversation.messages.push(message);

    conversation.turnNumber++;
    conversation.lastSeed = result.seed;
    conversation.lastImages = result.images.map(img => img.data);
  }

  /**
   * Restart a Single Shot thread after an extension restart, from what its
   * next follow-up uses: the latest images (its references and seed). Like a
   * live Single Shot thread, it keeps no earlier messages.
   */
  rehydrate(
    conversationId: string,
    model: string,
    aspectRatio: string,
    latestImages: RehydrationImage[],
    turnCount: number,
    resolution?: string
  ): ImageConversationState {
    const conversation: ImageConversationState = {
      id: conversationId,
      mode: 'edit',
      messages: [],
      model,
      aspectRatio,
      resolution,
      turnNumber: turnCount,
      lastSeed: latestImages[0]?.seed,
      lastImages: latestImages.map(img => img.data),
    };

    this.conversations.set(conversationId, conversation);
    this.logger.info(`Re-hydrated Single Shot thread ${conversationId} at turn ${turnCount}`);

    return conversation;
  }

  /** Only the host-owned transcript store may restore opaque provider messages. */
  restore(state: ImageConversationState): void {
    this.conversations.set(state.id, state);
  }

  /**
   * Clear a conversation
   */
  clear(conversationId: string): void {
    this.conversations.delete(conversationId);
    this.logger.debug(`Cleared conversation: ${conversationId}`);
  }

  /**
   * Clear all conversations
   */
  clearAll(): void {
    this.conversations.clear();
    this.logger.debug('Cleared all image conversations');
  }

  private isGeminiModel(model: string): boolean {
    return model.toLowerCase().includes('gemini');
  }

  private hasThoughtSignatures(message: ImageConversationMessage): boolean {
    const hasImageSignature = Array.isArray(message.images) &&
      message.images.some(image => 'thought_signature' in image || 'thoughtSignature' in image);

    const hasContentSignature = Array.isArray(message.content) &&
      message.content.some(block =>
        (block.type === 'image_url' || 'image_url' in block) &&
        ('thought_signature' in block || 'thoughtSignature' in block)
      );

    return hasImageSignature || hasContentSignature;
  }
}
