// Text client
export type {
  TextClient,
  TextMessage,
  TextCompletionOptions,
  TextCompletionResult,
  TokenUsage,
} from './TextClient';
export { OpenRouterTextClient } from './OpenRouterTextClient';

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
