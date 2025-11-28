/**
 * ConversationManager - Manages multi-turn conversation state
 *
 * Features:
 * - Multi-turn conversation support
 * - Configurable max turn limit
 * - Conversation history management
 * - Clear/reset capabilities
 *
 * Pattern: Maintains conversation state independently of AI client
 */
import { ChatMessage } from '../clients/AIClient';

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  turnCount: number;
  createdAt: number;
  lastUpdatedAt: number;
}

export interface ConversationManagerOptions {
  maxTurns?: number;
  systemPrompt?: string;
}

export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private maxTurns: number;
  private readonly defaultSystemPrompt: string;

  constructor(options: ConversationManagerOptions = {}) {
    this.maxTurns = options.maxTurns ?? 10;
    this.defaultSystemPrompt = options.systemPrompt ?? 'You are a helpful assistant.';
  }

  /**
   * Create a new conversation
   * @param systemPrompt Optional custom system prompt
   * @returns The conversation ID
   */
  createConversation(systemPrompt?: string): string {
    const id = this.generateId();
    const conversation: Conversation = {
      id,
      messages: [{
        role: 'system',
        content: systemPrompt ?? this.defaultSystemPrompt,
      }],
      turnCount: 0,
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
    this.conversations.set(id, conversation);
    return id;
  }

  /**
   * Get a conversation by ID
   */
  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  /**
   * Add a user message and increment turn count
   * @returns false if max turns exceeded
   */
  addUserMessage(conversationId: string, content: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    if (conversation.turnCount >= this.maxTurns) {
      return false; // Max turns exceeded
    }

    conversation.messages.push({ role: 'user', content });
    conversation.turnCount++;
    conversation.lastUpdatedAt = Date.now();
    return true;
  }

  /**
   * Add an assistant response
   */
  addAssistantMessage(conversationId: string, content: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.messages.push({ role: 'assistant', content });
    conversation.lastUpdatedAt = Date.now();
  }

  /**
   * Get messages for API call (excludes system message from count)
   */
  getMessages(conversationId: string): ChatMessage[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    return [...conversation.messages];
  }

  /**
   * Get current turn number
   */
  getTurnCount(conversationId: string): number {
    return this.conversations.get(conversationId)?.turnCount ?? 0;
  }

  /**
   * Check if conversation has reached max turns
   */
  isAtMaxTurns(conversationId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    return conversation ? conversation.turnCount >= this.maxTurns : true;
  }

  /**
   * Clear a specific conversation
   */
  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  /**
   * Clear all conversations
   */
  clearAll(): void {
    this.conversations.clear();
  }

  /**
   * Update max turns setting
   */
  setMaxTurns(maxTurns: number): void {
    this.maxTurns = maxTurns;
  }

  /**
   * Get max turns setting
   */
  getMaxTurns(): number {
    return this.maxTurns;
  }

  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
