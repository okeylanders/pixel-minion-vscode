/**
 * Image Generation Message Payloads
 */
import { TokenUsage } from './tokenUsage';

/**
 * Normalized aspect ratios published by OpenRouter's Image API (Frame's
 * `AspectRatio`). The SVG tab keeps its own seven viewBox ratios
 * (`SVGAspectRatio`, svgGeneration.ts).
 */
export type AspectRatio =
  | 'auto'
  | '1:1' | '1:2' | '2:1' | '1:4' | '4:1' | '1:8' | '8:1'
  | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '7:5' | '5:7'
  | '9:16' | '16:9' | '21:9'
  | '9:19.5' | '19.5:9' | '9:20' | '20:9' | '9:21';

export interface ImageGenerationRequestPayload {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImages?: string[];  // base64 encoded
  referenceSvgText?: string;   // raw SVG text (if attachment was SVG)
  conversationId?: string;     // for continuation
  seed?: number;               // optional seed for reproducibility (auto-generated if not provided)
}

/**
 * History turn for re-hydration (lightweight: prompts + image refs)
 */
export interface ConversationHistoryTurn {
  prompt: string;
  images: Array<{
    data: string;      // base64 data URL
    seed: number;
  }>;
  referenceSvgText?: string;
}

/**
 * The settings a conversation was started with. A continuation always uses
 * these, never the draft controls: changing the picker only affects the next
 * Generate.
 */
export interface ImageThreadSettings {
  model: string;
  aspectRatio: AspectRatio;
}

/**
 * A follow-up turn. It carries only the new prompt: reference images and an
 * attached SVG belong to the turn they were sent with (and travel in
 * `history`), so a draft attachment is never added to a refinement.
 */
export interface ImageGenerationContinuePayload {
  prompt: string;
  conversationId: string;
  /**
   * Conversation history for re-hydration.
   * Always sent - handler uses it to rebuild conversation if lost (e.g., extension restart).
   */
  history?: ConversationHistoryTurn[];
  /**
   * The thread's model and aspect ratio (ImageThreadSettings), needed for
   * re-hydration.
   */
  model?: string;
  aspectRatio?: AspectRatio;
}

export interface GeneratedImage {
  id: string;
  data: string;          // base64
  mimeType: string;      // 'image/png' | 'image/jpeg'
  prompt: string;        // prompt that generated it
  timestamp: number;
  seed: number;          // seed used for generation (for reproducibility)
}

/**
 * A single turn in the conversation history
 */
export interface ConversationTurn {
  id: string;
  prompt: string;
  images: GeneratedImage[];
  turnNumber: number;
  timestamp: number;
  usage?: TokenUsage;
  referenceSvgText?: string;
}

export interface ImageGenerationResponsePayload {
  conversationId: string;
  images: GeneratedImage[];
  turnNumber: number;
  usage?: TokenUsage;
}

export interface ImageSaveRequestPayload {
  imageId: string;
  data: string;              // base64
  mimeType: string;
  suggestedFilename: string;
}

export interface ImageSaveResultPayload {
  success: boolean;
  imageId: string;
  filePath?: string;
  /** The user dismissed the save dialog: not an error, and not saved. */
  cancelled?: boolean;
  error?: string;
}
