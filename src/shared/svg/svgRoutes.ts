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
 * gates Refine with it. It keys on the id prefix until the SVG catalog
 * carries an explicit route per model (roadmap P5b).
 */
export function isNativeVectorSvgModel(modelId: string): boolean {
  return modelId.startsWith('recraft/');
}

export function svgModelSupportsRefinement(modelId: string): boolean {
  return !isNativeVectorSvgModel(modelId);
}
