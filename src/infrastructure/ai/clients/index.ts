// Text client
export type {
  TextClient,
  TextMessage,
  TextMessageContent,
  TextCompletionOptions,
  TextCompletionResult,
  TokenUsage,
} from './TextClient';
export { OpenRouterTextClient } from './OpenRouterTextClient';
export { OpenRouterDynamicTextClient } from './OpenRouterDynamicTextClient';

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
