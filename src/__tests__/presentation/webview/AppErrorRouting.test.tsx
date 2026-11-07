/** @jest-environment jsdom */
/**
 * App-level message routing: errors reach both generation hooks, and each
 * settles only its own request. Before, an enhance error went to both tabs,
 * stopping the other tab's spinner and showing the error twice.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessageEnvelope, MessageType, createEnvelope } from '@messages';
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

it('does not rewrite webview state when an unrelated message re-renders the app', () => {
  render(<App />);
  const writes = mockSetState.mock.calls.length;

  // A balance push re-renders App but changes no persisted state.
  deliver(createEnvelope(MessageType.OPENROUTER_BALANCE_DATA, 'extension.account', {
    status: 'ok', creditsStatus: 'ok', credits: { totalCredits: 10, totalUsage: 1, remaining: 9 }, fetchedAt: Date.now(),
  }));

  expect(writes).toBeGreaterThan(0);
  expect(mockSetState.mock.calls.length).toBe(writes);
});
