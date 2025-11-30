/**
 * SVGOrchestrator - Coordinates SVG generation using text completion API
 *
 * Pattern: Dependency Injection - client is injected, orchestrator is agnostic
 * Responsibilities:
 * - Coordinates between SVGConversationManager and TextClient
 * - Handles conversation lifecycle
 * - Extracts SVG code from AI responses
 * - Provides clean interface for handlers
 *
 * Note: Uses OpenRouterDynamicTextClient which allows model to be set per request
 */
import { OpenRouterDynamicTextClient } from '../clients/OpenRouterDynamicTextClient';
import { SVGConversationManager, SVGConversationState, SVGRehydrationTurn } from './SVGConversationManager';
import { LoggingService } from '@logging';
import { AspectRatio } from '@messages';

export interface SVGGenerationOptions {
  model: string;
  aspectRatio: AspectRatio;
  referenceImage?: string;  // base64 encoded image
}

export interface SVGTurnResult {
  conversationId: string;
  svgCode: string;
  turnNumber: number;
}

export class SVGOrchestrator {
  private readonly conversationManager: SVGConversationManager;
  private client: OpenRouterDynamicTextClient | null = null;

  constructor(private readonly logger: LoggingService) {
    this.conversationManager = new SVGConversationManager(logger);
  }

  /**
   * Set the text client (dependency injection)
   */
  setClient(client: OpenRouterDynamicTextClient): void {
    this.client = client;
    this.logger.debug('SVGOrchestrator client configured');
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
   * Generate an SVG (new conversation or continue existing)
   */
  async generateSVG(
    prompt: string,
    options: SVGGenerationOptions,
    conversationId?: string
  ): Promise<SVGTurnResult> {
    if (!this.client) {
      throw new Error('No text client configured. Call setClient() first.');
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

    this.logger.debug(`Generating SVG for conversation ${conversation.id}`);

    // Set the model on the client for this request
    this.client.setModel(options.model);

    // Add user message (handles multimodal if reference image provided)
    this.conversationManager.addUserMessage(conversation.id, prompt, options.referenceImage);

    // Call the text client with conversation messages
    const result = await this.client.createCompletion(conversation.messages);

    // Extract SVG from the response
    const svgCode = this.extractSVG(result.content);

    if (!svgCode) {
      throw new Error('Failed to extract SVG code from response');
    }

    // Add assistant response
    this.conversationManager.addAssistantResponse(conversation.id, svgCode);

    this.logger.info(`SVG generation complete (turn ${conversation.turnNumber})`);

    return {
      conversationId: conversation.id,
      svgCode,
      turnNumber: conversation.turnNumber,
    };
  }

  /**
   * Continue an existing conversation
   */
  async continueSVG(
    conversationId: string,
    prompt: string,
    history?: SVGRehydrationTurn[],
    model?: string,
    aspectRatio?: AspectRatio
  ): Promise<SVGTurnResult> {
    let conversation = this.conversationManager.get(conversationId);

    if (!conversation && history?.length && model && aspectRatio) {
      this.logger.info(`Re-hydrating SVG conversation ${conversationId} from history (${history.length} turns)`);
      conversation = this.conversationManager.rehydrate(conversationId, model, aspectRatio, history);
    }

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found. Please start a new generation.`);
    }

    // Continue with existing conversation settings
    return this.generateSVG(prompt, {
      model: conversation.model,
      aspectRatio: conversation.aspectRatio,
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
  getConversation(conversationId: string): SVGConversationState | undefined {
    return this.conversationManager.get(conversationId);
  }

  /**
   * Extract SVG code from AI response
   * The response may include markdown code blocks, so we need to extract the SVG
   */
  private extractSVG(content: string): string {
    // Try to extract from markdown code block first
    const codeBlockMatch = content.match(/```(?:svg|xml)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to extract raw SVG
    const svgMatch = content.match(/<svg[\s\S]*<\/svg>/i);
    if (svgMatch) {
      return svgMatch[0].trim();
    }

    // If no SVG tags found, return the content as-is
    // (the AI might have returned pure SVG without markdown)
    return content.trim();
  }
}
