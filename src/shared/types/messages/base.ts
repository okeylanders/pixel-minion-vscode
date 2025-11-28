/**
 * Message Types - enumerate all message types in the system
 *
 * Pattern: Use enum for type safety and autocomplete
 * Reference: docs/example-repo for the full pattern
 */
export enum MessageType {
  // Hello World domain
  HELLO_WORLD_REQUEST = 'HELLO_WORLD_REQUEST',
  HELLO_WORLD_RESULT = 'HELLO_WORLD_RESULT',

  // Settings domain
  REQUEST_SETTINGS = 'REQUEST_SETTINGS',
  SETTINGS_DATA = 'SETTINGS_DATA',
  UPDATE_SETTING = 'UPDATE_SETTING',

  // API Key management (secure)
  REQUEST_API_KEY_STATUS = 'REQUEST_API_KEY_STATUS',
  API_KEY_STATUS = 'API_KEY_STATUS',
  SAVE_API_KEY = 'SAVE_API_KEY',
  CLEAR_API_KEY = 'CLEAR_API_KEY',

  // AI Conversation
  AI_CONVERSATION_REQUEST = 'AI_CONVERSATION_REQUEST',
  AI_CONVERSATION_RESPONSE = 'AI_CONVERSATION_RESPONSE',
  AI_CONVERSATION_CLEAR = 'AI_CONVERSATION_CLEAR',

  // Status and errors
  STATUS = 'STATUS',
  ERROR = 'ERROR',

  // UI
  TAB_CHANGED = 'TAB_CHANGED',
  OPEN_SETTINGS_OVERLAY = 'OPEN_SETTINGS_OVERLAY',

  // Token usage
  TOKEN_USAGE_UPDATE = 'TOKEN_USAGE_UPDATE',
  RESET_TOKEN_USAGE = 'RESET_TOKEN_USAGE',

  // Image Generation
  IMAGE_GENERATION_REQUEST = 'IMAGE_GENERATION_REQUEST',
  IMAGE_GENERATION_RESPONSE = 'IMAGE_GENERATION_RESPONSE',
  IMAGE_GENERATION_CONTINUE = 'IMAGE_GENERATION_CONTINUE',
  IMAGE_GENERATION_CLEAR = 'IMAGE_GENERATION_CLEAR',
  IMAGE_SAVE_REQUEST = 'IMAGE_SAVE_REQUEST',
  IMAGE_SAVE_RESULT = 'IMAGE_SAVE_RESULT',

  // SVG Generation
  SVG_GENERATION_REQUEST = 'SVG_GENERATION_REQUEST',
  SVG_GENERATION_RESPONSE = 'SVG_GENERATION_RESPONSE',
  SVG_GENERATION_CONTINUE = 'SVG_GENERATION_CONTINUE',
  SVG_GENERATION_CLEAR = 'SVG_GENERATION_CLEAR',
  SVG_SAVE_REQUEST = 'SVG_SAVE_REQUEST',
  SVG_SAVE_RESULT = 'SVG_SAVE_RESULT',
}

export type MessageSource =
  | 'extension.helloWorld'
  | 'extension.settings'
  | 'extension.ai'
  | 'extension.imageGeneration'
  | 'extension.svgGeneration'
  | 'webview.helloWorld'
  | 'webview.settings'
  | 'webview.ai'
  | 'webview.imageGeneration'
  | 'webview.svgGeneration';

/**
 * Message Envelope - wraps all messages with metadata
 *
 * Pattern: Every message includes source, type, payload, and timestamp
 * Benefits: Source tracking, echo prevention, audit trails
 */
export interface MessageEnvelope<TPayload = unknown> {
  type: MessageType;
  source: MessageSource;
  payload: TPayload;
  timestamp: number;
  correlationId?: string;
}

// Factory function to create envelopes
export function createEnvelope<T>(
  type: MessageType,
  source: MessageSource,
  payload: T,
  correlationId?: string
): MessageEnvelope<T> {
  return {
    type,
    source,
    payload,
    timestamp: Date.now(),
    correlationId,
  };
}
