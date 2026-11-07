import { inspectSvgDocument, MAX_SVG_DOCUMENT_BYTES } from '../../../shared/svg/SVGDocumentPolicy';
import { ACCEPTED_SVGS, REJECTED_SVGS, STYLE_LEAK_SVG } from '../../fixtures/svgDocuments';

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

  it('inspects a large document in linear time', () => {
    const shapes = '<rect x="1" y="1" width="2" height="2" fill="#123456"/>'.repeat(20000);
    const started = Date.now();
    expect(inspectSvgDocument(`<svg xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`)).toEqual({ accepted: true });
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
