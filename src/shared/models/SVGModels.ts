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
 * Request routing is unchanged by this field: SVGOrchestrator still selects
 * the vector client by id prefix until P5b moves routing onto `kind`.
 */

import type { ImageApiAspectRatio, SvgModelDefinition } from '../types/providers';

/** Aspect ratios the Recraft V4.1 vector endpoints advertise on the Image API. */
const RECRAFT_VECTOR_ASPECT_RATIOS: readonly ImageApiAspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9', 'auto'];

export const OPENROUTER_SVG_MODELS: SvgModelDefinition[] = [
  // ── Native vector (Recraft, output_format 'svg'): $/SVG ─────────────────
  { kind: 'native-vector', id: 'recraft/recraft-v4.1-pro-vector', displayName: '⭐ Recraft V4.1 Pro Vector (native SVG, 1:1 only) - Recommended', referenceImages: { min: 0, max: 1 }, imagePricing: { unit: 'image', output: 0.30 }, supportedAspectRatios: RECRAFT_VECTOR_ASPECT_RATIOS },
  { kind: 'native-vector', id: 'recraft/recraft-v4.1-vector', displayName: 'Recraft V4.1 Vector (native SVG, budget, 1:1 only)', referenceImages: { min: 0, max: 1 }, imagePricing: { unit: 'image', output: 0.08 }, supportedAspectRatios: RECRAFT_VECTOR_ASPECT_RATIOS },

  // ── Code SVG (text/vision models): $/1M tokens ──────────────────────────
  { kind: 'code', id: 'anthropic/claude-fable-5', displayName: '⭐ Claude Fable 5 (code SVG) - Recommended', textPricing: { inputPer1M: 10, outputPer1M: 50 }, acceptsImageInput: true, reasoning: { mandatory: true, defaultEffort: 'high' } },
  { kind: 'code', id: 'anthropic/claude-opus-5', displayName: '⭐ Claude Opus 5 (code SVG) - Recommended', textPricing: { inputPer1M: 5, outputPer1M: 25 }, acceptsImageInput: true, reasoning: { mandatory: false, defaultEnabled: true, defaultEffort: 'high' } },
  { kind: 'code', id: 'openai/gpt-5.6-sol', displayName: '⭐ GPT-5.6 Sol (code SVG) - Recommended', textPricing: { inputPer1M: 5, outputPer1M: 30 }, acceptsImageInput: true, reasoning: { mandatory: false, defaultEnabled: true, defaultEffort: 'medium' } },
  { kind: 'code', id: 'openai/gpt-5.6-sol-pro', displayName: 'GPT-5.6 Sol Pro (code SVG)', textPricing: { inputPer1M: 5, outputPer1M: 30 }, acceptsImageInput: true, reasoning: { mandatory: false, defaultEnabled: true, defaultEffort: 'medium' } },
  { kind: 'code', id: 'openai/gpt-5.4', displayName: 'GPT-5.4 (code SVG)', textPricing: { inputPer1M: 2.5, outputPer1M: 15 }, acceptsImageInput: true, reasoning: { mandatory: false, defaultEnabled: false, defaultEffort: 'medium' } },
  { kind: 'code', id: 'google/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro (code SVG)', textPricing: { inputPer1M: 2, outputPer1M: 12 }, acceptsImageInput: true, reasoning: { mandatory: true, defaultEffort: 'medium' } },
];

/** Default model for SVG generation */
export const DEFAULT_SVG_MODEL = 'recraft/recraft-v4.1-pro-vector';
