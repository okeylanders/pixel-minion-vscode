// Ported from frame-minion@40e7949 packages/core/src/shared/models/ImageGenerationModes.ts; keep in sync
/**
 * What each image model can do in each mode, and how the request travels.
 *
 * Mode and transport are different things: Conversation sends the whole
 * thread to `/chat/completions`; Single Shot (the `edit` wire value) sends
 * only the latest prompt and its image references, to the dedicated Image API
 * (`/images`) unless a catalog row names another transport. Both the Image
 * tab's controls and the host's checks before a request read this one
 * function, so the UI and the host cannot disagree about a model.
 *
 * Pixel deltas from Frame:
 *   - The conversational set follows the keyed 2026-11-07 probe, re-checked
 *     2026-11-12 (provider-contracts/openrouter-image-chat-routes-2026-11-12.json):
 *     Frame's six Gemini aliases plus Nano Banana 2.1, and the three GPT-5
 *     image wrappers. Meta Muse is gone from both modes: OpenRouter now rejects
 *     it on `/chat/completions` and lists no Image API endpoint for it.
 *   - Conversation also carries the model's audited reference-image bounds
 *     (from its Image API record), so a Conversation request with more
 *     references than the model takes is refused before it is sent. Frame
 *     leaves Conversation references unbounded.
 *   - `defaultImageMode` names Frame's rule for a new thread (Conversation
 *     when a verified route exists, otherwise Single Shot), which Frame
 *     inlines in its hook.
 *   - The project-frame helpers (`imageFrameModelUnavailableReason`,
 *     `imageFrameAspectRatioPolicy`) are not ported: Pixel has no orchestrator.
 */
import type { ImageGenerationMode, AspectRatio, ImageResolution } from '../types/messages/imageGeneration';
import { OPENROUTER_IMAGE_MODELS } from './ImageModels';

export interface ImageRouteCapabilities {
  transport: 'images' | 'chat-completions';
  modalities?: ('image' | 'text')[];
  supportedAspectRatios: readonly AspectRatio[];
  supportedResolutions: readonly Exclude<ImageResolution, 'auto'>[];
  supportsSeed: boolean;
  referenceImages?: { min: number; max: number };
  referenceMimeTypes?: readonly ('image/png' | 'image/jpeg' | 'image/webp')[];
  /** From the catalog row: what the model does with its references (wording only). */
  referenceRole?: 'style' | 'edit';
  /** From the catalog row: the provider's request-size limit (a warning, not a gate). */
  maxRequestBytes?: number;
}

// Chat endpoint records and the routing probe checked 2026-11-07 / 2026-11-12.
// A catalog listing for an image generator alone does not establish a
// conversational route.
const GEMINI_CHAT_MODELS = new Set([
  'google/gemini-nano-banana-2.1',
  'google/gemini-3.1-flash-image', 'google/gemini-3.1-flash-lite-image',
  'google/gemini-2.5-flash-image', 'google/gemini-3-pro-image',
  'google/gemini-3.1-flash-image-preview', 'google/gemini-3-pro-image-preview',
]);
const GPT_CHAT_MODELS = new Set([
  'openai/gpt-5.4-image-2', 'openai/gpt-5-image', 'openai/gpt-5-image-mini',
]);

export function imageRouteCapabilities(modelId: string, mode: ImageGenerationMode): ImageRouteCapabilities | undefined {
  const model = OPENROUTER_IMAGE_MODELS.find(entry => entry.id === modelId);
  // A custom id can try Single Shot with automatic dimensions; Conversation
  // stays strict until its route is verified.
  if (!model) return mode === 'edit' && modelId.trim() ? {
    transport: 'images', supportedAspectRatios: ['auto'], supportedResolutions: [], supportsSeed: true,
  } : undefined;
  if (mode === 'edit') {
    return {
      transport: model.transport ?? 'images',
      modalities: ['image'],
      supportedAspectRatios: model.supportedAspectRatios ?? ['auto'],
      supportedResolutions: model.supportedResolutions ?? [],
      supportsSeed: model.supportsSeed !== false,
      referenceImages: model.referenceImages,
      referenceMimeTypes: model.referenceMimeTypes,
      referenceRole: model.referenceRole,
      maxRequestBytes: model.maxRequestBytes,
    };
  }
  if (mode !== 'conversation') return undefined;
  if (!GEMINI_CHAT_MODELS.has(modelId) && !GPT_CHAT_MODELS.has(modelId)) return undefined;
  return {
    transport: 'chat-completions', modalities: ['image', 'text'],
    supportedAspectRatios: model.supportedAspectRatios ?? ['auto'],
    // Gemini chat uses image_config.image_size. The dedicated API's 512
    // spelling is not assumed to work on chat; request the native K tiers.
    supportedResolutions: GEMINI_CHAT_MODELS.has(modelId)
      ? (model.supportedResolutions ?? []).filter(resolution => resolution !== '512') : [],
    // The chat routes list `seed`, unlike these models' Image API records.
    supportsSeed: true,
    referenceImages: model.referenceImages,
    referenceMimeTypes: model.referenceMimeTypes,
    referenceRole: model.referenceRole,
    maxRequestBytes: model.maxRequestBytes,
  };
}

/** Frame's rule for a new thread: Conversation when the model has a verified route. */
export function defaultImageMode(modelId: string): ImageGenerationMode {
  return imageRouteCapabilities(modelId, 'conversation') ? 'conversation' : 'edit';
}

export function imageModeLabel(mode: ImageGenerationMode): string {
  return mode === 'conversation' ? 'Conversation' : 'Single Shot';
}

export function imageModeDescription(mode: ImageGenerationMode): string {
  return mode === 'conversation'
    ? 'Uses previous messages and images as context.'
    : 'Each follow-up uses the latest generated images and your new prompt. Earlier messages are not included.';
}

/** Explain the selected wire route separately from a thread's context policy. */
export function imageModeEndpointDescription(mode: ImageGenerationMode, modelId: string): string {
  if (mode === 'conversation') {
    return 'Conversation uses OpenRouter’s /chat/completions endpoint, with previous messages and images as context.';
  }
  if (imageRouteCapabilities(modelId, mode)?.transport === 'chat-completions') {
    return 'This model uses OpenRouter’s /chat/completions endpoint for Single Shot, sending only the current prompt and image references. Other Single Shot models use /images, where some newer models are available exclusively and resolution and aspect-ratio controls may be better supported.';
  }
  return 'Single Shot uses OpenRouter’s /images endpoint instead of /chat/completions. Some newer models are available only through /images, which may offer better support for resolution and aspect-ratio controls. Each request uses only its prompt and image references.';
}
