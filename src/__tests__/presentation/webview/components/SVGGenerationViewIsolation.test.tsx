/** @jest-environment jsdom */
/**
 * The SVG tab never puts generated markup into the app's DOM: every preview
 * is an isolated <img> whose data URL carries the document, so a generated
 * <style> or id can't touch the app. A document the policy rejects isn't
 * previewed or saved, but its source stays visible. Refine follows the
 * conversation's model, not the picker.
 *
 * (CSS/SMIL animation inside the <img> needs a real browser; it is a manual
 * check in an installed VSIX.)
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessageType } from '@messages';
import {
  useSVGGeneration,
  SVGGenerationPersistence,
} from '../../../../presentation/webview/hooks/domain/useSVGGeneration';
import { SVGGenerationView } from '../../../../presentation/webview/components/views/SVGGenerationView';
import { svgDataUrl } from '../../../../presentation/webview/components/svg/svgPreviewSource';
import { REJECTED_SVGS, STYLE_LEAK_SVG } from '../../../fixtures/svgDocuments';

const mockPost = jest.fn();
const mockApi = { postMessage: mockPost };
jest.mock('../../../../presentation/webview/hooks/useVSCodeApi', () => ({
  useVSCodeApi: () => mockApi,
}));

const textModel = 'openai/gpt-5.3-codex';
const vectorModel = 'recraft/recraft-v4.1-pro-vector';

const thread = (svgCode: string, threadModel = textModel): Partial<SVGGenerationPersistence> => ({
  model: textModel, aspectRatio: '1:1', conversationId: 'svg-1',
  threadSettings: { model: threadModel, aspectRatio: '1:1' },
  svgCode, conversationHistory: [{ prompt: 'An icon', svgCode, turnNumber: 1 }],
  referenceImage: null, referenceSvgText: null,
});

function View({ initial }: { initial: Partial<SVGGenerationPersistence> }) {
  const svg = useSVGGeneration(initial);
  return <SVGGenerationView svgGeneration={svg} />;
}

/** Data URL → markup, decoding the base64 payload as UTF-8. */
const decode = (dataUrl: string) => {
  const binary = atob(dataUrl.replace(/^data:image\/svg\+xml;base64,/, ''));
  return decodeURIComponent(Array.from(binary, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
};
const previews = () => Array.from(document.querySelectorAll<HTMLImageElement>('img.svg-preview-image'));

beforeEach(() => mockPost.mockClear());

describe('SVG preview isolation', () => {
  it('renders every preview as an <img> and never inserts the markup into the app', () => {
    render(<View initial={thread(STYLE_LEAK_SVG)} />);

    // Inline thumbnail, 32/64/128 and the full preview.
    expect(previews()).toHaveLength(5);
    for (const image of previews()) {
      expect(image.src).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(decode(image.src)).toBe(STYLE_LEAK_SVG);
    }

    // The generated <style> and ids exist only inside the image documents.
    expect(document.querySelector('style')).toBeNull();
    expect(document.querySelector('#pixel-leak-marker')).toBeNull();
    expect(document.querySelector('#monitor-frame')).toBeNull();
    expect(document.querySelector('#skull')).toBeNull();
    expect(document.querySelector('.svg-preview svg')).toBeNull();
  });

  it('still shows a hostile document only as text when its code is opened', () => {
    render(<View initial={thread(STYLE_LEAK_SVG)} />);
    fireEvent.click(screen.getByRole('button', { name: /SVG code/ }));

    expect(screen.getByText(/pixel-leak-marker/).tagName).toBe('CODE');
    expect(document.querySelector('style')).toBeNull();
  });

  it('encodes non-ASCII markup as UTF-8', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Café ✓ 東京</text></svg>';
    expect(decode(svgDataUrl(svg))).toBe(svg);
  });

  it('does not preview or save a rejected document, and keeps its source visible', () => {
    const { svg } = REJECTED_SVGS['a <script> element'];
    render(<View initial={thread(svg)} />);

    expect(previews()).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toContain('Preview and Save are off because this SVG contains a <script> element');
    // The code view opens by itself and shows the exact source.
    expect(screen.getByText(svg).tagName).toBe('CODE');
    expect(document.querySelector('script')).toBeNull();

    const save = screen.getByRole('button', { name: 'Save to workspace' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    act(() => { save.click(); });
    expect(mockPost.mock.calls.filter(([m]) => m.type === MessageType.SVG_SAVE_REQUEST)).toHaveLength(0);
  });
});

describe('Refine eligibility follows the conversation’s model', () => {
  const refine = () => screen.getByPlaceholderText(/Refine/) as HTMLInputElement;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>';

  it('keeps Refine off for a native-vector conversation while a text model is picked', () => {
    render(<View initial={{ ...thread(svg, vectorModel), model: textModel }} />);

    expect(refine().disabled).toBe(true);
    expect(refine().placeholder).toContain('not supported');
  });

  it('keeps Refine on for a text conversation while a native-vector model is picked', () => {
    render(<View initial={{ ...thread(svg, textModel), model: vectorModel }} />);

    expect(refine().disabled).toBe(false);
  });
});
