import { MessageType, MessageEnvelope } from './base';

export interface StatusPayload {
  message: string;
  isLoading?: boolean;
}

export interface ErrorPayload {
  message: string;
  code?: string;
  details?: unknown;
}

export type StatusMessage = MessageEnvelope<StatusPayload>;
export type ErrorMessage = MessageEnvelope<ErrorPayload>;
