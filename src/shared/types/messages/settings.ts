import { MessageType, MessageEnvelope } from './base';

export interface SettingsPayload {
  maxConversationTurns: number;
  openRouterModel: string;
  imageModel: string;
  svgModel: string;
  // SVG Architect settings
  svgBlueprintModel: string;
  svgArchitectMaxIterations: number;
  svgArchitectEnabled: boolean;
}

export interface UpdateSettingPayload {
  key: keyof SettingsPayload;
  value: unknown;
}

export type RequestSettingsMessage = MessageEnvelope<void>;
export type SettingsDataMessage = MessageEnvelope<SettingsPayload>;
export type UpdateSettingMessage = MessageEnvelope<UpdateSettingPayload>;
