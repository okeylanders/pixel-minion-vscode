/**
 * ImageOrchestrator request ownership: a failed turn never reaches the next
 * request, a failed first turn leaves nothing behind, one provider request
 * per conversation, and an attached SVG is sent exactly once.
 *
 * Adapted from frame-minion@40e7949
 * packages/core/src/__tests__/infrastructure/ai/orchestration/ImageConversationModes.test.ts
 * (:120 rollback, :163 concurrency, :203 first turn), without modes or the
 * transcript store. Drives the real OpenRouterImageClient so assertions are
 * about the request body that would reach OpenRouter.
 */
import { ImageOrchestrator } from '../../../../infrastructure/ai/orchestration/ImageOrchestrator';
import { OpenRouterImageClient } from '../../../../infrastructure/ai/clients/OpenRouterImageClient';
import type { LoggingService } from '@logging';
import type { SecretStorageService } from '@secrets';

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as LoggingService;
const secrets = { getApiKey: async () => 'test-key', hasApiKey: async () => true } as unknown as SecretStorageService;
const model = 'google/gemini-3.1-flash-image-preview';
const image = 'data:image/png;base64,QUJD';
const svg = '<svg viewBox="0 0 10 10"><circle r="4"/></svg>';
const assistant = {
  role: 'assistant',
  content: [{ type: 'text', text: 'Here you go' }],
  images: [{ image_url: { url: image }, thought_signature: 'sig' }],
};

const mockFetch = jest.fn();
const okResponse = () => ({ ok: true, json: async () => ({ choices: [{ message: assistant }] }) });
const body = (index: number) => JSON.parse(mockFetch.mock.calls[index][1].body);
const countOf = (haystack: string, needle: string) => haystack.split(needle).length - 1;

function create(): ImageOrchestrator {
  const orchestrator = new ImageOrchestrator(logger);
  orchestrator.setClient(new OpenRouterImageClient(secrets, logger));
  return orchestrator;
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockReset().mockImplementation(async () => okResponse());
});

describe('ImageOrchestrator request ownership', () => {
  it('rolls back a failed turn so the retry does not replay its prompt or seed', async () => {
    const orchestrator = create();
    const first = await orchestrator.generateImage('A blue knight', { model, aspectRatio: '1:1', seed: 7 });
    mockFetch.mockRejectedValueOnce(new Error('network unavailable'));

    await expect(
      orchestrator.continueConversation(first.conversationId, 'Failed prompt')
    ).rejects.toThrow('network unavailable');
    const retry = await orchestrator.continueConversation(first.conversationId, 'Actual retry');

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const retryBody = body(2);
    expect(JSON.stringify(retryBody)).not.toContain('Failed prompt');
    expect(retryBody.messages).toHaveLength(3); // user, assistant, retry
    expect(retryBody.messages[2].content[0].text).toBe('Actual retry');
    expect(retryBody.seed).toBe(7);
    expect(retry.turnNumber).toBe(2);
    expect(orchestrator.getConversation(first.conversationId)?.messages).toHaveLength(4);
  });

  it('removes the in-memory conversation when its first provider turn fails', async () => {
    const orchestrator = create();
    mockFetch.mockRejectedValueOnce(new Error('offline'));

    await expect(orchestrator.generateImage('A tree', { model, aspectRatio: '1:1' })).rejects.toThrow('offline');

    const created = (logger.debug as jest.Mock).mock.calls
      .map(([message]) => String(message))
      .find((message) => message.startsWith('Created image conversation:'))!;
    expect(orchestrator.getConversation(created.split(': ')[1])).toBeUndefined();
  });

  it('keeps a re-hydrated conversation (and its history) when a later turn fails', async () => {
    const orchestrator = create();
    const history = [{ prompt: 'A blue knight', images: [{ data: image, seed: 3 }] }];
    mockFetch.mockRejectedValueOnce(new Error('rate limited'));

    await expect(
      orchestrator.continueConversation('img-restored', 'Add a tree', history, model, '1:1')
    ).rejects.toThrow('rate limited');

    expect(orchestrator.getConversation('img-restored')?.messages).toHaveLength(2);
    expect(orchestrator.getConversation('img-restored')?.lastSeed).toBe(3);
  });

  it('allows only one provider request for concurrent continuations of a conversation', async () => {
    const orchestrator = create();
    const history = [{ prompt: 'A blue knight', images: [{ data: image, seed: 3 }] }];
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    mockFetch.mockImplementationOnce(async () => { await blocked; return okResponse(); });

    const next = orchestrator.continueConversation('img-restored', 'First follow-up', history, model, '1:1');
    const duplicate = orchestrator.continueConversation('img-restored', 'Duplicate follow-up', history, model, '1:1');

    await expect(duplicate).rejects.toThrow('already generating');
    expect(() => orchestrator.clearConversation('img-restored')).toThrow('Wait for image generation');
    release();
    expect((await next).turnNumber).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body(0))).not.toContain('Duplicate follow-up');
    expect(orchestrator.getConversation('img-restored')?.messages).toHaveLength(4);

    orchestrator.clearConversation('img-restored');
    expect(orchestrator.getConversation('img-restored')).toBeUndefined();
  });

  it('sends an attached SVG exactly once, on the turn it was attached to', async () => {
    const orchestrator = create();
    const first = await orchestrator.generateImage('Match this logo', {
      model, aspectRatio: '1:1', referenceSvgText: svg,
    });
    expect(body(0).messages[0].content[0].text).toBe(`Match this logo\n\nReference SVG:\n${svg}`);

    await orchestrator.continueConversation(first.conversationId, 'Make it red');
    const continued = JSON.stringify(body(1));
    expect(countOf(continued, 'Reference SVG:')).toBe(1);
    expect(body(1).messages[2].content[0].text).toBe('Make it red');
  });

  it('replays an attached SVG exactly once after re-hydration', async () => {
    const orchestrator = create();
    const history = [{ prompt: 'Match this logo', images: [{ data: image, seed: 3 }], referenceSvgText: svg }];

    await orchestrator.continueConversation('img-restored', 'Make it red', history, model, '1:1');

    const replayed = JSON.stringify(body(0));
    expect(countOf(replayed, 'Reference SVG:')).toBe(1);
    expect(body(0).messages[0].content[0].text).toBe(`Match this logo\n\nReference SVG:\n${svg}`);
  });
});

describe('ImageOrchestrator rollback after the response was recorded', () => {
  // A result that breaks the client contract (no `images` array) makes the
  // manager throw part-way through recording the turn: after it pushed the
  // assistant message and advanced the turn counter.
  const malformed = { assistantMessage: assistant, images: undefined, seed: 99 };
  const good = { assistantMessage: assistant, images: [{ data: image, mimeType: 'image/png' }], seed: 5 };

  function withClient(results: unknown[]): ImageOrchestrator {
    const orchestrator = new ImageOrchestrator(logger);
    const queue = [...results];
    orchestrator.setClient({
      isConfigured: async () => true,
      generateImages: async () => queue.shift() as never,
    } as never);
    return orchestrator;
  }

  it('restores the turn number, seed and last images of an existing conversation', async () => {
    const orchestrator = withClient([good, malformed]);
    const first = await orchestrator.generateImage('A blue knight', { model, aspectRatio: '1:1', seed: 5 });
    const before = { ...orchestrator.getConversation(first.conversationId)! };

    await expect(orchestrator.continueConversation(first.conversationId, 'Broken turn')).rejects.toThrow();

    const after = orchestrator.getConversation(first.conversationId)!;
    expect(after.messages).toHaveLength(2);
    expect(after.turnNumber).toBe(1);
    expect(after.lastSeed).toBe(before.lastSeed);
    expect(after.lastImages).toEqual([image]);
  });

  it('still releases a first turn that failed after being recorded', async () => {
    const orchestrator = withClient([malformed]);

    await expect(orchestrator.generateImage('A tree', { model, aspectRatio: '1:1' })).rejects.toThrow();

    const created = (logger.debug as jest.Mock).mock.calls
      .map(([message]) => String(message))
      .find((message) => message.startsWith('Created image conversation:'))!;
    expect(orchestrator.getConversation(created.split(': ')[1])).toBeUndefined();
  });
});
