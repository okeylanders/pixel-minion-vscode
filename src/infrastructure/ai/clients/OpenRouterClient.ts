/**
 * OpenRouterClient - Implementation of AIClient for OpenRouter API
 *
 * OpenRouter provides access to multiple AI models through a unified API.
 * https://openrouter.ai/docs
 *
 * Reference: docs/example-repo/src/infrastructure/api/OpenRouterClient.ts
 */
import { AIClient, ChatMessage, ChatCompletionOptions, ChatCompletionResult } from './AIClient';

export class OpenRouterClient implements AIClient {
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

  async createChatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
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
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
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
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      id: data.id,
    };
  }
}
