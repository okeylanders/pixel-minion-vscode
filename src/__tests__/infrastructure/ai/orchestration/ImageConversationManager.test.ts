import { ImageConversationManager } from '../../../../infrastructure/ai/orchestration/ImageConversationManager';
import type { LoggingService } from '../../../../infrastructure/logging/LoggingService';

describe('ImageConversationManager', () => {
  const logger: Pick<LoggingService, 'debug' | 'info' | 'warn' | 'error'> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves assistant content, images, and reasoning details for continuation', () => {
    const manager = new ImageConversationManager(logger as unknown as LoggingService);
    const conversation = manager.create('google/gemini-3.1-flash-image-preview', '16:9');

    manager.addUserMessage(conversation.id, 'A cartoon tree');
    manager.addAssistantResponse(conversation.id, {
      images: [{ data: 'data:image/png;base64,AAA', mimeType: 'image/png' }],
      seed: 123,
      assistantMessage: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Here is your image' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' }, thought_signature: 'sig-content' },
        ],
        images: [
          { image_url: { url: 'data:image/png;base64,AAA' }, thought_signature: 'sig-image' },
        ],
        reasoning_details: [{ type: 'reasoning.encrypted', data: 'abc' }],
      },
      assistantContent: [
        { type: 'text', text: 'Here is your image' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' }, thought_signature: 'sig-content' },
      ],
      assistantImages: [
        { image_url: { url: 'data:image/png;base64,AAA' }, thought_signature: 'sig-image' },
      ],
      reasoning_details: [{ type: 'reasoning.encrypted', data: 'abc' }],
    });

    const saved = manager.get(conversation.id);
    expect(saved).toBeDefined();
    expect(saved?.messages).toHaveLength(2);

    const assistant = saved?.messages[1];
    expect(assistant?.role).toBe('assistant');
    expect(assistant?.content[1]).toMatchObject({
      type: 'image_url',
      thought_signature: 'sig-content',
    });
    expect(assistant?.images?.[0]).toMatchObject({
      thought_signature: 'sig-image',
    });
    expect(assistant?.reasoning_details).toEqual([{ type: 'reasoning.encrypted', data: 'abc' }]);
  });

  it('strips unsigned assistant image parts for gemini and keeps last images for user-side continuation', () => {
    const manager = new ImageConversationManager(logger as unknown as LoggingService);
    const conversation = manager.create('google/gemini-3.1-flash-image-preview', '16:9');

    manager.addUserMessage(conversation.id, 'A cartoon tree');
    manager.addAssistantResponse(conversation.id, {
      images: [{ data: 'data:image/png;base64,AAA', mimeType: 'image/png' }],
      seed: 321,
      assistantMessage: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Here is your image' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
        ],
        images: [{ image_url: { url: 'data:image/png;base64,AAA' } }],
        reasoning_details: [{ type: 'reasoning.encrypted', data: 'xyz' }],
      },
      reasoning_details: [{ type: 'reasoning.encrypted', data: 'xyz' }],
    });

    const saved = manager.get(conversation.id);
    expect(saved).toBeDefined();

    const assistant = saved?.messages[1];
    expect(assistant?.role).toBe('assistant');
    expect(assistant?.images).toBeUndefined();
    expect(assistant?.content).toEqual([{ type: 'text', text: 'Here is your image' }]);
    expect(saved?.lastImages).toEqual(['data:image/png;base64,AAA']);
  });
});
