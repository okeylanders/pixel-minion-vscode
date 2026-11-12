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
  it('rehydrates the raster reference and attached SVG a turn was sent with, as it sent them', () => {
    const manager = new SVGConversationManager(mockLogger);
    const live = manager.create('model-a', '1:1');
    manager.addUserMessage(live.id, 'Trace this', 'data:image/png;base64,AAA', '<svg id="ref"/>');

    const restored = manager.rehydrate('svg-2', 'model-a', '1:1', [
      { prompt: 'Trace this', svgCode: '<svg></svg>', referenceImage: 'data:image/png;base64,AAA', referenceSvgText: '<svg id="ref"/>' },
    ]);

    expect(restored.messages[1]).toEqual(manager.get(live.id)?.messages[1]);
  });
});
