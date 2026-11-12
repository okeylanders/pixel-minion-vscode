/**
 * MessageHandler failure containment: a request whose domain handler throws
 * outside its own try (a malformed payload) is still answered with an error
 * carrying the request's id, so the webview can stop that request's spinner.
 *
 * Uses the real domain handlers, unlike MessageHandler.test.ts.
 */
import { MessageHandler } from '../../../application/handlers/MessageHandler';
import { ImageOrchestrator } from '../../../infrastructure/ai/orchestration/ImageOrchestrator';
import { MessageEnvelope, MessageType, createEnvelope } from '@messages';

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const secretStorage = {
  getApiKey: jest.fn().mockResolvedValue('test-key'),
  setApiKey: jest.fn(),
  deleteApiKey: jest.fn(),
  hasApiKey: jest.fn().mockResolvedValue(true),
  onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
};
const balanceService = {
  getBalance: jest.fn(),
  invalidate: jest.fn(),
  scheduleRefresh: jest.fn(),
  addRefreshListener: jest.fn(() => jest.fn()),
};

let post: jest.Mock;
let handler: MessageHandler;
const errors = () => post.mock.calls
  .map(([message]) => message as MessageEnvelope)
  .filter((message) => message.type === MessageType.ERROR);

beforeEach(() => {
  jest.clearAllMocks();
  post = jest.fn();
  handler = new MessageHandler(post, secretStorage as never, logger as never, balanceService as never, new ImageOrchestrator(logger as never));
});

describe('MessageHandler failure containment', () => {
  it('answers an enhance request with no prompt with an error for that request', async () => {
    // EnhanceHandler logs `prompt.substring(...)` before its try.
    await handler.handleMessage(createEnvelope(
      MessageType.ENHANCE_PROMPT_REQUEST, 'webview.enhance', { type: 'image' }, 'image-enhance-1'
    ));

    expect(errors()).toHaveLength(1);
    expect(errors()[0]).toMatchObject({
      source: 'extension.router',
      correlationId: 'image-enhance-1',
      payload: { code: 'UNHANDLED_ERROR' },
    });
    expect(logger.error).toHaveBeenCalledWith(
      `Unhandled error while handling ${MessageType.ENHANCE_PROMPT_REQUEST}`, expect.any(TypeError)
    );
  });

  it('answers a generation request with no payload with an error for that request', async () => {
    await handler.handleMessage(createEnvelope(
      MessageType.SVG_GENERATION_REQUEST, 'webview.svgGeneration', undefined, 'svg-generate-1'
    ));

    expect(errors()).toEqual([expect.objectContaining({ correlationId: 'svg-generate-1' })]);
  });

  it('ignores a message that is not an envelope, without throwing', async () => {
    await expect(handler.handleMessage(null as never)).resolves.toBeUndefined();
    await expect(handler.handleMessage('hello' as never)).resolves.toBeUndefined();
    expect(post).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('Ignoring a webview message that is not a message envelope');
  });
});
