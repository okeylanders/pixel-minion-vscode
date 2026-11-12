/**
 * How an SVG model produces its output, which decides what a conversation
 * with it can do.
 *
 * - Text-SVG models write markup; a conversation can be refined, because the
 *   model sees its earlier SVG in the transcript.
 * - Native-vector models (Recraft) return a finished SVG as image output and
 *   regenerate from the prompt; sending them a text transcript to "refine"
 *   is meaningless, so a native-vector conversation can't be refined.
 *
 * The thread's model decides, never the draft picker. This is the single
 * place the rule lives: the host routes and guards with it and the webview
 * gates Refine with it. A curated model's route is its catalog `kind`; an
 * id the catalog doesn't list (a custom id, or a model superseded since it
 * was picked) falls back to the provider prefix, because Recraft is the only
 * provider whose SVG models are native vector.
 */
import { OPENROUTER_SVG_MODELS } from '../models/SVGModels';
import type { SvgModelDefinition } from '../types/providers';

const CATALOG_KIND = new Map<string, SvgModelDefinition['kind']>(
  OPENROUTER_SVG_MODELS.map((model) => [model.id, model.kind])
);

export function isNativeVectorSvgModel(modelId: string): boolean {
  const kind = CATALOG_KIND.get(modelId);
  if (kind !== undefined) return kind === 'native-vector';
  return modelId.startsWith('recraft/');
}

export function svgModelSupportsRefinement(modelId: string): boolean {
  return !isNativeVectorSvgModel(modelId);
}
