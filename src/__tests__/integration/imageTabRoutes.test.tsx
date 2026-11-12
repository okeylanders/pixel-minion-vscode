/** @jest-environment jsdom */
/**
 * Image tab end to end: the real App, its hooks and views, wired to the real
 * MessageHandler, ImageGenerationHandler, ImageOrchestrator,
 * OpenRouterImageClient and transcript store. Only `fetch`, VS Code settings,
 * secret storage, the balance service and the file system are stubbed, so
 * every assertion is about what the user sees and what would reach
 * OpenRouter.
 *
 * The capability-gating cases follow the PR #14 review (F-01): a prompt-only
 * first turn, attached references, a model switch with references attached,
 * and a first turn followed by a refinement, each checked in the UI and at
 * the host.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as vscode from 'vscode';
import { App } from '../../presentation/webview/App';
import { MessageHandler } from '../../application/handlers/MessageHandler';
import { FileImageConversationStore } from '../../infrastructure/ai/orchestration/ImageConversationStore';
import { MessageEnvelope, MessageType, OpenRouterBalancePayload, createEnvelope } from '@messages';
import { memoryGlobalStorage } from '../helpers/memoryGlobalStorage';
import { __resetOverlayStateForTests } from '../../presentation/webview/hooks/useOverlayDismiss';

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const signedAssistant = {
  role: 'assistant',
  content: [{ type: 'text', text: 'A blue knight' }],
  images: [{ image_url: { url: `data:image/png;base64,${PNG_1PX}` }, thought_signature: 'opaque' }],
};

// ── Host side ────────────────────────────────────────────────────────────────
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const secrets = {
  getApiKey: jest.fn(async () => 'test-key'),
  hasApiKey: jest.fn(async () => true),
  onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
};
const BALANCE: OpenRouterBalancePayload = { status: 'ok', creditsStatus: 'ok', accountEpoch: 0, fetchedAt: 1 };
const balances = {
  getBalance: jest.fn(async () => BALANCE),
  invalidate: jest.fn(),
  accountEpoch: jest.fn(() => 0),
  scheduleRefresh: jest.fn(),
  addRefreshListener: jest.fn(() => () => undefined),
};
let settingsValues: Record<string, unknown> = {};
const mockConfig = {
  get: jest.fn((key: string, fallback?: unknown) => settingsValues[key] ?? fallback),
  inspect: jest.fn(() => ({})),
  update: jest.fn(async (key: string, value: unknown) => { settingsValues[key] = value; }),
};

let storage = memoryGlobalStorage();
let host: MessageHandler;
const toWebview: MessageEnvelope[] = [];
function startHost(): void {
  host?.dispose();
  host = new MessageHandler(
    (message) => {
      toWebview.push(message);
      act(() => { window.dispatchEvent(new MessageEvent('message', { data: message })); });
    },
    secrets as never,
    logger as never,
    balances as never,
    new FileImageConversationStore(storage.storage, ['file:///project'])
  );
}

// ── Webview side: the vscode API forwards to the host ───────────────────────
const fromWebview: MessageEnvelope[] = [];
const mockApi = {
  postMessage: (message: MessageEnvelope) => {
    fromWebview.push(message);
    void host.handleMessage(message);
  },
  getState: () => undefined,
  setState: jest.fn(),
};
jest.mock('../../presentation/webview/hooks/useVSCodeApi', () => ({ useVSCodeApi: () => mockApi }));

// ── OpenRouter ───────────────────────────────────────────────────────────────
const mockFetch = jest.fn();
const providerCalls = () => mockFetch.mock.calls.filter(([url]) => /\/(images|chat\/completions)$/.test(String(url)));
const lastBody = () => JSON.parse(providerCalls()[providerCalls().length - 1][1].body);
const lastUrl = () => String(providerCalls()[providerCalls().length - 1][0]);

beforeEach(() => {
  jest.clearAllMocks();
  toWebview.length = 0;
  fromWebview.length = 0;
  settingsValues = {};
  storage = memoryGlobalStorage();
  (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
  global.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockReset().mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => (String(url).endsWith('/chat/completions')
      ? { choices: [{ message: signedAssistant }], usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0.03 } }
      : { data: [{ b64_json: PNG_1PX, media_type: 'image/png' }], usage: { cost: 0.01 } }),
  }));
  startHost();
});
afterEach(() => {
  host.dispose();
  __resetOverlayStateForTests();
});

// ── UI helpers ───────────────────────────────────────────────────────────────
const promptBox = () => screen.getByPlaceholderText('Describe the image you want to generate...');
const generateButton = () => screen.getByRole('button', { name: /Generate/ }) as HTMLButtonElement;
const addReferenceButton = () => screen.getByRole('button', { name: /Add Reference Image/ }) as HTMLButtonElement;
const warnings = () => screen.queryAllByRole('status').map(element => element.textContent);

async function renderImageTab(model: string) {
  settingsValues.imageModel = model;
  const view = render(<App />);
  // Settings arrive from the host and select the model.
  await waitFor(() => expect(toWebview.some(message =>
    message.type === MessageType.SETTINGS_DATA && (message.payload as { imageModel?: string }).imageModel === model)).toBe(true));
  return view;
}

async function pickModel(name: string) {
  fireEvent.click(screen.getByRole('button', { name: /Current model:/ }));
  const browser = await screen.findByRole('dialog', { name: /browser/ });
  fireEvent.click(within(browser).getByRole('button', { name }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /browser/ })).toBeNull());
}

async function attachPng(container: HTMLElement, count = 1) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const before = container.querySelectorAll('.thumbnail').length;
  const files = Array.from({ length: count }, (_, index) =>
    new File([Buffer.from(PNG_1PX, 'base64')], `ref-${index}.png`, { type: 'image/png' }));
  fireEvent.change(input, { target: { files } });
  await waitFor(() => expect(container.querySelectorAll('.thumbnail').length).toBe(before + count));
}

const SVG_MARKUP = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>';
async function attachSvg(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const before = container.querySelectorAll('.thumbnail').length;
  fireEvent.change(input, { target: { files: [new File([SVG_MARKUP], 'logo.svg', { type: 'image/svg+xml' })] } });
  await waitFor(() => expect(container.querySelectorAll('.thumbnail').length).toBe(before + 1));
}

async function generate(text: string) {
  fireEvent.change(promptBox(), { target: { value: text } });
  const before = providerCalls().length;
  fireEvent.click(generateButton());
  await waitFor(() => expect(providerCalls().length).toBe(before + 1));
  await screen.findAllByRole('img', { name: text });
}

/** Send a request the UI would never send, straight through the real host. */
async function sendRaw(type: MessageType, payload: object) {
  const message = createEnvelope(type, 'webview.imageGeneration', payload, `image-raw-${Math.random()}`);
  await host.handleMessage(message);
  return toWebview.filter(reply => reply.correlationId === message.correlationId);
}

describe('capability gating (PR #14 F-01)', () => {
  it('prompt-only first turn: a text-only model generates with no references; a reference-only model waits for one', async () => {
    const { container } = await renderImageTab('recraft/recraft-v4.1-flash');
    // No raster reference slot: the button offers SVG text context only.
    expect(screen.queryByRole('button', { name: /Add Reference Image/ })).toBeNull();
    expect((screen.getByRole('button', { name: /Add SVG Context/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((container.querySelector('input[type="file"]') as HTMLInputElement).accept).toBe('image/svg+xml');
    expect(screen.getByText(/This model accepts text prompts only/)).toBeTruthy();
    await generate('A poster');
    expect(lastUrl()).toBe('https://openrouter.ai/api/v1/images');
    expect(lastBody()).toEqual({ model: 'recraft/recraft-v4.1-flash', prompt: 'A poster', aspect_ratio: '1:1' });

    await pickModel('Krea K3 Edit');
    fireEvent.change(promptBox(), { target: { value: 'Make it night' } });
    expect(generateButton().disabled).toBe(true);
    expect(warnings()).toContain('This model needs at least 1 reference image. Add one to generate.');
    await attachPng(container);
    expect(generateButton().disabled).toBe(false);
    await generate('Make it night');
    expect(lastBody().input_references).toHaveLength(1);
    expect(lastBody().model).toBe('krea/k3-edit');
  });

  it('SVG context takes no reference slot: it goes in the prompt, on a text-only model and beside a full raster slot', async () => {
    const { container } = await renderImageTab('recraft/recraft-v4.1-flash');
    await attachSvg(container);
    expect(screen.getByRole('img', { name: 'SVG text context' })).toBeTruthy();
    fireEvent.change(promptBox(), { target: { value: 'A poster' } });
    expect(generateButton().disabled).toBe(false);
    fireEvent.click(generateButton());
    await waitFor(() => expect(providerCalls()).toHaveLength(1));
    expect(lastBody()).toEqual({ model: 'recraft/recraft-v4.1-flash', prompt: `A poster\n\nReference SVG:\n${SVG_MARKUP}`, aspect_ratio: '1:1' });
    await screen.findAllByRole('img', { name: 'A poster' });

    // One raster slot (Recraft V4.1): the SVG leaves it free for a PNG.
    await pickModel('Recraft V4.1');
    expect(addReferenceButton().textContent).toBe('+ Add Reference Image');
    await attachPng(container);
    expect(screen.getByRole('button', { name: /Add SVG Context \(1\/1\)/ })).toBeTruthy();
    expect(generateButton().disabled).toBe(false);
    fireEvent.click(generateButton());
    await waitFor(() => expect(providerCalls()).toHaveLength(2));
    expect(lastBody()).toMatchObject({
      model: 'recraft/recraft-v4.1', prompt: `A poster\n\nReference SVG:\n${SVG_MARKUP}`,
      input_references: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${PNG_1PX}` } }],
    });
  });

  it('attached references: the host refuses references to a text-only model even when the UI is bypassed', async () => {
    await renderImageTab('recraft/recraft-v4.1-flash');
    const before = providerCalls().length;
    const replies = await sendRaw(MessageType.IMAGE_GENERATION_REQUEST, {
      mode: 'edit', model: 'recraft/recraft-v4.1-flash', aspectRatio: '1:1', prompt: 'A poster',
      referenceImages: [`data:image/png;base64,${PNG_1PX}`],
    });
    expect(replies.find(reply => reply.type === MessageType.ERROR)?.payload).toMatchObject({
      message: 'This model accepts 0 reference images; received 1.',
    });
    expect(providerCalls()).toHaveLength(before);
  });

  it('model switch with references attached: Generate is blocked until the attachments fit the new model', async () => {
    const { container } = await renderImageTab('google/gemini-3.1-flash-image');
    await attachPng(container, 2);
    fireEvent.change(promptBox(), { target: { value: 'A knight' } });
    expect(generateButton().disabled).toBe(false);

    await pickModel('Recraft V4.1 Flash');
    expect(generateButton().disabled).toBe(true);
    expect(warnings()).toContain('This model accepts text prompts only. Remove the reference images to generate.');

    await pickModel('Recraft V4.1');
    expect(generateButton().disabled).toBe(true);
    expect(warnings()).toContain('This model accepts 0–1 reference images; 2 attached. Remove 1 to generate.');
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove image' })[0]);
    expect(generateButton().disabled).toBe(false);

    const before = providerCalls().length;
    fireEvent.click(generateButton());
    await waitFor(() => expect(providerCalls()).toHaveLength(before + 1));
    expect(lastBody()).toMatchObject({ model: 'recraft/recraft-v4.1', input_references: [expect.any(Object)] });
  });

  it('first turn to refinement: a text-only thread offers no Refine, and the host refuses a forced follow-up', async () => {
    await renderImageTab('recraft/recraft-v4.1-flash');
    await generate('A poster');
    expect(screen.getByText('This model generates from text only. Start a new generation above to make another image.')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/latest image|Continue the conversation/)).toBeNull();

    const response = toWebview.find(message => message.type === MessageType.IMAGE_GENERATION_RESPONSE)!;
    const { conversationId } = response.payload as { conversationId: string };
    const before = providerCalls().length;
    const replies = await sendRaw(MessageType.IMAGE_GENERATION_CONTINUE, {
      mode: 'edit', model: 'recraft/recraft-v4.1-flash', aspectRatio: '1:1', resolution: 'auto', prompt: 'Make it red', conversationId,
    });
    expect(replies.find(reply => reply.type === MessageType.ERROR)?.payload).toMatchObject({
      message: 'This model accepts 0 reference images; received 1.',
    });
    expect(providerCalls()).toHaveLength(before);
  });

  it('a Single Shot refinement sends only the latest image and the new prompt', async () => {
    await renderImageTab('recraft/recraft-v4.1');
    await generate('A blue knight');
    const refine = screen.getByPlaceholderText('Write a prompt using the latest image...');
    fireEvent.change(refine, { target: { value: 'Make it red' } });
    fireEvent.keyDown(refine, { key: 'Enter' });
    await waitFor(() => expect(providerCalls()).toHaveLength(2));
    expect(lastUrl()).toBe('https://openrouter.ai/api/v1/images');
    expect(lastBody()).toEqual({
      model: 'recraft/recraft-v4.1', prompt: 'Make it red', aspect_ratio: '1:1',
      input_references: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${PNG_1PX}` } }],
    });
  });
});

describe('controls follow the selected model', () => {
  it('shows seed, resolution and ratio controls only where the route takes them', async () => {
    await renderImageTab('google/gemini-3.1-flash-image');
    // Conversation route: chat lists seed; K tiers only (no 512).
    expect(screen.getByLabelText('Seed')).toBeTruthy();
    const resolution = screen.getByLabelText('Resolution') as HTMLSelectElement;
    expect(Array.from(resolution.options).map(option => option.value)).toEqual(['auto', '1K', '2K', '4K']);

    await pickModel('Recraft V4.1');
    expect(screen.queryByLabelText('Seed')).toBeNull();
    expect(screen.queryByLabelText('Resolution')).toBeNull();
    const ratio = screen.getByLabelText('Aspect Ratio') as HTMLSelectElement;
    expect(Array.from(ratio.options).map(option => option.value)).toEqual(['1:1', '3:4', '4:3', '9:16', '16:9', 'auto']);
    expect(ratio.options[5].textContent).toBe('Auto (model chooses)');

    await pickModel('FLUX.3 Image Klein');
    expect(screen.getByLabelText('Seed')).toBeTruthy();
    expect(Array.from((screen.getByLabelText('Resolution') as HTMLSelectElement).options).map(option => option.value))
      .toEqual(['auto', '768', '1K', '1.5K', '2K', '4K']);
  });

  it('sends the chosen ratio, tier and seed, and hides the seed chip where none was sent', async () => {
    await renderImageTab('black-forest-labs/flux-3-image-klein');
    fireEvent.change(screen.getByLabelText('Aspect Ratio'), { target: { value: '7:5' } });
    fireEvent.change(screen.getByLabelText('Resolution'), { target: { value: '768' } });
    fireEvent.change(screen.getByLabelText('Seed'), { target: { value: '42' } });
    await generate('A lighthouse');
    expect(lastBody()).toEqual({ model: 'black-forest-labs/flux-3-image-klein', prompt: 'A lighthouse', seed: 42, aspect_ratio: '7:5', resolution: '768' });
    expect(screen.getByRole('button', { name: /42/ })).toBeTruthy();

    await pickModel('Recraft V4.1');
    await generate('A poster');
    expect(lastBody()).not.toHaveProperty('seed');
    expect(screen.queryByTitle(/Seed:/)).toBeNull();
  });
});

describe('Conversation restart recovery', () => {
  it('continues a Conversation after the extension host restarts, from the saved transcript', async () => {
    await renderImageTab('google/gemini-3-pro-image');
    await generate('Keep the knight blue');
    expect(lastUrl()).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(storage.files.size).toBe(1);

    // A new host (new orchestrator, empty memory) over the same global storage.
    startHost();
    const refine = screen.getByPlaceholderText('Continue the conversation...');
    fireEvent.change(refine, { target: { value: 'Add a tree' } });
    fireEvent.keyDown(refine, { key: 'Enter' });
    await waitFor(() => expect(providerCalls()).toHaveLength(2));
    const body = lastBody();
    expect(body.messages).toHaveLength(3);
    expect(body.messages[1]).toEqual(signedAssistant);
    expect(body.messages[2].content[0]).toEqual({ type: 'text', text: 'Add a tree' });
    await waitFor(() => expect(screen.getAllByText('Add a tree').length).toBeGreaterThan(0));
  });

  it('says so, without a provider call, when the transcript is gone', async () => {
    await renderImageTab('google/gemini-3-pro-image');
    await generate('Keep the knight blue');
    storage.files.clear();
    startHost();
    const refine = screen.getByPlaceholderText('Continue the conversation...');
    fireEvent.change(refine, { target: { value: 'Add a tree' } });
    fireEvent.keyDown(refine, { key: 'Enter' });
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('transcript is unavailable'));
    expect(providerCalls()).toHaveLength(1);
  });

  it('releases the old thread’s transcript when Generate starts a new one', async () => {
    await renderImageTab('google/gemini-3-pro-image');
    await generate('Keep the knight blue');
    const [file] = [...storage.files.keys()];
    await generate('A different knight');
    await waitFor(() => expect(JSON.parse(Buffer.from(storage.files.get(file)!).toString('utf8'))).toEqual({ version: 1, deleted: true }));
  });
});
