/**
 * SVGConversationManager - Manages SVG generation conversation state
 *
 * Responsibilities:
 * - Store and retrieve conversation state
 * - Build messages for text completion API calls
 * - Manage SVG system prompt with aspect ratio configuration
 */
import { TextMessage } from '../clients/TextClient';
import { LoggingService } from '@logging';
import { AspectRatio, ASPECT_RATIO_DIMENSIONS } from '@messages';

/**
 * State for a single SVG generation conversation
 */
export interface SVGConversationState {
  id: string;
  messages: TextMessage[];
  model: string;
  aspectRatio: AspectRatio;
  turnNumber: number;
}

export interface SVGRehydrationTurn {
  prompt: string;
  svgCode: string;
  turnNumber?: number;
  referenceSvgText?: string;
}

/**
 * SVG system prompt - instructs the AI to generate clean SVG code
 */
const SVG_SYSTEM_PROMPT = `You are an expert SVG artist. Generate clean, well-structured SVG code based on user descriptions.

Rules:
1. Output ONLY valid SVG code - no explanations unless asked
2. Use viewBox for scalability
3. Prefer semantic grouping with <g> elements
4. Use meaningful id attributes for key elements
5. Keep code clean and readable with proper indentation
6. For the requested aspect ratio, set appropriate viewBox dimensions
7. If a reference image is provided, use it as inspiration for style/composition

When user asks for refinements, output the complete updated SVG (not just changes).`;

export class SVGConversationManager {
  private readonly conversations = new Map<string, SVGConversationState>();

  constructor(private readonly logger: LoggingService) {}

  /**
   * Create a new conversation with system prompt configured for aspect ratio
   */
  create(model: string, aspectRatio: AspectRatio): SVGConversationState {
    const id = `svg-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Get dimensions for the aspect ratio
    const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];
    const systemPrompt = `${SVG_SYSTEM_PROMPT}\n\nFor this conversation, use viewBox="0 0 ${dimensions.width} ${dimensions.height}" for the ${aspectRatio} aspect ratio.`;

    const conversation: SVGConversationState = {
      id,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        }
      ],
      model,
      aspectRatio,
      turnNumber: 0,
    };

    this.conversations.set(id, conversation);
    this.logger.debug(`Created SVG conversation: ${id} with aspect ratio ${aspectRatio}`);
    return conversation;
  }

  /**
   * Get an existing conversation
   */
  get(id: string): SVGConversationState | undefined {
    return this.conversations.get(id);
  }

  /**
   * Get or create a conversation
   */
  getOrCreate(
    id: string | undefined,
    model: string,
    aspectRatio: AspectRatio
  ): SVGConversationState {
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
   * Supports both simple text and multimodal messages with reference images
   */
  addUserMessage(
    conversationId: string,
    prompt: string,
    referenceImage?: string,
    referenceSvgText?: string
  ): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Build message content
    let content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;

    // If an SVG text is provided, append it to the prompt as text.
    if (referenceSvgText) {
      const svgAppendix = `\n\nReference SVG:\n${referenceSvgText}`;
      content = referenceImage
        ? [
            { type: 'text', text: `${prompt}${svgAppendix}` },
            { type: 'image_url', image_url: { url: referenceImage } },
          ]
        : `${prompt}${svgAppendix}`;
    } else if (referenceImage) {
      content = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: referenceImage } }
      ];
    } else {
      content = prompt;
    }

    conversation.messages.push({
      role: 'user',
      content
    });
  }

  /**
   * Add an assistant response with the generated SVG code
   */
  addAssistantResponse(
    conversationId: string,
    svgCode: string
  ): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.messages.push({
      role: 'assistant',
      content: svgCode
    });

    conversation.turnNumber++;
  }

  /**
   * Clear a conversation
   */
  clear(conversationId: string): void {
    this.conversations.delete(conversationId);
    this.logger.debug(`Cleared SVG conversation: ${conversationId}`);
  }

  /**
   * Clear all conversations
   */
  clearAll(): void {
    this.conversations.clear();
    this.logger.debug('Cleared all SVG conversations');
  }

  /**
   * Re-hydrate a conversation from persisted history
   */
  rehydrate(
    conversationId: string,
    model: string,
    aspectRatio: AspectRatio,
    history: SVGRehydrationTurn[]
  ): SVGConversationState {
    const conversation: SVGConversationState = {
      id: conversationId,
      messages: [],
      model,
      aspectRatio,
      turnNumber: 0,
    };

    // Seed with system prompt
    const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];
    const systemPrompt = `${SVG_SYSTEM_PROMPT}\n\nFor this conversation, use viewBox="0 0 ${dimensions.width} ${dimensions.height}" for the ${aspectRatio} aspect ratio.`;
    conversation.messages.push({
      role: 'system',
      content: systemPrompt
    });

    for (const turn of history) {
      const promptWithSvg = turn.referenceSvgText
        ? `${turn.prompt}\n\nReference SVG:\n${turn.referenceSvgText}`
        : turn.prompt;
      conversation.messages.push({
        role: 'user',
        content: promptWithSvg
      });
      conversation.messages.push({
        role: 'assistant',
        content: turn.svgCode
      });
      conversation.turnNumber++;
    }

    this.conversations.set(conversationId, conversation);
    this.logger.info(`Re-hydrated SVG conversation ${conversationId} with ${conversation.turnNumber} turns`);
    return conversation;
  }
}
