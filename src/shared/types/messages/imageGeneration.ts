// Ported from frame-minion@40e7949 packages/core/src/shared/types/messages/imageGeneration.ts; keep in sync
/**
 * Image Generation Message Payloads
 *
 * Pixel deltas from Frame:
 *   - A continuation carries no `referenceSvgText` (P2): an attachment
 *     belongs to the turn it was sent with, so a refinement is only a prompt.
 *   - `ImageSaveResultPayload.cancelled` (P2: a dismissed save dialog is not
 *     an error).
 *   - The SVG tab keeps its own seven viewBox ratios (`SVGAspectRatio`,
 *     svgGeneration.ts); `AspectRatio` here is the Image API's wide set.
 */
import { TokenUsage } from './tokenUsage';

/** Normalized aspect ratios published by OpenRouter's Image API. */
export type AspectRatio =
  | 'auto'
  | '1:1' | '1:2' | '2:1' | '1:4' | '4:1' | '1:8' | '8:1'
  | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '7:5' | '5:7'
  | '9:16' | '16:9' | '21:9'
  | '9:19.5' | '19.5:9' | '9:20' | '20:9' | '9:21';
export type ImageResolution = 'auto' | '512' | '768' | '1K' | '1.5K' | '2K' | '4K';
/** `edit` remains the persisted/wire value for the Single Shot UI mode. */
export type ImageGenerationMode = 'conversation' | 'edit';

/**
 * Immutable settings for an existing image thread; draft controls are
 * separate. A continuation always uses these: changing the picker only
 * affects the next Generate.
 */
export interface ImageThreadSettings {
  mode: ImageGenerationMode;
  model: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
}

export interface ImageGenerationRequestPayload {
  /** Required: the host refuses a request without a known mode before any provider call. */
  mode: ImageGenerationMode;
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  /** OpenRouter Image API output tier. `auto` omits the field. */
  resolution?: ImageResolution;
  referenceImages?: string[];  // base64 encoded
  referenceSvgText?: string;   // raw SVG text (if attachment was SVG)
  conversationId?: string;     // for continuation
  seed?: number;               // optional seed for reproducibility (auto-generated if not provided)
}

/**
 * A display turn as the host sees it (lightweight: prompt + image refs). A
 * follow-up sends only the latest Single Shot turn's `images`
 * (`ImageGenerationContinuePayload.latestImages`).
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
 * A follow-up turn. It carries only the new prompt: reference images and an
 * attached SVG belong to the turn they were sent with, so a draft attachment
 * is never added to a refinement. It carries no display history either: the
 * host keeps a Conversation's transcript, and a Single Shot follow-up uses
 * only the latest images.
 */
export interface ImageGenerationContinuePayload {
  /** The thread's mode. Required, like a new request's. */
  mode: ImageGenerationMode;
  prompt: string;
  conversationId: string;
  /**
   * Turns in the visible thread. A Conversation restored from its host
   * transcript must have as many; a Single Shot thread restarted after a host
   * restart numbers its next turn from it.
   */
  turnCount: number;
  /**
   * Single Shot only: the latest turn's images (the follow-up's references),
   * so the thread can restart after a host restart.
   */
  latestImages?: ConversationHistoryTurn['images'];
  /** The thread's settings (ImageThreadSettings), needed for re-hydration. */
  model?: string;
  aspectRatio?: AspectRatio;
  resolution?: ImageResolution;
}

export interface GeneratedImage {
  /** False means the provider did not receive a seed; do not offer copy-seed. */
  seedSupported?: boolean;
  id: string;
  data: string;          // base64
  mimeType: string;      // 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  prompt: string;        // prompt that generated it
  aspectRatio?: AspectRatio; // requested aspect ratio for the generated image
  resolution?: ImageResolution;
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
  /** Display history omitted image bytes to stay within local storage limits. */
  imagesOmitted?: boolean;
  turnNumber: number;
  timestamp: number;
  usage?: TokenUsage;
  referenceSvgText?: string;
}

export interface ImageGenerationResponsePayload {
  settings?: ImageThreadSettings;
  recoveryWarning?: string;
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
