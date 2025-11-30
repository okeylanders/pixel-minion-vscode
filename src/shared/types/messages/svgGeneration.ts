/**
 * SVG Generation Message Payloads
 */
import { AspectRatio } from './imageGeneration';
import { TokenUsage } from './tokenUsage';

export interface SVGGenerationRequestPayload {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImage?: string;     // base64 encoded (single image)
  referenceSvgText?: string;   // raw SVG text (if attachment is SVG)
  conversationId?: string;
}

export interface SVGConversationHistoryTurn {
  prompt: string;
  svgCode: string;
  turnNumber?: number;
  referenceSvgText?: string;
  usage?: TokenUsage;
}

export interface SVGGenerationContinuePayload {
  prompt: string;
  conversationId: string;
  history?: SVGConversationHistoryTurn[];
  model?: string;
  aspectRatio?: AspectRatio;
  referenceSvgText?: string;
}

export interface SVGGenerationResponsePayload {
  conversationId: string;
  svgCode: string;
  turnNumber: number;
  usage?: TokenUsage;
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
