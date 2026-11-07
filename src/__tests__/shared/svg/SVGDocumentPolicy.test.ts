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
});
