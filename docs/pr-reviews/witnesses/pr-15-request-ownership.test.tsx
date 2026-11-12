/** @jest-environment jsdom */
/** Independent PR #15 review probes. Not part of the default test roots. */
import { act, renderHook } from '@testing-library/react';
import { MessageType, createEnvelope, GeneratedImage } from '../../../src/shared/types/messages';
import { useImageGeneration } from '../../../src/presentation/webview/hooks/domain/useImageGeneration';
import { useSVGGeneration } from '../../../src/presentation/webview/hooks/domain/useSVGGeneration';
const mockPost = jest.fn();
jest.mock('../../../src/presentation/webview/hooks/useVSCodeApi', () => ({
  useVSCodeApi: () => ({ postMessage: mockPost }),
}));
const image: GeneratedImage = { id: 'image-one', data: 'data:image/png;base64,aGVsbG8=', mimeType: 'image/png', prompt: 'first', seed: 3, timestamp: 1 };
const last = (type: MessageType) => mockPost.mock.calls.map(([m]) => m).filter(m => m.type === type).slice(-1)[0];
const error = (id: string) => createEnvelope(MessageType.ERROR, 'extension.router', { message: 'The host could not handle this request', code: 'UNHANDLED_ERROR' }, id);
beforeEach(() => mockPost.mockClear());

describe('independent request-ownership checks', () => {
  it('suppresses two image Generate calls before React rerenders', () => {
    const { result } = renderHook(() => useImageGeneration({prompt: 'first'}));
    act(() => { result.current.generate(); result.current.generate(); });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true);
  });
  it('suppresses two SVG Generate calls before React rerenders', () => {
    const { result } = renderHook(() => useSVGGeneration({prompt: 'first'}));
    act(() => { result.current.generate(); result.current.generate(); });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true);
  });
  it('keeps simultaneous image and SVG requests independent', () => {
    const { result } = renderHook(() => ({image: useImageGeneration({prompt: 'first'}), svg: useSVGGeneration({prompt: 'first'})}));
    act(() => { result.current.image.generate(); result.current.svg.generate(); });
    const id = last(MessageType.IMAGE_GENERATION_REQUEST).correlationId;
    act(() => { result.current.image.handleError(error(id)); result.current.svg.handleError(error(id)); });
    expect(result.current.image.isLoading).toBe(false);
    expect(result.current.svg.isLoading).toBe(true);
  });
  it('rejects an old image answer after failure and a new dispatch', () => {
    const { result } = renderHook(() => useImageGeneration({prompt: 'first'}));
    act(() => result.current.generate());
    const old = last(MessageType.IMAGE_GENERATION_REQUEST);
    act(() => { result.current.handleError(error(old.correlationId)); result.current.generate(); });
    act(() => result.current.handleGenerationResponse(createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration', { conversationId:'old', images:[image], turnNumber:1 }, old.correlationId)));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.conversationId).toBeNull();
  });
  it('keeps the completed SVG turn when its refinement fails', () => {
    const { result } = renderHook(() => useSVGGeneration({prompt:'first', conversationId:'room', svgCode:'<svg></svg>', threadSettings:{model:'anthropic/claude-opus-5.5',aspectRatio:'1:1'},conversationHistory:[{prompt:'first',svgCode:'<svg></svg>',turnNumber:1}]}));
    act(() => result.current.continueChat('second'));
    act(() => result.current.handleError(error(last(MessageType.SVG_GENERATION_CONTINUE).correlationId)));
    expect(result.current.conversationHistory).toHaveLength(1);
    expect(result.current.svgCode).toBe('<svg></svg>');
    expect(result.current.conversationId).toBe('room');
    expect(result.current.isLoading).toBe(false);
  });
  it('keeps the completed image turn when its refinement fails', () => {
    const { result } = renderHook(() => useImageGeneration({prompt:'first', conversationId:'room', generatedImages:[image],threadSettings:{model:'google/gemini-3.1-flash-image',aspectRatio:'1:1'},conversationHistory:[{id:'turn-1',prompt:'first',images:[image],turnNumber:1,timestamp:1}]}));
    act(() => result.current.continueChat('second'));
    act(() => result.current.handleError(error(last(MessageType.IMAGE_GENERATION_CONTINUE).correlationId)));
    expect(result.current.conversationHistory).toHaveLength(1);
    expect(result.current.generatedImages).toEqual([image]);
    expect(result.current.conversationId).toBe('room');
    expect(result.current.isLoading).toBe(false);
  });
  it('does not let a pending image save settle a generation', () => {
    const { result } = renderHook(() => useImageGeneration({prompt:'first'}));
    act(() => {result.current.saveImage(image);result.current.generate();});
    act(() => result.current.handleSaveResult(createEnvelope(MessageType.IMAGE_SAVE_RESULT,'extension.imageGeneration',{success:true,imageId:image.id},last(MessageType.IMAGE_SAVE_REQUEST).correlationId)));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.savedImageIds.has(image.id)).toBe(true);
  });
  it('does not let an old SVG save mark different generated code saved', () => {
    const { result } = renderHook(() => useSVGGeneration({prompt:'first',svgCode:'<svg>old</svg>'}));
    act(() => {result.current.saveSVG();result.current.generate();});
    const save = last(MessageType.SVG_SAVE_REQUEST);
    act(() => result.current.handleGenerationResponse(createEnvelope(MessageType.SVG_GENERATION_RESPONSE,'extension.svgGeneration',{conversationId:'new',svgCode:'<svg>new</svg>',turnNumber:1},last(MessageType.SVG_GENERATION_REQUEST).correlationId)));
    act(() => result.current.handleSaveResult(createEnvelope(MessageType.SVG_SAVE_RESULT,'extension.svgGeneration',{success:true},save.correlationId)));
    expect(result.current.isSaved).toBe(false);
    expect(result.current.isSaving).toBe(false);
  });
});

describe('nonblocking generic save-error contract gap (expected to fail until fixed)', () => {
  it('settles an image save answered by the router fallback ERROR', () => {
    const {result} = renderHook(() => useImageGeneration());
    act(() => result.current.saveImage(image));
    let claimed = false;
    act(() => {claimed = result.current.handleError(error(last(MessageType.IMAGE_SAVE_REQUEST).correlationId));});
    expect(claimed).toBe(true);
    expect(result.current.savingImageIds.has(image.id)).toBe(false);
  });
  it('settles an SVG save answered by the router fallback ERROR', () => {
    const {result} = renderHook(() => useSVGGeneration({svgCode:'<svg></svg>'}));
    act(() => result.current.saveSVG());
    let claimed = false;
    act(() => {claimed = result.current.handleError(error(last(MessageType.SVG_SAVE_REQUEST).correlationId));});
    expect(claimed).toBe(true);
    expect(result.current.isSaving).toBe(false);
  });
});
