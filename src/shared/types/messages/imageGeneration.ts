/**
 * Image Generation Message Payloads
 */
import { TokenUsage } from './tokenUsage';

export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3';

export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
  '3:2': { width: 1024, height: 683 },
  '2:3': { width: 683, height: 1024 },
};

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
