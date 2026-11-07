// Ported from frame-minion@40e7949 packages/core/src/shared/models/ImageModels.ts; keep in sync
/**
 * Curated OpenRouter image-model catalog.
 *
 * Pure static data — consumed by both the webview (Image tab and Settings
 * model pickers) and infrastructure (OpenRouter provider config).
 *
 * PRICING. Image models bill in three different units, captured by
 * `ImagePricing.unit`:
 *   - `image`       → flat $/image (Recraft, Riverflow, Seedream, Grok Image)
 *   - `megapixel`   → $/output-megapixel (FLUX.2 family)
 *   - `image-token` → $/1M output tokens (Gemini image family, GPT Image, MAI)
 *
 * `approxUsdPerImage` is a display-only comparison, never a fixed bill.
 * Size/quality qualifiers and assumptions accompany estimates; native rates
 * remain authoritative. Frame's docs/research/image-price-estimates.md holds
 * the references and calculations. Gemini estimates use model-specific token
 * counts; FLUX uses an approximately 1 MP reference. Where multiple output
 * tiers exist, the lowest tier is stored.
 *
 * Pixel deltas from Frame's catalog (keep this list current when syncing):
 *   - Rows are limited to models OpenRouter serves on `/chat/completions`,
 *     the only route Pixel speaks until the Image API transport lands
 *     (roadmap P3). Image-API-only models (GPT Image, Krea, FLUX.3, Qwen,
 *     Muse, …) are left out, not deleted from Frame; a test pins the list.
 *   - Nano Banana Pro keeps Pixel's ⭐.
 *   - Recraft `*-vector` models live in the SVG catalog (SVGModels.ts):
 *     Pixel's SVG tab is where SVG output belongs.
 */

import type { ImageApiAspectRatio, ImageModelDefinition } from '../types/providers';

// Captured from live Image API per-model endpoint records.
// OpenRouter normalizes these strings, but providers derive the concrete pixels.
const ASPECT_RATIOS = {
  gemini31: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'],
  gemini25: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
  openAiModern: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9', 'auto'],
  openAiClassic: ['1:1', '2:3', '3:2', 'auto'],
  mai: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', 'auto'],
  riverflow: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9', 'auto'],
  recraft: ['1:1', '3:4', '4:3', '9:16', '16:9', 'auto'],
  flux: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9', 'auto'],
  seedream: ['1:1', '1:2', '2:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '9:19.5', '19.5:9', '9:20', '20:9', '9:21', '21:9', 'auto'],
} satisfies Record<string, readonly ImageApiAspectRatio[]>;

export const OPENROUTER_IMAGE_MODELS: ImageModelDefinition[] = [
  // ── Google Gemini image family (token-billed) ───────────────────────────
  { id: 'google/gemini-3.1-flash-image', referenceImages: { min: 0, max: 14 }, displayName: '⭐ Nano Banana 2 (Google: Gemini 3.1 Flash Image) - Recommended', imagePricing: { unit: 'image-token', input: 0.50, output: 60, approxUsdPerImage: 0.0672, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['512', '1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.gemini31 },
  { id: 'google/gemini-3.1-flash-lite-image', referenceImages: { min: 0, max: 14 }, displayName: 'Nano Banana 2 Lite (Google: Gemini 3.1 Flash Lite Image)', imagePricing: { unit: 'image-token', input: 0.25, output: 30, approxUsdPerImage: 0.0336, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['1K'], supportedAspectRatios: ASPECT_RATIOS.gemini31 },
  { id: 'google/gemini-2.5-flash-image', referenceImages: { min: 0, max: 3 }, displayName: 'Nano Banana (Google: Gemini 2.5 Flash Image)', imagePricing: { unit: 'image-token', input: 0.30, output: 30, approxUsdPerImage: 0.0387, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,290 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedAspectRatios: ASPECT_RATIOS.gemini25 },
  { id: 'google/gemini-3-pro-image', referenceImages: { min: 0, max: 14 }, displayName: '⭐ Nano Banana Pro (Google: Gemini 3 Pro Image)', imagePricing: { unit: 'image-token', input: 2.00, output: 120, approxUsdPerImage: 0.1344, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.gemini25 },

  // ── OpenAI GPT image family (token-billed; per-image varies by size/quality) ──
  { id: 'openai/gpt-5.4-image-2', referenceImages: { min: 0, max: 16 }, displayName: 'GPT-5.4 Image 2', imagePricing: { unit: 'image-token', output: 30, approxUsdPerImage: 0.211, approxNote: '@ 1K · high', approxBasis: '1024×1024, high quality; GPT Image 2 output-only reference. Prompt and reference-image charges are additional; Auto quality may differ. Language-model and reasoning charges are also additional.' }, supportedAspectRatios: ASPECT_RATIOS.openAiModern },
  { id: 'openai/gpt-5-image-mini', referenceImages: { min: 0, max: 16 }, displayName: 'GPT-5 Image Mini', imagePricing: { unit: 'image-token', output: 8, approxUsdPerImage: 0.036, approxNote: '@ 1K · high', approxBasis: '1024×1024, high quality; GPT Image 1 Mini output-only reference. Prompt and reference-image charges are additional; Auto quality may differ. Language-model and reasoning charges are also additional.' }, supportedAspectRatios: ASPECT_RATIOS.openAiClassic },
  { id: 'openai/gpt-5-image', referenceImages: { min: 0, max: 16 }, displayName: 'GPT-5 Image', imagePricing: { unit: 'image-token', output: 40, approxUsdPerImage: 0.167, approxNote: '@ 1K · high', approxBasis: '1024×1024, high quality; GPT Image 1 output-only reference. Prompt and reference-image charges are additional; Auto quality may differ. Language-model and reasoning charges are also additional.' }, supportedAspectRatios: ASPECT_RATIOS.openAiClassic },

  // ── Microsoft MAI-Image (token-billed) ──────────────────────────────────
  { id: 'microsoft/mai-image-2.5', referenceImages: { min: 0, max: 1 }, displayName: 'Microsoft: MAI-Image 2.5', imagePricing: { unit: 'image-token', input: 8, output: 47, approxUsdPerImage: 0.048, approxBasis: 'Assumes 1,024 image output tokens per image, using the documented MAI family reference. Actual token usage may vary; prompt and reference-image charges are additional.' }, supportedAspectRatios: ASPECT_RATIOS.mai },
  { id: 'microsoft/mai-image-2.5-pro', referenceImages: { min: 0, max: 1 }, displayName: 'Microsoft: MAI-Image 2.5 Pro', imagePricing: { unit: 'image-token', input: 8, output: 108, approxUsdPerImage: 0.111, approxBasis: 'Assumes 1,024 image output tokens per image, using the documented MAI family reference. Actual token usage may vary; prompt and reference-image charges are additional.' }, supportedAspectRatios: ASPECT_RATIOS.mai },

  // ── Sourceful Riverflow (per-image) ─────────────────────────────────────
  { id: 'sourceful/riverflow-v2.5-pro', referenceImages: { min: 0, max: 10 }, displayName: 'Riverflow V2.5 Pro', imagePricing: { unit: 'image', output: 0.13 }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },
  { id: 'sourceful/riverflow-v2.5-fast', referenceImages: { min: 0, max: 4 }, displayName: 'Riverflow V2.5 Fast', imagePricing: { unit: 'image', output: 0.019 }, supportedResolutions: ['1K', '2K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },
  { id: 'sourceful/riverflow-v2-pro', referenceImages: { min: 0, max: 10 }, displayName: 'Riverflow V2 Pro', imagePricing: { unit: 'image', output: 0.15 }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },
  { id: 'sourceful/riverflow-v2-fast', referenceImages: { min: 0, max: 4 }, displayName: 'Riverflow V2 Fast', imagePricing: { unit: 'image', output: 0.02 }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },

  // ── Recraft raster (per-image) ──────────────────────────────────────────
  { id: 'recraft/recraft-v4.1-pro', referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1 Pro', imagePricing: { unit: 'image', output: 0.21 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4.1', referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1', imagePricing: { unit: 'image', output: 0.035 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4.1-utility-pro', referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1 Utility Pro', imagePricing: { unit: 'image', output: 0.21 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4.1-utility', referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1 Utility', imagePricing: { unit: 'image', output: 0.035 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4-pro', referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4 Pro', imagePricing: { unit: 'image', output: 0.25 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4', referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4', imagePricing: { unit: 'image', output: 0.04 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v3', referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V3', imagePricing: { unit: 'image', output: 0.04 }, supportedAspectRatios: ASPECT_RATIOS.recraft },

  // ── Black Forest Labs FLUX.2 (megapixel-billed) ─────────────────────────
  { id: 'black-forest-labs/flux.2-klein-4b', referenceImages: { min: 0, max: 4 }, displayName: 'FLUX.2 Klein 4B', imagePricing: { unit: 'megapixel', output: 0.014, approxUsdPerImage: 0.014, approxNote: '@ ~1 MP', approxBasis: 'Approximately one output megapixel; larger images and reference inputs can cost more.' }, supportedAspectRatios: ASPECT_RATIOS.flux },
  { id: 'black-forest-labs/flux.2-pro', referenceImages: { min: 0, max: 8 }, displayName: 'FLUX.2 Pro', imagePricing: { unit: 'megapixel', output: 0.03, approxUsdPerImage: 0.03, approxNote: '@ ~1 MP', approxBasis: 'Approximately one output megapixel; larger images and reference inputs can cost more.' }, supportedAspectRatios: ASPECT_RATIOS.flux },
  { id: 'black-forest-labs/flux.2-flex', referenceImages: { min: 0, max: 8 }, displayName: 'FLUX.2 Flex', imagePricing: { unit: 'megapixel', input: 0.06, output: 0.06, approxUsdPerImage: 0.06, approxNote: '@ ~1 MP', approxBasis: 'Approximately one output megapixel; larger images and reference inputs can cost more.' }, supportedAspectRatios: ASPECT_RATIOS.flux },
  { id: 'black-forest-labs/flux.2-max', referenceImages: { min: 0, max: 8 }, displayName: 'FLUX.2 Max', imagePricing: { unit: 'megapixel', output: 0.07, approxUsdPerImage: 0.07, approxNote: '@ ~1 MP', approxBasis: 'Approximately one output megapixel; larger images and reference inputs can cost more.' }, supportedAspectRatios: ASPECT_RATIOS.flux },

  // ── ByteDance Seedream (per-image) ──────────────────────────────────────
  { id: 'bytedance-seed/seedream-4.5', referenceImages: { min: 0, max: 14 }, displayName: 'Seedream 4.5', imagePricing: { unit: 'image', output: 0.04 }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.seedream },

  // ── Gemini preview aliases (kept for older projects; each mirrors its
  //    parent's pricing) ────────────────────────────────────────────────────
  { id: 'google/gemini-3.1-flash-image-preview', referenceImages: { min: 0, max: 14 }, displayName: 'Nano Banana 2 Preview (Google: Gemini 3.1 Flash Image Preview)', imagePricing: { unit: 'image-token', input: 0.50, output: 60, approxUsdPerImage: 0.0672, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['512', '1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.gemini31 },
  { id: 'google/gemini-3-pro-image-preview', referenceImages: { min: 0, max: 14 }, displayName: 'Nano Banana Pro Preview (Google: Gemini 3 Pro Image Preview)', imagePricing: { unit: 'image-token', input: 2.00, output: 120, approxUsdPerImage: 0.1344, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.gemini25 },
];

/** Default model for image generation */
export const DEFAULT_IMAGE_MODEL = 'google/gemini-3.1-flash-image';
