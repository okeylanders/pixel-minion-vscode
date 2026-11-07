/**
 * SVGDocumentPolicy — which generated SVG documents Pixel Minion previews and
 * saves.
 *
 * Generated markup is untrusted: a model (or a provider) can return an SVG
 * that runs script, loads remote resources or navigates when it is opened.
 * The webview preview is isolated in an <img> (see SVGPreview), which already
 * disables script and remote loads; this policy is the second layer, and the
 * only one for a saved `.svg`, which a browser opens with full privileges.
 *
 * The policy rejects; it never rewrites. A rejected document is still shown
 * as code (so nothing is silently changed or lost) but is not previewed or
 * saved. Rejection is deliberately conservative: when the scanner cannot
 * read the markup with confidence, it rejects.
 *
 * Allowed: ordinary SVG including <style> (with @keyframes), SMIL animation,
 * gradients, filters, <text>, references to the document itself
 * (`href="#id"`, `url(#id)`), and embedded raster images and fonts as
 * `data:` URLs (`image/{png,jpeg,gif,webp}`, `font/*`).
 *
 * Rejected:
 * - documents over MAX_SVG_DOCUMENT_BYTES, or without a single <svg> root;
 * - markup that isn't well-formed enough to inspect;
 * - <script>, <foreignObject>, <iframe>, <embed>, <object>, <handler>;
 * - event-handler attributes (`on…`);
 * - `href` / `xlink:href` / `src` / `xml:base` that leave the document;
 * - CSS `url(…)` that leaves the document, `@import`, `image-set()`,
 *   `expression()`, `-moz-binding`, `behavior:`;
 * - `javascript:`, `vbscript:` and `data:text/html` anywhere in an attribute;
 * - SMIL that animates an `href`;
 * - a DOCTYPE with an internal subset (entity definitions), and processing
 *   instructions other than the XML declaration (e.g. xml-stylesheet).
 *
 * Shared by the webview and the extension host, so it uses no DOM, Node or
 * encoding APIs.
 */

/** Largest SVG document we preview or save (UTF-8 bytes). */
export const MAX_SVG_DOCUMENT_BYTES = 2 * 1024 * 1024;

export type SVGDocumentVerdict =
  | { accepted: true }
  | {
      accepted: false;
      /** Completes "This SVG …", e.g. "contains a <script> element". */
      reason: string;
    };

const ACCEPTED: SVGDocumentVerdict = { accepted: true };

class Rejection extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

/** Elements that run code, embed other documents or host HTML. */
const FORBIDDEN_ELEMENTS: Readonly<Record<string, string>> = {
  script: '<script>',
  foreignobject: '<foreignObject>',
  iframe: '<iframe>',
  embed: '<embed>',
  object: '<object>',
  handler: '<handler>',
};

/** Attributes (local names) whose value is a URL the document would load or follow. */
const URL_ATTRIBUTES = new Set(['href', 'src', 'base']);

/** SMIL elements that can rewrite another attribute over time. */
const ANIMATION_ELEMENTS = new Set(['animate', 'set', 'animatemotion', 'animatetransform', 'animatecolor']);

/** Self-contained data URLs: raster images and fonts (never markup, which could carry script). */
const EMBEDDED_DATA = /^data:(image\/(png|jpe?g|gif|webp)|font\/[\w.+-]+|application\/(x-)?font-[\w.+-]+)[;,]/;

/**
 * Inspect an SVG document. Never throws: anything the scanner can't handle
 * is a rejection.
 */
export function inspectSvgDocument(source: string): SVGDocumentVerdict {
  try {
    checkSize(source);
    new Scanner(source).run();
    return ACCEPTED;
  } catch (error) {
    if (error instanceof Rejection) {
      return { accepted: false, reason: error.reason };
    }
    return { accepted: false, reason: "couldn't be inspected" };
  }
}

function checkSize(source: string): void {
  const limit = `is larger than ${MAX_SVG_DOCUMENT_BYTES / (1024 * 1024)} MB`;
  // Every UTF-16 code unit is at least one UTF-8 byte: a cheap first cut.
  if (source.length > MAX_SVG_DOCUMENT_BYTES) throw new Rejection(limit);
  if (utf8Length(source) > MAX_SVG_DOCUMENT_BYTES) throw new Rejection(limit);
}

/** UTF-8 length without allocating an encoded copy (and without TextEncoder). */
function utf8Length(source: string): number {
  let bytes = 0;
  for (let i = 0; i < source.length; i++) {
    const unit = source.charCodeAt(i);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff) {
      bytes += 4; // a surrogate pair is one 4-byte code point
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** XML 1.0 forbids C0 controls other than tab, LF and CR, and unpaired surrogates. */
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
const UNPAIRED_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

/** XML character and the five predefined entity references. */
function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|lt|gt|amp|quot|apos);?/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) return codePoint(parseInt(lower.slice(2), 16), match);
    if (lower.startsWith('#')) return codePoint(parseInt(lower.slice(1), 10), match);
    return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[lower] ?? match;
  });
}

function codePoint(value: number, fallback: string): string {
  return Number.isFinite(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : fallback;
}

/** CSS with comments removed and escapes (`\6a`, `\:`) resolved. */
function normalizeCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_match, hex: string) => codePoint(parseInt(hex, 16), ''))
    .replace(/\\(.)/g, '$1');
}

/** Lower-cased with whitespace and control characters removed. */
function compact(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '').toLowerCase();
}

/** Whether a URL value stays inside the document (a fragment or embedded data). */
function isLocalReference(url: string): boolean {
  const value = compact(url);
  return value.startsWith('#') || EMBEDDED_DATA.test(value);
}

function describeUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
}

/** Reject active content and external loads in CSS (a <style> body, a style attribute or any attribute value). */
function checkCss(css: string): void {
  const normalized = normalizeCss(css);
  const flat = compact(normalized);
  if (flat.includes('@import')) throw new Rejection('imports a stylesheet (@import)');
  if (flat.includes('image-set(')) throw new Rejection('uses image-set(), which can load external images');
  if (flat.includes('expression(')) throw new Rejection('uses a CSS expression()');
  if (flat.includes('-moz-binding') || flat.includes('behavior:')) throw new Rejection('uses a CSS binding');
  if (flat.includes('javascript:') || flat.includes('vbscript:')) throw new Rejection('contains a javascript: URL');

  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
  for (const match of normalized.matchAll(urlPattern)) {
    const target = match[1] ?? match[2] ?? match[3] ?? '';
    if (!isLocalReference(target)) {
      throw new Rejection(`links to an external resource (${describeUrl(target)})`);
    }
  }
}

function localName(qualifiedName: string): string {
  const colon = qualifiedName.lastIndexOf(':');
  return (colon === -1 ? qualifiedName : qualifiedName.slice(colon + 1)).toLowerCase();
}

interface Attribute {
  name: string;
  value: string;
}

/**
 * A single forward pass over the markup: prolog, elements, attributes, text,
 * comments and CDATA. It tracks element nesting so it can require exactly one
 * <svg> root, and collects <style> text for the CSS check. Sticky regexes
 * keep it linear in the document size.
 */
class Scanner {
  private static readonly ELEMENT_NAME = /[A-Za-z_][\w.:-]*/y;
  private static readonly END_TAG = /<\/([^\s>]+)\s*>/y;
  private static readonly ATTRIBUTE_NAME = /[^\s=/>"']+/y;
  private static readonly UNQUOTED_VALUE = /[^\s>]*/y;
  private static readonly WHITESPACE = /\s*/y;

  private position = 0;
  private readonly open: string[] = [];
  private rootSeen = false;
  private rootClosed = false;
  private styleText = '';

  constructor(private readonly source: string) {}

  run(): void {
    if (FORBIDDEN_CONTROL_CHARACTERS.test(this.source) || UNPAIRED_SURROGATE.test(this.source)) {
      throw new Rejection("isn't well-formed (it contains control characters)");
    }
    while (this.position < this.source.length) {
      const next = this.source.indexOf('<', this.position);
      const textEnd = next === -1 ? this.source.length : next;
      this.text(this.source.slice(this.position, textEnd));
      if (next === -1) break;
      this.position = next;
      this.markup();
    }
    if (!this.rootSeen) throw new Rejection("doesn't have an <svg> root element");
    if (this.open.length > 0) throw new Rejection(`isn't well-formed (<${this.open[this.open.length - 1]}> is never closed)`);
  }

  /** Match a sticky regex at the current position, advancing past it. */
  private take(pattern: RegExp): RegExpExecArray | null {
    pattern.lastIndex = this.position;
    const match = pattern.exec(this.source);
    if (match) this.position = pattern.lastIndex;
    return match;
  }

  private skipWhitespace(): void {
    this.take(Scanner.WHITESPACE);
  }

  private at(prefix: string): boolean {
    return this.source.startsWith(prefix, this.position);
  }

  private text(text: string): void {
    if (this.inStyle()) {
      this.styleText += text;
      return;
    }
    if ((!this.rootSeen || this.rootClosed) && text.trim() !== '') {
      throw new Rejection(this.rootSeen ? 'has content after its </svg>' : 'has content before its <svg> root');
    }
  }

  private markup(): void {
    if (this.at('<!--')) return this.skipPast('-->', 'a comment');
    if (this.at('<![CDATA[')) {
      const end = this.source.indexOf(']]>', this.position);
      if (end === -1) throw new Rejection("isn't well-formed (a CDATA section is never closed)");
      this.text(this.source.slice(this.position + '<![CDATA['.length, end));
      this.position = end + 3;
      return;
    }
    if (this.at('<!')) return this.declaration();
    if (this.at('<?')) return this.processingInstruction();
    if (this.at('</')) return this.endTag();
    this.startTag();
  }

  private skipPast(terminator: string, what: string): void {
    const end = this.source.indexOf(terminator, this.position);
    if (end === -1) throw new Rejection(`isn't well-formed (${what} is never closed)`);
    this.position = end + terminator.length;
  }

  private declaration(): void {
    const end = this.source.indexOf('>', this.position);
    if (end === -1) throw new Rejection("isn't well-formed (a declaration is never closed)");
    const body = this.source.slice(this.position, end);
    if (!/^<!DOCTYPE\s/i.test(body)) throw new Rejection(`has an unsupported declaration (${describeUrl(body)})`);
    if (body.includes('[') || /ENTITY/i.test(body)) {
      throw new Rejection('defines entities in its DOCTYPE');
    }
    if (this.rootSeen) throw new Rejection("isn't well-formed (a DOCTYPE inside the document)");
    this.position = end + 1;
  }

  private processingInstruction(): void {
    const end = this.source.indexOf('?>', this.position);
    if (end === -1) throw new Rejection("isn't well-formed (a processing instruction is never closed)");
    const target = /^<\?([^\s?]+)/.exec(this.source.slice(this.position, end))?.[1] ?? '';
    if (target.toLowerCase() !== 'xml' || this.rootSeen) {
      throw new Rejection(`has a processing instruction (<?${target}>)`);
    }
    this.position = end + 2;
  }

  private endTag(): void {
    const match = this.take(Scanner.END_TAG);
    if (!match) throw new Rejection("isn't well-formed (a malformed closing tag)");
    const name = match[1].toLowerCase();
    const expected = this.open.pop();
    if (expected !== name) {
      throw new Rejection(`isn't well-formed (</${match[1]}> doesn't close <${expected ?? 'nothing'}>)`);
    }
    if (localName(name) === 'style' && this.styleText) {
      // The XML parser resolves entities in <style> text before CSS sees it.
      checkCss(decodeXmlEntities(this.styleText));
      this.styleText = '';
    }
    if (this.open.length === 0) this.rootClosed = true;
  }

  private startTag(): void {
    this.position++; // '<'
    const nameMatch = this.take(Scanner.ELEMENT_NAME);
    if (!nameMatch) throw new Rejection("isn't well-formed (a stray '<')");
    const qualifiedName = nameMatch[0];
    const name = localName(qualifiedName);

    if (this.rootClosed) throw new Rejection('has content after its </svg>');
    if (!this.rootSeen) {
      if (name !== 'svg') throw new Rejection(`doesn't have an <svg> root element (it starts with <${qualifiedName}>)`);
      this.rootSeen = true;
    }
    if (this.inStyle()) throw new Rejection("isn't well-formed (an element inside <style>)");
    const forbidden = FORBIDDEN_ELEMENTS[name];
    if (forbidden) throw new Rejection(`contains a ${forbidden} element`);

    const { attributes, selfClosing } = this.attributes();
    this.checkAttributes(name, attributes);
    if (!selfClosing) this.open.push(qualifiedName.toLowerCase());
    else if (this.open.length === 0) this.rootClosed = true;
  }

  private inStyle(): boolean {
    const current = this.open[this.open.length - 1];
    return current !== undefined && localName(current) === 'style';
  }

  private attributes(): { attributes: Attribute[]; selfClosing: boolean } {
    const attributes: Attribute[] = [];
    for (;;) {
      this.skipWhitespace();
      if (this.position >= this.source.length) throw new Rejection("isn't well-formed (a tag is never closed)");
      if (this.at('>')) {
        this.position++;
        return { attributes, selfClosing: false };
      }
      if (this.at('/>')) {
        this.position += 2;
        return { attributes, selfClosing: true };
      }

      const nameMatch = this.take(Scanner.ATTRIBUTE_NAME);
      if (!nameMatch) throw new Rejection("isn't well-formed (a malformed attribute)");
      const name = nameMatch[0];
      this.skipWhitespace();

      let value = '';
      if (this.at('=')) {
        this.position++;
        this.skipWhitespace();
        const quote = this.source[this.position];
        if (quote === '"' || quote === "'") {
          const end = this.source.indexOf(quote, this.position + 1);
          if (end === -1) throw new Rejection("isn't well-formed (an attribute value is never closed)");
          value = this.source.slice(this.position + 1, end);
          this.position = end + 1;
        } else {
          // Not valid XML, but inspect it rather than skip it.
          value = this.take(Scanner.UNQUOTED_VALUE)?.[0] ?? '';
        }
      }
      attributes.push({ name, value: decodeXmlEntities(value) });
    }
  }

  private checkAttributes(element: string, attributes: Attribute[]): void {
    for (const { name, value } of attributes) {
      const local = localName(name);
      const flat = compact(value);

      if (local.startsWith('on')) throw new Rejection(`has an event handler attribute (${name})`);
      if (flat.includes('javascript:') || flat.includes('vbscript:')) {
        throw new Rejection('contains a javascript: URL');
      }
      if (flat.includes('data:text/html')) throw new Rejection('embeds an HTML document (data:text/html)');
      if (URL_ATTRIBUTES.has(local) && value.trim() !== '' && !isLocalReference(value)) {
        throw new Rejection(`links to an external resource (${describeUrl(value)})`);
      }
      if (ANIMATION_ELEMENTS.has(element) && local === 'attributename' && localName(value.trim()) === 'href') {
        throw new Rejection('animates a link target (SMIL on href)');
      }
      // Presentation attributes take CSS too: fill="url(#grad)" is local,
      // fill="url(https://…)" is a remote load.
      if (local === 'style' || flat.includes('url(')) checkCss(value);
    }
  }
}
