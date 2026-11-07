/**
 * Curated OpenRouter SVG-model catalog (Pixel-only; Frame has no SVG tab).
 *
 * Pure static data — consumed by the webview (SVG tab and Settings model
 * pickers) and infrastructure (OpenRouter provider config).
 *
 * Every entry says how it produces SVG with `kind`:
 *   - `native-vector` — Recraft models that return SVG as image output. They
 *     reuse Frame's `ImageModelDefinition` shape and unit-aware pricing
 *     ($/SVG). Their capability fields describe the Image API endpoint record;
 *     Pixel's vector client still sends them through `/chat/completions`
 *     without an aspect ratio, which is why their names say "1:1 only"
 *     (Image API transport for vector: roadmap P5b).
 *   - `code` — text/vision models that write SVG markup. Priced per 1M
 *     tokens on the standard first-party endpoint; `reasoning` comes from the
 *     chat feed because reasoning tokens bill as output.
 *
 * `kind` is the route: `src/shared/svg/svgRoutes.ts` sends a native-vector
 * id to the vector client and refuses to refine it, and falls back to the
 * `recraft/` prefix only for ids this catalog doesn't list.
 */

import type { ImageApiAspectRatio, SvgModelDefinition } from '../types/providers';

/** Aspect ratios the Recraft V4.1 vector endpoints advertise on the Image API. */
const RECRAFT_VECTOR_ASPECT_RATIOS: readonly ImageApiAspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9', 'auto'];

export const OPENROUTER_SVG_MODELS: SvgModelDefinition[] = [
  // ── Native vector (Recraft, output_format 'svg'): $/SVG ─────────────────
  // $0.30 / $0.08 [endpoints]; [bench] $0.30 (2048² SVG) / $0.08. A keyed V4.1 Vector call
  // on chat/completions returned SVG on 2026-11-07 (viewBox 2048×2048; no aspect ratio sent).
  // NOT HERE: recraft/recraft-v4-styles-pro-vector ($0.12 + $0.005/request) and -styles-vector
  // ($0.05 + $0.005/request). Both require 1–10 raster style references, and the SVG tab can't
  // yet keep Generate disabled until one is attached (it also sends an attached SVG as text).
  { kind: 'native-vector', id: 'recraft/recraft-v4.1-pro-vector', supportsSeed: false, displayName: '⭐ Recraft V4.1 Pro Vector (native SVG, 1:1 only) - Recommended', referenceImages: { min: 0, max: 1 }, imagePricing: { unit: 'image', output: 0.30 }, supportedAspectRatios: RECRAFT_VECTOR_ASPECT_RATIOS },
  { kind: 'native-vector', id: 'recraft/recraft-v4.1-vector', supportsSeed: false, displayName: 'Recraft V4.1 Vector (native SVG, budget, 1:1 only)', referenceImages: { min: 0, max: 1 }, imagePricing: { unit: 'image', output: 0.08 }, supportedAspectRatios: RECRAFT_VECTOR_ASPECT_RATIOS },

  // ── Code SVG (text/vision models): $/1M tokens ──────────────────────────
  // Re-curated 2026-11-07 (audit §2d): newer generations replace older ones rather than
  // accumulate, matching the July curation. Prices are the standard first-party endpoint
  // [chat endpoints]; reasoning comes from the chat feed. All accept image input.
  // ⭐ keeps the owner's slots on their successors: Opus 5 → Opus 5.5 (cheaper), Fable 5 → Fable 5.1
  // (same price, "front-end and visual" gains), GPT-5.6 Sol → GPT-6.1 Sol (half the price).
  // Gemini 4 Argon is the strongest unstarred pick; no SVG-quality benchmark exists yet (audit O7).
  // Replaced, still live (so saved picks keep working and show as Custom): claude-fable-5,
  // claude-opus-5, gpt-5.6-sol, gpt-5.6-sol-pro, gpt-5.4, gemini-3.1-pro-preview.
  { kind: 'code', id: 'anthropic/claude-opus-5.5', displayName: '⭐ Claude Opus 5.5 (code SVG) - Recommended', textPricing: { inputPer1M: 4, outputPer1M: 20 }, acceptsImageInput: true, reasoning: { mandatory: true, defaultEffort: 'high' } }, // 11 endpoints; fast tag $8/$40
  { kind: 'code', id: 'anthropic/claude-fable-5.1', displayName: '⭐ Claude Fable 5.1 (code SVG) - Recommended', textPricing: { inputPer1M: 10, outputPer1M: 50 }, acceptsImageInput: true, reasoning: { mandatory: true, defaultEffort: 'high' } }, // 4 endpoints
  { kind: 'code', id: 'anthropic/claude-sonnet-5.5', displayName: 'Claude Sonnet 5.5 (code SVG)', textPricing: { inputPer1M: 2, outputPer1M: 10 }, acceptsImageInput: true, reasoning: { mandatory: true, defaultEffort: 'high' } }, // 10 endpoints
  { kind: 'code', id: 'anthropic/claude-haiku-5.5', displayName: 'Claude Haiku 5.5 (code SVG, budget)', textPricing: { inputPer1M: 0.1, outputPer1M: 0.5 }, acceptsImageInput: true, reasoning: { mandatory: false, defaultEffort: 'medium' } }, // 10 endpoints; feed omits default_enabled
  { kind: 'code', id: 'openai/gpt-6.1-sol', displayName: '⭐ GPT-6.1 Sol (code SVG) - Recommended', textPricing: { inputPer1M: 2, outputPer1M: 10 }, acceptsImageInput: true, reasoning: { mandatory: true, defaultEnabled: true, defaultEffort: 'medium' } }, // 9 endpoints; flex $1/$5
  { kind: 'code', id: 'openai/gpt-6-astra', displayName: 'GPT-6 Astra (code SVG)', textPricing: { inputPer1M: 10, outputPer1M: 50 }, acceptsImageInput: true, reasoning: { mandatory: true, defaultEnabled: true, defaultEffort: 'medium' } }, // 8 endpoints
  { kind: 'code', id: 'openai/gpt-6.1-terra', displayName: 'GPT-6.1 Terra (code SVG)', textPricing: { inputPer1M: 1, outputPer1M: 5 }, acceptsImageInput: true, reasoning: { mandatory: false, defaultEnabled: true, defaultEffort: 'medium' } }, // 7 endpoints
  { kind: 'code', id: 'google/gemini-4-argon', displayName: 'Gemini 4 Argon (code SVG)', textPricing: { inputPer1M: 2, outputPer1M: 10 }, acceptsImageInput: true, reasoning: { mandatory: true, defaultEffort: 'medium' } }, // 6 endpoints; flex $1/$5
  { kind: 'code', id: 'google/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash (code SVG, budget)', textPricing: { inputPer1M: 0.75, outputPer1M: 3.75 }, acceptsImageInput: true, reasoning: { mandatory: true, defaultEnabled: true, defaultEffort: 'medium' } }, // AI Studio + vertex/global; vertex/us $0.825/$4.125
  { kind: 'code', id: 'x-ai/grok-4.7', displayName: 'Grok 4.7 (code SVG)', textPricing: { inputPer1M: 2, outputPer1M: 6 }, acceptsImageInput: true, reasoning: { mandatory: true, defaultEnabled: true, defaultEffort: 'high' } }, // 6 endpoints; priority $4/$12
];

/** Default model for SVG generation */
export const DEFAULT_SVG_MODEL = 'recraft/recraft-v4.1-pro-vector';
