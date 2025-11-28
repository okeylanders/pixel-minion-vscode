/**
 * AIClient - Abstract interface for AI service providers
 *
 * Pattern: Strategy pattern - swap implementations without changing consumers
 * Enables: OpenRouter, OpenAI, Anthropic, local models, etc.
 *
 * Reference: Improved from docs/example-repo/src/infrastructure/api/OpenRouterClient.ts
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionResult {
  content: string;
  finishReason?: string;
  usage?: TokenUsage;
  id?: string;
}

export interface AIClient {
  /**
   * Get the model identifier being used
   */
  getModel(): string;

  /**
   * Create a chat completion
   * @param messages The conversation messages
   * @param options Optional parameters (temperature, maxTokens, abort signal)
   * @returns The completion result with content and metadata
   */
  createChatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult>;

  /**
   * Check if the client is properly configured (has API key, etc.)
   */
  isConfigured(): Promise<boolean>;
}
