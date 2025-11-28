import { MessageType, MessageEnvelope } from './base';

export interface AIConversationRequestPayload {
  message: string;
  conversationId?: string;
}

export interface AIConversationResponsePayload {
  response: string;
  conversationId: string;
  turnNumber: number;
  isComplete: boolean;
}

export type AIConversationRequestMessage = MessageEnvelope<AIConversationRequestPayload>;
export type AIConversationResponseMessage = MessageEnvelope<AIConversationResponsePayload>;
export type AIConversationClearMessage = MessageEnvelope<{ conversationId: string }>;
