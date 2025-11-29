/**
 * useMessageRouter - Strategy pattern for message routing
 *
 * Provides a declarative way to route extension messages to appropriate handlers.
 * Uses the Strategy pattern to map MessageType → Handler function.
 *
 * Pattern matches prose-minion: handlers passed as parameter, stays mounted in App.
 */
import { useEffect, useRef } from 'react';
import { MessageType, MessageEnvelope } from '@messages';

export type MessageHandler = (message: MessageEnvelope) => void;

/**
 * Map of MessageType to handler functions
 * Allows partial implementation (not all message types required)
 */
export type MessageHandlerMap = Partial<Record<MessageType, MessageHandler>>;

/**
 * Hook that sets up message routing from extension to webview
 *
 * Uses the Strategy pattern to route messages based on their type.
 * Maintains stable event listeners to avoid unnecessary re-registrations.
 *
 * @param handlers - Map of MessageType to handler functions
 *
 * @example
 * ```tsx
 * useMessageRouter({
 *   [MessageType.IMAGE_GENERATION_RESPONSE]: imageGeneration.handleResponse,
 *   [MessageType.SVG_GENERATION_RESPONSE]: svgGeneration.handleResponse,
 *   [MessageType.ERROR]: (msg) => console.error(msg.payload),
 * });
 * ```
 */
export function useMessageRouter(handlers: MessageHandlerMap): void {
  // Store handlers in ref to avoid re-creating event listener on every render
  const handlersRef = useRef(handlers);

  // Update ref when handlers change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Set up message event listener (only once)
  useEffect(() => {
    const messageHandler = (event: MessageEvent<MessageEnvelope>) => {
      const message = event.data;

      // Ignore messages from webview (echo prevention)
      if (message.source?.startsWith('webview.')) {
        return;
      }

      const handler = handlersRef.current[message.type];
      if (handler) {
        handler(message);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []); // Empty deps - listener is stable, handlers via ref
}
