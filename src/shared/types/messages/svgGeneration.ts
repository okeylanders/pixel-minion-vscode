/**
 * SVG Generation Message Payloads
 */

import { AspectRatio } from './imageGeneration';

export interface SVGGenerationRequestPayload {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImage?: string;     // base64 encoded (single image)
  conversationId?: string;
}

export interface SVGConversationHistoryTurn {
  prompt: string;
  svgCode: string;
  turnNumber?: number;
}

export interface SVGGenerationContinuePayload {
  prompt: string;
  conversationId: string;
  history?: SVGConversationHistoryTurn[];
  model?: string;
  aspectRatio?: AspectRatio;
}

export interface SVGGenerationResponsePayload {
  conversationId: string;
  svgCode: string;
  turnNumber: number;
}

export interface SVGSaveRequestPayload {
  svgCode: string;
  suggestedFilename: string;
}

export interface SVGSaveResultPayload {
  success: boolean;
  filePath?: string;
  error?: string;
}
