/**
 * OpenRouterTextClient - Implementation of TextClient for OpenRouter API
 *
 * OpenRouter provides access to multiple AI models through a unified API.
 * https://openrouter.ai/docs
 *
 * Reference: docs/example-repo/src/infrastructure/api/OpenRouterClient.ts
 */
import { TextClient, TextMessage, TextCompletionOptions, TextCompletionResult } from './TextClient';

export class OpenRouterTextClient implements TextClient {
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'anthropic/claude-sonnet-4'
  ) {}

  getModel(): string {
    return this.model;
  }

  async isConfigured(): Promise<boolean> {
    return this.apiKey !== undefined && this.apiKey.length > 0;
  }

  async createCompletion(
    messages: TextMessage[],
    options?: TextCompletionOptions
  ): Promise<TextCompletionResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/pixel-minion-vscode',
        'X-Title': 'Pixel Minion',
      },
      body: JSON.stringify({
        model: this.model,
        // Content can be either string or multimodal array - pass as-is
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 48000,
        usage: { include: true },  // Request native token counts and cost
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

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
