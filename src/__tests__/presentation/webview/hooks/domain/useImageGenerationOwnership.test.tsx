/** @jest-environment jsdom */
/**
 * useImageGeneration request ownership: every request carries a correlation
 * id, only its own answer settles it, the turn is built from what was
 * dispatched, refinements carry no draft attachments, "Saved" reflects the
 * host's result, and the persisted object is stable while nothing changes.
 *
 * The stale-response case is adapted from frame-minion@40e7949
 * useImageGenerationModes.test.tsx:41, without modes.
 */
import { act, renderHook } from '@testing-library/react';
import {
  MessageType,
  createEnvelope,
  ConversationTurn,
  GeneratedImage,
} from '@messages';
import {
  useImageGeneration,
  ImageGenerationPersistence,
} from '../../../../../presentation/webview/hooks/domain/useImageGeneration';

const mockPost = jest.fn();
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi', () => ({
  useVSCodeApi: () => ({ postMessage: mockPost }),
}));

const model = 'google/gemini-3.1-flash-image-preview';
const svg = '<svg viewBox="0 0 10 10"><circle r="4"/></svg>';
const image: GeneratedImage = {
  id: 'img-existing-1-0', data: 'data:image/png;base64,QUJD', mimeType: 'image/png',
  prompt: 'Blue knight', seed: 12, timestamp: 1,
};
const turn: ConversationTurn = { id: 'turn-1', prompt: 'Blue knight', images: [image], turnNumber: 1, timestamp: 1 };
const existing: Partial<ImageGenerationPersistence> = {
  model, aspectRatio: '16:9', conversationId: 'img-existing',
  threadSettings: { model, aspectRatio: '16:9' },
  generatedImages: [image], conversationHistory: [turn],
};

const posted = (type: MessageType) => mockPost.mock.calls.map(([message]) => message).filter((m) => m.type === type);
const last = (type: MessageType) => posted(type)[posted(type).length - 1];
const response = (correlationId: string | undefined, images: GeneratedImage[] = [image]) =>
  createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration',
    { conversationId: 'img-new', images, turnNumber: 1 }, correlationId);
const error = (source: 'extension.imageGeneration' | 'extension.enhance', text: string, correlationId?: string) =>
  createEnvelope(MessageType.ERROR, source, { message: text }, correlationId);

beforeEach(() => mockPost.mockClear());

describe('useImageGeneration request ownership', () => {
  it('captures prompt and context once, and ignores stale responses and errors', () => {
    const { result } = renderHook(() => useImageGeneration({ model }));
    act(() => {
      result.current.setPrompt('A knight');
      result.current.addReferenceImage('data:image/svg+xml;base64,PHN2Zy8+', svg);
    });
    act(() => result.current.generate());

    const request = last(MessageType.IMAGE_GENERATION_REQUEST);
    expect(request.correlationId).toMatch(/^image-generate-/);
    // The SVG goes once, as referenceSvgText; the host appends it.
    expect(request.payload.prompt).toBe('A knight');
    expect(request.payload.referenceSvgText).toBe(svg);
    expect(request.payload.referenceImages).toBeUndefined();

    // Typing after dispatch doesn't change what the turn records.
    act(() => result.current.setPrompt('Something else'));

    let claimed = true;
    act(() => { claimed = result.current.handleError(error('extension.imageGeneration', 'stale')); });
    expect(claimed).toBe(false);
    act(() => result.current.handleGenerationResponse(response('image-generate-old')));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.conversationHistory).toHaveLength(0);

    act(() => result.current.handleGenerationResponse(response(request.correlationId)));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.conversationHistory[0]).toMatchObject({ prompt: 'A knight', referenceSvgText: svg });
    expect(result.current.threadSettings).toEqual({ model, aspectRatio: '1:1' });

    // A duplicate delivery of the same response can't add a second turn.
    act(() => result.current.handleGenerationResponse(response(request.correlationId)));
    expect(result.current.conversationHistory).toHaveLength(1);
  });

  it('settles a failed generation only by its own error', () => {
    const { result } = renderHook(() => useImageGeneration({ model }));
    act(() => result.current.setPrompt('A knight'));
    act(() => result.current.generate());
    const request = last(MessageType.IMAGE_GENERATION_REQUEST);

    let claimed = false;
    act(() => { claimed = result.current.handleError(error('extension.imageGeneration', 'Provider down', request.correlationId)); });
    expect(claimed).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Provider down');
    expect(result.current.threadSettings).toBeNull();

    // A late response for the failed request can't revive it.
    act(() => result.current.handleGenerationResponse(response(request.correlationId)));
    expect(result.current.conversationHistory).toHaveLength(0);
  });

  it('refines with the thread settings and no draft attachments', () => {
    const { result } = renderHook(() => useImageGeneration(existing));
    act(() => {
      result.current.setModel('openai/gpt-5-image');
      result.current.setAspectRatio('1:1');
      result.current.addReferenceImage('data:image/png;base64,REVG');
      result.current.addReferenceImage('data:image/svg+xml;base64,PHN2Zy8+', svg);
    });
    act(() => result.current.continueChat('Add a tree'));

    const request = last(MessageType.IMAGE_GENERATION_CONTINUE);
    expect(request.correlationId).toMatch(/^image-continue-/);
    expect(request.payload).toMatchObject({
      prompt: 'Add a tree', conversationId: 'img-existing', model, aspectRatio: '16:9',
    });
    expect(request.payload).not.toHaveProperty('referenceImages');
    expect(request.payload).not.toHaveProperty('referenceSvgText');
    expect(request.payload.history).toEqual([{ prompt: 'Blue knight', images: [{ data: image.data, seed: 12 }], referenceSvgText: undefined }]);
  });

  it('continues a conversation saved before thread settings existed with its saved controls', () => {
    const legacy: Partial<ImageGenerationPersistence> = { ...existing };
    delete legacy.threadSettings;
    const { result } = renderHook(() => useImageGeneration(legacy));
    act(() => result.current.setModel('openai/gpt-5-image'));
    act(() => result.current.continueChat('Add a tree'));

    expect(last(MessageType.IMAGE_GENERATION_CONTINUE).payload).toMatchObject({ model, aspectRatio: '16:9' });
  });

  it('settles an enhance by its own answer; generation errors leave it running', () => {
    const { result } = renderHook(() => useImageGeneration({ model }));
    act(() => result.current.setPrompt('A knight'));
    act(() => result.current.enhancePrompt());
    const request = last(MessageType.ENHANCE_PROMPT_REQUEST);
    expect(request.correlationId).toMatch(/^image-enhance-/);

    act(() => { result.current.handleError(error('extension.enhance', 'someone else', 'svg-enhance-1')); });
    act(() => result.current.handleEnhanceResponse(createEnvelope(MessageType.ENHANCE_PROMPT_RESPONSE, 'extension.enhance',
      { enhancedPrompt: 'stale', originalPrompt: 'A knight', type: 'image' }, 'image-enhance-old')));
    expect(result.current.isEnhancing).toBe(true);
    expect(result.current.prompt).toBe('A knight');

    act(() => result.current.handleEnhanceResponse(createEnvelope(MessageType.ENHANCE_PROMPT_RESPONSE, 'extension.enhance',
      { enhancedPrompt: 'A knight in moonlight', originalPrompt: 'A knight', type: 'image' }, request.correlationId)));
    expect(result.current.isEnhancing).toBe(false);
    expect(result.current.prompt).toBe('A knight in moonlight');
  });

  describe('a late enhance never rewrites a prompt the user moved on from', () => {
    const enhanced = (correlationId: string) => createEnvelope(MessageType.ENHANCE_PROMPT_RESPONSE, 'extension.enhance',
      { enhancedPrompt: 'A knight in moonlight', originalPrompt: 'A knight', type: 'image' }, correlationId);

    it('Generate sends the prompt on screen and drops the running enhance', () => {
      const { result } = renderHook(() => useImageGeneration({ model }));
      act(() => result.current.setPrompt('A knight'));
      act(() => result.current.enhancePrompt());
      const enhance = last(MessageType.ENHANCE_PROMPT_REQUEST);

      act(() => result.current.generate());
      expect(last(MessageType.IMAGE_GENERATION_REQUEST).payload.prompt).toBe('A knight');
      expect(result.current.isEnhancing).toBe(false);

      act(() => result.current.handleEnhanceResponse(enhanced(enhance.correlationId)));
      let claimed = true;
      act(() => { claimed = result.current.handleError(error('extension.enhance', 'late', enhance.correlationId)); });
      expect(result.current.prompt).toBe('A knight');
      expect(claimed).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });

    it('Clear empties the prompt and its late enhance does not refill it', () => {
      const { result } = renderHook(() => useImageGeneration(existing));
      act(() => result.current.setPrompt('A knight'));
      act(() => result.current.enhancePrompt());
      const enhance = last(MessageType.ENHANCE_PROMPT_REQUEST);

      act(() => result.current.clearConversation());
      expect(result.current.isEnhancing).toBe(false);
      act(() => result.current.handleEnhanceResponse(enhanced(enhance.correlationId)));
      expect(result.current.prompt).toBe('');
    });

    it('keeps an edit made while the enhance ran', () => {
      const { result } = renderHook(() => useImageGeneration({ model }));
      act(() => result.current.setPrompt('A knight'));
      act(() => result.current.enhancePrompt());
      const enhance = last(MessageType.ENHANCE_PROMPT_REQUEST);

      act(() => result.current.setPrompt('A knight on a horse'));
      act(() => result.current.handleEnhanceResponse(enhanced(enhance.correlationId)));
      expect(result.current.prompt).toBe('A knight on a horse');
      expect(result.current.isEnhancing).toBe(false);
    });
  });

  it('clears the host conversation too, and shows a refused clear', () => {
    const { result } = renderHook(() => useImageGeneration(existing));
    act(() => result.current.clearConversation());

    const request = last(MessageType.IMAGE_GENERATION_CLEAR);
    expect(request.payload).toEqual({ conversationId: 'img-existing' });
    expect(request.correlationId).toMatch(/^image-clear-/);
    expect(result.current.conversationId).toBeNull();
    expect(result.current.threadSettings).toBeNull();

    let claimed = false;
    act(() => { claimed = result.current.handleError(error('extension.imageGeneration', 'Wait for it', request.correlationId)); });
    expect(claimed).toBe(true);
    expect(result.current.error).toBe('Wait for it');
  });

  it('shows Saved only after the host confirms the write', () => {
    const { result } = renderHook(() => useImageGeneration(existing));
    act(() => result.current.saveImage(image));
    const request = last(MessageType.IMAGE_SAVE_REQUEST);
    expect(result.current.savingImageIds.has(image.id)).toBe(true);
    expect(result.current.savedImageIds.has(image.id)).toBe(false);

    act(() => result.current.handleSaveResult(createEnvelope(MessageType.IMAGE_SAVE_RESULT, 'extension.imageGeneration',
      { success: true, imageId: image.id, filePath: '/w/pixel-minion/a.png' }, request.correlationId)));
    expect(result.current.savingImageIds.has(image.id)).toBe(false);
    expect(result.current.savedImageIds.has(image.id)).toBe(true);
  });

  it('never shows Saved for a cancelled or failed save, or for a result it did not request', () => {
    const { result } = renderHook(() => useImageGeneration(existing));

    act(() => result.current.handleSaveResult(createEnvelope(MessageType.IMAGE_SAVE_RESULT, 'extension.imageGeneration',
      { success: true, imageId: image.id }, 'image-save-unknown')));
    expect(result.current.savedImageIds.has(image.id)).toBe(false);

    act(() => result.current.saveImage(image));
    const cancelled = last(MessageType.IMAGE_SAVE_REQUEST);
    act(() => result.current.handleSaveResult(createEnvelope(MessageType.IMAGE_SAVE_RESULT, 'extension.imageGeneration',
      { success: false, cancelled: true, imageId: image.id }, cancelled.correlationId)));
    expect(result.current.savingImageIds.has(image.id)).toBe(false);
    expect(result.current.savedImageIds.has(image.id)).toBe(false);
    expect(result.current.error).toBeNull();

    act(() => result.current.saveImage(image));
    const failed = last(MessageType.IMAGE_SAVE_REQUEST);
    act(() => result.current.handleSaveResult(createEnvelope(MessageType.IMAGE_SAVE_RESULT, 'extension.imageGeneration',
      { success: false, imageId: image.id, error: 'Disk full' }, failed.correlationId)));
    expect(result.current.savedImageIds.has(image.id)).toBe(false);
    expect(result.current.error).toBe('Disk full');
  });

  it('settles a save the host failed to handle (router ERROR) and leaves a running refinement alone', () => {
    const { result } = renderHook(() => useImageGeneration(existing));
    const other: GeneratedImage = { ...image, id: 'img-other' };
    act(() => { result.current.saveImage(image); result.current.saveImage(other); });
    const [save, otherSave] = posted(MessageType.IMAGE_SAVE_REQUEST);
    act(() => result.current.continueChat('Make it red'));
    const refinement = last(MessageType.IMAGE_GENERATION_CONTINUE);

    let claimed = false;
    act(() => {
      claimed = result.current.handleError(createEnvelope(MessageType.ERROR, 'extension.router',
        { message: 'The host could not handle this request', code: 'UNHANDLED_ERROR' }, save.correlationId));
    });

    expect(claimed).toBe(true);
    expect(result.current.savingImageIds.has(image.id)).toBe(false);
    expect(result.current.savingImageIds.has(other.id)).toBe(true); // only that save
    expect(result.current.error).toBe('The host could not handle this request');
    expect(result.current.isLoading).toBe(true);

    // Settled: the same id again, an unknown save id, or a late result are not ours.
    act(() => { claimed = result.current.handleError(error('extension.imageGeneration', 'again', save.correlationId)); });
    expect(claimed).toBe(false);
    act(() => { claimed = result.current.handleError(error('extension.imageGeneration', 'unknown', 'image-save-unknown')); });
    expect(claimed).toBe(false);
    act(() => result.current.handleSaveResult(createEnvelope(MessageType.IMAGE_SAVE_RESULT, 'extension.imageGeneration',
      { success: true, imageId: image.id }, save.correlationId)));
    expect(result.current.savedImageIds.has(image.id)).toBe(false);

    // The other save and the refinement still settle on their own answers.
    act(() => result.current.handleSaveResult(createEnvelope(MessageType.IMAGE_SAVE_RESULT, 'extension.imageGeneration',
      { success: true, imageId: other.id }, otherSave.correlationId)));
    expect(result.current.savedImageIds.has(other.id)).toBe(true);
    act(() => result.current.handleGenerationResponse(response(refinement.correlationId)));
    expect(result.current.isLoading).toBe(false);
  });

  it('names the saved file after the image format and refuses unknown formats', () => {
    const { result } = renderHook(() => useImageGeneration(existing));
    act(() => result.current.saveImage({ ...image, id: 'webp', mimeType: 'image/webp', data: 'data:image/webp;base64,UklG' }));
    act(() => result.current.saveImage({ ...image, id: 'gif', mimeType: 'image/gif', data: 'data:image/gif;base64,R0lG' }));
    const names = posted(MessageType.IMAGE_SAVE_REQUEST).map((m) => m.payload.suggestedFilename);
    expect(names[0]).toMatch(/\.webp$/);
    expect(names[1]).toMatch(/\.gif$/);

    act(() => result.current.saveImage({ ...image, id: 'tiff', mimeType: 'image/tiff' }));
    expect(posted(MessageType.IMAGE_SAVE_REQUEST)).toHaveLength(2);
    expect(result.current.error).toContain('image/tiff');
  });

  it('keeps persistedState referentially equal across renders while idle', () => {
    const { result, rerender } = renderHook(() => useImageGeneration(existing));
    const first = result.current.persistedState;
    rerender();
    rerender();
    expect(result.current.persistedState).toBe(first);

    act(() => result.current.setPrompt('Changed'));
    expect(result.current.persistedState).not.toBe(first);
    expect(result.current.persistedState.prompt).toBe('Changed');
  });
});
