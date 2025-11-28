import { MessageType, MessageEnvelope } from './base';

export interface ApiKeyStatusPayload {
  isConfigured: boolean;
}

export interface SaveApiKeyPayload {
  apiKey: string;
}

// Note: We NEVER send the actual API key back to the webview
// Only send boolean status for security
export type RequestApiKeyStatusMessage = MessageEnvelope<void>;
export type ApiKeyStatusMessage = MessageEnvelope<ApiKeyStatusPayload>;
export type SaveApiKeyMessage = MessageEnvelope<SaveApiKeyPayload>;
export type ClearApiKeyMessage = MessageEnvelope<void>;
