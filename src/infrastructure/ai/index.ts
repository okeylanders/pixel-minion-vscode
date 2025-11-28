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

// Orchestration
export { AIOrchestrator, ConversationManager } from './orchestration';
export type { OrchestratorOptions, ConversationTurnResult, Conversation, ConversationManagerOptions } from './orchestration';

// Tools
export type { ToolProvider, ToolDefinition, ToolExecutionResult } from './tools';
export { FileToolProvider, ToolRegistry } from './tools';
