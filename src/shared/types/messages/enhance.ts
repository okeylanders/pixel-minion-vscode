/**
 * Prompt Enhancement Message Payloads
 */

export type EnhancePromptType = 'image' | 'svg';

export interface EnhancePromptRequestPayload {
  prompt: string;
  type: EnhancePromptType;
}

export interface EnhancePromptResponsePayload {
  enhancedPrompt: string;
  originalPrompt: string;
  type: EnhancePromptType;
}
