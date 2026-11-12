/** @jest-environment jsdom */
/**
 * Malformed saved state can't crash the Image tab (review P4-n4). The tab
 * renders restored state before anything can save over it, so before this
 * a non-array `archivedThreads` (or a turn without an images array) broke
 * the render on every reload.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { restoredImageState } from '../../../../../presentation/webview/hooks/domain/restoredImageState';
import { useImageGeneration, ImageGenerationPersistence } from '../../../../../presentation/webview/hooks/domain/useImageGeneration';
import { ImageGenerationView } from '../../../../../presentation/webview/components/views/ImageGenerationView';
import { MessageType, ConversationTurn, GeneratedImage, ImageThreadSettings, MessageEnvelope } from '@messages';

const mockPost = jest.fn();
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi', () => ({ useVSCodeApi: () => ({ postMessage: mockPost }) }));
const clears = () => mockPost.mock.calls.map(([message]) => message as MessageEnvelope).filter(message => message.type === MessageType.IMAGE_GENERATION_CLEAR);

const image: GeneratedImage = { id: 'image-1', data: 'data:image/png;base64,QUJD', mimeType: 'image/png', prompt: 'Blue knight', seed: 1, timestamp: 1 };
const turn: ConversationTurn = { id: 'turn-1', prompt: 'Blue knight', images: [image], turnNumber: 1, timestamp: 1 };
const settings: ImageThreadSettings = { mode: 'conversation', model: 'google/gemini-3-pro-image', aspectRatio: '1:1', resolution: 'auto' };
const archive = (id: string) => ({ id, settings, turns: [{ ...turn, id: `turn-${id}`, prompt: `Thread ${id}` }] });

beforeEach(() => mockPost.mockClear());

function View({ saved }: { saved: unknown }) {
  const state = useImageGeneration(saved as Partial<ImageGenerationPersistence>);
  return <ImageGenerationView imageGeneration={state} />;
}

describe('restoredImageState', () => {
  it('passes well-formed state through unchanged', () => {
    const saved = { mode: 'edit', prompt: 'p', model: 'm/x', aspectRatio: '1:1', resolution: 'auto', conversationId: 'img-1',
      threadSettings: settings, conversationHistory: [turn], generatedImages: [], archivedThreads: [archive('img-0')], recoveryWarning: 'r' };
    expect(restoredImageState(saved)).toEqual({ state: saved });
  });

  it('restores nothing from a value that is not an object', () => {
    for (const saved of [undefined, null, 'state', 42, [turn]]) expect(restoredImageState(saved)).toEqual({ state: {} });
  });

  it('keeps well-formed Earlier threads and drops the rest', () => {
    const malformed = [null, 'img-x', { id: 'img-a' }, { ...archive('img-b'), id: 7 }, { ...archive('img-c'), turns: 'none' },
      { ...archive('img-d'), turns: [] }, { ...archive('img-e'), settings: { ...settings, mode: 'chat' } },
      { ...archive('img-f'), turns: [{ ...turn, images: 'none' }] }, { ...archive('img-g'), turns: [{ ...turn, prompt: 5 }] },
      { ...archive('img-h'), turns: [{ ...turn, usage: { promptTokens: 1 } }] }, { ...archive('img-i'), turns: [{ ...turn, images: [{ ...image, prompt: null }] }] }];
    const { state } = restoredImageState({ archivedThreads: [archive('img-1'), ...malformed, archive('img-2')] });
    expect(state.archivedThreads?.map(thread => thread.id)).toEqual(['img-1', 'img-2']);
    expect(restoredImageState({ archivedThreads: { 0: archive('img-1') } }).state.archivedThreads).toEqual([]);
  });

  it('restores an Earlier thread without the notes an earlier build saved on it', () => {
    const { state } = restoredImageState({ archivedThreads: [{ ...archive('img-1'), recoveryWarning: 'r', persistenceWarning: 'p' }] });
    expect(state.archivedThreads).toEqual([archive('img-1')]);
  });

  it('drops an unknown mode, and opens a thread whose settings have one as Single Shot', () => {
    const { state } = restoredImageState({ mode: 'chat', conversationId: 'img-1', conversationHistory: [turn], threadSettings: { ...settings, mode: 'chat' } });
    expect(state).not.toHaveProperty('mode');
    expect(state.threadSettings).toEqual({ model: settings.model, aspectRatio: settings.aspectRatio });
  });

  it('drops a current thread it can’t render whole, and names it for release', () => {
    const result = restoredImageState({ conversationId: 'img-1', threadSettings: settings, conversationHistory: [turn, { ...turn, images: null }] });
    expect(result.state).toMatchObject({ conversationId: null, conversationHistory: [], generatedImages: [] });
    expect(result.unrestoredThreadId).toBe('img-1');
    expect(restoredImageState({ conversationId: 'img-1', conversationHistory: 'x' }).unrestoredThreadId).toBe('img-1');
  });

  it('keeps only string draft fields', () => {
    expect(restoredImageState({ prompt: 5, model: ['x'], aspectRatio: {}, resolution: null, recoveryWarning: 1 }).state)
      .toEqual({ archivedThreads: [], conversationId: null, conversationHistory: [], generatedImages: [], threadSettings: null, recoveryWarning: undefined });
  });
});

describe('the Image tab with malformed saved state', () => {
  it('renders when archivedThreads is not an array, and the next save is well formed', () => {
    const hook = { current: null as ReturnType<typeof useImageGeneration> | null };
    function Probe() { hook.current = useImageGeneration({ archivedThreads: 'broken' } as unknown as Partial<ImageGenerationPersistence>); return <ImageGenerationView imageGeneration={hook.current} />; }
    render(<Probe />);
    expect(screen.getByText('Your images appear here')).toBeTruthy();
    expect(hook.current?.persistedState.archivedThreads).toEqual([]);
  });

  it('renders the well-formed Earlier threads among malformed ones', () => {
    render(<View saved={{ archivedThreads: [archive('img-1'), { id: 'img-2', settings, turns: [{ ...turn, images: 7 }] }, 3] }} />);
    expect(screen.getAllByRole('button', { name: 'Delete thread' })).toHaveLength(1);
    expect(screen.getByText('Thread img-1', { selector: '.conversation-header-title' })).toBeTruthy();
    expect(screen.getByText('Thread 1 of 1, earlier thread')).toBeTruthy();
  });

  it('falls back to the default rule for an unknown mode: one mode is pressed', () => {
    render(<View saved={{ mode: 'chat', model: 'recraft/recraft-v4.1' }} />);
    expect(screen.getByRole('button', { name: 'Single Shot' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Conversation' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('renders without the current thread when its history is malformed, and releases it once', () => {
    const { rerender } = render(<View saved={{ conversationId: 'img-1', threadSettings: settings, conversationHistory: [{ ...turn, images: null }] }} />);
    rerender(<View saved={{ conversationId: 'img-1', threadSettings: settings, conversationHistory: [{ ...turn, images: null }] }} />);
    expect(screen.getByText('Your images appear here')).toBeTruthy();
    expect(clears().map(message => message.payload)).toEqual([{ conversationId: 'img-1' }]);
  });

  it('renders a turn whose usage is malformed by leaving the thread out, not by crashing', () => {
    render(<View saved={{ conversationId: 'img-1', threadSettings: settings, conversationHistory: [{ ...turn, usage: { costUsd: 'free' } }] }} />);
    expect(screen.getByText('Your images appear here')).toBeTruthy();
  });
});
