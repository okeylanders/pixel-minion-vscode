/**
 * The shapes OpenRouter actually sent and accepted in the paid P3
 * qualification (provider-contracts/openrouter-image-live-2026-11-12.json),
 * replayed through the real client, orchestrator and transcript store with
 * stand-in bytes. If a refactor changes a request body away from what the
 * provider accepted, or stops accepting a response shape it returned, these
 * fail.
 */
import { ImageOrchestrator } from '../../../../infrastructure/ai/orchestration/ImageOrchestrator';
import { FileImageConversationStore } from '../../../../infrastructure/ai/orchestration/ImageConversationStore';
import { OpenRouterImageClient } from '../../../../infrastructure/ai/clients/OpenRouterImageClient';
import type { LoggingService } from '@logging';
import type { SecretStorageService } from '@secrets';
import live from '../../../fixtures/provider-contracts/openrouter-image-live-2026-11-12.json';
import { memoryGlobalStorage } from '../../../helpers/memoryGlobalStorage';

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as LoggingService;
const secrets = { getApiKey: async () => 'test', hasApiKey: async () => true } as unknown as SecretStorageService;
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const call = (prefix: string) => {
  const found = live.calls.find(entry => entry.step.startsWith(prefix));
  if (!found) throw new Error(`no live call ${prefix}`);
  return found as unknown as { url: string; status: number; request: Record<string, unknown>; response: unknown };
};
/** Replace fixture placeholders (`<…>`, truncated data URLs) so shapes compare. */
const shape = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (_key, v) => {
  if (typeof v === 'string' && (v.startsWith('data:image/') || /^<.*>$/.test(v))) return '<placeholder>';
  if (typeof v === 'number' && _key === 'seed') return '<placeholder>';
  return v;
}));

const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
  mockFetch.mockReset();
});
const body = (index: number) => JSON.parse(mockFetch.mock.calls[index][1].body);

interface RecordedImages { created?: number; data: Array<{ media_type: string }>; usage?: unknown }
interface RecordedChatMessage {
  role: string; content: unknown; refusal: unknown; reasoning: unknown;
  reasoning_details: Array<{ type: string }>; images: unknown[];
}
interface RecordedChat { choices: Array<{ message: RecordedChatMessage } & Record<string, unknown>> }

/** The recorded response, with stand-in bytes where the fixture holds metadata. */
function imagesResponse(response: unknown) {
  const recorded = response as RecordedImages;
  return {
    ok: true,
    json: async () => ({
      created: recorded.created,
      data: recorded.data.map(item => ({ b64_json: PNG_1PX, media_type: item.media_type })),
      usage: recorded.usage,
    }),
  };
}
function chatResponse(response: unknown) {
  const recorded = response as RecordedChat;
  const message = recorded.choices[0].message;
  return {
    ok: true,
    json: async () => ({
      ...recorded,
      choices: [{
        ...recorded.choices[0],
        message: {
          role: message.role, content: message.content, refusal: message.refusal, reasoning: message.reasoning,
          reasoning_details: message.reasoning_details.map(({ type }) => ({ type, data: '<opaque>', format: 'openai-responses-v1', id: '<reasoning item>', index: 0 })),
          images: message.images.map(() => ({ type: 'image_url', image_url: { url: `data:image/png;base64,${PNG_1PX}` } })),
        },
      }],
    }),
  };
}

it('recorded every qualification call (OpenAI reached a provider; the BYOK-blocked ones stopped at routing)', () => {
  const statuses = Object.fromEntries(live.calls.map(entry => [entry.step.split(':')[0], entry.status]));
  expect(statuses).toEqual({ A: 404, D: 404, F: 404, H: 200, I1: 200, I2: 200, K: 404, J1: 200, J2: 200 });
  expect(live.totalUpstreamCostUsd).toBeLessThan(0.4);
});

it('sends a Single Shot text-to-image and its follow-up exactly as OpenRouter accepted them', async () => {
  const first = call('I1');
  const followUp = call('I2');
  mockFetch.mockResolvedValueOnce(imagesResponse(first.response)).mockResolvedValueOnce(imagesResponse(followUp.response));
  const orchestrator = new ImageOrchestrator(logger);
  orchestrator.setClient(new OpenRouterImageClient(secrets, logger));

  const turn = await orchestrator.generateImage(first.request.prompt as string, { mode: 'edit', model: 'openai/gpt-image-1-mini', aspectRatio: 'auto' });
  await orchestrator.continueConversation(turn.conversationId, followUp.request.prompt as string, undefined, undefined, undefined, undefined, undefined, 'edit');

  expect(mockFetch.mock.calls[0][0]).toBe(first.url);
  expect(shape(body(0))).toEqual(shape(first.request));
  expect(shape(body(1))).toEqual(shape(followUp.request));
  // BYOK: OpenRouter bills nothing, so the turn's cost reads 0.
  expect(turn.usage).toEqual({ promptTokens: 16, completionTokens: 1568, totalTokens: 1584, costUsd: 0 });
  expect(turn.result.seedSupported).toBe(false);
});

it('replays a GPT-5 Conversation from its transcript after a restart in the shape OpenRouter accepted', async () => {
  const first = call('J1');
  const second = call('J2');
  mockFetch.mockResolvedValueOnce(chatResponse(first.response)).mockResolvedValueOnce(chatResponse(second.response));
  const { storage } = memoryGlobalStorage();
  const store = new FileImageConversationStore(storage, ['file:///project']);
  const make = () => {
    const orchestrator = new ImageOrchestrator(logger, store);
    orchestrator.setClient(new OpenRouterImageClient(secrets, logger));
    return orchestrator;
  };
  const turn = await make().generateImage('A blue knight on a white background, simple flat style', { mode: 'conversation', model: 'openai/gpt-5-image-mini', aspectRatio: '3:2' });
  await make().continueConversation(turn.conversationId, 'Now give the knight a red shield', [{ prompt: 'x', images: [] }],
    'openai/gpt-5-image-mini', '3:2', 'auto', undefined, 'conversation');

  expect(shape(body(0))).toEqual(shape(first.request));
  // The assistant turn comes back whole: content null, refusal, reasoning and
  // the encrypted reasoning item, exactly the fields the provider returned.
  expect(shape(body(1))).toEqual(shape(second.request));
});

it('stops at the BYOK routing refusal without a second call', async () => {
  const blocked = call('A');
  mockFetch.mockResolvedValue({ ok: false, status: blocked.status, statusText: 'Not Found', text: async () => JSON.stringify(blocked.response) });
  const orchestrator = new ImageOrchestrator(logger);
  orchestrator.setClient(new OpenRouterImageClient(secrets, logger));
  await expect(orchestrator.generateImage(blocked.request.prompt as string, { mode: 'edit', model: 'black-forest-labs/flux-3-image-klein', aspectRatio: '1:1', resolution: '768', seed: 42 }))
    .rejects.toThrow('OpenRouter image generation error: 404');
  expect(shape(body(0))).toEqual(shape(blocked.request));
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
