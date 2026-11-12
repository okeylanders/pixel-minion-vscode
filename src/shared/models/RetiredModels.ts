/**
 * Saved model ids that can no longer reach a request, and where each moves.
 *
 * Pure static data next to the catalogs it points into. SettingsHandler
 * applies it on read and persists the replacement, so a stale
 * `pixelMinion.imageModel` or `pixelMinion.svgModel` never reaches a request.
 *
 * Verified 2026-11-07: delisted ids against `/api/v1/models`,
 * `/api/v1/images/models` and each id's `/endpoints` record (see
 * docs/model-catalog-audit-2026-11-07.md).
 *
 * Models OpenRouter serves only through its Image API used to be listed here
 * too (reason `images-api-only`). Pixel speaks that API since roadmap P3, so
 * those ids are catalog models again and nothing migrates them.
 *
 * Superseded-but-live ids (a model replaced in the curated list by a newer
 * generation) are deliberately NOT listed: OpenRouter still serves them, so a
 * saved selection keeps working and shows as "Custom" in the picker rather
 * than silently switching models and prices under the user.
 */

/** Why a saved model id can no longer be used by Pixel Minion. */
export type RetiredModelReason =
  /** OpenRouter no longer serves the model ("no provider serves this model anymore"). */
  'delisted';

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
};

/** Replacement id per retired id (derived from {@link RETIRED_MODELS}). */
export const RETIRED_MODEL_REPLACEMENTS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(RETIRED_MODELS).map(([id, retired]) => [id, retired.replacement])
);
