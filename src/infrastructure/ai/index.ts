/**
 * AI Infrastructure Layer
 *
 * Client-agnostic AI orchestration with:
 * - Pluggable AI clients (OpenRouter, etc.)
 * - Conversation management with turn limits
 * - Extensible tool system
 */

// Clients
export type { AIClient, ChatMessage, ChatCompletionOptions, ChatCompletionResult, TokenUsage } from './clients';
export { OpenRouterClient } from './clients';

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

// Orchestration
export { AIOrchestrator, ConversationManager } from './orchestration';
export type { OrchestratorOptions, ConversationTurnResult, Conversation, ConversationManagerOptions } from './orchestration';

// Image conversation manager
export { ImageConversationManager } from './orchestration';
export type { ImageConversationState, RehydrationTurn } from './orchestration';

// Tools
export type { ToolProvider, ToolDefinition, ToolExecutionResult } from './tools';
export { FileToolProvider, ToolRegistry } from './tools';
