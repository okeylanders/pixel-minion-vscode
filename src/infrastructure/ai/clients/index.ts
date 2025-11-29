export type { AIClient, ChatMessage, ChatCompletionOptions, ChatCompletionResult, TokenUsage } from './AIClient';
export { OpenRouterClient } from './OpenRouterClient';

// Image generation client
export type {
  ImageGenerationClient,
  ImageGenerationRequest,
  ImageGenerationResult,
  GeneratedImageData,
  ImageMessageContent,
  ImageConversationMessage,
} from './ImageGenerationClient';
export { OpenRouterImageClient } from './OpenRouterImageClient';
