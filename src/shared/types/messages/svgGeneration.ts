/**
 * SVG Generation Message Payloads
 */
import { TokenUsage } from './tokenUsage';

/**
 * The SVG tab's aspect ratios. Each maps to the viewBox the SVG prompt asks
 * for (ASPECT_RATIO_DIMENSIONS), so this stays a small fixed set, separate
 * from the Image API's wide `AspectRatio` (imageGeneration.ts).
 */
export type SVGAspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3';

export const SVG_ASPECT_RATIOS: readonly SVGAspectRatio[] = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'];

export const ASPECT_RATIO_DIMENSIONS: Record<SVGAspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
  '3:2': { width: 1024, height: 683 },
  '2:3': { width: 683, height: 1024 },
};

export interface SVGGenerationRequestPayload {
  prompt: string;
  model: string;
  aspectRatio: SVGAspectRatio;
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
  aspectRatio: SVGAspectRatio;
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
  aspectRatio?: SVGAspectRatio;
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
