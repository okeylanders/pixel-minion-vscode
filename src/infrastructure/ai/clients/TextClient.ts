/**
 * TextClient - Abstract interface for text-based AI service providers
 *
 * Pattern: Strategy pattern - swap implementations without changing consumers
 * Enables: OpenRouter, OpenAI, Anthropic, local models, etc.
 *
 * Reference: Improved from docs/example-repo/src/infrastructure/api/OpenRouterClient.ts
 */

export interface TextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TextCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TextCompletionResult {
  content: string;
  finishReason?: string;
  usage?: TokenUsage;
  id?: string;
}

export interface TextClient {
  /**
   * Get the model identifier being used
   */
  getModel(): string;

  /**
   * Create a text completion
   * @param messages The conversation messages
   * @param options Optional parameters (temperature, maxTokens, abort signal)
   * @returns The completion result with content and metadata
   */
  createCompletion(
    messages: TextMessage[],
    options?: TextCompletionOptions
  ): Promise<TextCompletionResult>;

  /**
   * Check if the client is properly configured (has API key, etc.)
   */
  isConfigured(): Promise<boolean>;
}
