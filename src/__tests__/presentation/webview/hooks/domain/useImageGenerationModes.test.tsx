/** @jest-environment jsdom */
/**
 * Thread-owned settings, the automatic mode for a new thread, legacy
 * migration and the bounded snapshot, through the real hook and Image tab.
 *
 * Adapted from frame-minion@40e7949 useImageGenerationModes.test.tsx (the
 * cases that don't need the mode toggle, which arrives with roadmap P4).
 */
import React from 'react';
import { act, renderHook, render, screen, fireEvent } from '@testing-library/react';
import { useImageGeneration, ImageGenerationPersistence } from '../../../../../presentation/webview/hooks/domain/useImageGeneration';
import { ImageGenerationView } from '../../../../../presentation/webview/components/views/ImageGenerationView';
import { MessageType, createEnvelope, ImageThreadSettings, ConversationTurn, GeneratedImage, MessageEnvelope } from '@messages';

const mockPost = jest.fn();
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi', () => ({ useVSCodeApi: () => ({ postMessage: mockPost }) }));
const model = 'google/gemini-3-pro-image';
const image: GeneratedImage = { id: 'image-1', data: 'data:image/png;base64,QUJD', mimeType: 'image/png', prompt: 'Blue knight', seed: 12, timestamp: 1 };
const settings: ImageThreadSettings = { mode: 'conversation', model, aspectRatio: '16:9', resolution: '4K' };
const turn: ConversationTurn = { id: 'turn-1', prompt: 'Keep the knight blue', images: [image], timestamp: 1, turnNumber: 1 };
const existing: Partial<ImageGenerationPersistence> = { model, aspectRatio: '16:9', resolution: '4K', threadSettings: settings, conversationId: 'img-existing', conversationHistory: [turn] };
const messages = (): MessageEnvelope[] => mockPost.mock.calls.map(([message]) => message);
const posted = () => messages()[messages().length - 1];
const ofType = (type: MessageType) => messages().filter(message => message.type === type);

beforeEach(() => mockPost.mockClear());

function View({ initial }: { initial: Partial<ImageGenerationPersistence> }) {
  const state = useImageGeneration(initial);
  return <ImageGenerationView imageGeneration={state} />;
}

describe('the mode a new thread gets (no toggle until P4)', () => {
  it('starts a Conversation where the model has a verified route, otherwise Single Shot', () => {
    const { result } = renderHook(() => useImageGeneration({ model, prompt: 'A knight' }));
    expect(result.current.mode).toBe('conversation');
    act(() => result.current.generate());
    expect(posted().payload).toMatchObject({ mode: 'conversation', model });

    act(() => { result.current.handleError(createEnvelope(MessageType.ERROR, 'extension.imageGeneration', { message: 'x' }, posted().correlationId)); });
    act(() => result.current.setModel('recraft/recraft-v4.1'));
    expect(result.current.mode).toBe('edit');
    act(() => result.current.generate());
    expect(posted().payload).toMatchObject({ mode: 'edit', model: 'recraft/recraft-v4.1' });
  });

  it('runs a custom id as Single Shot with automatic dimensions, keeping the id', () => {
    const { result } = renderHook(() => useImageGeneration({ model: 'vendor/unknown', aspectRatio: '16:9', resolution: '2K', prompt: 'A tree' }));
    expect(result.current.mode).toBe('edit');
    expect(result.current.aspectRatio).toBe('auto');
    expect(result.current.resolution).toBe('auto');
    act(() => result.current.generate());
    expect(posted().payload).toMatchObject({ mode: 'edit', model: 'vendor/unknown', aspectRatio: 'auto', resolution: 'auto' });
  });
});

describe('thread-owned settings', () => {
  it('continues with immutable thread settings despite changing the controls for a new generation', () => {
    const { result } = renderHook(() => useImageGeneration(existing));
    act(() => { result.current.setModel('recraft/recraft-v4.1'); result.current.setAspectRatio('auto'); result.current.setResolution('auto'); });
    act(() => result.current.continueChat('Add a tree'));
    expect(posted().payload).toMatchObject({ ...settings, prompt: 'Add a tree', conversationId: 'img-existing' });
    expect(posted().payload).not.toHaveProperty('referenceImages');
  });

  it('takes the settings the host reports and its recovery warning', () => {
    const { result } = renderHook(() => useImageGeneration({ model, prompt: 'A knight', aspectRatio: '16:9' }));
    act(() => result.current.generate());
    act(() => result.current.handleGenerationResponse(createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration', {
      conversationId: 'img-new', images: [image], turnNumber: 1, settings: { ...settings, resolution: 'auto' },
      recoveryWarning: 'The image was generated, but conversation recovery could not be saved.',
    }, posted().correlationId)));
    expect(result.current.threadSettings).toEqual({ ...settings, resolution: 'auto' });
    expect(result.current.recoveryWarning).toContain('could not be saved');
    expect(result.current.persistedState.recoveryWarning).toContain('could not be saved');
  });

  it('clears optimistic settings after a failed new thread but preserves settings after a failed continuation', () => {
    const { result } = renderHook(() => useImageGeneration({ model, prompt: 'A tree' }));
    act(() => result.current.generate());
    act(() => { result.current.handleError(createEnvelope(MessageType.ERROR, 'extension.imageGeneration', { message: 'offline' }, posted().correlationId)); });
    expect(result.current.threadSettings).toBeNull();
    expect(result.current.conversationId).toBeNull();
    const active = renderHook(() => useImageGeneration(existing));
    act(() => active.result.current.continueChat('Continue'));
    act(() => { active.result.current.handleError(createEnvelope(MessageType.ERROR, 'extension.imageGeneration', { message: 'offline' }, posted().correlationId)); });
    expect(active.result.current.threadSettings).toEqual(settings);
  });


  it('normalizes the ratio and resolution when a model change removes them', () => {
    const { result } = renderHook(() => useImageGeneration({ model: 'google/gemini-3.1-flash-image', aspectRatio: '21:9', resolution: '4K' }));
    expect(result.current.aspectRatio).toBe('21:9');
    act(() => result.current.setModel('recraft/recraft-v4.1'));
    expect(result.current.aspectRatio).toBe('1:1');
    expect(result.current.resolution).toBe('auto');
    act(() => { result.current.setModel('openai/gpt-image-2'); result.current.setAspectRatio('auto'); });
    expect(result.current.aspectRatio).toBe('auto');
  });
});

describe('Generate replacing a thread', () => {
  const answer = (correlationId: string | undefined, conversationId = 'img-new') => createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE,
    'extension.imageGeneration', { conversationId, images: [image], turnNumber: 1, settings }, correlationId);
  const failure = (correlationId: string | undefined, text = 'Provider returned 502') =>
    createEnvelope(MessageType.ERROR, 'extension.imageGeneration', { message: text }, correlationId);

  it('releases the replaced thread only once the new one succeeds', () => {
    const { result } = renderHook(() => useImageGeneration({ ...existing, prompt: 'A new knight' }));
    act(() => result.current.generate());
    expect(ofType(MessageType.IMAGE_GENERATION_CLEAR)).toHaveLength(0);

    act(() => result.current.handleGenerationResponse(answer(ofType(MessageType.IMAGE_GENERATION_REQUEST)[0].correlationId)));
    const [clear] = ofType(MessageType.IMAGE_GENERATION_CLEAR);
    expect(clear.payload).toEqual({ conversationId: 'img-existing' });
    expect(clear.correlationId).toMatch(/^image-clear-/);
    expect(result.current.conversationId).toBe('img-new');
    expect(result.current.persistedState.conversationId).toBe('img-new');
  });

  it('puts the replaced thread back, unreleased, when the new one fails', () => {
    const { result } = renderHook(() => useImageGeneration({ ...existing, prompt: 'A new knight' }));
    act(() => result.current.generate());
    expect(result.current.conversationHistory).toEqual([]);
    act(() => { result.current.handleError(failure(ofType(MessageType.IMAGE_GENERATION_REQUEST)[0].correlationId)); });

    expect(ofType(MessageType.IMAGE_GENERATION_CLEAR)).toHaveLength(0);
    expect(result.current.error).toBe('Provider returned 502');
    expect(result.current.conversationId).toBe('img-existing');
    expect(result.current.threadSettings).toEqual(settings);
    expect(result.current.conversationHistory).toEqual([turn]);
    expect(result.current.generatedImages).toEqual([image]);
    // ...and it can still be continued.
    act(() => result.current.continueChat('Add a tree'));
    expect(posted()).toMatchObject({ type: MessageType.IMAGE_GENERATION_CONTINUE, payload: { conversationId: 'img-existing' } });
  });

  it('keeps the replaced thread in the snapshot while the new one runs, so a reload brings it back', () => {
    const { result } = renderHook(() => useImageGeneration({ ...existing, prompt: 'A new knight' }));
    act(() => result.current.generate());
    const saved = result.current.persistedState;
    expect(saved).toMatchObject({ conversationId: 'img-existing', threadSettings: settings, conversationHistory: [turn] });

    const restored = renderHook(() => useImageGeneration(saved));
    expect(restored.result.current.conversationId).toBe('img-existing');
    expect(restored.result.current.conversationHistory).toEqual([turn]);
  });

  it('shows the release error after the response instead of letting the response hide it', () => {
    const { result } = renderHook(() => useImageGeneration({ ...existing, prompt: 'A new knight' }));
    act(() => result.current.generate());
    act(() => result.current.handleGenerationResponse(answer(ofType(MessageType.IMAGE_GENERATION_REQUEST)[0].correlationId)));
    const [clear] = ofType(MessageType.IMAGE_GENERATION_CLEAR);
    // The user refines the new thread before the release answers.
    act(() => result.current.continueChat('Add a tree'));
    const refine = posted();
    act(() => { result.current.handleError(failure(clear.correlationId, 'Could not delete the old transcript')); });
    expect(result.current.isLoading).toBe(true);

    act(() => result.current.handleGenerationResponse(createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration',
      { conversationId: 'img-new', images: [image], turnNumber: 2 }, refine.correlationId)));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Could not delete the old transcript');
  });

  it('shows a refused Clear after the Generate that followed it settles', () => {
    const { result } = renderHook(() => useImageGeneration(existing));
    act(() => result.current.clearConversation());
    const [clear] = ofType(MessageType.IMAGE_GENERATION_CLEAR);
    act(() => result.current.setPrompt('A new knight'));
    act(() => result.current.generate());
    const request = ofType(MessageType.IMAGE_GENERATION_REQUEST)[0];
    act(() => { result.current.handleError(failure(clear.correlationId, 'Wait for image generation to finish')); });

    act(() => { result.current.handleError(failure(request.correlationId, 'Provider returned 502')); });
    expect(result.current.error).toBe('Provider returned 502 Wait for image generation to finish');
  });
});

describe('a reload during a first Generate', () => {
  it('saves no thread until the host names one, so the reload restores none', () => {
    const { result } = renderHook(() => useImageGeneration({ model, prompt: 'A knight' }));
    act(() => result.current.generate());
    // On screen the thread's settings are shown while it runs...
    expect(result.current.threadSettings).toMatchObject({ mode: 'conversation', model });
    // ...but what App writes meanwhile holds no thread.
    const saved = result.current.persistedState;
    expect(saved.conversationId).toBeNull();
    expect(saved.threadSettings).toBeNull();

    render(<View initial={saved} />);
    expect(screen.getByText('Your images appear here')).toBeTruthy();
    expect(screen.queryByText('Uses previous messages and images as context.')).toBeNull();
  });

  it('ignores thread settings saved without a conversation id (written by an earlier build)', () => {
    const ghost = { model, prompt: 'A knight', conversationId: null, threadSettings: settings, conversationHistory: [] };
    const { result } = renderHook(() => useImageGeneration(ghost));
    expect(result.current.threadSettings).toBeNull();
    expect(result.current.persistedState.threadSettings).toBeNull();
  });

  it('saves the thread once the host answers', () => {
    const { result } = renderHook(() => useImageGeneration({ model, prompt: 'A knight' }));
    act(() => result.current.generate());
    act(() => result.current.handleGenerationResponse(createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration',
      { conversationId: 'img-new', images: [image], turnNumber: 1, settings }, posted().correlationId)));
    expect(result.current.persistedState).toMatchObject({ conversationId: 'img-new', threadSettings: settings });
  });
});

describe('migration of history saved before modes', () => {
  it('opens untagged persisted history as Single Shot', () => {
    const { result } = renderHook(() => useImageGeneration({ model, aspectRatio: '16:9', conversationId: 'img-old', conversationHistory: [turn] }));
    expect(result.current.threadSettings).toEqual({ mode: 'edit', model, aspectRatio: '16:9', resolution: 'auto' });
    act(() => result.current.continueChat('Add a tree'));
    expect(posted().payload).toMatchObject({ mode: 'edit', model, aspectRatio: '16:9', resolution: 'auto' });
  });

  it('opens P2-shaped thread settings (no mode) as Single Shot on a ratio the model lists', () => {
    // The old picker offered 3:2 to every model; Recraft V4.1 doesn't list it.
    const legacy = { model: 'recraft/recraft-v4.1', conversationId: 'img-old', conversationHistory: [turn],
      threadSettings: { model: 'recraft/recraft-v4.1', aspectRatio: '3:2' } } as unknown as Partial<ImageGenerationPersistence>;
    const { result } = renderHook(() => useImageGeneration(legacy));
    expect(result.current.threadSettings).toEqual({ mode: 'edit', model: 'recraft/recraft-v4.1', aspectRatio: '1:1', resolution: 'auto' });
  });
});

describe('bounded webview history', () => {
  it('retains a large Single Shot image across a reload and reuses the bounded history while typing', () => {
    const largeTurn = { ...turn, images: [{ ...image, data: `data:image/png;base64,${'A'.repeat(4 * 1024 * 1024)}` }] };
    const live = renderHook(() => useImageGeneration({ ...existing, threadSettings: { ...settings, mode: 'edit' }, conversationHistory: [largeTurn] }));
    const history = live.result.current.persistedState.conversationHistory;
    expect(history[0].images).toEqual(largeTurn.images);
    expect(live.result.current.persistenceWarning).toBeUndefined();
    act(() => live.result.current.setPrompt('A new prompt'));
    expect(live.result.current.persistedState.conversationHistory).toBe(history);
    expect(live.result.current.persistedState.prompt).toBe('A new prompt');
    const saved = live.result.current.persistedState;
    live.unmount();
    const restored = renderHook(() => useImageGeneration(saved));
    expect(restored.result.current.generatedImages).toEqual(largeTurn.images);
    act(() => restored.result.current.continueChat('Continue'));
    expect(restored.result.current.error).toBeNull();
    expect(posted().type).toBe(MessageType.IMAGE_GENERATION_CONTINUE);
  });

  it('explains omitted previews and blocks an image-less Single Shot follow-up locally', () => {
    const omitted: Partial<ImageGenerationPersistence> = {
      ...existing, threadSettings: { ...settings, mode: 'edit' },
      conversationHistory: [{ ...turn, images: [], imagesOmitted: true }],
      // An earlier snapshot's warning is never restored; the flagged turn is what counts.
      persistenceWarning: 'Local history keeps a limited amount of image data. Some images will not survive reload. Save images you want to keep.',
    };
    const restored = renderHook(() => useImageGeneration(omitted));
    expect(restored.result.current.persistenceWarning).toMatch(/previews from an earlier session were not kept/);
    act(() => restored.result.current.continueChat('Continue'));
    expect(restored.result.current.error).toContain('latest image was not retained');
    expect(mockPost).not.toHaveBeenCalled();
    render(<View initial={omitted} />);
    expect(screen.getByText(/Image previews were not retained/)).toBeTruthy();
    expect(screen.getByText(/previews from an earlier session were not kept/)).toBeTruthy();
    expect(screen.queryByText(/Some images will not survive reload/)).toBeNull();
  });

  it('lets a Conversation continue without previews: the host keeps the transcript', () => {
    const omitted: Partial<ImageGenerationPersistence> = { ...existing, conversationHistory: [{ ...turn, images: [], imagesOmitted: true }] };
    const { result } = renderHook(() => useImageGeneration(omitted));
    act(() => result.current.continueChat('Continue'));
    expect(posted().payload).toMatchObject({ mode: 'conversation', turnCount: 1 });
  });
});

describe('request-size warnings (from the catalog’s maxRequestBytes)', () => {
  const riverflow = 'sourceful/riverflow-v2-pro';
  const bigPng = `data:image/png;base64,${'A'.repeat(Math.ceil((5 * 1024 * 1024) / 0.75))}`;

  it('counts only the images Generate sends, never the SVG preview', () => {
    const { result } = renderHook(() => useImageGeneration({ model: riverflow, prompt: 'A poster' }));
    // A big SVG goes as text: its preview is not part of the request's images.
    act(() => result.current.addReferenceImage(`data:image/svg+xml;base64,${'A'.repeat(7 * 1024 * 1024)}`, '<svg/>'));
    act(() => result.current.addReferenceImage('data:image/png;base64,QUJD'));
    expect(result.current.referenceImageSizeWarning).toBeNull();
    act(() => result.current.addReferenceImage(bigPng));
    expect(result.current.referenceImageSizeWarning).toBe('Reference images total 5.0 MB, over Riverflow V2 Pro’s 4.5 MB request limit. Generation may fail.');
    // A model whose route states no limit gets no warning for the same images.
    act(() => result.current.setModel('google/gemini-3.1-flash-image'));
    expect(result.current.referenceImageSizeWarning).toBeNull();
  });

  it('warns beside the refine bar when a Single Shot follow-up would re-send an oversized latest image', () => {
    const big = { ...turn, images: [{ ...image, data: bigPng }] };
    const thread: Partial<ImageGenerationPersistence> = {
      model: riverflow, conversationId: 'img-river', conversationHistory: [big],
      threadSettings: { mode: 'edit', model: riverflow, aspectRatio: '1:1', resolution: 'auto' },
    };
    const { result } = renderHook(() => useImageGeneration(thread));
    expect(result.current.followUpSizeWarning).toMatch(/^The latest image is 5\.0 MB, over Riverflow V2 Pro’s 4\.5 MB request limit/);
    // Draft controls don't move it: the thread's model owns the follow-up.
    act(() => result.current.setModel('google/gemini-3.1-flash-image'));
    expect(result.current.followUpSizeWarning).not.toBeNull();
    render(<View initial={thread} />);
    expect(screen.getByText(/A follow-up sends it again, so it may fail/)).toBeTruthy();

    // A Conversation follow-up sends no images from the webview's history.
    const conversation = renderHook(() => useImageGeneration({ ...existing, conversationHistory: [big] }));
    expect(conversation.result.current.followUpSizeWarning).toBeNull();
  });
});

describe('thread description in the output card', () => {
  it('names the thread’s mode and settings, and says when the controls only apply to a new thread', () => {
    render(<View initial={existing} />);
    expect(screen.getByText('Conversation')).toBeTruthy();
    expect(screen.getByText('Uses previous messages and images as context.')).toBeTruthy();
    expect(screen.getByText(/Nano Banana Pro \(Google: Gemini 3 Pro Image\) · 16:9 · 4K/)).toBeTruthy();
    expect(screen.queryByText(/Controls above apply to a new thread/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Resolution'), { target: { value: '2K' } });
    expect(screen.getByText(/Controls above apply to a new thread/)).toBeTruthy();
    expect(screen.getByPlaceholderText('Continue the conversation...')).toBeTruthy();
  });

  it('words a Single Shot thread’s follow-up as using the latest image', () => {
    render(<View initial={{ ...existing, threadSettings: { ...settings, mode: 'edit' } }} />);
    expect(screen.getByText('Single Shot history')).toBeTruthy();
    expect(screen.getByText(/Earlier messages are not included/)).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a prompt using the latest image...')).toBeTruthy();
  });
});
