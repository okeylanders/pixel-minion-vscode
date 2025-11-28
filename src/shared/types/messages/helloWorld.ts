import { MessageType, MessageEnvelope } from './base';

export interface HelloWorldRequestPayload {
  text: string;
}

export interface HelloWorldResultPayload {
  renderedMarkdown: string;
  originalText: string;
}

export type HelloWorldRequestMessage = MessageEnvelope<HelloWorldRequestPayload>;
export type HelloWorldResultMessage = MessageEnvelope<HelloWorldResultPayload>;
