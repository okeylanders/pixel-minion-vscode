/**
 * ImageGenerationHandler routing: a request must name a known mode, or it is
 * answered with an error for that request before the orchestrator (and so a
 * provider) sees it (P3 host review H3); a follow-up passes the orchestrator
 * its turn count and, for Single Shot, the latest images, and nothing else
 * from the webview (H6).
 */
import { MessageEnvelope, MessageType, createEnvelope } from '@messages';
import { ImageGenerationHandler } from '../../../../application/handlers/domain/ImageGenerationHandler';
import type { ImageOrchestrator } from '@ai';
import type { LoggingService } from '@logging';

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as LoggingService;
const image = 'data:image/png;base64,QUJD';
const settings = { mode: 'edit', model: 'recraft/recraft-v4.1', aspectRatio: '1:1', resolution: 'auto' } as const;
const turn = {
  conversationId: 'img-1', turnNumber: 2, aspectRatio: '1:1',
  settings, result: { images: [{ data: image, mimeType: 'image/png' }], seed: 0 },
};

let posted: MessageEnvelope[];
let orchestrator: { generateImage: jest.Mock; continueConversation: jest.Mock };
const handler = () => new ImageGenerationHandler(message => { posted.push(message); }, orchestrator as unknown as ImageOrchestrator, logger);
const request = (payload: object) => createEnvelope(MessageType.IMAGE_GENERATION_REQUEST, 'webview.imageGeneration', payload as never, 'image-generate-1');
const followUp = (payload: object) => createEnvelope(MessageType.IMAGE_GENERATION_CONTINUE, 'webview.imageGeneration', payload as never, 'image-continue-1');
const errors = () => posted.filter(message => message.type === MessageType.ERROR);

beforeEach(() => {
  posted = [];
  orchestrator = { generateImage: jest.fn(async () => turn), continueConversation: jest.fn(async () => turn) };
});

describe('mode', () => {
  it.each([undefined, 'chat', 'Edit', 1])('refuses a new request whose mode is %p, for that request, before the orchestrator', async mode => {
    await handler().handleGenerationRequest(request({ ...settings, mode, prompt: 'A tree' }));
    expect(orchestrator.generateImage).not.toHaveBeenCalled();
    expect(errors()).toEqual([expect.objectContaining({
      correlationId: 'image-generate-1',
      payload: expect.objectContaining({ code: 'IMAGE_GENERATION_ERROR', message: expect.stringContaining('no known generation mode') }),
    })]);
    // The spinner the request started is stopped.
    expect(posted.filter(message => message.type === MessageType.STATUS).map(message => (message.payload as { isLoading: boolean }).isLoading)).toEqual([true, false]);
  });

  it.each([undefined, 'chat'])('refuses a follow-up whose mode is %p, before the orchestrator', async mode => {
    await handler().handleContinueRequest(followUp({ ...settings, mode, prompt: 'Make it red', conversationId: 'img-1', turnCount: 1 }));
    expect(orchestrator.continueConversation).not.toHaveBeenCalled();
    expect(errors()).toEqual([expect.objectContaining({ correlationId: 'image-continue-1' })]);
  });

  it('passes a known mode through', async () => {
    await handler().handleGenerationRequest(request({ ...settings, mode: 'conversation', prompt: 'A tree' }));
    expect(orchestrator.generateImage).toHaveBeenCalledWith('A tree', expect.objectContaining({ mode: 'conversation' }), undefined);
    expect(errors()).toEqual([]);
  });
});

describe('follow-ups', () => {
  it('hands the orchestrator the turn count and the latest images, not display history', async () => {
    await handler().handleContinueRequest(followUp({
      ...settings, prompt: 'Make it red', conversationId: 'img-1', turnCount: 3,
      latestImages: [{ data: image, seed: 7, extra: 'dropped' }],
      history: [{ prompt: 'ignored', images: [] }],
    }));
    expect(orchestrator.continueConversation).toHaveBeenCalledWith('img-1', 'Make it red', {
      mode: 'edit', turnCount: 3, latestImages: [{ data: image, seed: 7 }], model: settings.model, aspectRatio: '1:1', resolution: 'auto',
    });
    expect(posted.find(message => message.type === MessageType.IMAGE_GENERATION_RESPONSE)?.payload).toMatchObject({ conversationId: 'img-1', turnNumber: 2 });
  });
});
