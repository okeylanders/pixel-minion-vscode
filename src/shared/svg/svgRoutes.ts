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
 * was picked) is native vector only when its name ends in `-vector` (before
 * any `:variant`), as every vector model OpenRouter lists does. Not by the
 * `recraft/` prefix: most Recraft models are raster, and the vector route
 * would bill one and then fail on the raster it returns. Anything else
 * goes to the code route.
 *
 * A raster image model can't make SVG on either route, and both would
 * accept and bill it (the chat-route probe lists Recraft's raster models
 * as chat-routable), so `svgModelRefusal` names the ones known to be
 * raster and the host refuses them before any provider call: the Image
 * catalog's ids, and an unlisted `recraft/` id without a `-vector` name
 * (Recraft publishes only image models).
 *
 * Every rule classifies the *model* an id names: its base before any
 * `:variant` (`:nitro`, `:floor`, …, which pick a provider or price, not a
 * different model), compared case-insensitively (catalog ids are
 * lower-case; the Settings field stores a curated id's casing for an exact
 * match). The full id is what gets dispatched. Classifying the whole
 * string let `black-forest-labs/flux.2-pro:nitro` pass as an unknown text
 * model (PR #18 R18-1).
 */
import { OPENROUTER_SVG_MODELS } from '../models/SVGModels';
import { OPENROUTER_IMAGE_MODELS } from '../models/ImageModels';
import type { SvgModelDefinition } from '../types/providers';

/** The model an id names: lower-cased, without its `:variant`. */
function modelKey(modelId: string): string {
  return modelId.split(':')[0].toLowerCase();
}

const CATALOG_KIND = new Map<string, SvgModelDefinition['kind']>(
  OPENROUTER_SVG_MODELS.map((model) => [modelKey(model.id), model.kind])
);
const RASTER_IMAGE_KEYS = new Set(OPENROUTER_IMAGE_MODELS.map((model) => modelKey(model.id)));

export function isNativeVectorSvgModel(modelId: string): boolean {
  const key = modelKey(modelId);
  const kind = CATALOG_KIND.get(key);
  if (kind !== undefined) return kind === 'native-vector';
  return key.endsWith('-vector');
}

export function svgModelSupportsRefinement(modelId: string): boolean {
  return !isNativeVectorSvgModel(modelId);
}

/**
 * Why `modelId` can't make SVG, or null. A known raster image model would
 * be billed on either SVG route and then fail on the raster it returns.
 */
export function svgModelRefusal(modelId: string): string | null {
  const key = modelKey(modelId);
  if (CATALOG_KIND.has(key) || isNativeVectorSvgModel(modelId)) return null;
  if (RASTER_IMAGE_KEYS.has(key) || key.startsWith('recraft/')) {
    return `${modelId} makes raster images, not SVG. Use it on the Image tab, or choose a vector (-vector) or text model for SVG.`;
  }
  return null;
}
