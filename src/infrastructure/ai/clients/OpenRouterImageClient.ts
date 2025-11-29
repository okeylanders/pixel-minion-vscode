/**
 * OpenRouterImageClient - Image generation via OpenRouter API
 *
 * Handles:
 * - API authentication via SecretStorageService
 * - Image-specific request formatting (modalities, image_config)
 * - Response parsing for generated images
 */
import {
  ImageGenerationClient,
  ImageGenerationRequest,
  ImageGenerationResult,
  GeneratedImageData,
} from './ImageGenerationClient';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';

export class OpenRouterImageClient implements ImageGenerationClient {
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor(
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService
  ) {}

  async isConfigured(): Promise<boolean> {
    return this.secretStorage.hasApiKey();
  }

  async generateImages(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const apiKey = await this.secretStorage.getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
    }

    this.logger.debug('Calling OpenRouter image generation', {
      model: request.model,
      aspectRatio: request.aspectRatio,
      seed: request.seed,
      messageCount: request.messages.length,
    });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/pixel-minion-vscode',
        'X-Title': 'Pixel Minion',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        modalities: ['image', 'text'],
        seed: request.seed,
        image_config: { aspect_ratio: request.aspectRatio },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenRouter API error: ${response.status} ${errorText}`);
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    this.logger.debug('OpenRouter response received');

    return this.parseResponse(result, request.seed);
  }

  private parseResponse(result: any, requestedSeed?: number): ImageGenerationResult {
    const choice = result.choices?.[0];
    if (!choice?.message?.images?.length) {
      throw new Error('No images returned from API');
    }

    const images: GeneratedImageData[] = [];

    for (const [index, image] of choice.message.images.entries()) {
      const imageUrl = image.image_url?.url;
      if (!imageUrl) {
        this.logger.warn(`Image ${index} missing URL`);
        continue;
      }

      // Extract mime type from data URL
      const mimeType = this.extractMimeType(imageUrl);
      if (!mimeType) {
        this.logger.warn(`Image ${index} is not a valid data URL`);
        continue;
      }

      images.push({
        data: imageUrl,
        mimeType,
      });
    }

    if (images.length === 0) {
      throw new Error('Failed to parse images from API response');
    }

    return {
      images,
      seed: requestedSeed ?? 0,
      usage: result.usage ? {
        promptTokens: result.usage.prompt_tokens,
        completionTokens: result.usage.completion_tokens,
        totalTokens: result.usage.total_tokens,
      } : undefined,
    };
  }

  private extractMimeType(dataUrl: string): string | null {
    const match = dataUrl.match(/^data:(image\/\w+);base64,/);
    return match?.[1] ?? null;
  }
}
