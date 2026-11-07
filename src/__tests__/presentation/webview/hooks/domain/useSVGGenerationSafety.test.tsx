/** @jest-environment jsdom */
/**
 * useSVGGeneration safety rules: the thread's model gates Refine, a document
 * the policy rejects is never sent to be saved, and the raster reference a
 * turn was sent with is kept for re-hydration.
 */
import { act, renderHook } from '@testing-library/react';
import { MessageType, createEnvelope } from '@messages';
import {
  useSVGGeneration,
  SVGGenerationPersistence,
} from '../../../../../presentation/webview/hooks/domain/useSVGGeneration';
import { REJECTED_SVGS } from '../../../../fixtures/svgDocuments';

const mockPost = jest.fn();
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi', () => ({
  useVSCodeApi: () => ({ postMessage: mockPost }),
}));

const textModel = 'openai/gpt-5.3-codex';
const vectorModel = 'recraft/recraft-v4.1-pro-vector';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>';
const raster = 'data:image/png;base64,iVBORw0KGgo=';
const posted = (type: MessageType) => mockPost.mock.calls.map(([message]) => message).filter((m) => m.type === type);

const thread = (threadModel: string, svgCode = svg): Partial<SVGGenerationPersistence> => ({
  model: textModel, aspectRatio: '1:1', conversationId: 'svg-1',
  threadSettings: { model: threadModel, aspectRatio: '1:1' },
  svgCode, conversationHistory: [{ prompt: 'An icon', svgCode, turnNumber: 1, referenceImage: raster }],
  referenceImage: null, referenceSvgText: null,
});

beforeEach(() => mockPost.mockClear());

describe('useSVGGeneration safety', () => {
  it('refuses to refine a native-vector conversation, whatever model is picked now', () => {
    const { result } = renderHook(() => useSVGGeneration(thread(vectorModel)));
    act(() => result.current.continueChat('Make it blue'));

    expect(posted(MessageType.SVG_GENERATION_CONTINUE)).toHaveLength(0);
    expect(result.current.error).toContain("Refine isn't available");
    expect(result.current.isLoading).toBe(false);
  });

  it('never sends a rejected document to be saved', () => {
    const { result } = renderHook(() => useSVGGeneration(thread(textModel, REJECTED_SVGS['an onload handler'].svg)));
    act(() => result.current.saveSVG());

    expect(posted(MessageType.SVG_SAVE_REQUEST)).toHaveLength(0);
    expect(result.current.error).toBe('Not saved: this SVG has an event handler attribute (onload).');
    expect(result.current.isSaving).toBe(false);
  });

  it('records the raster reference with its turn and replays it in the history', () => {
    const { result } = renderHook(() => useSVGGeneration({ model: textModel }));
    act(() => {
      result.current.setPrompt('Trace this');
      result.current.setReferenceAttachment({ preview: raster, svgText: null });
    });
    act(() => result.current.generate());
    const request = posted(MessageType.SVG_GENERATION_REQUEST)[0];
    expect(request.payload.referenceImage).toBe(raster);

    act(() => result.current.handleGenerationResponse(createEnvelope(MessageType.SVG_GENERATION_RESPONSE,
      'extension.svgGeneration', { conversationId: 'svg-2', svgCode: svg, turnNumber: 1 }, request.correlationId)));
    expect(result.current.conversationHistory[0].referenceImage).toBe(raster);

    act(() => result.current.continueChat('Thicker lines'));
    const continuation = posted(MessageType.SVG_GENERATION_CONTINUE)[0];
    expect(continuation.payload.history[0]).toMatchObject({ prompt: 'Trace this', referenceImage: raster });
  });

  it('does not record an SVG attachment’s preview image as a raster reference', () => {
    const { result } = renderHook(() => useSVGGeneration({ model: textModel }));
    act(() => {
      result.current.setPrompt('Redraw this');
      result.current.setReferenceAttachment({ preview: 'data:image/svg+xml;base64,PHN2Zy8+', svgText: svg });
    });
    act(() => result.current.generate());
    const request = posted(MessageType.SVG_GENERATION_REQUEST)[0];
    act(() => result.current.handleGenerationResponse(createEnvelope(MessageType.SVG_GENERATION_RESPONSE,
      'extension.svgGeneration', { conversationId: 'svg-3', svgCode: svg, turnNumber: 1 }, request.correlationId)));

    expect(result.current.conversationHistory[0].referenceImage).toBeUndefined();
    expect(result.current.conversationHistory[0].referenceSvgText).toBe(svg);
  });
});
