/**
 * Saved model ids that can no longer reach a request, and where each moves.
 *
 * Pure static data next to the catalogs it points into. SettingsHandler
 * applies it on read and persists the replacement, so a stale
 * `pixelMinion.imageModel` or `pixelMinion.svgModel` never reaches a request.
 *
 * Verified 2026-11-07: delisted ids against `/api/v1/models`,
 * `/api/v1/images/models` and each id's `/endpoints` record; images-api-only
 * ids by a `/chat/completions` probe that OpenRouter rejects before routing
 * (see docs/model-catalog-audit-2026-11-07.md).
 *
 * Superseded-but-live ids (a model replaced in the curated list by a newer
 * generation) are deliberately NOT listed: OpenRouter still serves them, so a
 * saved selection keeps working and shows as "Custom" in the picker rather
 * than silently switching models and prices under the user.
 */

import { DEFAULT_IMAGE_MODEL } from './ImageModels';

/** Why a saved model id can no longer be used by Pixel Minion. */
export type RetiredModelReason =
  /** OpenRouter no longer serves the model ("no provider serves this model anymore"). */
  | 'delisted'
  /**
   * OpenRouter serves the model only through `POST /api/v1/images`; a
   * `/chat/completions` request is rejected with 404 "is an image generation
   * model and cannot be used with the chat/completions endpoint". These return
   * once Pixel adopts the dedicated Image API transport (roadmap phase P3).
   */
  | 'images-api-only';

export interface RetiredModel {
  replacement: string;
  reason: RetiredModelReason;
}

export const RETIRED_MODELS: Readonly<Record<string, RetiredModel>> = {
  // Delisted — the first five shipped in v1.3.0. Each points at the catalog's successor
  // (a test pins that every replacement is a catalog id).
  'x-ai/grok-imagine-image-quality': { replacement: 'x-ai/grok-imagine-image-2.0', reason: 'delisted' },
  'sourceful/riverflow-v2-max-preview': { replacement: 'sourceful/riverflow-v2.5-pro', reason: 'delisted' },
  'sourceful/riverflow-v2-standard-preview': { replacement: 'sourceful/riverflow-v2.5-pro', reason: 'delisted' },
  'sourceful/riverflow-v2-fast-preview': { replacement: 'sourceful/riverflow-v2.5-fast', reason: 'delisted' },
  'anthropic/claude-opus-4': { replacement: 'anthropic/claude-opus-5.5', reason: 'delisted' },
  'anthropic/claude-opus-5-fast': { replacement: 'anthropic/claude-opus-5.5', reason: 'delisted' },
  // Image API only — added by the PR #12 catalog refresh, never released.
  'openai/gpt-image-2': { replacement: 'openai/gpt-5.4-image-2', reason: 'images-api-only' },
  'openai/gpt-image-1': { replacement: 'openai/gpt-5.4-image-2', reason: 'images-api-only' },
  'openai/gpt-image-1-mini': { replacement: 'openai/gpt-5.4-image-2', reason: 'images-api-only' },
  'krea/krea-2-large': { replacement: DEFAULT_IMAGE_MODEL, reason: 'images-api-only' },
  'krea/krea-2-medium': { replacement: DEFAULT_IMAGE_MODEL, reason: 'images-api-only' },
  'krea/krea-2-medium-turbo': { replacement: DEFAULT_IMAGE_MODEL, reason: 'images-api-only' },
};

/** Replacement id per retired id (derived from {@link RETIRED_MODELS}). */
export const RETIRED_MODEL_REPLACEMENTS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(RETIRED_MODELS).map(([id, retired]) => [id, retired.replacement])
);
