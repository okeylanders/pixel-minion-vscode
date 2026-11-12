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
  /** Raster reference (data URL) sent with this turn, replayed on re-hydration. */
  referenceImage?: string;
  usage?: TokenUsage;
}

/** The settings an SVG conversation was started with; continuations use these. */
export interface SVGThreadSettings {
  model: string;
  aspectRatio: AspectRatio;
}

/**
 * A refinement. It carries only the new prompt: attachments belong to the
 * turn they were sent with (and travel in `history`), so a draft attachment
 * is never added to a refinement.
 */
export interface SVGGenerationContinuePayload {
  prompt: string;
  conversationId: string;
  history?: SVGConversationHistoryTurn[];
  /** The thread's model and aspect ratio (SVGThreadSettings), for re-hydration. */
  model?: string;
  aspectRatio?: AspectRatio;
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
  /** The user dismissed the save dialog: not an error, and not saved. */
  cancelled?: boolean;
  error?: string;
}
