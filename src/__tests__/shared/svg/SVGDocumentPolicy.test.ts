import { readFileSync } from 'fs';
import { join } from 'path';
import { inspectSvgDocument, MAX_SVG_DOCUMENT_BYTES } from '../../../shared/svg/SVGDocumentPolicy';
import { ACCEPTED_SVGS, REJECTED_SVGS, STYLE_LEAK_SVG } from '../../fixtures/svgDocuments';

/**
 * A real Recraft V4.1 Vector response (chat/completions, 2026-11-07 smoke
 * test): `choices[0].message.images[0].image_url.url`, base64-decoded. It
 * declares the C2PA namespace for its provenance <metadata>.
 */
const RECRAFT_VECTOR_SVG = readFileSync(join(__dirname, '../../fixtures/recraft-v4.1-vector-2026-11-07.svg'), 'utf8');

describe('SVGDocumentPolicy', () => {
  it.each(Object.entries(ACCEPTED_SVGS))('accepts %s', (_name, svg) => {
    expect(inspectSvgDocument(svg)).toEqual({ accepted: true });
  });

  it.each(Object.entries(REJECTED_SVGS))('rejects %s', (_name, { svg, reason }) => {
    const verdict = inspectSvgDocument(svg);
    expect(verdict.accepted).toBe(false);
    expect(verdict.accepted === false && verdict.reason).toContain(reason);
  });

  it('leaves <style> and id isolation to the preview: the style-leak document is valid SVG', () => {
    // Broad CSS and colliding ids are harmless inside an <img>; the policy
    // must not reject artwork for using them.
    expect(inspectSvgDocument(STYLE_LEAK_SVG)).toEqual({ accepted: true });
  });

  it('rejects documents over the size cap, counted in UTF-8 bytes', () => {
    const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg"><text>${body}</text></svg>`;
    const overhead = wrap('').length;
    expect(inspectSvgDocument(wrap('a'.repeat(MAX_SVG_DOCUMENT_BYTES - overhead)))).toEqual({ accepted: true });
    expect(inspectSvgDocument(wrap('a'.repeat(MAX_SVG_DOCUMENT_BYTES - overhead + 1)))).toEqual({
      accepted: false, reason: 'is larger than 2 MB',
    });
    // 'é' is two bytes: under the cap in characters, over it in bytes.
    expect(inspectSvgDocument(wrap('é'.repeat(MAX_SVG_DOCUMENT_BYTES / 2)))).toMatchObject({ accepted: false });
  });

  it('rejects empty and non-SVG input', () => {
    expect(inspectSvgDocument('')).toMatchObject({ accepted: false, reason: expect.stringContaining('<svg> root') });
    expect(inspectSvgDocument('Here is your icon!')).toMatchObject({ accepted: false });
    expect(inspectSvgDocument('<svg')).toMatchObject({ accepted: false });
  });

  it('accepts a real Recraft vector response, C2PA metadata namespace included', () => {
    expect(RECRAFT_VECTOR_SVG).toContain('xmlns:c2pa="http://c2pa.org/manifest"');
    expect(inspectSvgDocument(RECRAFT_VECTOR_SVG)).toEqual({ accepted: true });
  });

  it('inspects a large document in linear time', () => {
    const shapes = '<rect x="1" y="1" width="2" height="2" fill="#123456"/>'.repeat(20000);
    const started = Date.now();
    expect(inspectSvgDocument(`<svg xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`)).toEqual({ accepted: true });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  describe('worst-case input stays linear (R5-S2)', () => {
    const NS = 'xmlns="http://www.w3.org/2000/svg"';
    /** Repeat `unit` to fill a document of just under the 2 MB cap. */
    const fill = (before: string, unit: string, after: string) => {
      const room = MAX_SVG_DOCUMENT_BYTES - before.length - after.length;
      return before + unit.repeat(Math.floor(room / unit.length)) + after;
    };
    const timed = (svg: string) => {
      const started = Date.now();
      const verdict = inspectSvgDocument(svg);
      return { verdict, ms: Date.now() - started };
    };
    // Each was quadratic or worse in a regex before (128 KB of `url(` took
    // 5.9 s; the full 2 MB about 25 minutes), or probes another scan loop.
    const cases: Record<string, string> = {
      'url( openers in <style>': fill(`<svg ${NS}><style>`, 'url(', '</style></svg>'),
      'url( openers in an attribute': fill(`<svg ${NS}><rect fill="`, 'url(', '"/></svg>'),
      'url("… openers in <style>': fill(`<svg ${NS}><style>`, 'url("', '</style></svg>'),
      'CSS comment openers': fill(`<svg ${NS}><style>`, '/*', '</style></svg>'),
      'CSS string openers': fill(`<svg ${NS}><style>`, `"'`, '</style></svg>'),
      'CSS escapes': fill(`<svg ${NS}><style>`, '\\', '</style></svg>'),
      'entity openers in an attribute': fill(`<svg ${NS}><rect id="`, '&#x', '"/></svg>'),
      'many tiny attributes': fill(`<svg ${NS}><rect `, 'a="" ', '/></svg>'),
      'deep nesting': fill(`<svg ${NS}>`, '<g>', '</svg>'),
      'comment openers': fill(`<svg ${NS}>`, '<!--', '</svg>'),
      'stray end-tag openers': fill(`<svg ${NS}>`, '</', '</svg>'),
      'many url(#id) references': fill(`<svg ${NS}><style>`, 'a{fill:url(#g)}', '</style></svg>'),
    };

    it.each(Object.entries(cases))('%s: 2 MB in well under a second', (_name, svg) => {
      expect(svg.length).toBeLessThanOrEqual(MAX_SVG_DOCUMENT_BYTES);
      const { ms } = timed(svg);
      expect(ms).toBeLessThan(1000);
    });

    it('rejects an unterminated url( flood instead of accepting it', () => {
      expect(timed(cases['url( openers in <style>']).verdict).toMatchObject({ accepted: false });
    });
  });

  describe('long names and deep nesting stay linear (R16-1)', () => {
    const NS = 'xmlns="http://www.w3.org/2000/svg"';
    const root = (body: string) => `<svg ${NS}>${body}</svg>`;
    const overhead = root('').length;
    /** Largest n whose document, `n` bytes per unit, stays under the 2 MB cap. */
    const units = (bytesPerUnit: number, extra = 0) => Math.floor((MAX_SVG_DOCUMENT_BYTES - overhead - extra) / bytesPerUnit);
    const timed = (svg: string) => {
      const started = Date.now();
      const verdict = inspectSvgDocument(svg);
      return { verdict, ms: Date.now() - started };
    };

    // Each document is valid and accepted, so the scanner reads all of it.
    // Before R16-1 the first took 5.7 s at 384 KB (O(n²): the open parent's
    // name was re-read for every child); at 2 MB it would take minutes.
    const cases: Record<string, () => string> = {
      'a long open element name with many children': () => {
        const n = units(6, 5); // <n> + n × <g/> + </n>
        const tag = 'g'.repeat(n);
        return root(`<${tag}>${'<g/>'.repeat(n)}</${tag}>`);
      },
      'a long prefixed open element name with many children': () => {
        const n = units(6, 64); // also the xmlns:svg declaration and two "svg:" prefixes
        const tag = `svg:${'g'.repeat(n)}`;
        return `<svg ${NS} xmlns:svg="http://www.w3.org/2000/svg"><${tag}>${'<g/>'.repeat(n)}</${tag}></svg>`;
      },
      'a long open element name with many text runs': () => {
        const n = units(7, 5); // <n> + n × "x<g/>" (5) + </n>
        const tag = 'g'.repeat(n);
        return root(`<${tag}>${'x<g/>'.repeat(n)}</${tag}>`);
      },
      'balanced deep nesting': () => {
        const n = units(7);
        return root('<g>'.repeat(n) + '</g>'.repeat(n));
      },
      'deep nesting of long names': () => {
        const tag = 'g'.repeat(1000);
        const depth = units(2 * tag.length + 5);
        return root(`<${tag}>`.repeat(depth) + `</${tag}>`.repeat(depth));
      },
      'a long open name around a <style> with many CDATA runs': () => {
        const n = units(18, 20);
        const tag = 'g'.repeat(n);
        return root(`<${tag}><style>${'<![CDATA[a{}]]>'.repeat(n)}</style></${tag}>`);
      },
    };

    it.each(Object.entries(cases))('%s: about 2 MB, accepted in well under a second', (_name, build) => {
      const svg = build();
      expect(svg.length).toBeLessThanOrEqual(MAX_SVG_DOCUMENT_BYTES);
      expect(svg.length).toBeGreaterThan(MAX_SVG_DOCUMENT_BYTES * 0.9);
      const { verdict, ms } = timed(svg);
      expect(verdict).toEqual({ accepted: true });
      expect(ms).toBeLessThan(1000);
    });

    it('still matches end tags exactly, case-insensitively, and finds <style> by local name', () => {
      expect(inspectSvgDocument(root('<G><g/></g>'))).toEqual({ accepted: true });
      expect(inspectSvgDocument(root('<gg><g/></g>'))).toMatchObject({ accepted: false, reason: expect.stringContaining("doesn't close <gg>") });
      // A prefixed <style> is still a <style>: its CSS is checked when it closes.
      expect(inspectSvgDocument(`<svg ${NS} xmlns:s="http://www.w3.org/2000/svg"><s:style>@import "x.css";</s:style></svg>`))
        .toMatchObject({ accepted: false, reason: expect.stringContaining('@import') });
      // A sibling element named like style (stylex) is not one.
      expect(inspectSvgDocument(root('<stylex>@import "x.css";</stylex>'))).toEqual({ accepted: true });
      expect(inspectSvgDocument(root('<style><g/></style>'))).toMatchObject({ accepted: false, reason: expect.stringContaining('inside <style>') });
    });
  });
});
