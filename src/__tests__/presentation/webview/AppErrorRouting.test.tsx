/** @jest-environment jsdom */
/**
 * App-level message routing: errors reach both generation hooks, and each
 * settles only its own request. Before, an enhance error went to both tabs,
 * stopping the other tab's spinner and showing the error twice.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessageEnvelope, MessageType, OpenRouterBalancePayload, createEnvelope } from '@messages';
import { App } from '../../../presentation/webview/App';

const mockPost = jest.fn();
const mockSetState = jest.fn();
// One instance, like the real acquireVsCodeApi() singleton.
const mockApi = { postMessage: mockPost, getState: () => undefined, setState: mockSetState };
jest.mock('../../../presentation/webview/hooks/useVSCodeApi', () => ({
  useVSCodeApi: () => mockApi,
}));

const sent = (type: MessageType): MessageEnvelope[] =>
  mockPost.mock.calls.map(([message]) => message as MessageEnvelope).filter((m) => m.type === type);
const isDisabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const deliver = (message: MessageEnvelope) =>
  act(() => { window.dispatchEvent(new MessageEvent('message', { data: message })); });

beforeEach(() => {
  mockPost.mockClear();
  mockSetState.mockClear();
});

it('keeps the SVG tab generating when an Image-tab enhance fails', () => {
  render(<App />);

  // Image tab: start an enhance.
  fireEvent.change(screen.getByPlaceholderText('Describe the image you want to generate...'), { target: { value: 'A knight' } });
  fireEvent.click(screen.getByRole('button', { name: /Enhance Prompt/ }));
  const [enhance] = sent(MessageType.ENHANCE_PROMPT_REQUEST);

  // SVG tab: start a generation.
  fireEvent.click(screen.getByRole('tab', { name: /SVG/ }));
  fireEvent.change(screen.getByPlaceholderText('Describe the SVG you want to create...'), { target: { value: 'A star' } });
  fireEvent.click(screen.getByRole('button', { name: /Generate/ }));
  const [svgRequest] = sent(MessageType.SVG_GENERATION_REQUEST);
  expect(isDisabled(screen.getByRole('button', { name: 'Generating...' }))).toBe(true);

  deliver(createEnvelope(MessageType.ERROR, 'extension.enhance', { message: 'Enhance failed' }, enhance.correlationId));

  // The SVG request is untouched and shows no error...
  expect(isDisabled(screen.getByRole('button', { name: 'Generating...' }))).toBe(true);
  expect(screen.queryByRole('alert')).toBeNull();

  // ...and only its own answer settles it.
  deliver(createEnvelope(MessageType.SVG_GENERATION_RESPONSE, 'extension.svgGeneration',
    { conversationId: 'svg-1', svgCode: '<svg viewBox="0 0 1 1"/>', turnNumber: 1 }, 'svg-generate-stale'));
  expect(isDisabled(screen.getByRole('button', { name: 'Generating...' }))).toBe(true);
  deliver(createEnvelope(MessageType.ERROR, 'extension.svgGeneration', { message: 'No valid SVG' }, svgRequest.correlationId));
  expect(screen.getByRole('alert').textContent).toContain('No valid SVG');

  // The Image tab shows its own enhance error and is no longer enhancing.
  fireEvent.click(screen.getByRole('tab', { name: /Image/ }));
  expect(screen.getByRole('alert').textContent).toContain('Enhance failed');
  expect(isDisabled(screen.getByRole('button', { name: /Enhance Prompt/ }))).toBe(false);
});

it('shows an error that belongs to no request in the visible tab only', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: /SVG/ }));

  deliver(createEnvelope(MessageType.ERROR, 'extension.settings', { message: 'Failed to update setting svgModel' }));
  expect(screen.getByRole('alert').textContent).toContain('Failed to update setting svgModel');

  fireEvent.click(screen.getByRole('tab', { name: /Image/ }));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('shows an uncorrelated error from a generation host instead of dropping it', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: /SVG/ }));
  fireEvent.change(screen.getByPlaceholderText('Describe the SVG you want to create...'), { target: { value: 'A star' } });
  fireEvent.click(screen.getByRole('button', { name: /Generate/ }));

  // No id: it can't settle the running request, but it must not vanish.
  deliver(createEnvelope(MessageType.ERROR, 'extension.imageGeneration', { message: 'Host lost the request id' }));
  expect(screen.getByRole('alert').textContent).toContain('Host lost the request id');
  expect(isDisabled(screen.getByRole('button', { name: 'Generating...' }))).toBe(true);
});

it('settles a request the host failed to handle, and drops a stale one', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: /SVG/ }));
  fireEvent.change(screen.getByPlaceholderText('Describe the SVG you want to create...'), { target: { value: 'A star' } });
  fireEvent.click(screen.getByRole('button', { name: /Generate/ }));
  const [svgRequest] = sent(MessageType.SVG_GENERATION_REQUEST);

  deliver(createEnvelope(MessageType.ERROR, 'extension.router', { message: 'stale' }, 'svg-generate-old'));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(isDisabled(screen.getByRole('button', { name: 'Generating...' }))).toBe(true);

  deliver(createEnvelope(MessageType.ERROR, 'extension.router', { message: 'Could not handle this request' }, svgRequest.correlationId));
  expect(screen.getByRole('alert').textContent).toContain('Could not handle this request');
  expect(screen.queryByRole('button', { name: 'Generating...' })).toBeNull();
});

describe('a save the host failed to handle (router fallback ERROR)', () => {
  const routerError = (correlationId: string, message: string) =>
    createEnvelope(MessageType.ERROR, 'extension.router', { message, code: 'UNHANDLED_ERROR' }, correlationId);
  const imageData = 'data:image/png;base64,aGVsbG8=';

  it('settles the Image-tab save, shows why, and leaves the running generation alone', () => {
    render(<App />);
    const prompt = screen.getByPlaceholderText('Describe the image you want to generate...');
    fireEvent.change(prompt, { target: { value: 'A knight' } });
    fireEvent.click(screen.getByRole('button', { name: /Start Conversation/ }));
    const [first] = sent(MessageType.IMAGE_GENERATION_REQUEST);
    deliver(createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration', {
      conversationId: 'image-conv',
      images: [{ id: 'img-1', data: imageData, mimeType: 'image/png', prompt: 'A knight', timestamp: 1 }],
      turnNumber: 1,
    }, first.correlationId));

    fireEvent.click(screen.getByRole('button', { name: 'Save to workspace' }));
    const [save] = sent(MessageType.IMAGE_SAVE_REQUEST);
    expect(save.correlationId).toMatch(/^image-save-/);
    expect(isDisabled(screen.getByRole('button', { name: 'Saving…' }))).toBe(true);

    // A refinement of the same conversation is running when the save's error arrives.
    // The default model (Nano Banana 2) starts a Conversation thread.
    const refine = screen.getByPlaceholderText('Continue the conversation...');
    fireEvent.change(refine, { target: { value: 'Make it red' } });
    fireEvent.keyDown(refine, { key: 'Enter' });
    const [refinement] = sent(MessageType.IMAGE_GENERATION_CONTINUE);
    expect(isDisabled(screen.getByRole('button', { name: 'Generating...' }))).toBe(true);

    // Unknown and stale save ids are still dropped.
    deliver(routerError('image-save-old', 'stale save'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy();

    deliver(routerError(save.correlationId!, 'The host could not handle this request'));

    expect(screen.getByRole('alert').textContent).toContain('The host could not handle this request');
    expect(screen.queryByRole('button', { name: 'Saving…' })).toBeNull();
    expect(isDisabled(screen.getByRole('button', { name: 'Save to workspace' }))).toBe(false);
    expect(isDisabled(screen.getByRole('button', { name: 'Generating...' }))).toBe(true);

    // The refinement still settles on its own answer.
    deliver(createEnvelope(MessageType.IMAGE_GENERATION_RESPONSE, 'extension.imageGeneration', {
      conversationId: 'image-conv',
      images: [{ id: 'img-2', data: imageData, mimeType: 'image/png', prompt: 'Make it red', timestamp: 2 }],
      turnNumber: 2,
    }, refinement.correlationId));
    expect(screen.queryByRole('button', { name: 'Generating...' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Save to workspace' })).toHaveLength(2);

    // Now settled: a repeat of that error is dropped, and a late result changes nothing.
    // (The refinement's success cleared the earlier error.)
    deliver(routerError(save.correlationId!, 'repeat'));
    expect(screen.queryByRole('alert')).toBeNull();
    deliver(createEnvelope(MessageType.IMAGE_SAVE_RESULT, 'extension.imageGeneration',
      { success: true, imageId: 'img-1' }, save.correlationId));
    expect(screen.queryByRole('button', { name: 'Saved' })).toBeNull();
  });

  it('settles the SVG-tab save, shows why, and leaves the running generation alone', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /SVG/ }));
    fireEvent.change(screen.getByPlaceholderText('Describe the SVG you want to create...'), { target: { value: 'A star' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate/ }));
    const [first] = sent(MessageType.SVG_GENERATION_REQUEST);
    deliver(createEnvelope(MessageType.SVG_GENERATION_RESPONSE, 'extension.svgGeneration',
      { conversationId: 'svg-conv', svgCode: '<svg viewBox="0 0 1 1"/>', turnNumber: 1 }, first.correlationId));

    fireEvent.click(screen.getByRole('button', { name: 'Save to workspace' }));
    const [save] = sent(MessageType.SVG_SAVE_REQUEST);
    expect(save.correlationId).toMatch(/^svg-save-/);
    expect(isDisabled(screen.getByRole('button', { name: 'Saving…' }))).toBe(true);

    // A new generation is running (it hides the old result) when the save's error arrives.
    fireEvent.click(screen.getByRole('button', { name: /Generate/ }));
    const [, second] = sent(MessageType.SVG_GENERATION_REQUEST);
    expect(isDisabled(screen.getByRole('button', { name: 'Generating...' }))).toBe(true);

    deliver(routerError('svg-save-old', 'stale save'));
    expect(screen.queryByRole('alert')).toBeNull();

    deliver(routerError(save.correlationId!, 'The host could not handle this request'));

    expect(screen.getByRole('alert').textContent).toContain('The host could not handle this request');
    expect(isDisabled(screen.getByRole('button', { name: 'Generating...' }))).toBe(true);

    // The generation settles on its own answer. The same SVG comes back, and
    // its save button is ready again, not stuck on the failed save.
    deliver(createEnvelope(MessageType.SVG_GENERATION_RESPONSE, 'extension.svgGeneration',
      { conversationId: 'svg-conv-2', svgCode: '<svg viewBox="0 0 1 1"/>', turnNumber: 1 }, second.correlationId));
    expect(screen.queryByRole('button', { name: 'Generating...' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Saving…' })).toBeNull();
    expect(isDisabled(screen.getByRole('button', { name: 'Save to workspace' }))).toBe(false);

    // The Image tab shows nothing: the error was the SVG tab's.
    fireEvent.click(screen.getByRole('tab', { name: /Image/ }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

it('does not rewrite webview state when an unrelated message re-renders the app', () => {
  render(<App />);
  const writes = mockSetState.mock.calls.length;

  // A balance push re-renders App but changes no persisted state.
  deliver(createEnvelope(MessageType.OPENROUTER_BALANCE_DATA, 'extension.account', {
    status: 'ok', creditsStatus: 'ok', credits: { totalCredits: 10, totalUsage: 1, remaining: 9 },
    accountEpoch: 0, fetchedAt: Date.now(),
  } satisfies OpenRouterBalancePayload));

  expect(writes).toBeGreaterThan(0);
  expect(mockSetState.mock.calls.length).toBe(writes);
});
