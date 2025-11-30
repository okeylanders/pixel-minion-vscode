import { TextConversationManager } from '../../../../infrastructure/ai/orchestration/TextConversationManager';

describe('TextConversationManager', () => {
  it('rehydrates conversation history and tracks turns', () => {
    const manager = new TextConversationManager({
      maxTurns: 5,
      systemPrompt: 'sys prompt',
    });

    const conversation = manager.rehydrate(
      'conv-1',
      [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ],
      'sys prompt'
    );

    expect(manager.getConversation('conv-1')).toBeDefined();
    expect(conversation.turnCount).toBe(1);
    expect(conversation.messages[0].role).toBe('system');
    expect(conversation.messages[1]).toEqual({ role: 'user', content: 'Hi' });
    expect(conversation.messages[2]).toEqual({ role: 'assistant', content: 'Hello' });
  });
});
