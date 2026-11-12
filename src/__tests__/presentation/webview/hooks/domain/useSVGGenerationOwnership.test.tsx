/** @jest-environment jsdom */
/**
 * useSVGGeneration request ownership: correlated generate / refine / enhance
 * / clear / save, turns built from the dispatch snapshot (including the
 * attached SVG text), refinements without draft attachments, a truthful
 * "Saved" state and a stable persisted object.
 */
import { act, renderHook } from '@testing-library/react';
import { MessageType, createEnvelope, SVGConversationHistoryTurn } from '@messages';
import {
  useSVGGeneration,
  SVGGenerationPersistence,
} from '../../../../../presentation/webview/hooks/domain/useSVGGeneration';

const mockPost = jest.fn();
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi', () => ({
  useVSCodeApi: () => ({ postMessage: mockPost }),
}));

const model = 'openai/gpt-5.3-codex';
const svg = '<svg viewBox="0 0 10 10"><circle r="4"/></svg>';
const reply = '<svg viewBox="0 0 10 10"><rect width="4" height="4"/></svg>';
const turn: SVGConversationHistoryTurn = { prompt: 'A square', svgCode: reply, turnNumber: 1 };
const existing: Partial<SVGGenerationPersistence> = {
  model, aspectRatio: '16:9', conversationId: 'svg-existing',
  threadSettings: { model, aspectRatio: '16:9' },
  svgCode: reply, conversationHistory: [turn],
  referenceImage: null, referenceSvgText: null,
};

const posted = (type: MessageType) => mockPost.mock.calls.map(([message]) => message).filter((m) => m.type === type);
const last = (type: MessageType) => posted(type)[posted(type).length - 1];
const response = (correlationId: string | undefined, svgCode = reply) =>
  createEnvelope(MessageType.SVG_GENERATION_RESPONSE, 'extension.svgGeneration',
    { conversationId: 'svg-new', svgCode, turnNumber: 1 }, correlationId);
const saveResult = (correlationId: string | undefined, payload: object) =>
  createEnvelope(MessageType.SVG_SAVE_RESULT, 'extension.svgGeneration', payload, correlationId);

beforeEach(() => mockPost.mockClear());

describe('useSVGGeneration request ownership', () => {
  it('records the attached SVG with its turn and ignores stale responses and errors', () => {
    const { result } = renderHook(() => useSVGGeneration({ model }));
    act(() => {
      result.current.setPrompt('Redraw this');
      result.current.setReferenceAttachment({ preview: 'data:image/svg+xml;base64,PHN2Zy8+', svgText: svg });
    });
    act(() => result.current.generate());

    const request = last(MessageType.SVG_GENERATION_REQUEST);
    expect(request.correlationId).toMatch(/^svg-generate-/);
    expect(request.payload).toMatchObject({ prompt: 'Redraw this', referenceSvgText: svg });
    expect(request.payload.referenceImage).toBeUndefined();

    act(() => result.current.setReferenceAttachment({ preview: null, svgText: null }));
    let claimed = true;
    act(() => { claimed = result.current.handleError(createEnvelope(MessageType.ERROR, 'extension.svgGeneration', { message: 'stale' })); });
    expect(claimed).toBe(false);
    act(() => result.current.handleGenerationResponse(response('svg-generate-old', '<svg>stale</svg>')));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.svgCode).toBeNull();

    act(() => result.current.handleGenerationResponse(response(request.correlationId)));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.svgCode).toBe(reply);
    // Recorded from the dispatch, although the attachment was removed since.
    expect(result.current.conversationHistory[0]).toMatchObject({ prompt: 'Redraw this', referenceSvgText: svg });
  });

  it('refines with the thread settings and without the draft attachment', () => {
    const { result } = renderHook(() => useSVGGeneration(existing));
    act(() => {
      result.current.setModel('anthropic/claude-opus-4.7');
      result.current.setAspectRatio('1:1');
      result.current.setReferenceAttachment({ preview: 'data:image/svg+xml;base64,PHN2Zy8+', svgText: svg });
    });
    act(() => result.current.continueChat('Thicker strokes'));

    const request = last(MessageType.SVG_GENERATION_CONTINUE);
    expect(request.correlationId).toMatch(/^svg-continue-/);
    expect(request.payload).toMatchObject({
      prompt: 'Thicker strokes', conversationId: 'svg-existing', model, aspectRatio: '16:9',
    });
    expect(request.payload).not.toHaveProperty('referenceSvgText');
    expect(request.payload).not.toHaveProperty('referenceImage');
  });

  it('settles only its own enhance, so another tab’s enhance error leaves it running', () => {
    const { result } = renderHook(() => useSVGGeneration({ model }));
    act(() => result.current.setPrompt('A star'));
    act(() => result.current.enhancePrompt());
    const request = last(MessageType.ENHANCE_PROMPT_REQUEST);
    expect(request.correlationId).toMatch(/^svg-enhance-/);

    let claimed = true;
    act(() => { claimed = result.current.handleError(createEnvelope(MessageType.ERROR, 'extension.enhance', { message: 'Image enhance failed' }, 'image-enhance-1')); });
    expect(claimed).toBe(false);
    expect(result.current.isEnhancing).toBe(true);
    expect(result.current.error).toBeNull();

    act(() => { claimed = result.current.handleError(createEnvelope(MessageType.ERROR, 'extension.enhance', { message: 'Enhance failed' }, request.correlationId)); });
    expect(claimed).toBe(true);
    expect(result.current.isEnhancing).toBe(false);
    expect(result.current.error).toBe('Enhance failed');
  });

  describe('a late enhance never rewrites a prompt the user moved on from', () => {
    const enhanced = (correlationId: string) => createEnvelope(MessageType.ENHANCE_PROMPT_RESPONSE, 'extension.enhance',
      { enhancedPrompt: 'A five-pointed gold star', originalPrompt: 'A star', type: 'svg' }, correlationId);

    it('Generate sends the prompt on screen and drops the running enhance', () => {
      const { result } = renderHook(() => useSVGGeneration({ model }));
      act(() => result.current.setPrompt('A star'));
      act(() => result.current.enhancePrompt());
      const enhance = last(MessageType.ENHANCE_PROMPT_REQUEST);

      act(() => result.current.generate());
      expect(last(MessageType.SVG_GENERATION_REQUEST).payload.prompt).toBe('A star');
      expect(result.current.isEnhancing).toBe(false);

      act(() => result.current.handleEnhanceResponse(enhanced(enhance.correlationId)));
      let claimed = true;
      act(() => { claimed = result.current.handleError(createEnvelope(MessageType.ERROR, 'extension.enhance', { message: 'late' }, enhance.correlationId)); });
      expect(result.current.prompt).toBe('A star');
      expect(claimed).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });

    it('Clear empties the prompt and its late enhance does not refill it', () => {
      const { result } = renderHook(() => useSVGGeneration(existing));
      act(() => result.current.setPrompt('A star'));
      act(() => result.current.enhancePrompt());
      const enhance = last(MessageType.ENHANCE_PROMPT_REQUEST);

      act(() => result.current.clearConversation());
      expect(result.current.isEnhancing).toBe(false);
      act(() => result.current.handleEnhanceResponse(enhanced(enhance.correlationId)));
      expect(result.current.prompt).toBe('');
    });

    it('keeps an edit made while the enhance ran', () => {
      const { result } = renderHook(() => useSVGGeneration({ model }));
      act(() => result.current.setPrompt('A star'));
      act(() => result.current.enhancePrompt());
      const enhance = last(MessageType.ENHANCE_PROMPT_REQUEST);

      act(() => result.current.setPrompt('A red star'));
      act(() => result.current.handleEnhanceResponse(enhanced(enhance.correlationId)));
      expect(result.current.prompt).toBe('A red star');
      expect(result.current.isEnhancing).toBe(false);
    });
  });

  it('clears the host conversation with a correlated request', () => {
    const { result } = renderHook(() => useSVGGeneration(existing));
    act(() => result.current.clearConversation());

    const request = last(MessageType.SVG_GENERATION_CLEAR);
    expect(request.payload).toEqual({ conversationId: 'svg-existing' });
    expect(request.correlationId).toMatch(/^svg-clear-/);
    expect(result.current.conversationHistory).toEqual([]);
    expect(result.current.threadSettings).toBeNull();
  });

  it('shows Saved only after the host confirms the write, for the SVG on screen', () => {
    const { result } = renderHook(() => useSVGGeneration(existing));
    act(() => result.current.saveSVG());
    const request = last(MessageType.SVG_SAVE_REQUEST);
    expect(result.current.isSaving).toBe(true);
    expect(result.current.isSaved).toBe(false);

    act(() => result.current.handleSaveResult(saveResult(request.correlationId, { success: true, filePath: '/w/a.svg' })));
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isSaved).toBe(true);
  });

  it('never shows Saved after a cancel, a failure, or a result for an older save', () => {
    const { result } = renderHook(() => useSVGGeneration(existing));

    act(() => result.current.saveSVG());
    const cancelled = last(MessageType.SVG_SAVE_REQUEST);
    act(() => result.current.handleSaveResult(saveResult(cancelled.correlationId, { success: false, cancelled: true })));
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isSaved).toBe(false);
    expect(result.current.error).toBeNull();

    act(() => result.current.saveSVG());
    const older = last(MessageType.SVG_SAVE_REQUEST);
    act(() => result.current.saveSVG());
    act(() => result.current.handleSaveResult(saveResult(older.correlationId, { success: true })));
    expect(result.current.isSaved).toBe(false);
    expect(result.current.isSaving).toBe(true);

    const newer = last(MessageType.SVG_SAVE_REQUEST);
    act(() => result.current.handleSaveResult(saveResult(newer.correlationId, { success: false, error: 'Read-only folder' })));
    expect(result.current.isSaved).toBe(false);
    expect(result.current.error).toBe('Read-only folder');
  });

  it('settles a save the host failed to handle (router ERROR) and leaves a running refinement alone', () => {
    const { result } = renderHook(() => useSVGGeneration(existing));
    act(() => result.current.saveSVG());
    const save = last(MessageType.SVG_SAVE_REQUEST);
    act(() => result.current.continueChat('Add a gradient'));
    const refinement = last(MessageType.SVG_GENERATION_CONTINUE);

    let claimed = false;
    act(() => {
      claimed = result.current.handleError(createEnvelope(MessageType.ERROR, 'extension.router',
        { message: 'The host could not handle this request', code: 'UNHANDLED_ERROR' }, save.correlationId));
    });

    expect(claimed).toBe(true);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isSaved).toBe(false);
    expect(result.current.error).toBe('The host could not handle this request');
    expect(result.current.isLoading).toBe(true);

    // Settled: the same id again, an unknown save id, or a late result are not ours.
    const routerError = (id: string) =>
      createEnvelope(MessageType.ERROR, 'extension.router', { message: 'late' }, id);
    act(() => { claimed = result.current.handleError(routerError(save.correlationId)); });
    expect(claimed).toBe(false);
    act(() => { claimed = result.current.handleError(routerError('svg-save-unknown')); });
    expect(claimed).toBe(false);
    act(() => result.current.handleSaveResult(saveResult(save.correlationId, { success: true })));
    expect(result.current.isSaved).toBe(false);

    act(() => result.current.handleGenerationResponse(response(refinement.correlationId)));
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps persistedState referentially equal across renders while idle', () => {
    const { result, rerender } = renderHook(() => useSVGGeneration(existing));
    const first = result.current.persistedState;
    rerender();
    expect(result.current.persistedState).toBe(first);

    act(() => result.current.setPrompt('Changed'));
    expect(result.current.persistedState).not.toBe(first);
  });
});
