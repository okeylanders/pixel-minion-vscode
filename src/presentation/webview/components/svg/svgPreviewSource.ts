/**
 * The policy verdict and preview URL for a generated SVG.
 *
 * Every preview of a result (inline, 32/64/128, full size) asks for the same
 * document, so the last one is cached: the policy scan and base64 encoding
 * run once per result, not once per preview per render.
 */
import { inspectSvgDocument, SVGDocumentVerdict } from '../../../../shared/svg/SVGDocumentPolicy';

export interface SvgPreviewSource {
  verdict: SVGDocumentVerdict;
  /** `data:image/svg+xml;base64,…`, or null when the policy rejected the document. */
  dataUrl: string | null;
}

let cached: { svgCode: string; source: SvgPreviewSource } | null = null;

export function svgPreviewSource(svgCode: string): SvgPreviewSource {
  if (cached?.svgCode === svgCode) return cached.source;
  const verdict = inspectSvgDocument(svgCode);
  const source: SvgPreviewSource = { verdict, dataUrl: verdict.accepted ? svgDataUrl(svgCode) : null };
  cached = { svgCode, source };
  return source;
}

/**
 * Base64 of the UTF-8 bytes. btoa only takes Latin-1, so the markup is first
 * turned into one character per UTF-8 byte via its percent-encoding. Callers
 * pass policy-accepted markup, which has no unpaired surrogates (the only
 * input encodeURIComponent refuses).
 */
export function svgDataUrl(svgCode: string): string {
  const utf8 = encodeURIComponent(svgCode).replace(/%([0-9A-F]{2})/g, (_match, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return `data:image/svg+xml;base64,${btoa(utf8)}`;
}
