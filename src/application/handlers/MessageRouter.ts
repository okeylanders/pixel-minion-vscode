/**
 * MessageRouter - Strategy pattern for message routing
 *
 * Pattern: Strategy pattern with Map-based handler registry
 * Benefits: No switch statements, Open/Closed Principle
 *
 * Reference: docs/example-repo/src/application/handlers/MessageRouter.ts
 */
import { MessageType, MessageEnvelope } from '@messages';

export type MessageHandlerFn<T = unknown> = (
  message: MessageEnvelope<T>
) => Promise<void> | void;

export class MessageRouter {
  private handlers: Map<MessageType, MessageHandlerFn> = new Map();

  /**
   * Register a handler for a specific message type
   */
  register<T>(type: MessageType, handler: MessageHandlerFn<T>): void {
    this.handlers.set(type, handler as MessageHandlerFn);
  }

  /**
   * Unregister a handler
   */
  unregister(type: MessageType): void {
    this.handlers.delete(type);
  }

  /**
   * Route a message to its handler
   * @returns true if a handler was found and executed
   */
  async route(message: MessageEnvelope): Promise<boolean> {
    const handler = this.handlers.get(message.type);
    if (handler) {
      await handler(message);
      return true;
    }
    return false;
  }

  /**
   * Check if a handler exists for a message type
   */
  hasHandler(type: MessageType): boolean {
    return this.handlers.has(type);
  }

  /**
   * Get all registered message types
   */
  getRegisteredTypes(): MessageType[] {
    return Array.from(this.handlers.keys());
  }
}
