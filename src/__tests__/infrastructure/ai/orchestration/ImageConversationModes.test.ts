/**
 * Conversation and Single Shot through the real orchestrator, client and
 * transcript store (fetch and storage mocked): what each mode sends, restart
 * recovery, and every refusal happening before a provider call.
 *
 * Ported from frame-minion@40e7949
 * packages/core/src/__tests__/infrastructure/ai/orchestration/ImageConversationModes.test.ts.
 * Pixel deltas: the store writes through an in-memory GlobalStorage; Muse's
 * case uses a GPT-5 conversational route (Muse has no route on 2026-11-12);
 * the project-frame case keeps only its mode-less compatibility half.
 */
import { ImageOrchestrator } from '../../../../infrastructure/ai/orchestration/ImageOrchestrator';
import { FileImageConversationStore, MAX_IMAGE_TRANSCRIPT_BYTES } from '../../../../infrastructure/ai/orchestration/ImageConversationStore';
import { OpenRouterImageClient } from '../../../../infrastructure/ai/clients/OpenRouterImageClient';
import { memoryGlobalStorage } from '../../../helpers/memoryGlobalStorage';
import type { LoggingService } from '@logging';
import type { SecretStorageService } from '@secrets';

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as LoggingService;
const secrets = { getApiKey: async () => 'test', hasApiKey: async () => true } as unknown as SecretStorageService;
const model = 'google/gemini-3-pro-image';
const image = 'data:image/png;base64,QUJD';
const signedAssistant = {
  role: 'assistant', content: [{ type: 'text', text: 'The knight remains blue.' }],
  images: [{ image_url: { url: image }, thought_signature: 'opaque-image-signature' }],
  reasoning_details: [{ type: 'reasoning.encrypted', data: 'opaque-reasoning', index: 0 }],
  provider_extra: { preserve: true },
};
const options = { mode: 'conversation' as const, model, aspectRatio: '16:9', resolution: '4K' };
/** What a Single Shot follow-up hands back: the latest turn's images. */
const latestImages = [{ data: image, seed: 12 }];
/** A Conversation follow-up's thread settings, as the webview sends them. */
const restoredThread = { mode: 'conversation' as const, model, aspectRatio: '16:9', resolution: '4K' };

function harness() {
  const { files, storage } = memoryGlobalStorage();
  const store = new FileImageConversationStore(storage);
  const create = () => {
    const orchestrator = new ImageOrchestrator(logger, store);
    orchestrator.setClient(new OpenRouterImageClient(secrets, logger));
    return orchestrator;
  };
  return { files, storage, store, create };
}

const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
  mockFetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: signedAssistant }] }) });
});
const body = (index: number) => JSON.parse(mockFetch.mock.calls[index][1].body);
const imagesApi = () => mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [{ b64_json: 'QUJD', media_type: 'image/png' }] }) });

it('replays the full signed conversation, including original references and SVG exactly once, after a host restart', async () => {
  const { create, files } = harness();
  const first = create();
  const result = await first.generateImage('Keep the knight blue', { ...options, seed: 12, referenceImages: [image], referenceSvgText: '<svg />' });
  expect(body(0).image_config).toEqual({ aspect_ratio: '16:9', image_size: '4K' });
  expect(body(0).modalities).toEqual(['image', 'text']);
  expect(files.size).toBe(1);
  expect([...files.keys()][0]).toMatch(/^image-conversations\/img-[a-zA-Z0-9-]+\.json$/);

  const restored = create();
  const next = await restored.continueConversation(result.conversationId, 'Add a tree', { mode: 'conversation', turnCount: 1, model, aspectRatio: '16:9', resolution: '4K' });
  expect(next.turnNumber).toBe(2);
  expect(body(1).messages).toHaveLength(3);
  expect(body(1).messages[0]).toEqual(body(0).messages[0]);
  // The first turn's raster reference survives the restart (display history never had it).
  expect(body(1).messages[0].content[1]).toEqual({ type: 'image_url', image_url: { url: image } });
  expect(body(1).messages[0].content[0].text).toBe('Keep the knight blue\n\nReference SVG:\n<svg />');
  expect(body(1).messages[1]).toEqual(signedAssistant);
  expect(body(1).messages[2].content).toEqual([{ type: 'text', text: 'Add a tree' }, { type: 'image_url', image_url: { url: image } }]);
  expect(body(1)).not.toHaveProperty('input_references');
  expect(next.settings).toEqual(options);
});

it('keeps GPT-5 conversational and Single Shot semantics distinct for the same model', async () => {
  const { create } = harness();
  const orchestrator = create();
  const first = await orchestrator.generateImage('Keep the knight blue', { mode: 'conversation', model: 'openai/gpt-5-image', aspectRatio: '1:1' });
  await orchestrator.continueConversation(first.conversationId, 'Add a tree', { mode: 'conversation', turnCount: 1 });
  expect(mockFetch.mock.calls[1][0]).toMatch(/\/chat\/completions$/);
  expect(body(1).messages).toHaveLength(3);
  expect(body(1).messages[1]).toEqual(signedAssistant);
  expect(body(1).image_config).toEqual({ aspect_ratio: '1:1' });

  imagesApi();
  const edit = await orchestrator.generateImage('Keep the knight blue', { mode: 'edit', model: 'openai/gpt-5-image', aspectRatio: '1:1' });
  await orchestrator.continueConversation(edit.conversationId, 'Add a tree', { mode: 'edit', turnCount: 1 });
  expect(mockFetch.mock.calls[3][0]).toMatch(/\/images$/);
  expect(body(3).prompt).toBe('Add a tree');
  expect(body(3).input_references).toEqual([{ type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } }]);
  expect(edit.result.seedSupported).toBe(false);
});

it('retains the unsigned Gemini workaround while keeping earlier textual instructions', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'A blue knight', images: [{ image_url: { url: image } }] } }] }) });
  const orchestrator = harness().create();
  const first = await orchestrator.generateImage('Keep the knight blue', options);
  await orchestrator.continueConversation(first.conversationId, 'Add a tree', { mode: 'conversation', turnCount: 1 });
  expect(body(1).messages[0].content[0].text).toBe('Keep the knight blue');
  expect(body(1).messages[1]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'A blue knight' }] });
  expect(body(1).messages[2].content[1].image_url.url).toBe(image);
});

it('keeps Single Shot follow-ups to the latest result and prompt, including after restart', async () => {
  imagesApi();
  const { create, files } = harness();
  const first = await create().generateImage('Keep the knight blue', { ...options, mode: 'edit', resolution: 'auto' });
  // Single Shot threads have no transcript.
  expect(files.size).toBe(0);
  const restarted = create();
  const next = await restarted.continueConversation(first.conversationId, 'Add a tree', { mode: 'edit', turnCount: 1, latestImages, model, aspectRatio: '16:9', resolution: 'auto' });
  expect(next.turnNumber).toBe(2);
  expect(body(1).prompt).toBe('Add a tree');
  expect(body(1).input_references).toEqual([{ type: 'image_url', image_url: { url: image } }]);
  expect(body(1)).not.toHaveProperty('messages');
  expect(files.size).toBe(0);
  // The restarted thread numbers on from the visible turn count and keeps no messages.
  expect(restarted.getConversation(first.conversationId)).toMatchObject({ turnNumber: 2, messages: [] });
});

it('keeps only the latest images in a Single Shot thread, however many turns it has', async () => {
  const outputs = ['QUJD', 'REVG', 'R0hJ'];
  for (const b64 of outputs) mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ b64_json: b64, media_type: 'image/png' }] }) });
  const orchestrator = harness().create();
  const first = await orchestrator.generateImage('A knight', { mode: 'edit', model, aspectRatio: '16:9' });
  await orchestrator.continueConversation(first.conversationId, 'Add a tree', { mode: 'edit', turnCount: 1 });
  const third = await orchestrator.continueConversation(first.conversationId, 'Add a moon', { mode: 'edit', turnCount: 2 });
  expect(third.turnNumber).toBe(3);
  // Each follow-up sends only the previous turn's image.
  expect(body(2).input_references).toEqual([{ type: 'image_url', image_url: { url: 'data:image/png;base64,REVG' } }]);
  // The host keeps no earlier turns: only what the next follow-up will send.
  expect(orchestrator.getConversation(first.conversationId)).toMatchObject({ messages: [], lastImages: ['data:image/png;base64,R0hJ'] });
});

it('cannot restart a Single Shot thread without its latest images or a turn count', async () => {
  const orchestrator = harness().create();
  const thread = { mode: 'edit' as const, model, aspectRatio: '16:9', resolution: 'auto' };
  await expect(orchestrator.continueConversation('img-lost', 'Add a tree', { ...thread, turnCount: 1 })).rejects.toThrow('unavailable');
  await expect(orchestrator.continueConversation('img-lost', 'Add a tree', { ...thread, turnCount: 0, latestImages })).rejects.toThrow('unavailable');
  expect(mockFetch).not.toHaveBeenCalled();
});

it('rejects unsupported routes, ratios, resolutions and thread-setting changes before another provider call', async () => {
  const orchestrator = harness().create();
  await expect(orchestrator.generateImage('A tree', { ...options, model: 'openai/gpt-image-2.5-flare' })).rejects.toThrow('Conversation route');
  await expect(orchestrator.generateImage('A tree', { ...options, aspectRatio: 'auto' })).rejects.toThrow('Aspect ratio');
  await expect(orchestrator.generateImage('A tree', { ...options, model: 'openai/gpt-5-image', aspectRatio: '1:1' })).rejects.toThrow('Resolution');
  await expect(orchestrator.generateImage('A tree', { mode: 'edit', model: 'krea/k3-edit', aspectRatio: '1:1' })).rejects.toThrow('reference images');
  await expect(orchestrator.generateImage('A tree', { mode: 'edit', model: 'recraft/recraft-v4.1-flash', aspectRatio: '1:1', referenceImages: [image] })).rejects.toThrow('reference images');
  expect(mockFetch).not.toHaveBeenCalled();
  const first = await orchestrator.generateImage('A tree', options);
  await expect(orchestrator.continueConversation(first.conversationId, 'Change mode', { mode: 'edit', turnCount: 1 })).rejects.toThrow('settings cannot change');
  await expect(orchestrator.continueConversation(first.conversationId, 'Change ratio', { mode: 'conversation', turnCount: 1, model, aspectRatio: '1:1', resolution: '4K' })).rejects.toThrow('settings cannot change');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it.each([
  ['mode', { mode: 'edit' as const }],
  ['model', { model: 'google/gemini-3.1-flash-image' }],
  ['aspect ratio', { aspectRatio: '1:1' }],
  ['resolution', { resolution: '2K' }],
  ['resolution (to Auto)', { resolution: 'auto' }],
])('refuses a turn that names an existing thread with another %s, before the provider', async (_setting, change) => {
  // A new-image request can name a thread directly, so generateImage itself
  // must hold the thread's settings, not only continueConversation.
  const orchestrator = harness().create();
  const first = await orchestrator.generateImage('A tree', options);
  const before = JSON.stringify(orchestrator.getConversation(first.conversationId));
  await expect(orchestrator.generateImage('Change it', { ...options, ...change }, first.conversationId)).rejects.toThrow('settings cannot change');
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(orchestrator.getConversation(first.conversationId))).toBe(before);
  // The same settings continue the thread.
  await expect(orchestrator.generateImage('Keep going', options, first.conversationId)).resolves.toMatchObject({ turnNumber: 2 });
});

it('refuses a Single Shot follow-up on a text-only model before the provider sees the previous image', async () => {
  imagesApi();
  const orchestrator = harness().create();
  const first = await orchestrator.generateImage('A poster', { mode: 'edit', model: 'recraft/recraft-v4.1-flash', aspectRatio: 'auto' });
  expect(body(0)).not.toHaveProperty('input_references');
  await expect(orchestrator.continueConversation(first.conversationId, 'Make it red', { mode: 'edit', turnCount: 1 }))
    .rejects.toThrow('accepts 0 reference images; received 1');
  expect(mockFetch).toHaveBeenCalledTimes(1);
  // The refused turn left the thread as it was (a Single Shot thread keeps only its latest images).
  expect(orchestrator.getConversation(first.conversationId)).toMatchObject({ turnNumber: 1, messages: [] });
});

it('rolls back failed turns so retries do not replay failed user messages', async () => {
  const orchestrator = harness().create();
  const first = await orchestrator.generateImage('Keep the knight blue', options);
  mockFetch.mockRejectedValueOnce(new Error('network unavailable'));
  await expect(orchestrator.continueConversation(first.conversationId, 'Failed prompt', { mode: 'conversation', turnCount: 1 })).rejects.toThrow('network unavailable');
  const next = await orchestrator.continueConversation(first.conversationId, 'Actual retry', { mode: 'conversation', turnCount: 1 });
  expect(body(2).messages).toHaveLength(3);
  expect(JSON.stringify(body(2))).not.toContain('Failed prompt');
  expect(next.turnNumber).toBe(2);
});

it('never reconstructs conversational signatures from visible history when the transcript is missing or stale', async () => {
  const { create } = harness();
  await expect(create().continueConversation('img-missing', 'Continue', { ...restoredThread, turnCount: 1 })).rejects.toThrow('transcript is unavailable');
  expect(mockFetch).not.toHaveBeenCalled();
  const first = await create().generateImage('Keep the knight blue', options);
  // The visible thread shows fewer or more turns than the saved transcript holds.
  await expect(create().continueConversation(first.conversationId, 'Continue', { ...restoredThread, turnCount: 0 })).rejects.toThrow('visible history differ');
  await expect(create().continueConversation(first.conversationId, 'Continue', { ...restoredThread, turnCount: 2 })).rejects.toThrow('visible history differ');
  // A transcript for other thread settings is refused, not silently retargeted.
  await expect(create().continueConversation(first.conversationId, 'Continue', { ...restoredThread, turnCount: 1, aspectRatio: '1:1' })).rejects.toThrow('settings cannot change');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('reports recovery-write failures without discarding a generated image', async () => {
  const { create, storage } = harness();
  storage.write.mockRejectedValueOnce(new Error('disk full'));
  const result = await create().generateImage('A tree', options);
  expect(result.result.images[0].data).toBe(image);
  expect(result.recoveryWarning).toContain('could not be saved');
});

it('clears persisted transcripts and blocks traversal and corrupt records', async () => {
  const { create, store, files } = harness();
  const orchestrator = create();
  const first = await orchestrator.generateImage('A tree', options);
  // Another workspace's store is built on its own storage folder (workspaceStorageRoot).
  expect(await new FileImageConversationStore(memoryGlobalStorage().storage).read(first.conversationId)).toBeUndefined();
  await expect(store.read('img-../../escape')).rejects.toThrow('identifier');
  const file = [...files.keys()][0];
  const saved = files.get(file)!;
  files.set(file, Buffer.from('{broken'));
  await expect(store.read(first.conversationId)).rejects.toThrow('Saved image conversation is invalid.');
  files.set(file, saved);
  await orchestrator.clearConversation(first.conversationId);
  expect(JSON.parse(Buffer.from(files.get(file)!).toString('utf8'))).toEqual({ version: 1, deleted: true });
  expect(await store.read(first.conversationId)).toBeUndefined();
  expect(orchestrator.getConversation(first.conversationId)).toBeUndefined();
  // After the tombstone, a restarted host can't resume it.
  await expect(create().continueConversation(first.conversationId, 'Continue', { ...restoredThread, turnCount: 1 })).rejects.toThrow('transcript is unavailable');
});

it('refuses a transcript over the 64 MiB recovery limit, on read and on write', async () => {
  const { create, store, storage, files } = harness();
  const first = await create().generateImage('A tree', options);
  const file = [...files.keys()][0];
  storage.size.mockResolvedValueOnce(MAX_IMAGE_TRANSCRIPT_BYTES + 1);
  await expect(store.read(first.conversationId)).rejects.toThrow('too large to recover after a restart');
  expect(storage.read).not.toHaveBeenCalledWith(file);
  const huge = `data:image/png;base64,${'A'.repeat(MAX_IMAGE_TRANSCRIPT_BYTES)}`;
  const result = await create().generateImage('A tree', { ...options, referenceImages: [huge] });
  expect(result.recoveryWarning).toContain('too large to recover after a restart');
});

it('retires a thread whose turn crosses the recovery limit, and says so now and after a restart', async () => {
  const { files, storage } = memoryGlobalStorage();
  const store = new FileImageConversationStore(storage, 4096);
  const create = () => {
    const orchestrator = new ImageOrchestrator(logger, store);
    orchestrator.setClient(new OpenRouterImageClient(secrets, logger));
    return orchestrator;
  };
  const orchestrator = create();
  const first = await orchestrator.generateImage('Keep the knight blue', options);
  expect(first.recoveryWarning).toBeUndefined();

  // The second turn's (larger) image takes the transcript past the limit.
  const big = `data:image/png;base64,${'A'.repeat(4096)}`;
  const bigAssistant = { ...signedAssistant, images: [{ image_url: { url: big }, thought_signature: 'opaque-image-signature' }] };
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: bigAssistant }] }) });
  const second = await orchestrator.continueConversation(first.conversationId, 'Use this texture', { ...restoredThread, turnCount: 1 });
  expect(second.result.images).toHaveLength(1);
  expect(second.recoveryWarning).toBe('This conversation is now too large to recover after a restart. It continues while VS Code stays open; to keep restart recovery, start a new conversation from an image.');
  // The stale one-turn record is gone, so a restart can't resume the thread from it.
  expect(JSON.parse(Buffer.from([...files.values()][0]).toString('utf8'))).toEqual({ version: 1, deleted: true, reason: 'too-large' });

  // The thread goes on in this session; each turn repeats the warning.
  const third = await orchestrator.continueConversation(first.conversationId, 'Brighter', { mode: 'conversation', turnCount: 2 });
  expect(third.turnNumber).toBe(3);
  expect(third.recoveryWarning).toContain('too large to recover');

  // After a restart the follow-up is refused with the same guidance, before any provider call.
  const calls = mockFetch.mock.calls.length;
  await expect(create().continueConversation(first.conversationId, 'Continue', { ...restoredThread, turnCount: 3 }))
    .rejects.toThrow('This conversation is too large to recover after a restart. Start a new conversation from an image.');
  expect(mockFetch).toHaveBeenCalledTimes(calls);
});

it('allows only one provider request for concurrent continuations of a restored thread', async () => {
  const { create } = harness();
  const first = await create().generateImage('Keep the knight blue', options);
  const restored = create();
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  mockFetch.mockImplementationOnce(async () => { await blocked; return { ok: true, json: async () => ({ choices: [{ message: signedAssistant }] }) }; });
  const next = restored.continueConversation(first.conversationId, 'First follow-up', { ...restoredThread, turnCount: 1 });
  const duplicate = restored.continueConversation(first.conversationId, 'Duplicate follow-up', { ...restoredThread, turnCount: 1 });
  await expect(duplicate).rejects.toThrow('already generating');
  await expect(restored.clearConversation(first.conversationId)).rejects.toThrow('Wait for');
  release();
  expect((await next).turnNumber).toBe(2);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(restored.getConversation(first.conversationId)?.messages).toHaveLength(4);
});

it('refuses an id it does not hold in either mode, and skips writes without a transcript', async () => {
  imagesApi();
  const { create, storage } = harness();
  const orchestrator = create();
  // Only the host creates thread ids: an unseen one is never adopted.
  await expect(orchestrator.generateImage('A frame', { mode: 'edit', model, aspectRatio: '9:16' }, 'legacy-id')).rejects.toThrow('unavailable');
  await expect(orchestrator.generateImage('A frame', options, 'img-unseen')).rejects.toThrow('unavailable');
  expect(mockFetch).not.toHaveBeenCalled();
  const result = await orchestrator.generateImage('A frame', { mode: 'edit', model, aspectRatio: '9:16' });
  expect(result.conversationId).toMatch(/^img-/);
  await orchestrator.clearConversation('legacy-id');
  await orchestrator.clearConversation(result.conversationId);
  expect(orchestrator.getConversation(result.conversationId)).toBeUndefined();
  // Unknown after a restart, but nothing is saved for it: no tombstone is written.
  await orchestrator.clearConversation('img-unseen');
  expect(storage.write).not.toHaveBeenCalled();
});

it('refuses a request without a known mode before the provider: no unchecked ratio, tier or made-up id', async () => {
  imagesApi();
  const orchestrator = harness().create();
  // P3 host review H3: this once reached /images with a ratio and tier Krea 2 doesn't list.
  const unchecked = { model: 'krea/krea-2-medium-turbo', aspectRatio: '21:9', resolution: '4K' };
  await expect(orchestrator.generateImage('x', unchecked as never, 'img-made-up')).rejects.toThrow();
  await expect(orchestrator.generateImage('x', unchecked as never)).rejects.toThrow('Unknown image generation mode');
  await expect(orchestrator.generateImage('x', { ...unchecked, mode: 'chat' } as never)).rejects.toThrow('Unknown image generation mode');
  expect(mockFetch).not.toHaveBeenCalled();
});

it('keeps a cleared transcript cleared even if another orchestrator was generating it (defence behind the shared orchestrator)', async () => {
  const { create, files } = harness();
  const a = create();
  const first = await a.generateImage('A knight', options);
  let release!: () => void;
  mockFetch.mockImplementationOnce(async () => { await new Promise<void>(resolve => { release = resolve; }); return { ok: true, json: async () => ({ choices: [{ message: signedAssistant }] }) }; });
  const late = a.continueConversation(first.conversationId, 'Add a tree', { mode: 'conversation', turnCount: 1 });
  await new Promise(resolve => setImmediate(resolve));
  // A second orchestrator over the same store (the P3 review H1 repro) clears it meanwhile.
  await create().clearConversation(first.conversationId);
  release();
  const result = await late;
  expect(result.recoveryWarning).toContain('could not be saved');
  expect(JSON.parse(Buffer.from([...files.values()][0]).toString('utf8'))).toEqual({ version: 1, deleted: true });
  await expect(create().continueConversation(first.conversationId, 'Again', { ...restoredThread, turnCount: 2 })).rejects.toThrow('transcript is unavailable');
});

it('tombstones the saved record of a thread a restarted host has never seen', async () => {
  const { create, files } = harness();
  const first = await create().generateImage('A tree', options);
  const file = [...files.keys()][0];
  // Unknown after a restart: could be a Conversation, so its record is retired (Frame R-4).
  await create().clearConversation(first.conversationId);
  expect(JSON.parse(Buffer.from(files.get(file)!).toString('utf8'))).toEqual({ version: 1, deleted: true });
});

it.each(['{broken', 'null', '[]', '123', '{"version":1,"state":{"id":"img-x","mode":"edit"}}'])('gives the recovery guidance for corrupt JSON %s', async content => {
  const { create, store, files } = harness();
  const result = await create().generateImage('A tree', options);
  files.set([...files.keys()][0], Buffer.from(content));
  await expect(store.read(result.conversationId)).rejects.toThrow('Saved image conversation is invalid. Start a new conversation from an image.');
});

it('removes the in-memory thread when its first provider turn fails', async () => {
  const orchestrator = harness().create();
  mockFetch.mockRejectedValueOnce(new Error('offline'));
  await expect(orchestrator.generateImage('A tree', options)).rejects.toThrow('offline');
  const created = (logger.debug as jest.Mock).mock.calls.find(([message]) => String(message).startsWith('Created image conversation:'))![0];
  expect(orchestrator.getConversation(created.split(': ')[1])).toBeUndefined();
});
