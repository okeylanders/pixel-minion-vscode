/** @jest-environment jsdom */
/**
 * Modes, thread-owned settings, Earlier threads, start-from-image, custom
 * ids, legacy migration and the bounded snapshot, through the real hook and
 * Image tab.
 *
 * Ported from frame-minion@40e7949 useImageGenerationModes.test.tsx. Pixel
 * deltas: Muse cases use a custom id or a Single-Shot-only model (Muse has no
 * route), no desktop budget, and archiving also releases the thread on the
 * host (one IMAGE_GENERATION_CLEAR), which Frame does only on Delete.
 */
import React from 'react';
import { act, renderHook, render, screen, fireEvent, within } from '@testing-library/react';
import { useImageGeneration, ImageGenerationPersistence } from '../../../../../presentation/webview/hooks/domain/useImageGeneration';
import { ImageGenerationView } from '../../../../../presentation/webview/components/views/ImageGenerationView';
import { MessageType, createEnvelope, ImageThreadSettings, ConversationTurn, GeneratedImage, MessageEnvelope } from '@messages';
import { OPENROUTER_IMAGE_MODELS, imageRouteCapabilities } from '../../../../../shared/models';
import { __resetOverlayStateForTests } from '../../../../../presentation/webview/hooks/useOverlayDismiss';

const mockPost = jest.fn();
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi', () => ({ useVSCodeApi: () => ({ postMessage: mockPost }) }));
const model = 'google/gemini-3-pro-image';
const image: GeneratedImage = { id: 'image-1', data: 'data:image/png;base64,QUJD', mimeType: 'image/png', prompt: 'Blue knight', seed: 12, timestamp: 1 };
const settings: ImageThreadSettings = { mode: 'conversation', model, aspectRatio: '16:9', resolution: '4K' };
const turn: ConversationTurn = { id: 'turn-1', prompt: 'Keep the knight blue', images: [image], timestamp: 1, turnNumber: 1 };
const existing: Partial<ImageGenerationPersistence> = { ...settings, threadSettings: settings, conversationId: 'img-existing', conversationHistory: [turn] };
const messages = (): MessageEnvelope<any>[] => mockPost.mock.calls.map(([message]) => message); // eslint-disable-line @typescript-eslint/no-explicit-any
const posted = () => messages()[messages().length - 1];
const ofType = (type: MessageType) => messages().filter(message => message.type === type);
const fail = (correlationId: string | undefined) =>
  createEnvelope(MessageType.ERROR, 'extension.imageGeneration', { message: 'offline' }, correlationId);

beforeEach(() => mockPost.mockClear());
afterEach(() => __resetOverlayStateForTests());

function View({ initial }: { initial: Partial<ImageGenerationPersistence> }) {
  const state = useImageGeneration(initial);
  return <ImageGenerationView imageGeneration={state} />;
}

describe('modes and Earlier threads', () => {
  it('preserves earlier threads and their mode when switching, including after webview reload', () => {
    const hook = renderHook(() => useImageGeneration(existing));
    act(() => hook.result.current.setMode('edit'));
    expect(hook.result.current.conversationId).toBeNull();
    expect(hook.result.current.archivedThreads).toEqual([{ id: 'img-existing', settings, turns: [turn] }]);
    // Earlier threads don't continue, so the host lets go of it (Pixel delta).
    expect(messages()).toEqual([expect.objectContaining({ type: MessageType.IMAGE_GENERATION_CLEAR, payload: { conversationId: 'img-existing' } })]);
    const saved = hook.result.current.persistedState;
    hook.unmount();
    const restored = renderHook(() => useImageGeneration(saved));
    expect(restored.result.current.mode).toBe('edit');
    expect(restored.result.current.archivedThreads[0].settings.mode).toBe('conversation');
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('keeps the current thread under Earlier threads when Generate starts a new one, and deletes one on request', () => {
    const { result } = renderHook(() => useImageGeneration({ ...existing, prompt: 'A new knight' }));
    act(() => result.current.generate());
    // Shown under Earlier threads while the new one runs, but not released yet.
    expect(result.current.archivedThreads.map(thread => thread.id)).toEqual(['img-existing']);
    expect(ofType(MessageType.IMAGE_GENERATION_CLEAR)).toHaveLength(0);
    // Deleting it is refused while it still belongs to the running Generate:
    // a failure must bring it back with its host transcript intact.
    act(() => result.current.removeArchivedThread('img-existing'));
    expect(result.current.archivedThreads.map(thread => thread.id)).toEqual(['img-existing']);
    expect(ofType(MessageType.IMAGE_GENERATION_CLEAR)).toHaveLength(0);
    act(() => result.current.handleGenerationResponse(createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration',
      { conversationId: 'img-new', images: [image], turnNumber: 1, settings }, ofType(MessageType.IMAGE_GENERATION_REQUEST)[0].correlationId)));
    expect(result.current.archivedThreads.map(thread => thread.id)).toEqual(['img-existing']);
    expect(ofType(MessageType.IMAGE_GENERATION_CLEAR)[0].payload).toEqual({ conversationId: 'img-existing' });

    mockPost.mockClear();
    act(() => result.current.removeArchivedThread('img-existing'));
    expect(result.current.archivedThreads).toEqual([]);
    expect(posted()).toMatchObject({ type: MessageType.IMAGE_GENERATION_CLEAR, payload: { conversationId: 'img-existing' } });
    expect(posted().correlationId).toMatch(/^image-clear-/);
  });

  it('captures prompt/context once, refuses a mode switch or a new start while generating, and ignores stale responses and errors', () => {
    // A preview distinct from the image a "start from" would attach, so an
    // ignored call and an obeyed one can't look the same (review P4-m4).
    const svgPreview = 'data:image/svg+xml;base64,PHN2ZyAvPg==';
    const { result } = renderHook(() => useImageGeneration({ ...existing, prompt: 'A knight' }));
    act(() => result.current.addReferenceImage(svgPreview, '<svg />'));
    act(() => result.current.generate());
    const request = posted();
    expect(request.payload).toMatchObject({ mode: 'conversation', prompt: 'A knight', referenceSvgText: '<svg />' });
    expect(request.payload.referenceImages).toBeUndefined();
    const during = () => ({
      mode: result.current.mode, prompt: result.current.prompt, referenceImages: result.current.referenceImages,
      threadSettings: result.current.threadSettings, archived: result.current.archivedThreads.map(thread => thread.id),
    });
    const before = during();
    expect(before).toEqual({ mode: 'conversation', prompt: 'A knight', referenceImages: [svgPreview], threadSettings: settings, archived: ['img-existing'] });

    act(() => result.current.setMode('edit'));
    act(() => result.current.startFromImage(image));
    expect(during()).toEqual(before);
    expect(ofType(MessageType.IMAGE_GENERATION_CLEAR)).toHaveLength(0);

    act(() => { result.current.handleError(createEnvelope(MessageType.ERROR, 'extension.imageGeneration', { message: 'stale' })); });
    expect(result.current.isLoading).toBe(true);
    act(() => result.current.handleGenerationResponse(createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration', { conversationId: 'img-new', images: [image], turnNumber: 1 }, request.correlationId)));
    expect(result.current.conversationHistory[0].prompt).toBe('A knight');
    expect(result.current.conversationHistory[0].referenceSvgText).toBe('<svg />');
    expect(result.current.isLoading).toBe(false);
  });

  it('refuses a mode switch or a new start while an enhance runs, keeping the thread on screen', () => {
    const { result } = renderHook(() => useImageGeneration({ ...existing, prompt: 'A knight' }));
    act(() => result.current.enhancePrompt());
    expect(result.current.isEnhancing).toBe(true);
    act(() => result.current.setMode('edit'));
    act(() => result.current.startFromImage(image));
    expect(result.current.mode).toBe('conversation');
    expect(result.current.conversationId).toBe('img-existing');
    expect(result.current.threadSettings).toEqual(settings);
    expect(result.current.archivedThreads).toEqual([]);
    expect(result.current.referenceImages).toEqual([]);
    expect(result.current.prompt).toBe('A knight');
    expect(ofType(MessageType.IMAGE_GENERATION_CLEAR)).toHaveLength(0);
  });

  it('migrates untagged persisted history to Single Shot and can start a fresh conversation from an existing image', () => {
    const { result } = renderHook(() => useImageGeneration({ model, conversationId: 'img-old', conversationHistory: [turn] }));
    expect(result.current.mode).toBe('edit');
    expect(result.current.threadSettings?.mode).toBe('edit');
    act(() => result.current.setMode('conversation'));
    act(() => result.current.startFromImage(image));
    expect(result.current.referenceImages).toEqual([image.data]);
    expect(result.current.archivedThreads[0].settings.mode).toBe('edit');
    expect(result.current.conversationHistory).toEqual([]);
    expect(result.current.mode).toBe('conversation');
  });

  it('keeps no recovery note on an Earlier thread, but brings it back with a thread a failed Generate restores', () => {
    const note = 'The image was generated, but its transcript could not be saved for restart recovery.';
    const switched = renderHook(() => useImageGeneration({ ...existing, recoveryWarning: note }));
    act(() => switched.result.current.setMode('edit'));
    expect(switched.result.current.archivedThreads[0]).toEqual({ id: 'img-existing', settings, turns: [turn] });
    expect(switched.result.current.persistedState.archivedThreads?.[0]).not.toHaveProperty('recoveryWarning');
    expect(switched.result.current.recoveryWarning).toBeUndefined();

    const failed = renderHook(() => useImageGeneration({ ...existing, recoveryWarning: note, prompt: 'A new knight' }));
    act(() => failed.result.current.generate());
    expect(failed.result.current.archivedThreads[0]).not.toHaveProperty('recoveryWarning');
    act(() => { failed.result.current.handleError(fail(ofType(MessageType.IMAGE_GENERATION_REQUEST).pop()!.correlationId)); });
    expect(failed.result.current.recoveryWarning).toBe(note);
  });

  it('starts a new installation in Conversation when the model has a route, otherwise Single Shot', () => {
    expect(renderHook(() => useImageGeneration({ model })).result.current.mode).toBe('conversation');
    expect(renderHook(() => useImageGeneration({ model: 'recraft/recraft-v4.1' })).result.current.mode).toBe('edit');
    // A tagged thread from before the toggle keeps its mode.
    expect(renderHook(() => useImageGeneration({ ...existing, mode: undefined })).result.current.mode).toBe('conversation');
  });

  it('follows the configured default model until the user chooses a mode, and saves the mode only once chosen', () => {
    type Props = { selected: string; initial?: Partial<ImageGenerationPersistence> };
    const render = (props: Props) => renderHook(({ selected, initial }: Props) =>
      useImageGeneration(initial, { selectedModel: selected }), { initialProps: props });
    // Mounted on useSettings' placeholder; the configured default arrives next.
    const hook = render({ selected: 'google/gemini-3.1-flash-image' });
    expect(hook.result.current.mode).toBe('conversation');
    hook.rerender({ selected: 'recraft/recraft-v4.1' });
    expect(hook.result.current.mode).toBe('edit');
    act(() => hook.result.current.setPrompt('A poster'));
    act(() => hook.result.current.generate());
    expect(hook.result.current.error).toBeNull();
    expect(posted().payload).toMatchObject({ mode: 'edit', model: 'recraft/recraft-v4.1' });

    // Saved before a choice: no mode, so a reload keeps following the settings.
    const fresh = render({ selected: 'google/gemini-3.1-flash-image' });
    expect(fresh.result.current.persistedState.mode).toBeUndefined();
    const reloaded = render({ selected: 'recraft/recraft-v4.1', initial: fresh.result.current.persistedState });
    expect(reloaded.result.current.mode).toBe('edit');
    // Chosen: saved, and a later default change leaves it alone.
    act(() => reloaded.result.current.setMode('conversation'));
    expect(reloaded.result.current.persistedState.mode).toBe('conversation');
    reloaded.rerender({ selected: 'recraft/recraft-v4.1-flash', initial: fresh.result.current.persistedState });
    expect(reloaded.result.current.mode).toBe('conversation');
  });

  it('keeps the mode a model was picked in, even when the pick comes back as the settings default', () => {
    const onModelChange = jest.fn();
    const hook = renderHook(({ selected }: { selected: string }) => useImageGeneration(undefined, { selectedModel: selected, onModelChange }),
      { initialProps: { selected: 'recraft/recraft-v4.1' } });
    expect(hook.result.current.mode).toBe('edit');
    // Gemini picked from the Single Shot list; Settings echo it back.
    act(() => hook.result.current.setModel('google/gemini-3.1-flash-image'));
    hook.rerender({ selected: 'google/gemini-3.1-flash-image' });
    expect(onModelChange).toHaveBeenCalledWith('google/gemini-3.1-flash-image');
    expect(hook.result.current.mode).toBe('edit');
    expect(hook.result.current.persistedState.mode).toBe('edit');
  });

  it('keeps a restored thread’s mode when the settings arrive', () => {
    const hook = renderHook(({ selected }: { selected: string }) => useImageGeneration({ ...existing, mode: undefined }, { selectedModel: selected }),
      { initialProps: { selected: model } });
    hook.rerender({ selected: 'recraft/recraft-v4.1' });
    expect(hook.result.current.mode).toBe('conversation');
  });

  it('keeps the model on a mode switch, normalizing only what the new route drops', () => {
    const { result } = renderHook(() => useImageGeneration({ model: 'google/gemini-3.1-flash-image', mode: 'edit', resolution: '512' }));
    act(() => result.current.setMode('conversation'));
    expect(result.current.model).toBe('google/gemini-3.1-flash-image');
    expect(result.current.resolution).toBe('auto');
  });
});

describe('thread-owned settings', () => {
  it('continues with immutable thread settings despite changing the controls for a new generation', () => {
    const { result } = renderHook(() => useImageGeneration(existing));
    act(() => { result.current.setModel('openai/gpt-5-image'); result.current.setAspectRatio('3:2'); result.current.setResolution('auto'); });
    act(() => result.current.continueChat('Add a tree'));
    expect(posted().payload).toMatchObject({ ...settings, prompt: 'Add a tree', conversationId: 'img-existing' });
    expect(posted().payload).not.toHaveProperty('referenceImages');
  });

  it('clears optimistic settings after a failed new thread but preserves settings after a failed continuation', () => {
    const { result } = renderHook(() => useImageGeneration({ model, prompt: 'A tree' }));
    act(() => result.current.generate());
    act(() => { result.current.handleError(fail(posted().correlationId)); });
    expect(result.current.threadSettings).toBeNull();
    expect(result.current.conversationId).toBeNull();
    const active = renderHook(() => useImageGeneration(existing));
    act(() => active.result.current.continueChat('Continue'));
    act(() => { active.result.current.handleError(fail(posted().correlationId)); });
    expect(active.result.current.threadSettings).toEqual(settings);
  });

  it('takes the settings the host reports and its recovery warning', () => {
    const { result } = renderHook(() => useImageGeneration({ model, prompt: 'A knight', aspectRatio: '16:9' }));
    act(() => result.current.generate());
    act(() => result.current.handleGenerationResponse(createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration', {
      conversationId: 'img-new', images: [image], turnNumber: 1, settings: { ...settings, resolution: 'auto' },
      recoveryWarning: 'The image was generated, but conversation recovery could not be saved.',
    }, posted().correlationId)));
    expect(result.current.threadSettings).toEqual({ ...settings, resolution: 'auto' });
    expect(result.current.persistedState.recoveryWarning).toContain('could not be saved');
  });

  it('normalizes the ratio and resolution when a model change removes them', () => {
    // Single Shot: every catalog model has a route there, so each change normalizes.
    const { result } = renderHook(() => useImageGeneration({ model: 'google/gemini-3.1-flash-image', mode: 'edit', aspectRatio: '21:9', resolution: '4K' }));
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
    // ...and it stays under Earlier threads for good.
    expect(result.current.archivedThreads.map(thread => thread.id)).toEqual(['img-existing']);
    expect(result.current.persistedState.archivedThreads?.map(thread => thread.id)).toEqual(['img-existing']);
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
    // It is the current thread again, not an Earlier thread...
    expect(result.current.archivedThreads).toEqual([]);
    expect(result.current.persistedState.archivedThreads).toEqual([]);
    // ...and it can still be continued.
    act(() => result.current.continueChat('Add a tree'));
    expect(posted()).toMatchObject({ type: MessageType.IMAGE_GENERATION_CONTINUE, payload: { conversationId: 'img-existing' } });
  });

  it('keeps the replaced thread in the snapshot while the new one runs, so a reload brings it back', () => {
    const { result } = renderHook(() => useImageGeneration({ ...existing, prompt: 'A new knight' }));
    act(() => result.current.generate());
    const saved = result.current.persistedState;
    expect(saved).toMatchObject({ conversationId: 'img-existing', threadSettings: settings, conversationHistory: [turn] });
    // Not saved as an Earlier thread too: it isn't one until the new thread exists.
    expect(saved.archivedThreads).toEqual([]);

    const restored = renderHook(() => useImageGeneration(saved));
    expect(restored.result.current.conversationId).toBe('img-existing');
    expect(restored.result.current.conversationHistory).toEqual([turn]);
    expect(restored.result.current.archivedThreads).toEqual([]);
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
    // The mode's description stays (it describes the next thread); a thread's own settings line doesn't.
    expect(document.querySelector('.image-thread-settings')).toBeNull();
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
    const legacy = { model: 'recraft/recraft-v4.1', conversationId: 'img-old', conversationHistory: [turn],
      threadSettings: { model: 'recraft/recraft-v4.1', aspectRatio: '3:2' } } as unknown as Partial<ImageGenerationPersistence>;
    const { result } = renderHook(() => useImageGeneration(legacy));
    expect(result.current.threadSettings).toEqual({ mode: 'edit', model: 'recraft/recraft-v4.1', aspectRatio: '1:1', resolution: 'auto' });
    expect(result.current.mode).toBe('edit');
  });
});

describe('the Image tab', () => {
  it('renders an accessible mode control and keeps the archived thread’s own description', () => {
    render(<View initial={existing} />);
    const group = screen.getByRole('group', { name: 'Image generation mode' });
    const edit = within(group).getByRole('button', { name: 'Single Shot' });
    expect(within(group).getByRole('button', { name: 'Conversation' }).getAttribute('aria-pressed')).toBe('true');
    expect(edit.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(edit);
    expect(edit.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Earlier thread\. To make changes/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Conversation' })).toBeTruthy();
    expect(screen.getByText('Keep the knight blue', { selector: '.conversation-header-title' })).toBeTruthy();
    expect(screen.getByText(/Uses previous messages and images as context/)).toBeTruthy();
    expect(screen.queryByPlaceholderText('Continue the conversation...')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete thread' })).toBeTruthy();
  });

  it('disables mode switching while a request runs', () => {
    render(<View initial={{ ...existing, prompt: 'A knight' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Start Conversation/ }));
    expect((screen.getByRole('group', { name: 'Image generation mode' }) as HTMLFieldSetElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Single Shot' }) as HTMLButtonElement).matches(':disabled')).toBe(true);
  });

  it('switches mode only on activation, never when arrow keys move focus (review P4-m3)', () => {
    render(<View initial={existing} />);
    const group = screen.getByRole('group', { name: 'Image generation mode' });
    // Toggle buttons, not radios: browsers move a radio group's selection with
    // the arrow keys, which here would archive the thread. Native buttons are
    // activated (a click) only by a pointer, Enter or Space, and each is its
    // own Tab stop.
    expect(within(group).queryAllByRole('radio')).toHaveLength(0);
    const buttons = within(group).getAllByRole('button') as HTMLButtonElement[];
    expect(buttons.map(button => [button.tagName, button.type, button.tabIndex])).toEqual([['BUTTON', 'button', 0], ['BUTTON', 'button', 0]]);
    for (const button of buttons) {
      button.focus();
      for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']) {
        fireEvent.keyDown(button, { key });
        fireEvent.keyUp(button, { key });
      }
    }
    expect(buttons.map(button => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(screen.queryByText('Earlier threads')).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
    // Activating the pressed one changes nothing either.
    fireEvent.click(buttons[0]);
    expect(mockPost).not.toHaveBeenCalled();
    // Activating the other switches, keeping the thread under Earlier threads.
    fireEvent.click(buttons[1]);
    expect(buttons.map(button => button.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(screen.getByText(/Earlier thread\. To make changes/)).toBeTruthy();
  });

  it('moves focus to the prompt after starting from an image (the pressed button is gone)', () => {
    render(<View initial={existing} />);
    const start = screen.getByRole('button', { name: 'Start a conversation from this image' });
    start.focus();
    fireEvent.click(start);
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Describe the image you want to generate...'));
  });

  it('deletes the visible archive and focuses the next result, then the prompt when empty', () => {
    const thread = (id: string, prompt: string) => ({ id, settings, turns: [{ ...turn, id: `turn-${id}`, prompt }] });
    render(<View initial={{ model, archivedThreads: [thread('img-1', 'First'), thread('img-2', 'Second'), thread('img-3', 'Third')] }} />);
    const results = screen.getByRole('region', { name: 'Image results' });
    expect(within(results).getByText('Third', { selector: '.conversation-header-title' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous thread' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete thread' }));
    // Second was selected; its newer neighbor is Third.
    expect(within(results).getByText('Third', { selector: '.conversation-header-title' })).toBeTruthy();
    expect(document.activeElement).toBe(within(results).getByRole('heading'));
    expect(posted().payload).toEqual({ conversationId: 'img-2' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete thread' }));
    expect(within(results).getByText('First', { selector: '.conversation-header-title' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete thread' }));
    expect(screen.queryByRole('navigation', { name: 'Result threads' })).toBeNull();
    expect(screen.getByText('Your images appear here')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Describe the image you want to generate...'));
  });

  it('switches harmlessly when no thread is on screen: nothing archived, nothing released', () => {
    render(<View initial={{ model }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Single Shot' }));
    expect(screen.getByRole('button', { name: 'Single Shot' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Earlier threads')).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('lists only the models the selected mode supports', () => {
    render(<View initial={{ model, mode: 'conversation' }} />);
    const conversational = OPENROUTER_IMAGE_MODELS.filter(entry => imageRouteCapabilities(entry.id, 'conversation'));
    fireEvent.click(screen.getByRole('button', { name: /Current model:/ }));
    const browser = screen.getByRole('dialog', { name: /browser/ });
    expect(conversational).toHaveLength(10);
    expect(browser.querySelectorAll('.model-browser-card')).toHaveLength(conversational.length);
    expect(within(browser).queryByRole('button', { name: 'Recraft V4.1' })).toBeNull();
    expect(within(browser).getByRole('button', { name: 'GPT-5 Image' })).toBeTruthy();
    fireEvent.click(within(browser).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Single Shot' }));
    fireEvent.click(screen.getByRole('button', { name: /Current model:/ }));
    const singleShot = screen.getByRole('dialog', { name: /browser/ });
    expect(within(singleShot).getByRole('button', { name: 'Recraft V4.1' })).toBeTruthy();
    expect(singleShot.querySelectorAll('.model-browser-card')).toHaveLength(OPENROUTER_IMAGE_MODELS.length);
  });

  it('keeps a curated model the mode doesn’t support visible by name and blocks it without replacing the choice', () => {
    render(<View initial={{ model: 'recraft/recraft-v4.1', mode: 'conversation', prompt: 'A knight' }} />);
    expect(screen.getByRole('button', { name: /Current model: Recraft V4\.1$/ })).toBeTruthy();
    expect(screen.getByText(/no verified Conversation route/)).toBeTruthy();
    expect(screen.getAllByRole('status').map(node => node.textContent)).toContain('The selected model is unavailable in Conversation. Choose a supported model above.');
    expect((screen.getByRole('button', { name: /Start Conversation/ }) as HTMLButtonElement).disabled).toBe(true);
    // No seed/ratio/resolution for a route that doesn't exist.
    expect(screen.queryByLabelText('Seed')).toBeNull();
  });

  it('shows only chat-supported resolution tiers and mode-specific endpoint and follow-up wording', () => {
    const { unmount } = render(<View initial={{ ...existing, model: 'google/gemini-3.1-flash-image' }} />);
    const resolutions = screen.getByLabelText('Resolution') as HTMLSelectElement;
    expect(Array.from(resolutions.options).map(option => option.value)).toEqual(['auto', '1K', '2K', '4K']);
    expect(screen.getByText(/Conversation uses OpenRouter’s \/chat\/completions endpoint/)).toBeTruthy();
    expect(screen.getByText(/Longer conversations may cost more/)).toBeTruthy();
    expect(screen.getByPlaceholderText('Continue the conversation...')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
    unmount();
    render(<View initial={{ ...existing, mode: 'edit', threadSettings: { ...settings, mode: 'edit' } }} />);
    expect(screen.getByRole('button', { name: '⚡ Generate' })).toBeTruthy();
    expect(screen.getByText('Single Shot history')).toBeTruthy();
    expect(screen.getByText(/Single Shot uses OpenRouter’s \/images endpoint instead of \/chat\/completions/)).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a prompt using the latest image...')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
  });

  it('offers start-from-image on every image, but not while busy or for a model that takes no reference', () => {
    const { unmount } = render(<View initial={existing} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start a conversation from this image' }));
    expect(screen.getByText(/Earlier thread\. To make changes/)).toBeTruthy();
    expect(screen.getAllByAltText('Reference 1').length).toBe(1);
    expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({ type: MessageType.IMAGE_GENERATION_CLEAR }));
    unmount();
    render(<View initial={{ ...existing, mode: 'edit', model: 'recraft/recraft-v4.1-flash' }} />);
    expect(screen.queryByRole('button', { name: /from this image/ })).toBeNull();
  });

  it('offers start-from-image only when the draft model has a route in the mode that takes the image (review P4-n5)', () => {
    const offered = () => screen.queryAllByRole('button', { name: /from this image/ }).length;
    // Recraft V4.1 has no Conversation route: starting a conversation from an image would only be blocked.
    const { unmount } = render(<View initial={{ ...existing, mode: 'conversation', model: 'recraft/recraft-v4.1' }} />);
    expect(offered()).toBe(0);
    unmount();
    // A route whose references must be PNG, JPEG or WebP: offered on a PNG, not on a GIF.
    const gif = { ...image, id: 'image-gif', mimeType: 'image/gif', data: 'data:image/gif;base64,R0lG', prompt: 'Animated knight' };
    const both = { ...existing, mode: 'edit' as const, model: 'recraft/recraft-v4-styles', conversationHistory: [{ ...turn, images: [image, gif] }] };
    const second = render(<View initial={both} />);
    const card = (alt: string) => screen.getByAltText(alt).closest('.image-card') as HTMLElement;
    expect(within(card(image.prompt)).queryAllByRole('button', { name: /from this image/ })).toHaveLength(1);
    expect(within(card(gif.prompt)).queryAllByRole('button', { name: /from this image/ })).toHaveLength(0);
    second.unmount();
    // The same thread with a model that takes any image format: both.
    render(<View initial={{ ...both, model: 'google/gemini-3.1-flash-image' }} />);
    expect(offered()).toBe(2);
  });

  it('keeps custom ids visible and usable in Single Shot while Conversation stays strict', () => {
    const { unmount } = render(<View initial={{ mode: 'edit', model: 'vendor/unknown', prompt: 'A tree' }} />);
    expect(screen.getByRole('button', { name: /Current model: Custom: vendor\/unknown/ })).toBeTruthy();
    expect(screen.getByText(/runs as Single Shot with the options shown above/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /⚡ Generate/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /⚡ Generate/ }));
    expect(posted().payload).toMatchObject({ mode: 'edit', model: 'vendor/unknown', aspectRatio: 'auto' });
    unmount();
    render(<View initial={{ mode: 'conversation', model: 'vendor/unknown', prompt: 'A tree' }} />);
    expect(screen.getByRole('button', { name: /Current model: Custom: vendor\/unknown/ })).toBeTruthy();
    expect(screen.getByText(/A custom model id runs in Single Shot only/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Start Conversation/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('names the thread’s settings and says when the controls only apply to a new thread', () => {
    render(<View initial={existing} />);
    expect(screen.getByText(/Nano Banana Pro \(Google: Gemini 3 Pro Image\) · 16:9 · 4K/)).toBeTruthy();
    expect(screen.queryByText(/Controls above apply to a new thread/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Resolution'), { target: { value: '2K' } });
    expect(screen.getByText(/Controls above apply to a new thread/)).toBeTruthy();
  });
});

describe('results-pane thread navigation', () => {
  const oldImage = { ...image, id: 'image-old', prompt: 'Old landscape' };
  const oldSettings: ImageThreadSettings = { mode: 'edit', model: 'recraft/recraft-v4.1', aspectRatio: '1:1', resolution: 'auto' };
  const archive = { id: 'img-old', settings: oldSettings, turns: [{ ...turn, id: 'turn-old', prompt: 'Old landscape', images: [oldImage] }] };

  it('browses one thread at a time with its own settings, without changing or dispatching the current thread', () => {
    render(<View initial={{ ...existing, archivedThreads: [archive] }} />);
    const results = screen.getByRole('region', { name: 'Image results' });
    const previous = screen.getByRole('button', { name: 'Previous thread' }) as HTMLButtonElement;
    const next = screen.getByRole('button', { name: 'Next thread' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(within(results).queryByAltText(oldImage.prompt)).toBeNull();
    expect(screen.getByText('Thread 2 of 2, current thread')).toBeTruthy();

    const draft = screen.getByRole('textbox', { name: 'Continue the conversation...' });
    fireEvent.change(draft, { target: { value: 'Keep my unsent refinement' } });
    fireEvent.click(previous);
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expect(screen.getByText('Thread 1 of 2, earlier thread')).toBeTruthy();
    expect(within(results).getByAltText(oldImage.prompt)).toBeTruthy();
    expect(within(results).queryByAltText(image.prompt)).toBeNull();
    expect(within(results).getByText(/Recraft V4.1 · 1:1 · Default resolution/)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Continue the conversation...' })).toBeNull();
    // Even a stale event on the hidden composer must not submit to the current thread.
    fireEvent.keyDown(draft, { key: 'Enter' });
    expect(mockPost).not.toHaveBeenCalled();

    fireEvent.click(next);
    expect((screen.getByRole('textbox', { name: 'Continue the conversation...' }) as HTMLInputElement).value).toBe('Keep my unsent refinement');
    expect(within(results).getByAltText(image.prompt)).toBeTruthy();
    expect(within(results).queryByAltText(oldImage.prompt)).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(posted()).toMatchObject({ type: MessageType.IMAGE_GENERATION_CONTINUE, payload: { conversationId: 'img-existing', prompt: 'Keep my unsent refinement' } });
  });

  it('saves the browsed image and deletes only its archive, returning focus to the current result', () => {
    render(<View initial={{ ...existing, archivedThreads: [archive] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous thread' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to workspace' }));
    expect(posted()).toMatchObject({ type: MessageType.IMAGE_SAVE_REQUEST, payload: { imageId: oldImage.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete thread' }));
    expect(posted()).toMatchObject({ type: MessageType.IMAGE_GENERATION_CLEAR, payload: { conversationId: 'img-old' } });
    expect(screen.getByText('Thread 1 of 1, current thread')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Continue the conversation...' })).toBeTruthy();
    expect(document.activeElement).toBe(within(screen.getByRole('region', { name: 'Image results' })).getByRole('heading'));
  });

  it('shows the pending generation instead of an archive, locks navigation, and restores the live thread on failure', () => {
    let state: ReturnType<typeof useImageGeneration>;
    function Harness() {
      state = useImageGeneration({ ...existing, prompt: 'New result', archivedThreads: [archive] });
      return <ImageGenerationView imageGeneration={state} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous thread' }));
    fireEvent.click(screen.getByRole('button', { name: '⚡ Start Conversation' }));
    const request = posted();
    expect(screen.getByText('Thread 3 of 3, current thread')).toBeTruthy();
    expect(screen.queryByAltText(oldImage.prompt)).toBeNull();
    expect((screen.getByRole('button', { name: 'Previous thread' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Next thread' }) as HTMLButtonElement).disabled).toBe(true);
    act(() => { state.handleError(fail(request.correlationId)); });
    expect(screen.getByText('Thread 2 of 2, current thread')).toBeTruthy();
    expect(screen.getByAltText(image.prompt)).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Continue the conversation...' })).toBeTruthy();
    expect(ofType(MessageType.IMAGE_GENERATION_CLEAR)).toHaveLength(0);
  });
});

describe('bounded webview history', () => {
  it('retains a large Single Shot image across a reload and reuses the bounded history while typing', () => {
    const largeTurn = { ...turn, images: [{ ...image, data: `data:image/png;base64,${'A'.repeat(4 * 1024 * 1024)}` }] };
    const live = renderHook(() => useImageGeneration({ ...existing, mode: 'edit', threadSettings: { ...settings, mode: 'edit' }, conversationHistory: [largeTurn] }));
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
      ...existing, mode: 'edit', threadSettings: { ...settings, mode: 'edit' },
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
    expect(screen.queryByText(/will not survive reload/)).toBeNull();
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

  it('saves only the newest five earlier threads, with a note, while the session keeps all of them', () => {
    const archives = Array.from({ length: 6 }, (_, index) => ({ id: `img-${index}`, settings, turns: [{ ...turn, id: `turn-${index}` }] }));
    const { result } = renderHook(() => useImageGeneration({ ...existing, archivedThreads: archives }));
    expect(result.current.archivedThreads).toHaveLength(6);
    expect(result.current.persistedState.archivedThreads?.map(thread => thread.id)).toEqual(['img-1', 'img-2', 'img-3', 'img-4', 'img-5']);
    expect(result.current.persistenceWarning).toContain('five newest earlier threads');
  });
});
