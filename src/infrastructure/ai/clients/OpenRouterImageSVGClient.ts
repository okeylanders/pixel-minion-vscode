/**
 * OpenRouterImageSVGClient - TextClient that produces SVG markup via image-output models.
 *
 * Implements the TextClient interface but calls OpenRouter's chat completions with
 * `modalities: ['image']`. Used for vector-native models (e.g. Recraft) that return
 * SVG documents in `message.images[0].image_url.url` as `data:image/svg+xml;base64,...`
 * rather than as text. The SVG is decoded into raw markup and returned in
 * `TextCompletionResult.content`, so the SVGOrchestrator's existing markup-extraction
 * path works unchanged.
 */
import { TextClient, TextMessage, TextCompletionOptions, TextCompletionResult } from './TextClient';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';

export class OpenRouterImageSVGClient implements TextClient {
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private currentModel: string;

  constructor(
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService,
    defaultModel: string = 'recraft/recraft-v4.1-pro-vector'
  ) {
    this.currentModel = defaultModel;
  }

  getModel(): string {
    return this.currentModel;
  }

  async isConfigured(): Promise<boolean> {
    return this.secretStorage.hasApiKey();
  }

  async createCompletion(
    messages: TextMessage[],
    options?: TextCompletionOptions
  ): Promise<TextCompletionResult> {
    const apiKey = await this.secretStorage.getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
    }

    const modelToUse = options?.model ?? this.currentModel;

    this.logger.debug('Calling OpenRouter vector image completion', {
      model: modelToUse,
      messageCount: messages.length,
    });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/pixel-minion-vscode',
        'X-Title': 'Pixel Minion VS Code Extension',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        modalities: ['image'],
        usage: { include: true },
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenRouter API error: ${response.status} ${errorText}`);
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No completion choice returned from OpenRouter');
    }

    const svgMarkup = this.decodeSvgFromImageMessage(choice.message);

    return {
      content: svgMarkup,
      finishReason: choice.finish_reason,
      usage: data.usage ? {
        promptTokens: data.usage.native_tokens_prompt ?? data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.native_tokens_completion ?? data.usage.completion_tokens ?? 0,
        totalTokens: (data.usage.native_tokens_prompt ?? data.usage.prompt_tokens ?? 0) +
                     (data.usage.native_tokens_completion ?? data.usage.completion_tokens ?? 0),
        costUsd: data.usage.cost ?? data.usage.total_cost,
      } : undefined,
      id: data.id,
    };
  }

  /**
   * Extract SVG markup from a chat-completions response whose output is an image.
   * Recraft returns `data:image/svg+xml;base64,<payload>` in message.images[0].image_url.url.
   */
  private decodeSvgFromImageMessage(message: unknown): string {
    const images = (message as { images?: Array<{ image_url?: { url?: string } }> } | undefined)?.images;
    const url = images?.[0]?.image_url?.url;
    if (!url) {
      throw new Error('Vector image model returned no image data');
    }

    const match = url.match(/^data:image\/svg\+xml;base64,(.+)$/);
    if (!match) {
      throw new Error('Vector image model returned an unexpected payload (expected image/svg+xml data URL)');
    }

    try {
      return Buffer.from(match[1], 'base64').toString('utf-8');
    } catch (error) {
      this.logger.error('Failed to base64-decode SVG payload', error);
      throw new Error('Failed to decode SVG payload from vector image model');
    }
  }
}
