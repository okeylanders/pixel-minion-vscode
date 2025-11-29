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

/**
 * State for a single image generation conversation
 */
export interface ImageConversationState {
  id: string;
  messages: ImageConversationMessage[];
  model: string;
  aspectRatio: string;
  turnNumber: number;
  lastSeed?: number;
}

/**
 * History turn for re-hydration (from webview persistence)
 */
export interface RehydrationTurn {
  prompt: string;
  images: Array<{
    data: string;
    seed: number;
  }>;
}

export class ImageConversationManager {
  private readonly conversations = new Map<string, ImageConversationState>();

  constructor(private readonly logger: LoggingService) {}

  /**
   * Create a new conversation
   */
  create(model: string, aspectRatio: string): ImageConversationState {
    const id = `img-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const conversation: ImageConversationState = {
      id,
      messages: [],
      model,
      aspectRatio,
      turnNumber: 0,
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
    aspectRatio: string
  ): ImageConversationState {
    if (id) {
      const existing = this.conversations.get(id);
      if (existing) {
        return existing;
      }
    }
    return this.create(model, aspectRatio);
  }

  /**
   * Add a user message to a conversation
   */
  addUserMessage(
    conversationId: string,
    prompt: string,
    referenceImages?: string[]
  ): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const content: ImageMessageContent[] = [
      { type: 'text', text: prompt }
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

    conversation.messages.push({
      role: 'assistant',
      content: [{ type: 'text', text: 'Generated images' }],
      images: result.images.map(img => ({ image_url: { url: img.data } }))
    });

    conversation.turnNumber++;
    conversation.lastSeed = result.seed;
  }

  /**
   * Re-hydrate a conversation from webview history (after extension restart)
   */
  rehydrate(
    conversationId: string,
    model: string,
    aspectRatio: string,
    history: RehydrationTurn[]
  ): ImageConversationState {
    const conversation: ImageConversationState = {
      id: conversationId,
      messages: [],
      model,
      aspectRatio,
      turnNumber: 0,
    };

    // Rebuild messages from history
    for (const turn of history) {
      // Add user message with prompt and images as context
      const userContent: ImageMessageContent[] = [
        { type: 'text', text: turn.prompt }
      ];

      for (const img of turn.images) {
        userContent.push({
          type: 'image_url',
          image_url: { url: img.data }
        });
      }

      conversation.messages.push({
        role: 'user',
        content: userContent
      });

      // Add assistant response with images
      conversation.messages.push({
        role: 'assistant',
        content: [{ type: 'text', text: 'Generated images' }],
        images: turn.images.map(img => ({ image_url: { url: img.data } }))
      });

      conversation.turnNumber++;

      // Track the last seed used
      if (turn.images.length > 0) {
        conversation.lastSeed = turn.images[0].seed;
      }
    }

    this.conversations.set(conversationId, conversation);
    this.logger.info(`Re-hydrated conversation ${conversationId} with ${conversation.turnNumber} turns`);

    return conversation;
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
}
