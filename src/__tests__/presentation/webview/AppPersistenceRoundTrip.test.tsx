/** @jest-environment jsdom */
/**
 * The Image tab's saved snapshot, through the real App: what App writes with
 * `setState` is what the next App reads with `getState`, as in a webview
 * reload. The warnings must describe the current state only. Before, App
 * re-read the last saved snapshot on every render and fed its warning into
 * the next one, so a warning never cleared and the shortened-draft note grew
 * on every keystroke (re-serializing the whole image history each time).
 *
 * The storage budget is lowered to 4 MiB so a few megabytes of image data
 * cross it; everything else is the real persistence code.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessageEnvelope, MessageType, GeneratedImage, createEnvelope } from '@messages';
import { App } from '../../../presentation/webview/App';
import {
  boundedImageHistory,
  IMAGE_HISTORY_ARCHIVE_WARNING,
  IMAGE_HISTORY_DRAFT_WARNING,
  IMAGE_HISTORY_RESTORED_WARNING,
  IMAGE_HISTORY_STORAGE_WARNING,
} from '../../../presentation/webview/hooks/domain/imageHistoryPersistence';
import type { PersistenceState } from '../../../presentation/webview/hooks/usePersistence';

jest.mock('../../../presentation/webview/hooks/domain/imageHistoryPersistence', () => {
  const actual = jest.requireActual('../../../presentation/webview/hooks/domain/imageHistoryPersistence');
  return { ...actual, MAX_IMAGE_HISTORY_STORAGE_BYTES: 4 * 1024 * 1024, boundedImageHistory: jest.fn(actual.boundedImageHistory) };
});

// getState returns exactly what setState last saved, like the real webview.
let mockStored: PersistenceState | undefined;
const mockPost = jest.fn();
const mockApi = {
  postMessage: mockPost,
  getState: () => mockStored,
  setState: (state: PersistenceState) => { mockStored = JSON.parse(JSON.stringify(state)); },
};
jest.mock('../../../presentation/webview/hooks/useVSCodeApi', () => ({ useVSCodeApi: () => mockApi }));

const sent = (type: MessageType): MessageEnvelope[] =>
  mockPost.mock.calls.map(([message]) => message as MessageEnvelope).filter((m) => m.type === type);
const deliver = (message: MessageEnvelope) =>
  act(() => { window.dispatchEvent(new MessageEvent('message', { data: message })); });
const promptBox = () => screen.getByPlaceholderText('Describe the image you want to generate...');
// A fresh install opens in Conversation (the default model has a chat route).
const generateButton = () => screen.getByRole('button', { name: /⚡ (Generate|Start Conversation)/ });
// 1.5M base64 characters: about 3 MiB as counted, so one fits the lowered budget and two don't.
const bigImage = (turn: number): GeneratedImage => ({
  id: `image-${turn}`, data: `data:image/png;base64,${'A'.repeat(1_500_000)}`,
  mimeType: 'image/png', prompt: `Prompt ${turn}`, seed: turn, timestamp: turn,
});
const smallImage: GeneratedImage = { ...bigImage(1), data: 'data:image/png;base64,QUJD' };
const savedImage = () => mockStored!.imageGeneration!;

function answer(request: MessageEnvelope, turnNumber: number, images: GeneratedImage[]) {
  deliver(createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration',
    { conversationId: 'img-1', images, turnNumber }, request.correlationId));
}

beforeEach(() => {
  mockStored = undefined;
  mockPost.mockClear();
  (boundedImageHistory as jest.Mock).mockClear();
});

it('warns while the snapshot drops images, explains restored turns after a reload, and clears with the thread', () => {
  const first = render(<App />);
  fireEvent.change(promptBox(), { target: { value: 'A knight' } });
  fireEvent.click(generateButton());
  answer(sent(MessageType.IMAGE_GENERATION_REQUEST)[0], 1, [bigImage(1)]);
  // One large image fits: nothing to warn about.
  expect(screen.queryByText(IMAGE_HISTORY_STORAGE_WARNING)).toBeNull();
  expect(savedImage().persistenceWarning).toBeUndefined();

  const refine = screen.getByPlaceholderText('Continue the conversation...');
  fireEvent.change(refine, { target: { value: 'Add a tree' } });
  fireEvent.keyDown(refine, { key: 'Enter' });
  answer(sent(MessageType.IMAGE_GENERATION_CONTINUE)[0], 2, [bigImage(2)]);
  // Two don't: the live session still shows both, the snapshot keeps only the latest.
  expect(screen.getByText(IMAGE_HISTORY_STORAGE_WARNING)).toBeTruthy();
  expect(savedImage().conversationHistory.map(turn => !!turn.imagesOmitted)).toEqual([true, false]);
  first.unmount();

  // Reload. The snapshot now fits (the omitted turn is small), so the
  // prospective warning is gone; the restored turn explains itself.
  const second = render(<App />);
  expect(screen.queryByText(IMAGE_HISTORY_STORAGE_WARNING)).toBeNull();
  expect(screen.getByText(IMAGE_HISTORY_RESTORED_WARNING)).toBeTruthy();
  expect(savedImage().persistenceWarning).toBeUndefined();

  fireEvent.click(screen.getByRole('button', { name: 'Clear thread' }));
  expect(screen.queryByText(IMAGE_HISTORY_RESTORED_WARNING)).toBeNull();
  expect(savedImage().conversationHistory).toEqual([]);
  second.unmount();

  // And nothing comes back on the next reload.
  render(<App />);
  expect(screen.queryByText(IMAGE_HISTORY_RESTORED_WARNING)).toBeNull();
  expect(screen.queryByText(IMAGE_HISTORY_STORAGE_WARNING)).toBeNull();
});

it('shows no warning when nothing was dropped, before or after a reload', () => {
  const first = render(<App />);
  fireEvent.change(promptBox(), { target: { value: 'A knight' } });
  fireEvent.click(generateButton());
  answer(sent(MessageType.IMAGE_GENERATION_REQUEST)[0], 1, [smallImage]);
  expect(screen.queryAllByRole('status').map(element => element.textContent).join('')).not.toMatch(/local history|local storage/);
  first.unmount();

  render(<App />);
  expect(screen.getAllByRole('img', { name: 'Prompt 1' })).toHaveLength(1);
  expect(screen.queryAllByRole('status').map(element => element.textContent).join('')).not.toMatch(/local history|local storage/);
  expect(savedImage().persistenceWarning).toBeUndefined();
});

it('keeps the shortened-draft note to one sentence, in its own field, without re-bounding the history per keystroke', () => {
  const first = render(<App />);
  fireEvent.change(promptBox(), { target: { value: 'A knight' } });
  fireEvent.click(generateButton());
  answer(sent(MessageType.IMAGE_GENERATION_REQUEST)[0], 1, [smallImage]);

  const long = 'x'.repeat(40_000);
  fireEvent.change(promptBox(), { target: { value: long } });
  const boundings = (boundedImageHistory as jest.Mock).mock.calls.length;
  for (const suffix of ['a', 'ab', 'abc']) fireEvent.change(promptBox(), { target: { value: long + suffix } });

  expect(screen.getAllByText(IMAGE_HISTORY_DRAFT_WARNING)).toHaveLength(1);
  expect(screen.getByText(IMAGE_HISTORY_DRAFT_WARNING).textContent).toBe(IMAGE_HISTORY_DRAFT_WARNING);
  expect(savedImage().draftWarning).toBe(IMAGE_HISTORY_DRAFT_WARNING);
  expect(savedImage().persistenceWarning).toBeUndefined();
  expect(savedImage().prompt).toHaveLength(4096);
  // Typing never re-bounds (re-serializes) the image history.
  expect((boundedImageHistory as jest.Mock).mock.calls.length).toBe(boundings);

  // A short draft fits again: the note goes.
  fireEvent.change(promptBox(), { target: { value: 'short' } });
  expect(screen.queryByText(IMAGE_HISTORY_DRAFT_WARNING)).toBeNull();
  expect(savedImage().draftWarning).toBeUndefined();

  // Restored from a shortened draft, the note doesn't come back with it.
  fireEvent.change(promptBox(), { target: { value: long } });
  first.unmount();
  render(<App />);
  expect((promptBox() as HTMLTextAreaElement).value).toHaveLength(4096);
  expect(screen.queryByText(IMAGE_HISTORY_DRAFT_WARNING)).toBeNull();
  expect(screen.queryByText(/local history/)).toBeNull();
});

describe('Earlier threads in the saved snapshot', () => {
  /** Start a new thread from the prompt box; the host answers with `conversationId`. */
  function startThread(prompt: string, conversationId: string) {
    fireEvent.change(promptBox(), { target: { value: prompt } });
    fireEvent.click(generateButton());
    const request = sent(MessageType.IMAGE_GENERATION_REQUEST).pop()!;
    deliver(createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration',
      { conversationId, images: [{ ...smallImage, id: `${conversationId}-image`, prompt }], turnNumber: 1 }, request.correlationId));
  }
  const deleteButtons = () => screen.queryAllByRole('button', { name: 'Delete thread' });

  it('notes dropped threads only while the snapshot drops them, never from restored state', () => {
    const first = render(<App />);
    for (let index = 1; index <= 7; index++) startThread(`Thread ${index}`, `img-${index}`);
    // Six Earlier threads live; the snapshot keeps five, and says so.
    expect(deleteButtons()).toHaveLength(6);
    expect(savedImage().archivedThreads?.map(thread => thread.id)).toEqual(['img-2', 'img-3', 'img-4', 'img-5', 'img-6']);
    expect(savedImage().persistenceWarning).toBe(IMAGE_HISTORY_ARCHIVE_WARNING);
    expect(screen.getByText(IMAGE_HISTORY_ARCHIVE_WARNING)).toBeTruthy();
    first.unmount();

    // Reload: the five come back, nothing more is being left out, so no note.
    const second = render(<App />);
    expect(deleteButtons()).toHaveLength(5);
    expect(screen.queryByText(IMAGE_HISTORY_ARCHIVE_WARNING)).toBeNull();
    expect(savedImage().persistenceWarning).toBeUndefined();
    // A sixth again: the note is recomputed, not remembered.
    startThread('Thread 8', 'img-8');
    expect(screen.getByText(IMAGE_HISTORY_ARCHIVE_WARNING)).toBeTruthy();
    // Delete them all and clear: the note goes, and stays gone after a reload.
    while (deleteButtons().length) fireEvent.click(deleteButtons()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear thread' }));
    expect(screen.queryByText(IMAGE_HISTORY_ARCHIVE_WARNING)).toBeNull();
    expect(savedImage()).toMatchObject({ archivedThreads: [], conversationHistory: [] });
    expect(savedImage().persistenceWarning).toBeUndefined();
    second.unmount();

    render(<App />);
    expect(deleteButtons()).toHaveLength(0);
    expect(screen.queryByText(/will not survive reload/)).toBeNull();
  });

  it('brings back the thread a Generate was replacing when the webview reloads mid-request, unreleased', () => {
    const first = render(<App />);
    startThread('A knight', 'img-1');
    fireEvent.change(promptBox(), { target: { value: 'A castle' } });
    fireEvent.click(generateButton());
    // While it runs, the old thread shows under Earlier threads...
    expect(screen.getByText('Earlier threads')).toBeTruthy();
    // ...but the snapshot still has it as the current thread, and nothing was released.
    expect(savedImage()).toMatchObject({ conversationId: 'img-1', archivedThreads: [] });
    expect(sent(MessageType.IMAGE_GENERATION_CLEAR)).toHaveLength(0);
    first.unmount();

    render(<App />);
    expect(screen.queryByText('Earlier threads')).toBeNull();
    expect(screen.getAllByRole('img', { name: 'A knight' })).toHaveLength(1);
    expect(screen.getByPlaceholderText('Continue the conversation...')).toBeTruthy();
  });
});
