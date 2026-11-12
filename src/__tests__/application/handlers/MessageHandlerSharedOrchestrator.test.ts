/**
 * A re-resolved view gets a new MessageHandler but not a new image
 * orchestrator (extension.ts builds one per extension). These cases run two
 * handlers over one orchestrator and one transcript store, the way a view
 * that was closed and reopened does, and check that the one-request-per-thread
 * lock and the thread map hold across them (P3 host review H1).
 *
 * Real handlers, orchestrator, client and store; fetch and storage mocked.
 */
import { MessageHandler } from '../../../application/handlers/MessageHandler';
import { ImageOrchestrator } from '../../../infrastructure/ai/orchestration/ImageOrchestrator';
import { FileImageConversationStore } from '../../../infrastructure/ai/orchestration/ImageConversationStore';
import { OpenRouterImageClient } from '../../../infrastructure/ai/clients/OpenRouterImageClient';
import { MessageEnvelope, MessageType, createEnvelope } from '@messages';
import { memoryGlobalStorage } from '../../helpers/memoryGlobalStorage';

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const secrets = { getApiKey: jest.fn(async () => 'test-key'), hasApiKey: jest.fn(async () => true) };
const balances = { scheduleRefresh: jest.fn(), addRefreshListener: jest.fn(() => () => undefined) };
const image = 'data:image/png;base64,QUJD';
const assistant = { role: 'assistant', content: [{ type: 'text', text: 'ok' }], images: [{ image_url: { url: image } }] };
const chatOk = () => ({ ok: true, json: async () => ({ choices: [{ message: assistant }] }) });
const thread = { mode: 'conversation', model: 'openai/gpt-5-image', aspectRatio: '1:1', resolution: 'auto' } as const;

const mockFetch = jest.fn();
let storage: ReturnType<typeof memoryGlobalStorage>;
let orchestrator: ImageOrchestrator;

/** A view's handler: what it posts, and how to send it a request. */
function view() {
  const posted: MessageEnvelope[] = [];
  const handler = new MessageHandler(message => { posted.push(message); }, secrets as never, logger as never, balances as never, orchestrator);
  const send = async (type: MessageType, payload: object) => {
    const message = createEnvelope(type, 'webview.imageGeneration', payload, `image-${Math.random()}`);
    await handler.handleMessage(message);
    return posted.filter(reply => reply.correlationId === message.correlationId && reply.type !== MessageType.STATUS);
  };
  return { handler, posted, send };
}
const record = () => JSON.parse(Buffer.from([...storage.files.values()][0]).toString('utf8'));

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockReset().mockImplementation(async () => chatOk());
  storage = memoryGlobalStorage();
  orchestrator = new ImageOrchestrator(logger as never, new FileImageConversationStore(storage.storage));
  orchestrator.setClient(new OpenRouterImageClient(secrets as never, logger as never));
});

it('refuses a clear from a re-resolved view while the old view’s turn is generating, so the transcript is not resurrected', async () => {
  const a = view();
  const [first] = await a.send(MessageType.IMAGE_GENERATION_REQUEST, { ...thread, prompt: 'A knight' });
  const { conversationId } = first.payload as { conversationId: string };

  let release!: () => void;
  mockFetch.mockImplementationOnce(async () => { await new Promise<void>(resolve => { release = resolve; }); return chatOk(); });
  const generating = a.send(MessageType.IMAGE_GENERATION_CONTINUE, { ...thread, prompt: 'Add a tree', conversationId, turnCount: 1 });
  await new Promise(resolve => setImmediate(resolve));

  // The view is closed and reopened: a new handler over the same orchestrator.
  a.handler.dispose();
  const b = view();
  const refused = await b.send(MessageType.IMAGE_GENERATION_CLEAR, { conversationId });
  expect(refused).toEqual([expect.objectContaining({
    type: MessageType.ERROR,
    payload: expect.objectContaining({ code: 'IMAGE_CLEAR_ERROR', message: expect.stringContaining('Wait for image generation') }),
  })]);
  expect(record().deleted).toBeUndefined();

  release();
  const [answer] = await generating;
  expect(answer.type).toBe(MessageType.IMAGE_GENERATION_RESPONSE);
  expect(record().state.turnNumber).toBe(2);

  // Once the turn is over the new view can clear it, and the tombstone holds.
  expect(await b.send(MessageType.IMAGE_GENERATION_CLEAR, { conversationId })).toEqual([]);
  expect(record()).toEqual({ version: 1, deleted: true });
});

it('lets a re-resolved view continue the old view’s threads from memory, and still allows only one request per thread', async () => {
  const a = view();
  const [first] = await a.send(MessageType.IMAGE_GENERATION_REQUEST, { ...thread, prompt: 'A knight' });
  const { conversationId } = first.payload as { conversationId: string };
  const b = view();

  let release!: () => void;
  mockFetch.mockImplementationOnce(async () => { await new Promise<void>(resolve => { release = resolve; }); return chatOk(); });
  const fromA = a.send(MessageType.IMAGE_GENERATION_CONTINUE, { ...thread, prompt: 'Add a tree', conversationId, turnCount: 1 });
  await new Promise(resolve => setImmediate(resolve));
  const fromB = await b.send(MessageType.IMAGE_GENERATION_CONTINUE, { ...thread, prompt: 'Add a moon', conversationId, turnCount: 1 });
  expect(fromB).toEqual([expect.objectContaining({ type: MessageType.ERROR, payload: expect.objectContaining({ message: expect.stringContaining('already generating') }) })]);
  release();
  await fromA;

  const [next] = await b.send(MessageType.IMAGE_GENERATION_CONTINUE, {
    ...thread, prompt: 'Add a moon', conversationId, turnCount: 2,
  });
  expect(next.payload).toMatchObject({ conversationId, turnNumber: 3 });
  // The whole transcript came from memory, not a store read.
  expect(JSON.parse(mockFetch.mock.calls[2][1].body).messages).toHaveLength(5);
  expect(storage.storage.read).not.toHaveBeenCalled();
});
