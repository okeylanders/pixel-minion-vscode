import { MessageType, MessageEnvelope } from './base';

export interface SettingsPayload {
  maxConversationTurns: number;
  openRouterModel: string;
  imageModel: string;
  svgModel: string;
}

export interface UpdateSettingPayload {
  key: keyof SettingsPayload;
  value: unknown;
}

export type RequestSettingsMessage = MessageEnvelope<void>;
export type SettingsDataMessage = MessageEnvelope<SettingsPayload>;
export type UpdateSettingMessage = MessageEnvelope<UpdateSettingPayload>;
