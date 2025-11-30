import { SVGConversationManager } from '../../../../infrastructure/ai/orchestration/SVGConversationManager';
import { LoggingService } from '@logging';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as LoggingService;

describe('SVGConversationManager', () => {
  it('rehydrates a conversation with history', () => {
    const manager = new SVGConversationManager(mockLogger);
    const conversation = manager.rehydrate(
      'svg-1',
      'model-a',
      '1:1',
      [
        { prompt: 'Draw a cat', svgCode: '<svg></svg>', turnNumber: 1 },
        { prompt: 'Refine it', svgCode: '<svg><g /></svg>', turnNumber: 2 },
      ]
    );

    expect(conversation.id).toBe('svg-1');
    expect(conversation.turnNumber).toBe(2);
    expect(conversation.messages[0].role).toBe('system');
    expect(conversation.messages[1].role).toBe('user');
    expect(conversation.messages[2].role).toBe('assistant');
    expect(conversation.messages[conversation.messages.length - 1].content).toContain('<svg><g /></svg>');
  });
});
