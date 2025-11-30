/**
 * TextOrchestrator - Coordinates text conversations without knowing which client is used
 *
 * Pattern: Dependency Injection - client is injected, orchestrator is agnostic
 * Responsibilities:
 * - Coordinates between TextConversationManager and TextClient
 * - Handles conversation lifecycle
 * - Provides clean interface for consumers
 */
import { TextClient, TextCompletionResult, TextCompletionOptions } from '../clients/TextClient';
import { TextConversationManager, TextConversationManagerOptions } from './TextConversationManager';

export interface TextOrchestratorOptions extends TextConversationManagerOptions {
  // Extend with orchestrator-specific options if needed
}

export interface TextTurnResult {
  response: string;
  conversationId: string;
  turnNumber: number;
  isComplete: boolean; // true if max turns reached
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class TextOrchestrator {
  private readonly conversationManager: TextConversationManager;
  private client: TextClient | null = null;

  constructor(options: TextOrchestratorOptions = {}) {
    this.conversationManager = new TextConversationManager(options);
  }

  /**
   * Set the text client (dependency injection)
   */
  setClient(client: TextClient): void {
    this.client = client;
  }

  /**
   * Check if a client is configured
   */
  hasClient(): boolean {
    return this.client !== null;
  }

  /**
   * Start a new conversation
   * @param systemPrompt Optional custom system prompt
   * @returns The conversation ID
   */
  startConversation(systemPrompt?: string): string {
    return this.conversationManager.createConversation(systemPrompt);
  }

  /**
   * Check if a conversation exists
   */
  hasConversation(conversationId: string): boolean {
    return this.conversationManager.hasConversation(conversationId);
  }

  /**
   * Rehydrate a conversation from history
   */
  rehydrateConversation(
    conversationId: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string
  ): void {
    this.conversationManager.rehydrate(conversationId, history, systemPrompt);
  }

  /**
   * Send a message in a conversation and get a response
   */
  async sendMessage(
    conversationId: string,
    userMessage: string,
    options?: TextCompletionOptions
  ): Promise<TextTurnResult> {
    if (!this.client) {
      throw new Error('No text client configured. Call setClient() first.');
    }

    // Check if we can add more turns
    if (!this.conversationManager.addUserMessage(conversationId, userMessage)) {
      return {
        response: 'Maximum conversation turns reached. Please start a new conversation.',
        conversationId,
        turnNumber: this.conversationManager.getTurnCount(conversationId),
        isComplete: true,
      };
    }

    // Get all messages and call the AI
    const messages = this.conversationManager.getMessages(conversationId);
    const result = await this.client.createCompletion(messages, options);

    // Store the assistant's response
    this.conversationManager.addAssistantMessage(conversationId, result.content);

    const turnNumber = this.conversationManager.getTurnCount(conversationId);
    const isComplete = this.conversationManager.isAtMaxTurns(conversationId);

    return {
      response: result.content,
      conversationId,
      turnNumber,
      isComplete,
      usage: result.usage,
    };
  }

  /**
   * Send a single message without maintaining conversation state
   * (For simple one-off queries)
   */
  async sendSingleMessage(
    userMessage: string,
    systemPrompt?: string,
    options?: TextCompletionOptions
  ): Promise<TextCompletionResult> {
    if (!this.client) {
      throw new Error('No text client configured. Call setClient() first.');
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt ?? 'You are a helpful assistant.' },
      { role: 'user' as const, content: userMessage },
    ];

    return this.client.createCompletion(messages, options);
  }

  /**
   * Clear a conversation
   */
  clearConversation(conversationId: string): void {
    this.conversationManager.clearConversation(conversationId);
  }

  /**
   * Clear all conversations
   */
  clearAllConversations(): void {
    this.conversationManager.clearAll();
  }

  /**
   * Get conversation turn count
   */
  getTurnCount(conversationId: string): number {
    return this.conversationManager.getTurnCount(conversationId);
  }

  /**
   * Update max turns setting
   */
  setMaxTurns(maxTurns: number): void {
    this.conversationManager.setMaxTurns(maxTurns);
  }

  /**
   * Get max turns setting
   */
  getMaxTurns(): number {
    return this.conversationManager.getMaxTurns();
  }
}
