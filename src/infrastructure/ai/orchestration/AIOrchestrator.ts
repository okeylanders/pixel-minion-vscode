/**
 * AIOrchestrator - Coordinates AI conversations without knowing which client is used
 *
 * Pattern: Dependency Injection - client is injected, orchestrator is agnostic
 * Responsibilities:
 * - Coordinates between ConversationManager and AIClient
 * - Handles conversation lifecycle
 * - Provides clean interface for consumers
 */
import { AIClient, ChatCompletionResult, ChatCompletionOptions } from '../clients/AIClient';
import { ConversationManager, ConversationManagerOptions } from './ConversationManager';

export interface OrchestratorOptions extends ConversationManagerOptions {
  // Extend with orchestrator-specific options if needed
}

export interface ConversationTurnResult {
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

export class AIOrchestrator {
  private readonly conversationManager: ConversationManager;
  private client: AIClient | null = null;

  constructor(options: OrchestratorOptions = {}) {
    this.conversationManager = new ConversationManager(options);
  }

  /**
   * Set the AI client (dependency injection)
   */
  setClient(client: AIClient): void {
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
   * Send a message in a conversation and get a response
   */
  async sendMessage(
    conversationId: string,
    userMessage: string,
    options?: ChatCompletionOptions
  ): Promise<ConversationTurnResult> {
    if (!this.client) {
      throw new Error('No AI client configured. Call setClient() first.');
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
    const result = await this.client.createChatCompletion(messages, options);

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
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    if (!this.client) {
      throw new Error('No AI client configured. Call setClient() first.');
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt ?? 'You are a helpful assistant.' },
      { role: 'user' as const, content: userMessage },
    ];

    return this.client.createChatCompletion(messages, options);
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
