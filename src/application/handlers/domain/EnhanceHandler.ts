/**
 * EnhanceHandler - Handles prompt enhancement requests
 *
 * Pattern: Single-shot text generation for prompt improvement
 */
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  EnhancePromptRequestPayload,
  EnhancePromptResponsePayload,
  EnhancePromptType,
  StatusPayload,
  TokenUsage,
} from '@messages';
import { OpenRouterTextClient } from '@ai';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';

const SYSTEM_PROMPTS: Record<EnhancePromptType, string> = {
  image: `You are an expert prompt engineer for AI image generation. Your task is to enhance the user's prompt to produce better, more detailed images.

Guidelines:
- Add specific visual details (lighting, composition, style, mood)
- Include artistic references when appropriate (art style, medium, artist influences)
- Specify technical aspects (camera angle, depth of field, color palette)
- Keep the core subject/intent intact
- Make it vivid and descriptive but not overly long

Return ONLY the enhanced prompt, no explanation or commentary.`,

  svg: `You are an expert prompt engineer for AI SVG/vector graphic generation. Your task is to enhance the user's prompt to produce a single, clean vector graphic.

Guidelines:
- Request ONE single SVG output, not multiple variants or options
- Emphasize clean lines, simple shapes, and flat design principles
- Specify icon-appropriate details (solid fills, minimal gradients, clear silhouettes)
- Include scale considerations (works at small sizes like 16x16, 32x32)
- Mention style preferences (flat, outlined, filled, minimalist)
- Keep designs simple enough to work as scalable vectors

Return ONLY the enhanced prompt, no explanation or commentary.`,
};

const ENHANCE_MODEL = 'openai/gpt-5.1';

export class EnhanceHandler {
  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService,
    private readonly applyTokenUsageCallback?: (usage: TokenUsage) => void
  ) {
    this.logger.debug('EnhanceHandler initialized');
  }

  /**
   * Handle prompt enhancement request
   */
  async handleEnhanceRequest(message: MessageEnvelope<EnhancePromptRequestPayload>): Promise<void> {
    const { prompt, type } = message.payload;
    this.logger.info(`Enhance request (${type}): ${prompt.substring(0, 50)}...`);

    // Send loading status
    this.postMessage(createEnvelope<StatusPayload>(
      MessageType.STATUS,
      'extension.enhance',
      { message: 'Enhancing prompt...', isLoading: true },
      message.correlationId
    ));

    try {
      const apiKey = await this.secretStorage.getApiKey();
      if (!apiKey) {
        throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
      }

      const client = new OpenRouterTextClient(apiKey, ENHANCE_MODEL);
      const systemPrompt = SYSTEM_PROMPTS[type];

      const result = await client.createCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ]);

      const enhancedPrompt = result.content.trim();
      this.logger.info(`Enhanced prompt: ${enhancedPrompt.substring(0, 50)}...`);

      // Send response
      this.postMessage(createEnvelope<EnhancePromptResponsePayload>(
        MessageType.ENHANCE_PROMPT_RESPONSE,
        'extension.enhance',
        {
          enhancedPrompt,
          originalPrompt: prompt,
          type,
        },
        message.correlationId
      ));

      if (result.usage) {
        this.applyTokenUsage(result.usage);
      }
    } catch (error) {
      this.logger.error('Enhance request failed', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.enhance',
        {
          message: error instanceof Error ? error.message : 'Enhancement failed',
          code: 'ENHANCE_ERROR',
        },
        message.correlationId
      ));
    } finally {
      // Clear loading status
      this.postMessage(createEnvelope<StatusPayload>(
        MessageType.STATUS,
        'extension.enhance',
        { message: '', isLoading: false },
        message.correlationId
      ));
    }
  }

  /**
   * Report token usage to the central accumulator
   */
  private applyTokenUsage(usage: TokenUsage): void {
    if (this.applyTokenUsageCallback) {
      this.applyTokenUsageCallback(usage);
    }
  }
}
