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
import { TextClient } from '../clients/TextClient';
import { SVGConversationManager, SVGConversationState, SVGRehydrationTurn } from './SVGConversationManager';
import { LoggingService } from '@logging';
import { AspectRatio, TokenUsage } from '@messages';
import { isNativeVectorSvgModel, svgModelSupportsRefinement } from '../../../shared/svg/svgRoutes';
import { inspectSvgDocument } from '../../../shared/svg/SVGDocumentPolicy';

/**
 * Output-token ceiling for one SVG turn.
 *
 * On OpenRouter, `max_tokens` covers reasoning tokens AND the visible answer
 * on most providers, and every recommended code model reasons by default
 * (Opus 5.5, Fable 5.1, Sonnet 5.5 and Grok 4.7 at high effort). At the text
 * client's 16,384 default a long SVG could stop with `finish_reason:
 * "length"` before the markup closed, which surfaces as "no valid SVG".
 *
 * 32,000 doubles that headroom and stays well under the smallest output cap
 * of any endpoint serving a curated code model (65,536: Gemini 3.8 Flash,
 * and Gemini 4 Argon on vertex/us, as of 2026-11-07), so no endpoint is asked
 * for more than it allows. It is a ceiling, not a charge, but it also bounds a
 * runaway turn: at most $1.60 at Fable 5.1's $50/1M output rate, where 48,000
 * would allow $2.40. The vector client ignores it.
 */
export const SVG_MAX_OUTPUT_TOKENS = 32_000;

export interface SVGGenerationOptions {
  model: string;
  aspectRatio: AspectRatio;
  referenceImage?: string;  // base64 encoded image
  referenceSvgText?: string; // raw SVG content
}

export interface SVGTurnResult {
  conversationId: string;
  svgCode: string;
  turnNumber: number;
  usage?: TokenUsage;
}

export class SVGOrchestrator {
  private readonly conversationManager: SVGConversationManager;
  private client: OpenRouterDynamicTextClient | null = null;
  private vectorImageClient: TextClient | null = null;
  /** Conversations with a provider request outstanding (one at a time each). */
  private readonly inFlight = new Set<string>();

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
   * Set the vector-image SVG client used for image-output models (e.g. Recraft).
   */
  setVectorImageClient(client: TextClient): void {
    this.vectorImageClient = client;
    this.logger.debug('SVGOrchestrator vector-image client configured');
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
   * Pick the client appropriate for the given model. Vector image models
   * (e.g. Recraft) need a different API shape and produce SVG via image output.
   */
  private selectClient(model: string): TextClient {
    if (isNativeVectorSvgModel(model)) {
      if (!this.vectorImageClient) {
        throw new Error('Vector image client not configured for Recraft models.');
      }
      return this.vectorImageClient;
    }
    if (!this.client) {
      throw new Error('No text client configured. Call setClient() first.');
    }
    return this.client;
  }

  /**
   * Generate an SVG (new conversation or continue existing)
   */
  async generateSVG(
    prompt: string,
    options: SVGGenerationOptions,
    conversationId?: string
  ): Promise<SVGTurnResult> {
    const client = this.selectClient(options.model);

    if (!(await client.isConfigured())) {
      throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
    }

    // Get or create conversation
    const conversation = this.conversationManager.getOrCreate(
      conversationId,
      options.model,
      options.aspectRatio
    );

    // One provider request per conversation: an overlapping refinement would
    // interleave its user message into the request already being built.
    if (this.inFlight.has(conversation.id)) {
      throw new Error('This SVG conversation is already generating. Wait for it to finish.');
    }
    this.inFlight.add(conversation.id);
    const previousMessageCount = conversation.messages.length;
    const previousTurnNumber = conversation.turnNumber;

    try {
      this.logger.debug(`Generating SVG for conversation ${conversation.id}`);

      // Add user message (handles multimodal if reference image provided)
      this.conversationManager.addUserMessage(conversation.id, prompt, options.referenceImage, options.referenceSvgText);

      // Call the text client with conversation messages, passing model directly to avoid race conditions
      const result = await client.createCompletion(conversation.messages, {
        model: options.model,
        maxTokens: SVG_MAX_OUTPUT_TOKENS,
      });

      // Extract SVG from the response (throws if no valid SVG found)
      const svgCode = this.extractSVG(result.content);
      // Text and native-vector output alike: a rejected document is still
      // returned (the webview shows its code) but is never previewed or saved.
      // Diagnostic only (the webview and the save handler decide), and kept
      // because the policy is linear: ~1 ms for a typical result, well under
      // a second for a pathological 2 MB one.
      const verdict = inspectSvgDocument(svgCode);
      if (!verdict.accepted) {
        this.logger.warn(`SVG from ${options.model} will not be previewed or saved: it ${verdict.reason}`);
      }

      // Add assistant response
      this.conversationManager.addAssistantResponse(conversation.id, svgCode);

      this.logger.info(`SVG generation complete (turn ${conversation.turnNumber})`);

      // Transform client usage to TokenUsage format
      const usage: TokenUsage | undefined = result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        costUsd: result.usage.costUsd,
      } : undefined;

      return {
        conversationId: conversation.id,
        svgCode,
        turnNumber: conversation.turnNumber,
        usage,
      };
    } catch (error) {
      // A failed turn (provider error, or a reply with no SVG in it) must not
      // enter the next refinement's transcript.
      conversation.messages.splice(previousMessageCount);
      conversation.turnNumber = previousTurnNumber;
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
   * Continue an existing conversation
   */
  async continueSVG(
    conversationId: string,
    prompt: string,
    history?: SVGRehydrationTurn[],
    model?: string,
    aspectRatio?: AspectRatio,
    referenceSvgText?: string
  ): Promise<SVGTurnResult> {
    let conversation = this.conversationManager.get(conversationId);

    // Native-vector models regenerate from the prompt; sending them this
    // conversation's text transcript would be a paid request for an
    // unrelated image. The thread's model decides, before any provider call.
    const threadModel = conversation?.model ?? model;
    if (threadModel && !svgModelSupportsRefinement(threadModel)) {
      throw new Error("Refine isn't available for native vector models. Start a new generation instead.");
    }

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
      referenceSvgText,
    }, conversationId);
  }

  /**
   * Clear a conversation. Refused while a turn is generating: the turn would
   * otherwise complete into a conversation the user already discarded.
   */
  clearConversation(conversationId: string): void {
    if (this.inFlight.has(conversationId)) {
      throw new Error('Wait for SVG generation to finish before clearing this conversation.');
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
      const extracted = codeBlockMatch[1].trim();
      // Verify it contains SVG tags
      if (/<svg[\s\S]*<\/svg>/i.test(extracted)) {
        return extracted;
      }
    }

    // Try to extract raw SVG
    const svgMatch = content.match(/<svg[\s\S]*<\/svg>/i);
    if (svgMatch) {
      return svgMatch[0].trim();
    }

    // No valid SVG found - log for debugging and throw error
    this.logger.warn('SVG extraction failed - no valid SVG tags found in response', {
      contentLength: content.length,
      contentPreview: content.substring(0, 200) + (content.length > 200 ? '...' : '')
    });
    throw new Error('No valid SVG code found in response. The AI may have returned an explanation instead of SVG code.');
  }
}
