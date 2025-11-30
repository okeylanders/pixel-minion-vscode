import { MessageType, MessageEnvelope } from './base';
import { AspectRatio } from './imageGeneration';

export interface SettingsPayload {
  maxConversationTurns: number;
  openRouterModel: string;
  defaultImageModel: string;
  defaultSVGModel: string;
  defaultAspectRatio: AspectRatio;
}

export interface UpdateSettingPayload {
  key: keyof SettingsPayload;
  value: unknown;
}

export type RequestSettingsMessage = MessageEnvelope<void>;
export type SettingsDataMessage = MessageEnvelope<SettingsPayload>;
export type UpdateSettingMessage = MessageEnvelope<UpdateSettingPayload>;
