// Ported from frame-minion@40e7949 packages/core/src/shared/models/ImageModels.ts; keep in sync
/**
 * Curated OpenRouter image-model catalog.
 *
 * Pure static data — consumed by both the webview (Image tab and Settings
 * model pickers) and infrastructure (OpenRouter provider config).
 *
 * PRICING. Image models bill in three different units, captured by
 * `ImagePricing.unit`:
 *   - `image`       → flat $/image (Recraft, Riverflow, Seedream, Grok Image, Krea, Qwen, FLUX.3)
 *   - `megapixel`   → $/output-megapixel (FLUX.2 family)
 *   - `image-token` → $/1M output tokens (Gemini image family, GPT Image, MAI)
 *
 * `approxUsdPerImage` is a display-only comparison, never a fixed bill.
 * Size/quality qualifiers and assumptions accompany estimates; native rates
 * remain authoritative. Frame's docs/research/image-price-estimates.md holds
 * the references and calculations. Gemini estimates use model-specific token
 * counts; FLUX.2 uses an approximately 1 MP reference. Where multiple output
 * tiers exist, the lowest tier is stored. A row with no verifiable per-image
 * reference carries only an `approxNote`.
 *
 * CAPABILITIES. `referenceImages`, `supportedAspectRatios`,
 * `supportedResolutions` and `supportsSeed` are copied from the live
 * `GET /api/v1/images/models/<id>/endpoints` records (a value is kept only
 * when every endpoint advertises it). They drive the Image tab's controls and
 * the host's checks before a request is sent (ImageGenerationModes.ts);
 * `provider-contracts/openrouter-image-endpoints-2026-11-12.json` pins them in
 * a test. Every row is reachable through the Image API (Single Shot); which
 * rows also have a conversational `/chat/completions` route is decided in
 * ImageGenerationModes.ts, not here. Two fields are not in those records and
 * drive only the Image tab's wording and warnings: `referenceRole` (what a
 * model does with its references, from its description) and
 * `maxRequestBytes` (Sourceful's 4.5 MB request limit, carried over from the
 * v1.1.0 size warning).
 *
 * Re-audited 2026-11-07 (prices, capabilities, OpenRouter's media benchmarks;
 * docs/model-catalog-audit-2026-11-07.md) and re-checked 2026-11-12 (no drift).
 * Each new or changed price carries its source in a trailing comment.
 *
 * Pixel deltas from Frame's catalog (keep this list current when syncing):
 *   - Added ahead of Frame (upstream candidates): Nano Banana 2.1, Riverflow
 *     V2.6 Pro, GPT Image 2.6 Sunburst/Flare, FLUX.3 Image Klein, Qwen Image
 *     2.1 Turbo and Krea K3 Edit. Frame's delisted rows (Grok Imagine Image
 *     Quality, Ming, Riverflow previews, Gemini 2.5 preview) are absent.
 *   - NOT HERE: meta/muse-image. On 2026-11-12 OpenRouter rejects it on
 *     `/chat/completions` ("is an image generation model … use /api/v1/images")
 *     while its Image API endpoint list is empty, so neither route serves it.
 *     Frame still routes it over chat; flagged upstream.
 *   - `supportsSeed: false` wherever the Image API endpoint record lists no
 *     `seed` parameter (records are "definitive supported parameters").
 *   - Input rates added where OpenRouter itemizes them (GPT Image and GPT-5.x
 *     wrappers, Riverflow V2 per reference, Seedream 5 Pro, Grok, Qwen Image 3
 *     and Krea K3 Edit per reference). Qwen Image 3 / 3 Pro accept 3
 *     references (Frame lists 4).
 *   - Nano Banana Pro keeps Pixel's ⭐; Nano Banana 2.1 gets one (cheaper
 *     output and higher benchmark pass rates than Nano Banana 2; audit §3);
 *     GPT Image 2 gets one as the audited OpenAI pick (audit §1e).
 *   - Recraft `*-vector` models live in the SVG catalog (SVGModels.ts):
 *     Pixel's SVG tab is where SVG output belongs.
 *   - `referenceRole` and `maxRequestBytes` are Pixel fields: Frame infers
 *     "style reference" wording from `referenceMimeTypes` and keys the
 *     Sourceful size warning on the `sourceful/` prefix. The Recraft Styles
 *     descriptions drop Frame's "at least 256 px on its shortest edge": no
 *     endpoint record states it and nothing checks it.
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
  krea: ['1:1', '2:3', '3:2', '4:3', '4:5', '9:16', '16:9'],
  riverflow: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9', 'auto'],
  riverflow26: ['1:1', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '16:9', '9:16', '21:9', 'auto'],
  grok: ['1:1', '1:2', '2:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '9:19.5', '19.5:9', '9:20', '20:9', 'auto'],
  recraft: ['1:1', '3:4', '4:3', '9:16', '16:9', 'auto'],
  recraftStyles: ['1:1', '2:1', '1:2', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', 'auto'],
  flux: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9', 'auto'],
  flux3: ['21:9', '2:1', '16:9', '3:2', '7:5', '4:3', '5:4', '1:1', '4:5', '3:4', '5:7', '2:3', '9:16', '1:2', '9:21', 'auto'],
  seedream: ['1:1', '1:2', '2:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '9:19.5', '19.5:9', '9:20', '20:9', '9:21', '21:9', 'auto'],
  qwen: ['1:1', '1:2', '1:4', '2:1', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '9:16', '16:9'],
} satisfies Record<string, readonly AspectRatio[]>;

/** Recraft Styles accepts only these reference formats. */
const RECRAFT_STYLE_REF_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
/** Sourceful's request-size limit (from Pixel v1.1.0's size warning; not in the endpoint records). */
const SOURCEFUL_MAX_REQUEST_BYTES = 4.5 * 1024 * 1024;

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
  // The GPT Image rows are Image API only (chat-blocked 2026-11-07); the GPT-5.x wrappers also have a
  // conversational chat route. The "@ 1K · high" references are kept unchanged; OpenRouter's benchmark
  // measured GPT Image 2 and 2.5 Flare at about $0.019 per 1024² image with an unpublished quality
  // setting, so re-basing them is an open owner decision (audit O5).
  { id: 'openai/gpt-image-2.6-sunburst', supportsSeed: false, referenceImages: { min: 0, max: 16 }, displayName: 'GPT Image 2.6 Sunburst', description: 'Detail-optimized image generation and editing for dense compositions, text-heavy layouts, and edits that stay consistent across turns.', imagePricing: { unit: 'image-token', input: 8, output: 30, approxNote: 'varies by size & quality', approxBasis: 'No vendor per-image reference verified. OpenRouter’s benchmark measured a $0.044 median at 1024×1024 (quality setting unpublished; the same run measured GPT Image 2 at $0.019). Prompt ($5/1M text) and reference-image charges are additional.' }, supportedAspectRatios: ASPECT_RATIOS.openAiModern }, // in-img $8, in-text $5, out $30 [endpoints]; quality up to `max`; gif output
  { id: 'openai/gpt-image-2.6-flare', supportsSeed: false, referenceImages: { min: 0, max: 16 }, displayName: 'GPT Image 2.6 Flare', description: 'Speed-optimized image generation and editing (about 50% faster than GPT Image 2.5) for fast iteration.', imagePricing: { unit: 'image-token', input: 8, output: 30, approxNote: 'varies by size & quality', approxBasis: 'No vendor per-image reference verified. OpenRouter’s benchmark measured a $0.044 median at 1024×1024 for text-to-image and $0.18 for edits (quality setting unpublished). Prompt and reference-image charges are additional.' }, supportedAspectRatios: ASPECT_RATIOS.openAiModern }, // same rates [endpoints]
  { id: 'openai/gpt-image-2.5-sunburst', referenceImages: { min: 0, max: 16 }, supportsSeed: false, displayName: 'GPT Image 2.5 Sunburst', description: 'Precision-focused image generation and editing for detailed compositions and demanding creative instructions.', imagePricing: { unit: 'image-token', input: 8, output: 30, approxUsdPerImage: 0.053, approxNote: '@ 1K · high', approxBasis: '1024×1024, high quality; based on fal’s published example at matching token rates. Prompt and reference-image charges are additional; Auto quality may cost more.' }, supportedAspectRatios: ASPECT_RATIOS.openAiModern }, // ✓ Frame entry unchanged [endpoints]
  { id: 'openai/gpt-image-2.5-flare', referenceImages: { min: 0, max: 16 }, supportsSeed: false, displayName: 'GPT Image 2.5 Flare', description: 'Speed-focused image generation and editing for everyday creative work and frequent iteration.', imagePricing: { unit: 'image-token', input: 8, output: 30, approxUsdPerImage: 0.053, approxNote: '@ 1K · high', approxBasis: '1024×1024, high quality; based on fal’s published example at matching token rates. Prompt and reference-image charges are additional; Auto quality may cost more.' }, supportedAspectRatios: ASPECT_RATIOS.openAiModern }, // ✓ Frame entry unchanged [endpoints]
  { id: 'openai/gpt-image-2', supportsSeed: false, referenceImages: { min: 0, max: 16 }, displayName: '⭐ GPT Image 2', imagePricing: { unit: 'image-token', input: 8, output: 30, approxUsdPerImage: 0.211, approxNote: '@ 1K · high', approxBasis: '1024×1024, high quality; GPT Image 2 output-only reference. Prompt and reference-image charges are additional; Auto quality may differ.' }, supportedAspectRatios: ASPECT_RATIOS.openAiModern }, // ✓ out; ADDED input $8 [endpoints]
  { id: 'openai/gpt-image-1', supportsSeed: false, referenceImages: { min: 0, max: 16 }, displayName: 'GPT Image 1', imagePricing: { unit: 'image-token', input: 10, output: 40, approxUsdPerImage: 0.167, approxNote: '@ 1K · high', approxBasis: '1024×1024, high quality; GPT Image 1 output-only reference. Prompt and reference-image charges are additional; Auto quality may differ.' }, supportedAspectRatios: ASPECT_RATIOS.openAiClassic }, // ✓ out; ADDED input $10 [endpoints]; [bench] $0.167
  { id: 'openai/gpt-image-1-mini', supportsSeed: false, referenceImages: { min: 0, max: 16 }, displayName: 'GPT Image 1 Mini', imagePricing: { unit: 'image-token', input: 2.5, output: 8, approxUsdPerImage: 0.036, approxNote: '@ 1K · high', approxBasis: '1024×1024, high quality; GPT Image 1 Mini output-only reference. Prompt and reference-image charges are additional; Auto quality may differ.' }, supportedAspectRatios: ASPECT_RATIOS.openAiClassic }, // ✓ out; ADDED input $2.5 [endpoints]
  // GPT-5.x wrappers (Image API and chat): input-image rates from the endpoint records, $8 / $2.5 / $10 per 1M.
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

  // ── Krea (per-image; the endpoints API now publishes these prices) ──────
  // K3 Edit requires 1–8 references: the Image tab blocks Generate until one is attached and the host
  // refuses a request without one (ImageGenerationModes / OpenRouterImageClient).
  { id: 'krea/k3-edit', referenceImages: { min: 1, max: 8 }, referenceRole: 'edit', displayName: 'Krea K3 Edit', description: 'Instruction-following image editing from 1–8 reference images. A reference image is required; this model does not generate from a prompt alone.', imagePricing: { unit: 'image', input: 0.02, output: 0.03, approxUsdPerImage: 0.05, approxNote: '@ 1K · one reference', approxBasis: '$0.03 per 1K output plus $0.02 per 1K input reference (one reference assumed). 2K rates are $0.06 / $0.07. An optional high-thinking surcharge of $0.02 per request applies. OpenRouter’s benchmark measured $0.01, below list; re-check.' }, supportedResolutions: ['1K', '2K'], supportedAspectRatios: ASPECT_RATIOS.krea }, // NEW 2026-10-15 [endpoints]; seed ✓
  { id: 'krea/krea-2-large', referenceImages: { min: 0, max: 1 }, displayName: 'Krea 2 Large', imagePricing: { unit: 'image', output: 0.06 }, supportedResolutions: ['1K'], supportedAspectRatios: ASPECT_RATIOS.krea }, // ✓ $0.06 (+$0.005 style refs / +$0.01 moodboards) [endpoints]
  { id: 'krea/krea-2-medium', referenceImages: { min: 0, max: 1 }, displayName: 'Krea 2 Medium', imagePricing: { unit: 'image', output: 0.03 }, supportedResolutions: ['1K'], supportedAspectRatios: ASPECT_RATIOS.krea }, // ✓ [endpoints]
  { id: 'krea/krea-2-medium-turbo', referenceImages: { min: 0, max: 1 }, displayName: 'Krea 2 Medium Turbo', imagePricing: { unit: 'image', output: 0.015 }, supportedResolutions: ['1K'], supportedAspectRatios: ASPECT_RATIOS.krea }, // ✓ [endpoints]

  // ── Sourceful Riverflow (per-image) ─────────────────────────────────────
  // [bench] measured V2.6 Pro / V2.5 Pro / V2.5 Fast above list at 1024² with no references (audit O6);
  // the bases say so rather than changing the list price.
  { id: 'sourceful/riverflow-v2.6-pro', supportsSeed: false, maxRequestBytes: SOURCEFUL_MAX_REQUEST_BYTES, referenceImages: { min: 0, max: 10 }, displayName: 'Riverflow V2.6 Pro', description: 'Flagship Riverflow 2.6: a unified text-to-image and image-to-image workflow with an integrated planning step.', imagePricing: { unit: 'image', output: 0.13, approxNote: '@ 1K', approxBasis: '1K list rate; 2K $0.15, 4K $0.17. OpenRouter’s benchmark paid a $0.157 median per 1024×1024 image, above list.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.riverflow26 }, // NEW 2026-10-29 [endpoints]
  { id: 'sourceful/riverflow-v2.5-pro', supportsSeed: false, maxRequestBytes: SOURCEFUL_MAX_REQUEST_BYTES, referenceImages: { min: 0, max: 10 }, displayName: 'Riverflow V2.5 Pro', imagePricing: { unit: 'image', output: 0.13, approxNote: '@ 1K', approxBasis: '1K list rate; 2K $0.15, 4K $0.17. OpenRouter’s benchmark paid a $0.248 median per 1024×1024 image, above list.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },
  { id: 'sourceful/riverflow-v2.5-fast', supportsSeed: false, maxRequestBytes: SOURCEFUL_MAX_REQUEST_BYTES, referenceImages: { min: 0, max: 4 }, displayName: 'Riverflow V2.5 Fast', imagePricing: { unit: 'image', output: 0.019, approxNote: '@ 1K', approxBasis: '1K list rate; 2K $0.021. OpenRouter’s benchmark paid a $0.029 median per 1024×1024 image, above list.' }, supportedResolutions: ['1K', '2K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },
  // input_reference $0.20 per reference image (input_font $0.03) [endpoints].
  { id: 'sourceful/riverflow-v2-pro', supportsSeed: false, maxRequestBytes: SOURCEFUL_MAX_REQUEST_BYTES, referenceImages: { min: 0, max: 10 }, displayName: 'Riverflow V2 Pro', imagePricing: { unit: 'image', input: 0.2, output: 0.15, approxNote: '@ 1K', approxBasis: '1K list rate; 4K $0.33. Each reference image adds $0.20.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },
  { id: 'sourceful/riverflow-v2-fast', supportsSeed: false, maxRequestBytes: SOURCEFUL_MAX_REQUEST_BYTES, referenceImages: { min: 0, max: 4 }, displayName: 'Riverflow V2 Fast', imagePricing: { unit: 'image', input: 0.2, output: 0.02, approxNote: '@ 1K', approxBasis: '1K list rate; 2K $0.04. Each reference image adds $0.20.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.riverflow },

  // ── xAI Grok Image (per-image) ──────────────────────────────────────────
  // Replaces the delisted grok-imagine-image-quality. Variants low_1k $0.04 … medium_2k $0.08, input image $0.01 [endpoints]; [bench] $0.06.
  { id: 'x-ai/grok-imagine-image-2.0', supportsSeed: false, referenceImages: { min: 0, max: 3 }, displayName: 'xAI: Grok Imagine Image 2.0', description: 'Fast, flexible image generation and reference-based editing with 1K or 2K output.', imagePricing: { unit: 'image', input: 0.01, output: 0.04, approxNote: '@ 1K', approxBasis: '1K low-quality reference; medium quality ($0.06) and 2K ($0.06–$0.08) cost more. OpenRouter’s benchmark measured $0.06 at 1024×1024. Reference images add $0.01 each.' }, supportedResolutions: ['1K', '2K'], supportedAspectRatios: ASPECT_RATIOS.grok },

  // ── Recraft raster (per-image) ──────────────────────────────────────────
  // Styles / Styles Pro require 1–10 PNG, JPEG or WebP style references (Generate is blocked until one
  // is attached). V4.1 Flash accepts none: its uploader is disabled and a Single Shot follow-up, which
  // would send the previous image, is not offered. The host refuses both mismatches before a request.
  { id: 'recraft/recraft-v4-styles-pro', supportsSeed: false, referenceImages: { min: 1, max: 10 }, referenceMimeTypes: RECRAFT_STYLE_REF_MIME, referenceRole: 'style', displayName: 'Recraft V4 Styles Pro', description: 'Create a new ~2K raster image in the style of 1–10 reference images. This reproduces style rather than editing the references; each must be PNG, JPEG, or WebP.', imagePricing: { unit: 'image', output: 0.1, approxUsdPerImage: 0.105, approxNote: '· one image', approxBasis: '$0.10 per image plus $0.005 style creation per request; the fee is shared across images in a multi-image request.' }, supportedAspectRatios: ASPECT_RATIOS.recraftStyles }, // ✓ [endpoints]; [bench] $0.105
  { id: 'recraft/recraft-v4-styles', supportsSeed: false, referenceImages: { min: 1, max: 10 }, referenceMimeTypes: RECRAFT_STYLE_REF_MIME, referenceRole: 'style', displayName: 'Recraft V4 Styles', description: 'Create a new ~1K raster image in the style of 1–10 reference images. This reproduces style rather than editing the references; each must be PNG, JPEG, or WebP.', imagePricing: { unit: 'image', output: 0.035, approxUsdPerImage: 0.04, approxNote: '· one image', approxBasis: '$0.035 per image plus $0.005 style creation per request; the fee is shared across images in a multi-image request.' }, supportedAspectRatios: ASPECT_RATIOS.recraftStyles }, // ✓ [endpoints]; [bench] $0.04
  { id: 'recraft/recraft-v4.1-flash', supportsSeed: false, referenceImages: { min: 0, max: 0 }, displayName: 'Recraft V4.1 Flash', description: 'Fast text-to-image generation for quick visual drafts. This route does not accept reference images.', imagePricing: { unit: 'image', output: 0.007 }, supportedAspectRatios: ASPECT_RATIOS.recraft }, // ✓ [endpoints]
  { id: 'recraft/recraft-v4.1-pro', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1 Pro', imagePricing: { unit: 'image', output: 0.21 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4.1', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1', imagePricing: { unit: 'image', output: 0.035 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4.1-utility-pro', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1 Utility Pro', imagePricing: { unit: 'image', output: 0.21 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4.1-utility', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4.1 Utility', imagePricing: { unit: 'image', output: 0.035 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4-pro', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4 Pro', imagePricing: { unit: 'image', output: 0.25 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v4', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V4', imagePricing: { unit: 'image', output: 0.04 }, supportedAspectRatios: ASPECT_RATIOS.recraft },
  { id: 'recraft/recraft-v3', supportsSeed: false, referenceImages: { min: 0, max: 1 }, displayName: 'Recraft V3', imagePricing: { unit: 'image', output: 0.04 }, supportedAspectRatios: ASPECT_RATIOS.recraft },

  // ── Black Forest Labs: FLUX.3 per-image tiers; FLUX.2 megapixel-billed ──
  { id: 'black-forest-labs/flux-3-image', supportsSeed: false, referenceImages: { min: 0, max: 10 }, displayName: 'FLUX.3 Image', description: 'Flagship image generation and multi-reference editing with up to 10 input images. Supports 768 through 4K output tiers.', imagePricing: { unit: 'image', output: 0.041, approxNote: '@ 768 · list rate', approxBasis: 'Published 768 list rate; OpenRouter advertised a temporary 50% discount on 2026-10-02. Check the live price before spending. 1K, 1.5K, 2K, and 4K list rates are higher.' }, supportedResolutions: ['768', '1K', '1.5K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.flux3 }, // ✓ list unchanged [endpoints]; [bench] $0.024 @1K (promo)
  { id: 'black-forest-labs/flux-3-image-klein', referenceImages: { min: 0, max: 10 }, displayName: 'FLUX.3 Image Klein', description: 'Open-weights FLUX.3 for low-cost generation and multi-reference editing that keeps characters and subjects consistent.', imagePricing: { unit: 'image', output: 0.008, approxNote: '@ 768 · list rate', approxBasis: '768 list rate; 1K $0.009, 1.5K $0.011, 2K $0.014, 4K $0.036.' }, supportedResolutions: ['768', '1K', '1.5K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.flux3 }, // NEW 2026-10-15 [endpoints]; seed ✓; [bench] $0.009 @1K
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

  // ── Qwen (per-image; seed ✓) ────────────────────────────────────────────
  { id: 'qwen/qwen-image-3-pro', referenceImages: { min: 0, max: 3 }, displayName: 'Qwen Image 3 Pro', description: 'Premium Qwen image generation and editing for finely rendered text, detail, and knowledge-rich scenes.', imagePricing: { unit: 'image', input: 0.003, output: 0.04, approxNote: '@ 1K', approxBasis: '1K output reference; 2K costs more ($0.075). Reference images add $0.003 each.' }, supportedResolutions: ['1K', '2K'], supportedAspectRatios: ASPECT_RATIOS.qwen }, // FIXED refs 4→3; ADDED input [endpoints]
  { id: 'qwen/qwen-image-3', referenceImages: { min: 0, max: 3 }, displayName: 'Qwen Image 3', description: 'A versatile image generator and editor with crisp small text and strong prompt detail.', imagePricing: { unit: 'image', input: 0.003, output: 0.03 }, supportedResolutions: ['1K', '2K'], supportedAspectRatios: ASPECT_RATIOS.qwen }, // FIXED refs 4→3; ADDED input [endpoints]
  { id: 'qwen/qwen-image-2.1-turbo', referenceImages: { min: 0, max: 4 }, displayName: 'Qwen Image 2.1 Turbo', description: 'Fast, lower-cost Qwen image generation and editing where throughput and price matter most.', imagePricing: { unit: 'image', output: 0.0184 }, supportedResolutions: ['1K', '2K'], supportedAspectRatios: ASPECT_RATIOS.qwen }, // NEW 2026-10-16; $0.0184 at 1K and 2K [endpoints]

  // ── Gemini preview aliases (kept for older projects; each mirrors its
  //    parent's pricing) ────────────────────────────────────────────────────
  { id: 'google/gemini-3.1-flash-image-preview', supportsSeed: false, referenceImages: { min: 0, max: 14 }, displayName: 'Nano Banana 2 Preview (Google: Gemini 3.1 Flash Image Preview)', imagePricing: { unit: 'image-token', input: 0.50, output: 60, approxUsdPerImage: 0.0672, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['512', '1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.gemini31 },
  { id: 'google/gemini-3-pro-image-preview', supportsSeed: false, referenceImages: { min: 0, max: 14 }, displayName: 'Nano Banana Pro Preview (Google: Gemini 3 Pro Image Preview)', imagePricing: { unit: 'image-token', input: 2.00, output: 120, approxUsdPerImage: 0.1344, approxNote: '@ 1K', approxBasis: '1024×1024 output reference using 1,120 image tokens. Prompt, reference-image, and reasoning charges are additional.' }, supportedResolutions: ['1K', '2K', '4K'], supportedAspectRatios: ASPECT_RATIOS.gemini25 },
];

/** Default model for image generation */
export const DEFAULT_IMAGE_MODEL = 'google/gemini-3.1-flash-image';
