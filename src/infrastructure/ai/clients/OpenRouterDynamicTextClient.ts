/**
 * OpenRouterDynamicTextClient - TextClient that uses SecretStorageService and supports dynamic models
 *
 * This client allows the model to be set per-request (via setModel) rather than at construction time.
 * This is useful for SVG generation where different models can be selected from the UI.
 */
import { TextClient, TextMessage, TextCompletionOptions, TextCompletionResult } from './TextClient';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';

export class OpenRouterDynamicTextClient implements TextClient {
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private currentModel: string;

  constructor(
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService,
    defaultModel: string = 'anthropic/claude-sonnet-4'
  ) {
    this.currentModel = defaultModel;
  }

  /**
   * Set the model to use for subsequent requests
   */
  setModel(model: string): void {
    this.currentModel = model;
    this.logger.debug(`OpenRouterDynamicTextClient model set to: ${model}`);
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

    this.logger.debug('Calling OpenRouter text completion', {
      model: this.currentModel,
      messageCount: messages.length,
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
        model: this.currentModel,
        // Content can be either string or multimodal array - pass as-is
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 16384,
        usage: { include: true },  // Request native token counts and cost
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

    this.logger.debug('OpenRouter response received', {
      hasUsage: !!data.usage,
      usage: data.usage,  // Log full usage object to see available fields
    });

    if (!choice) {
      throw new Error('No completion choice returned from OpenRouter');
    }

    return {
      content: choice.message?.content ?? '',
      finishReason: choice.finish_reason,
      usage: data.usage ? {
        // Prefer native token counts if available, fall back to normalized
        promptTokens: data.usage.native_tokens_prompt ?? data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.native_tokens_completion ?? data.usage.completion_tokens ?? 0,
        totalTokens: (data.usage.native_tokens_prompt ?? data.usage.prompt_tokens ?? 0) +
                     (data.usage.native_tokens_completion ?? data.usage.completion_tokens ?? 0),
        // Cost may be in different fields depending on OpenRouter version
        costUsd: data.usage.cost ?? data.usage.total_cost,
      } : undefined,
      id: data.id,
    };
  }
}
