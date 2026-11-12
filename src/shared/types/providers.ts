/**
 * Provider Interface Types
 *
 * Defines the interface for AI providers (OpenRouter, future custom endpoints).
 * Each provider exposes curated model lists per generation type.
 *
 * The image-pricing and image-model types below are ported from
 * frame-minion@40e7949 packages/core/src/shared/types/providers.ts; keep in
 * sync. Pixel-only additions (`TextPricing`, `SvgModelDefinition`) are
 * marked as such.
 */

import type { AspectRatio } from './messages/imageGeneration';

export type GenerationType = 'image' | 'svg';

/**
 * How an OpenRouter image model bills output. These are the three units the
 * `/api/v1/images/models/<id>/endpoints` responses actually use:
 *  - `image`       — a flat price per generated image (Recraft, Riverflow, Seedream, Grok Image)
 *  - `megapixel`   — price per output megapixel (the FLUX.2 family)
 *  - `image-token` — price per output *token*. An image is many tokens, so this
 *                    is NOT a per-image price (Gemini image family, GPT Image, MAI).
 *
 * Keeping the unit explicit is what lets the Model Browser stop mislabeling a
 * token-billed model's cost as though it were per-image.
 */
export type ImagePricingUnit = 'image' | 'megapixel' | 'image-token';

export interface ImagePricing {
  unit: ImagePricingUnit;
  /**
   * Output cost in the unit's native terms:
   *  - `image`       → USD per image
   *  - `megapixel`   → USD per output megapixel
   *  - `image-token` → USD per 1,000,000 output tokens
   * For models that publish tiered output pricing we store the lowest tier
   * (matching the pre-audit convention).
   */
  output: number;
  /**
   * Input cost in native terms; optional. FLUX Flex bills input per-MP; token
   * models per-1M input tokens; per-image models per reference image.
   */
  input?: number;
  /**
   * Display-only per-image comparison from a documented reference or explicitly
   * stated token-budget assumption. Not a fixed bill or a request quote.
   * The source and calculation are recorded beside each catalog row.
   */
  approxUsdPerImage?: number;
  /** Short size/quality qualifier, or fallback note when no estimate is available. */
  approxNote?: string;
  /** Visible explanation of the estimate and its assumptions. */
  approxBasis?: string;
}

/**
 * A curated OpenRouter image-generation model. `imagePricing` is the only
 * pricing surface: absent ⇒ the provider publishes no price and the Model
 * Browser renders no cost hint.
 *
 * ⚠️ Not yet consumed in Pixel: `transport`, `supportsSeed`, `referenceImages`,
 * `referenceMimeTypes`, `supportedResolutions` and `supportedAspectRatios` are
 * recorded from the live Image API endpoint records so the catalog stays
 * shareable with Frame. Nothing reads them until the Image API transport and
 * capability-driven controls land (roadmap P3); today every request goes to
 * `/chat/completions` with the Image tab's fixed controls.
 */
export interface ImageModelDefinition {
  id: string;           // e.g., 'google/gemini-2.5-flash-image'
  displayName: string;  // e.g., 'Gemini 2.5 Flash Image'
  description?: string;
  /** Explicit wire protocol; omitted for the dedicated Image API. */
  transport?: 'images' | 'chat-completions';
  /** False when live endpoint evidence explicitly excludes a seed parameter. */
  supportsSeed?: boolean;
  /** Exact Image API reference count bounds for models where the route was audited. */
  referenceImages?: { min: number; max: number };
  /** Narrower reference MIME allowlist for routes with format requirements. */
  referenceMimeTypes?: readonly ('image/png' | 'image/jpeg' | 'image/webp')[];
  /**
   * Unit-aware image-generation pricing (audited against the live
   * `/api/v1/images/models` endpoints). Absent ⇒ the provider publishes no
   * price (Model Browser renders no cost label).
   */
  imagePricing?: ImagePricing;
  /** Normalized output tiers published by OpenRouter's Image API. Absent means auto/default only. */
  supportedResolutions?: readonly ('512' | '768' | '1K' | '1.5K' | '2K' | '4K')[];
  /** Exact normalized aspect ratios accepted by the live OpenRouter Image API. */
  supportedAspectRatios?: readonly AspectRatio[];
}

/**
 * Pixel-only: per-token text pricing for SVG code models, from the standard
 * first-party chat endpoint (not flex, fast or batch tiers).
 */
export interface TextPricing {
  /** USD per 1,000,000 input tokens. */
  inputPer1M: number;
  /** USD per 1,000,000 output tokens (reasoning tokens bill at this rate too). */
  outputPer1M: number;
}

/** Pixel-only: a Recraft-style model that returns SVG directly. Reuses the image shape and pricing. */
export interface NativeVectorSvgModelDefinition extends ImageModelDefinition {
  kind: 'native-vector';
}

/** Pixel-only: a text/vision model that writes SVG markup as code. */
export interface CodeSvgModelDefinition {
  kind: 'code';
  id: string;
  displayName: string;
  description?: string;
  textPricing: TextPricing;
  /** Accepts an `image_url` part, which is how the SVG tab sends a reference image. */
  acceptsImageInput: boolean;
  /**
   * The chat feed's `reasoning` block. Reasoning tokens count against
   * `max_tokens` and bill as output, so a model that reasons by default
   * costs more than a plain output-token estimate suggests.
   */
  reasoning?: {
    /** Reasoning cannot be turned off. */
    mandatory: boolean;
    /** `default_enabled` from the feed; absent when the feed omits it. */
    defaultEnabled?: boolean;
    /** Effort OpenRouter applies when the request names none. */
    defaultEffort: string;
  };
}

/**
 * Pixel-only: an SVG tab catalog entry. `kind` says how the model produces
 * SVG, which decides its pricing shape and how the picker groups it.
 */
export type SvgModelDefinition = NativeVectorSvgModelDefinition | CodeSvgModelDefinition;

export interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  models: {
    image: ImageModelDefinition[];
    svg: SvgModelDefinition[];
  };
  supportsImageInput: boolean;
  supportsImageOutput: boolean;
}
