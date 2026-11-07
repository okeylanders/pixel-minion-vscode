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
 * - markup that isn't well-formed enough to inspect, including element and
 *   attribute names outside ASCII (read exactly or not at all);
 * - <script>, <foreignObject>, <iframe>, <embed>, <object>, <handler>;
 * - event-handler attributes (`on…`);
 * - namespace declarations other than SVG, XLink, XML and C2PA metadata;
 * - `href` / `xlink:href` / `src` / `xml:base` that leave the document;
 * - CSS `url(…)` / `src(…)` / `image(…)` that leave the document (or never
 *   close), `@import`, `image-set()`, `expression()`, `-moz-binding`,
 *   `behavior:`, in <style> and in every attribute value;
 * - `javascript:`, `vbscript:` and `data:text/html` anywhere in an attribute;
 * - SMIL that animates `href`, `src` or `xml:base`;
 * - a DOCTYPE with an internal subset (entity definitions), processing
 *   instructions other than a leading XML declaration (e.g.
 *   xml-stylesheet), and an XML declaration naming an encoding other than
 *   UTF-8 (saved files are UTF-8; another declared encoding would make a
 *   browser read different markup than this scanner did).
 *
 * Every pass is linear in the document size: the scanner and the CSS
 * tokenizer walk the text once with indexOf and single-position sticky
 * matches, and no pattern can backtrack across the document. The host runs
 * this after every generation and the webview on every new result, on up to
 * 2 MB of provider output, so a super-linear pattern is a hang.
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
const FORBIDDEN_ELEMENTS: ReadonlyMap<string, string> = new Map([
  ['script', '<script>'],
  ['foreignobject', '<foreignObject>'],
  ['iframe', '<iframe>'],
  ['embed', '<embed>'],
  ['object', '<object>'],
  ['handler', '<handler>'],
]);

/** Attributes (local names) whose value is a URL the document would load or follow. */
const URL_ATTRIBUTES = new Set(['href', 'src', 'base']);

/**
 * Namespaces a document may declare: SVG, XLink, the XML namespace, and the
 * C2PA provenance namespace Recraft puts in its <metadata> (a real Recraft
 * V4.1 Vector response declares `xmlns:c2pa`). Anything else (XHTML, MathML,
 * an editor's private vocabulary) is refused rather than reasoned about.
 */
const ALLOWED_NAMESPACES = new Set([
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
  'http://c2pa.org/manifest',
]);

/** How the SMIL rule names an animated URL attribute. */
const URL_ATTRIBUTE_LABELS: ReadonlyMap<string, string> = new Map([['href', 'href'], ['src', 'src'], ['base', 'xml:base']]);

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
  // Every check needs one of these: `(` (url(), image-set(), expression()),
  // `:` (behavior:, javascript:), `@` (@import), `/` (a comment) or `\` (an
  // escape that could spell any of them). Most attribute values have none.
  if (!CSS_TRIGGER.test(css)) return;
  const { text, urls } = tokenizeCss(css);
  const flat = compact(text);
  if (flat.includes('@import')) throw new Rejection('imports a stylesheet (@import)');
  if (flat.includes('image-set(')) throw new Rejection('uses image-set(), which can load external images');
  if (flat.includes('expression(')) throw new Rejection('uses a CSS expression()');
  if (flat.includes('-moz-binding') || flat.includes('behavior:')) throw new Rejection('uses a CSS binding');
  if (flat.includes('javascript:') || flat.includes('vbscript:')) throw new Rejection('contains a javascript: URL');
  for (const target of urls) {
    if (!isLocalReference(target)) {
      throw new Rejection(`links to an external resource (${describeUrl(target)})`);
    }
  }
}

const CSS_TRIGGER = /[(:@/\\]/;

/** Functions whose argument is a resource the browser loads. */
const URL_FUNCTIONS = new Set(['url', 'src', 'image']);

const isCssNewline = (ch: string) => ch === '\n' || ch === '\r' || ch === '\f';
const isCssWhitespace = (ch: string) => ch === ' ' || ch === '\t' || isCssNewline(ch);
const isHexDigit = (ch: string) => {
  const c = ch.charCodeAt(0);
  return (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);
};
/** CSS "name code point": letter, digit, `-`, `_`, or anything non-ASCII. */
const isNameChar = (ch: string) => {
  const c = ch.charCodeAt(0);
  return (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || c === 0x2d || c === 0x5f || c >= 0x80;
};

/**
 * A single pass over CSS, following the CSS Syntax tokenizer where it
 * matters: comments are dropped (outside strings and url tokens only),
 * escapes are decoded, strings are kept, and the argument of every
 * `url(` / `src(` / `image(` is collected. An unquoted url token is read the
 * way a browser reads it, without comment processing, so a `/*` inside one
 * can't hide what follows. Fails closed: a comment, url( or url argument the
 * tokenizer can't finish is a rejection. Linear: every step advances.
 */
function tokenizeCss(css: string): { text: string; urls: string[] } {
  const out: string[] = [];
  const urls: string[] = [];
  let ident = '';
  let i = 0;

  /** Decode the escape whose backslash is at `at`; returns the character and the index after it. */
  const escape = (at: number): { value: string; next: number } => {
    let j = at + 1;
    if (j >= css.length) return { value: '\ufffd', next: j };
    if (!isHexDigit(css[j])) return { value: css[j], next: j + 1 };
    let hex = '';
    while (j < css.length && hex.length < 6 && isHexDigit(css[j])) hex += css[j++];
    if (j < css.length && isCssWhitespace(css[j])) j += css[j] === '\r' && css[j + 1] === '\n' ? 2 : 1;
    const code = parseInt(hex, 16);
    const valid = code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
    return { value: valid ? String.fromCodePoint(code) : '\ufffd', next: j };
  };

  /** Read a string token opened at `at`; returns its decoded value and the index after it. */
  const string = (at: number): { value: string; next: number } => {
    const quote = css[at];
    let value = '';
    let j = at + 1;
    while (j < css.length) {
      const ch = css[j];
      if (ch === quote) return { value, next: j + 1 };
      if (isCssNewline(ch)) return { value, next: j }; // a bad string ends at the line break
      if (ch === '\\') {
        if (j + 1 < css.length && isCssNewline(css[j + 1])) {
          j += 2; // line continuation
          continue;
        }
        const decoded = escape(j);
        value += decoded.value;
        j = decoded.next;
        continue;
      }
      value += ch;
      j++;
    }
    return { value, next: j }; // a string left open runs to the end
  };

  const skipWhitespace = (from: number): number => {
    let j = from;
    while (j < css.length && isCssWhitespace(css[j])) j++;
    return j;
  };

  /** Read the argument of a url-like function whose `(` is at `open`; returns the index after its `)`. */
  const urlArgument = (open: number): number => {
    const unclosed = "isn't well-formed (a CSS url( is never closed)";
    let j = skipWhitespace(open + 1);
    if (j >= css.length) throw new Rejection(unclosed);
    if (css[j] === '"' || css[j] === "'") {
      const read = string(j);
      urls.push(read.value);
      j = skipWhitespace(read.next);
      if (j >= css.length) throw new Rejection(unclosed);
      if (css[j] !== ')') throw new Rejection("isn't well-formed (a CSS url( it can't read)");
      return j + 1;
    }
    let value = '';
    while (j < css.length) {
      const ch = css[j];
      if (ch === ')') {
        urls.push(value);
        return j + 1;
      }
      if (isCssWhitespace(ch)) {
        j = skipWhitespace(j);
        if (j >= css.length) throw new Rejection(unclosed);
        if (css[j] !== ')') throw new Rejection("isn't well-formed (a CSS url( it can't read)");
        continue;
      }
      if (ch === '\\') {
        if (j + 1 < css.length && isCssNewline(css[j + 1])) throw new Rejection("isn't well-formed (a CSS url( it can't read)");
        const decoded = escape(j);
        value += decoded.value;
        j = decoded.next;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '(') throw new Rejection("isn't well-formed (a CSS url( it can't read)");
      value += ch;
      j++;
    }
    throw new Rejection(unclosed);
  };

  while (i < css.length) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) throw new Rejection("isn't well-formed (a CSS comment is never closed)");
      i = end + 2;
      ident = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      const read = string(i);
      out.push(ch, read.value, ch);
      i = read.next;
      ident = '';
      continue;
    }
    if (ch === '\\' && !(i + 1 < css.length && isCssNewline(css[i + 1]))) {
      const decoded = escape(i);
      out.push(decoded.value);
      ident += decoded.value; // an escaped character is part of a name
      i = decoded.next;
      continue;
    }
    if (ch === '(' && URL_FUNCTIONS.has(ident.toLowerCase())) {
      out.push('(');
      i = urlArgument(i);
      out.push(')');
      ident = '';
      continue;
    }
    out.push(ch);
    ident = isNameChar(ch) ? ident + ch : '';
    i++;
  }
  return { text: out.join(''), urls };
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
 * match at one position each and never span more than the token they read,
 * which keeps the pass linear in the document size.
 *
 * Names are ASCII XML names (`[A-Za-z_][A-Za-z0-9_.:-]*`; an attribute may
 * also start with `:`), and a name must end at whitespace, `/`, `>` (or `=`
 * for an attribute). XML allows more letters in names; a name the scanner
 * would otherwise read only part of (and then misread the rest) is a
 * rejection instead.
 */
class Scanner {
  private static readonly ELEMENT_NAME = /[A-Za-z_][A-Za-z0-9_.:-]*/y;
  private static readonly END_TAG = /<\/([A-Za-z_][A-Za-z0-9_.:-]*)[ \t\r\n]*>/y;
  private static readonly ATTRIBUTE_NAME = /[A-Za-z_:][A-Za-z0-9_.:-]*/y;
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

  /**
   * Character data between markup. Inside <style> it is collected as the CSS
   * the browser will read: the XML parser resolves entities in text but not
   * in CDATA sections, so only text outside CDATA is decoded (decoding a
   * CDATA `&#47;*` would invent a comment that hides the CSS after it).
   */
  private text(text: string, cdata = false): void {
    if (this.inStyle()) {
      this.styleText += cdata ? text : decodeXmlEntities(text);
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
      this.text(this.source.slice(this.position + '<![CDATA['.length, end), true);
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
    const body = this.source.slice(this.position, end);
    const target = /^<\?([^\s?]+)/.exec(body)?.[1] ?? '';
    if (target.toLowerCase() !== 'xml') {
      throw new Rejection(`has a processing instruction (<?${target}>)`);
    }
    // The XML declaration: only first in the document (a byte order mark may
    // precede it), exactly `xml`, and UTF-8 if it names an encoding.
    const start = this.source.charCodeAt(0) === 0xfeff ? 1 : 0;
    if (this.position !== start || target !== 'xml') {
      throw new Rejection("isn't well-formed (the XML declaration must come first)");
    }
    // Browsers sniff the label leniently, so any mention of an encoding must
    // be a quoted UTF-8 label.
    if (/\sencoding/i.test(body)) {
      const encoding = /\sencoding\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(body);
      const name = encoding ? encoding[1] ?? encoding[2] : body.slice(body.search(/\sencoding/i)).trim();
      if (!encoding || !/^utf-?8$/i.test(name)) {
        throw new Rejection(`declares an encoding other than UTF-8 (${describeUrl(name)})`);
      }
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
      checkCss(this.styleText);
      this.styleText = '';
    }
    if (this.open.length === 0) this.rootClosed = true;
  }

  private startTag(): void {
    this.position++; // '<'
    const nameMatch = this.take(Scanner.ELEMENT_NAME);
    if (!nameMatch) throw new Rejection("isn't well-formed (a stray '<')");
    this.requireNameEnd('an element name', false);
    const qualifiedName = nameMatch[0];
    const name = localName(qualifiedName);

    if (this.rootClosed) throw new Rejection('has content after its </svg>');
    if (!this.rootSeen) {
      if (name !== 'svg') throw new Rejection(`doesn't have an <svg> root element (it starts with <${qualifiedName}>)`);
      this.rootSeen = true;
    }
    if (this.inStyle()) throw new Rejection("isn't well-formed (an element inside <style>)");
    const forbidden = FORBIDDEN_ELEMENTS.get(name);
    if (forbidden) throw new Rejection(`contains a ${forbidden} element`);

    const { attributes, selfClosing } = this.attributes();
    this.checkAttributes(name, attributes);
    if (!selfClosing) this.open.push(qualifiedName.toLowerCase());
    else if (this.open.length === 0) this.rootClosed = true;
  }

  /** A name must end where XML would end it; otherwise only part of it was read. */
  private requireNameEnd(what: string, attribute: boolean): void {
    const next = this.source[this.position];
    // XML whitespace only: U+FEFF, for one, is whitespace to JavaScript but a
    // name character to XML.
    const ends = next === undefined || next === '/' || next === '>' || next === ' ' || next === '\t'
      || next === '\n' || next === '\r' || (attribute && next === '=');
    if (!ends) throw new Rejection(`isn't well-formed (${what} it can't read)`);
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
      this.requireNameEnd('an attribute name', true);
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
      if (name.toLowerCase().startsWith('xmlns')) this.checkNamespaceDeclaration(name, value);
      if (flat.includes('javascript:') || flat.includes('vbscript:')) {
        throw new Rejection('contains a javascript: URL');
      }
      if (flat.includes('data:text/html')) throw new Rejection('embeds an HTML document (data:text/html)');
      if (URL_ATTRIBUTES.has(local) && value.trim() !== '' && !isLocalReference(value)) {
        throw new Rejection(`links to an external resource (${describeUrl(value)})`);
      }
      if (ANIMATION_ELEMENTS.has(element) && local === 'attributename') {
        const animated = URL_ATTRIBUTE_LABELS.get(localName(value.trim()));
        if (animated) throw new Rejection(`animates a link target (SMIL on ${animated})`);
      }
      // Presentation attributes take CSS too (fill="url(#grad)" is local,
      // fill="url(https://…)" a remote load), and CSS escapes can spell
      // url( without the literal text, so every value gets the CSS check.
      checkCss(value);
    }
  }

  /** `xmlns` / `xmlns:prefix` must name an allowed namespace, exactly. */
  private checkNamespaceDeclaration(name: string, value: string): void {
    if (name !== 'xmlns' && !name.startsWith('xmlns:')) {
      throw new Rejection(`isn't well-formed (a reserved attribute name, ${name})`);
    }
    if (!ALLOWED_NAMESPACES.has(value)) {
      throw new Rejection(`declares a namespace Pixel Minion doesn't allow (${describeUrl(value) || 'empty'})`);
    }
  }
}
