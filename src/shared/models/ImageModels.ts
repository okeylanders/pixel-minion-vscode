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
 * Re-audited 2026-11-07 against the live, unauthenticated
 * `GET /api/v1/images/models` + per-model `.../endpoints` records (prices,
 * reference counts, ratios, resolutions, seed) and OpenRouter's media
 * benchmarks (measured cost); see docs/model-catalog-audit-2026-11-07.md.
 * Each new or changed price carries its source in a trailing comment.
 *
 * Pixel deltas from Frame's catalog (keep this list current when syncing):
 *   - Rows are limited to models OpenRouter serves on `/chat/completions`,
 *     the only route Pixel speaks until the Image API transport lands
 *     (roadmap P3). A probe on 2026-11-07 showed GPT Image, Krea, FLUX.3,
 *     Qwen Image and Muse reject chat/completions; they are left out here,
 *     not deleted from Frame, and a client test pins the blocked list.
 *   - Added ahead of Frame (upstream candidates): Nano Banana 2.1 and
 *     Riverflow V2.6 Pro. Frame's delisted rows (Grok Imagine Image
 *     Quality, Ming, Riverflow previews, Gemini 2.5 preview) are absent.
 *   - Recraft V4 Styles / Styles Pro are left out although chat-routable:
 *     they require 1–10 style references and Pixel has no gating that keeps
 *     Generate disabled until one is attached (it arrives with P3/P4).
 *   - Recraft V4.1 Flash is left out for the inverse reason: it accepts no
 *     reference image, but Pixel's Refine always sends the previous image
 *     and attachments survive a model switch. It returns with the same
 *     capability-aware controls (P3/P4); a catalog test enforces this.
 *   - `supportsSeed: false` wherever the Image API endpoint record lists no
 *     `seed` parameter (records are "definitive supported parameters").
 *   - Input rates added where OpenRouter itemizes them (GPT-5.x wrappers,
 *     Riverflow V2 per reference, Seedream 5 Pro and Grok per reference).
 *   - Nano Banana Pro keeps Pixel's ⭐; Nano Banana 2.1 gets one (cheaper
 *     output and higher benchmark pass rates than Nano Banana 2; audit §3).
 *   - Recraft `*-vector` models live in the SVG catalog (SVGModels.ts):
 *     Pixel's SVG tab is where SVG output belongs.
 */

import type { ImageModelDefinition } from '../types/providers';
import type { AspectRatio } from '../types/messages/imageGeneration';

// Captured from live Image API per-model endpoint records.
// OpenRouter normalizes these strings, but providers derive the concrete pixels.
const ASPECT_RATIOS = {
  gemini31: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'],
  gemini25: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
  openAiModern: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9', 'auto'],
  openAiClassic: ['1:1', '2:3', '3:2', 'auto'],
  mai: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', 'auto'],
  riverflow: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9', 'auto'],
  riverflow26: ['1:1', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '16:9', '9:16', '21:9', 'auto'],
  grok: ['1:1', '1:2', '2:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '9:19.5', '19.5:9', '9:20', '20:9', 'auto'],
  recraft: ['1:1', '3:4', '4:3', '9:16', '16:9', 'auto'],
  flux: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9', 'auto'],
  seedream: ['1:1', '1:2', '2:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '9:19.5', '19.5:9', '9:20', '20:9', '9:21', '21:9', 'auto'],
} satisfies Record<string, readonly AspectRatio[]>;

export const OPENROUTER_IMAGE_MODELS: ImageModelDefinition[] = [
  // ── Google Gemini image family (token-billed) ───────────────────────────
  // out $30/1M [endpoints]; prompt $1.5/1M [chat feed]. Google's per-image token count was not
  // verifiable (ai.google.dev blocked), so the estimate is OpenRouter's measured median, not a token count.
  { id: 'google/gemini-nano-banana-2.1', supportsSeed: false, referenceImages: { min: 0, max: 14 }, displayName: '⭐ Nano Banana 2.1 (Google: Gemini Nano Banana 2.1) - Recommended', description: 'Flash-tier successor to Nano Banana 2 and Nano Banana Pro, with improved product recontextualization and editing.', imagePricing: { unit: 'image-token', input: 1.5, output: 30, approxUsdPerImage: 0.036, approxNote: '@ 1K', approxBasis: 'OpenRouter benchmark median at 1024×1024 (14 text-to-image generations, measured cost). Google’s per-image token count for this model was not verified. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.gemini31 },
  { id: 'google/gemini-3.1-flash-image', supportsSeed: false, referenceImages: { min: 0, max: 14 }, displayName: '⭐ Nano Banana 2 (Google: Gemini 3.1 Flash Image) - Recommended', imagePricing: { unit: 'image-token', input: 0.50, output: 60, approxUsdPerImage: 0.0672, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['512', '1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.gemini31 },
  { id: 'google/gemini-3.1-flash-lite-image', supportsSeed: false, referenceImages: { min: 0, max: 14 }, displayName: 'Nano Banana 2 Lite (Google: Gemini 3.1 Flash Lite Image)', imagePricing: { unit: 'image-token', input: 0.25, output: 30, approxUsdPerImage: 0.0336, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['1K'], supportedAspectRatios: ASPECT_RATIOS.gemini31 },
  { id: 'google/gemini-2.5-flash-image', supportsSeed: false, referenceImages: { min: 0, max: 3 }, displayName: 'Nano Banana (Google: Gemini 2.5 Flash Image)', imagePricing: { unit: 'image-token', input: 0.30, output: 30, approxUsdPerImage: 0.0387, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,290 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedAspectRatios: ASPECT_RATIOS.gemini25 },
  // 4K is advertised only by the google-ai-studio/global endpoint; vertex/global offers 1K/2K (audit O4). Union kept, matching Frame.
  { id: 'google/gemini-3-pro-image', supportsSeed: false, referenceImages: { min: 0, max: 14 }, displayName: '⭐ Nano Banana Pro (Google: Gemini 3 Pro Image)', imagePricing: { unit: 'image-token', input: 2.00, output: 120, approxUsdPerImage: 0.1344, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.gemini25 },

  // ── OpenAI GPT image family (token-billed; per-image varies by size/quality) ──
  // Input-image rates added from the endpoint records: $8 / $2.5 / $10 per 1M.
  { id: 'openai/gpt-5.4-image-2', supportsSeed: false, referenceImages: { min: 0, max: 16 }, displayName: 'GPT-5.4 Image 2', imagePricing: { unit: 'image-token', input: 8, output: 30, approxUsdPerImage: 0.211, approxNote: '@ 1K · high', approxBasis: '1024×1024, high quality; GPT Image 2 output-only reference. Prompt and reference-image charges are additional; Auto quality may differ. Language-model and reasoning charges are also additional.' }, supportedAspectRatios: ASPECT_RATIOS.openAiModern },
  // Retiring: the chat feed's expiration_date is 2026-12-01 (labelled in the picker; audit U5).
  { id: 'openai/gpt-5-image-mini', supportsSeed: false, referenceImages: { min: 0, max: 16 }, displayName: 'GPT-5 Image Mini', imagePricing: { unit: 'image-token', input: 2.5, output: 8, approxUsdPerImage: 0.036, approxNote: '@ 1K · high', approxBasis: '1024×1024, high quality; GPT Image 1 Mini output-only reference. Prompt and reference-image charges are additional; Auto quality may differ. Language-model and reasoning charges are also additional.' }, supportedAspectRatios: ASPECT_RATIOS.openAiClassic },
  { id: 'openai/gpt-5-image', supportsSeed: false, referenceImages: { min: 0, max: 16 }, displayName: 'GPT-5 Image', imagePricing: { unit: 'image-token', input: 10, output: 40, approxUsdPerImage: 0.167, approxNote: '@ 1K · high', approxBasis: '1024×1024, high quality; GPT Image 1 output-only reference. Prompt and reference-image charges are additional; Auto quality may differ. Language-model and reasoning charges are also additional.' }, supportedAspectRatios: ASPECT_RATIOS.openAiClassic },

  // ── Microsoft MAI-Image (token-billed) ──────────────────────────────────
  // 2.6 rows verbatim from Frame; [endpoints] in-img $8 / out $38 and $2.5 / $19; [bench] $0.0392 / $0.0196 corroborate.
  { id: 'microsoft/mai-image-2.6', referenceImages: { min: 0, max: 5 }, supportsSeed: false, displayName: 'Microsoft: MAI-Image 2.6', description: 'Text-to-image generation and reference-guided editing across portrait, landscape, and square compositions.', imagePricing: { unit: 'image-token', input: 8, output: 38, approxUsdPerImage: 0.039, approxBasis: 'Assumes 1,024 image output tokens per image, using the documented MAI family reference. Actual token usage may vary; prompt and reference-image charges are additional.' }, supportedAspectRatios: ASPECT_RATIOS.mai },
  { id: 'microsoft/mai-image-2.6-flash', referenceImages: { min: 0, max: 5 }, supportsSeed: false, displayName: 'Microsoft: MAI-Image 2.6 Flash', description: 'Lower-latency MAI image generation and reference-guided editing for quick visual iteration.', imagePricing: { unit: 'image-token', input: 2.5, output: 19, approxUsdPerImage: 0.0195, approxBasis: 'Assumes 1,024 image output tokens per image, using the documented MAI family reference. Actual token usage may vary; prompt and reference-image charges are additional.' }, supportedAspectRatios: ASPECT_RATIOS.mai },
  { id: 'microsoft/mai-image-2.5', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Microsoft: MAI-Image 2.5', imagePricing: { unit: 'image-token', input: 8, output: 47, approxUsdPerImage: 0.048, approxBasis: 'Assumes 1,024 image output tokens per image, using the documented MAI family reference. Actual token usage may vary; prompt and reference-image charges are additional.' }, supportedAspectRatios: ASPECT_RATIOS.mai },
  { id: 'microsoft/mai-image-2.5-pro', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Microsoft: MAI-Image 2.5 Pro', imagePricing: { unit: 'image-token', input: 8, output: 108, approxUsdPerImage: 0.111, approxBasis: 'Assumes 1,024 image output tokens per image, using the documented MAI family reference. Actual token usage may vary; prompt and reference-image charges are additional.' }, supportedAspectRatios: ASPECT_RATIOS.mai },

  // ── Sourceful Riverflow (per-image) ─────────────────────────────────────
  // [bench] measured V2.6 Pro / V2.5 Pro / V2.5 Fast above list at 1024² with no references (audit O6);
  // the bases say so rather than changing the list price.
  { id: 'sourceful/riverflow-v2.6-pro', supportsSeed: false, referenceImages: { min: 0, max: 10 }, displayName: 'Riverflow V2.6 Pro', description: 'Flagship Riverflow 2.6: a unified text-to-image and image-to-image workflow with an integrated planning step.', imagePricing: { unit: 'image', output: 0.13, approxNote: '@ 1K', approxBasis: '1K list rate; 2K $0.15, 4K $0.17. OpenRouter’s benchmark paid a $0.157 median per 1024×1024 image, above list.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.riverflow26 }, // NEW 2026-10-29 [endpoints]
  { id: 'sourceful/riverflow-v2.5-pro', supportsSeed: false, referenceImages: { min: 0, max: 10 }, displayName: 'Riverflow V2.5 Pro', imagePricing: { unit: 'image', output: 0.13, approxNote: '@ 1K', approxBasis: '1K list rate; 2K $0.15, 4K $0.17. OpenRouter’s benchmark paid a $0.248 median per 1024×1024 image, above list.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },
  { id: 'sourceful/riverflow-v2.5-fast', supportsSeed: false, referenceImages: { min: 0, max: 4 }, displayName: 'Riverflow V2.5 Fast', imagePricing: { unit: 'image', output: 0.019, approxNote: '@ 1K', approxBasis: '1K list rate; 2K $0.021. OpenRouter’s benchmark paid a $0.029 median per 1024×1024 image, above list.' }, supportedResolutions: ['1K', '2K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },
  // input_reference $0.20 per reference image (input_font $0.03) [endpoints].
  { id: 'sourceful/riverflow-v2-pro', supportsSeed: false, referenceImages: { min: 0, max: 10 }, displayName: 'Riverflow V2 Pro', imagePricing: { unit: 'image', input: 0.2, output: 0.15, approxNote: '@ 1K', approxBasis: '1K list rate; 4K $0.33. Each reference image adds $0.20.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },
  { id: 'sourceful/riverflow-v2-fast', supportsSeed: false, referenceImages: { min: 0, max: 4 }, displayName: 'Riverflow V2 Fast', imagePricing: { unit: 'image', input: 0.2, output: 0.02, approxNote: '@ 1K', approxBasis: '1K list rate; 2K $0.04. Each reference image adds $0.20.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },

  // ── xAI Grok Image (per-image) ──────────────────────────────────────────
  // Replaces the delisted grok-imagine-image-quality. Variants low_1k $0.04 … medium_2k $0.08, input image $0.01 [endpoints]; [bench] $0.06.
  { id: 'x-ai/grok-imagine-image-2.0', supportsSeed: false, referenceImages: { min: 0, max: 3 }, displayName: 'xAI: Grok Imagine Image 2.0', description: 'Fast, flexible image generation and reference-based editing with 1K or 2K output.', imagePricing: { unit: 'image', input: 0.01, output: 0.04, approxNote: '@ 1K', approxBasis: '1K low-quality reference; medium quality ($0.06) and 2K ($0.06–$0.08) cost more. OpenRouter’s benchmark measured $0.06 at 1024×1024. Reference images add $0.01 each.' }, supportedResolutions: ['1K', '2K'], supportedAspectRatios: ASPECT_RATIOS.grok },

  // ── Recraft raster (per-image) ──────────────────────────────────────────
  // NOT HERE: recraft/recraft-v4-styles and -styles-pro. They route on chat but require 1–10
  // style references; without Generate gating (P3/P4) a prompt-only request would just fail.
  // NOT HERE either: recraft/recraft-v4.1-flash ($0.007, text input only, 0 references). Refine
  // always sends the previous image, so it needs the same capability gating (PR #14 review F-01).
  { id: 'recraft/recraft-v4.1-pro', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1 Pro', imagePricing: { unit: 'image', output: 0.21 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4.1', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1', imagePricing: { unit: 'image', output: 0.035 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4.1-utility-pro', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1 Utility Pro', imagePricing: { unit: 'image', output: 0.21 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4.1-utility', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1 Utility', imagePricing: { unit: 'image', output: 0.035 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4-pro', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4 Pro', imagePricing: { unit: 'image', output: 0.25 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4', imagePricing: { unit: 'image', output: 0.04 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v3', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V3', imagePricing: { unit: 'image', output: 0.04 }, supportedAspectRatios: ASPECT_RATIOS.recraft },

  // ── Black Forest Labs FLUX.2 (megapixel-billed) ─────────────────────────
  { id: 'black-forest-labs/flux.2-klein-4b', referenceImages: { min: 0, max: 4 }, displayName: 'FLUX.2 Klein 4B', imagePricing: { unit: 'megapixel', output: 0.014, approxUsdPerImage: 0.014, approxNote: '@ ~1 MP', approxBasis: 'Approximately one output megapixel; larger images and reference inputs can cost more.' }, supportedAspectRatios: ASPECT_RATIOS.flux },
  { id: 'black-forest-labs/flux.2-pro', referenceImages: { min: 0, max: 8 }, displayName: 'FLUX.2 Pro', imagePricing: { unit: 'megapixel', output: 0.03, approxUsdPerImage: 0.03, approxNote: '@ ~1 MP', approxBasis: 'Approximately one output megapixel; larger images and reference inputs can cost more.' }, supportedAspectRatios: ASPECT_RATIOS.flux },
  { id: 'black-forest-labs/flux.2-flex', referenceImages: { min: 0, max: 8 }, displayName: 'FLUX.2 Flex', imagePricing: { unit: 'megapixel', input: 0.06, output: 0.06, approxUsdPerImage: 0.06, approxNote: '@ ~1 MP', approxBasis: 'Approximately one output megapixel; larger images and reference inputs can cost more.' }, supportedAspectRatios: ASPECT_RATIOS.flux },
  { id: 'black-forest-labs/flux.2-max', referenceImages: { min: 0, max: 8 }, displayName: 'FLUX.2 Max', imagePricing: { unit: 'megapixel', output: 0.07, approxUsdPerImage: 0.07, approxNote: '@ ~1 MP', approxBasis: 'Approximately one output megapixel; larger images and reference inputs can cost more.' }, supportedAspectRatios: ASPECT_RATIOS.flux },

  // ── ByteDance Seedream (per-image) ──────────────────────────────────────
  // 5.0 rows from Frame; Pro adds input $0.003 per reference [endpoints]. [bench] observed Pro at 2K ($0.09)
  // when no size was given; Lite renders 2K/4K only.
  { id: 'bytedance-seed/seedream-5-0-flash', referenceImages: { min: 0, max: 14 }, displayName: 'Seedream 5.0 Flash', description: 'Fast image generation and editing with up to 14 reference images, suited to frequent visual iteration.', imagePricing: { unit: 'image', output: 0.018 }, supportedResolutions: ['1K', '2K'], supportedAspectRatios: ASPECT_RATIOS.seedream },
  { id: 'bytedance-seed/seedream-5-0-lite', referenceImages: { min: 0, max: 14 }, displayName: 'Seedream 5.0 Lite', description: 'Fast, capable image creation for polished visual concepts, with broad aspect-ratio support and 2K/4K output.', imagePricing: { unit: 'image', output: 0.035 }, supportedResolutions: ['2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.seedream },
  { id: 'bytedance-seed/seedream-5-0-pro', referenceImages: { min: 0, max: 14 }, displayName: 'Seedream 5.0 Pro', description: 'Precise, natural-looking image generation and editing for commercial visual-production work.', imagePricing: { unit: 'image', input: 0.003, output: 0.045, approxNote: '@ 1K', approxBasis: '1K output reference; 2K (high-resolution) is $0.09, and OpenRouter’s benchmark observed 2K output at $0.09 when no size was specified. Reference images add $0.003 each.' }, supportedResolutions: ['1K', '2K'], supportedAspectRatios: ASPECT_RATIOS.seedream },
  { id: 'bytedance-seed/seedream-4.5', referenceImages: { min: 0, max: 14 }, displayName: 'Seedream 4.5', imagePricing: { unit: 'image', output: 0.04 }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.seedream },

  // ── Gemini preview aliases (kept for older projects; each mirrors its
  //    parent's pricing) ────────────────────────────────────────────────────
  { id: 'google/gemini-3.1-flash-image-preview', supportsSeed: false, referenceImages: { min: 0, max: 14 }, displayName: 'Nano Banana 2 Preview (Google: Gemini 3.1 Flash Image Preview)', imagePricing: { unit: 'image-token', input: 0.50, output: 60, approxUsdPerImage: 0.0672, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['512', '1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.gemini31 },
  { id: 'google/gemini-3-pro-image-preview', supportsSeed: false, referenceImages: { min: 0, max: 14 }, displayName: 'Nano Banana Pro Preview (Google: Gemini 3 Pro Image Preview)', imagePricing: { unit: 'image-token', input: 2.00, output: 120, approxUsdPerImage: 0.1344, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.gemini25 },
];

/** Default model for image generation */
export const DEFAULT_IMAGE_MODEL = 'google/gemini-3.1-flash-image';
