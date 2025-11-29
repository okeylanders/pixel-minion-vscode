/**
 * AI Infrastructure Layer
 *
 * Client-agnostic AI orchestration with:
 * - Pluggable AI clients (OpenRouter, etc.)
 * - Conversation management with turn limits
 * - Extensible tool system
 */

// Text clients
export type {
  TextClient,
  TextMessage,
  TextMessageContent,
  TextCompletionOptions,
  TextCompletionResult,
  TokenUsage,
} from './clients';
export { OpenRouterTextClient, OpenRouterDynamicTextClient } from './clients';

// Image generation client
export type {
  ImageGenerationClient,
  ImageGenerationRequest,
  ImageGenerationResult,
  GeneratedImageData,
  ImageMessageContent,
  ImageConversationMessage,
} from './clients';
export { OpenRouterImageClient } from './clients';

// Text orchestration
export { TextOrchestrator, TextConversationManager } from './orchestration';
export type {
  TextOrchestratorOptions,
  TextTurnResult,
  TextConversation,
  TextConversationManagerOptions,
} from './orchestration';

// Image orchestration
export { ImageConversationManager, ImageOrchestrator } from './orchestration';
export type {
  ImageConversationState,
  RehydrationTurn,
  ImageGenerationOptions,
  ImageTurnResult,
} from './orchestration';

// SVG orchestration
export { SVGConversationManager, SVGOrchestrator } from './orchestration';
export type {
  SVGConversationState,
  SVGGenerationOptions,
  SVGTurnResult,
} from './orchestration';

// Tools
export type { ToolProvider, ToolDefinition, ToolExecutionResult } from './tools';
export { FileToolProvider, ToolRegistry } from './tools';
