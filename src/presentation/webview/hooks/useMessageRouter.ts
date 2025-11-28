/**
 * useMessageRouter - Handles message routing in the webview
 *
 * Pattern: Strategy pattern for message routing
 * Uses stable references to avoid re-registering listeners
 * Reference: docs/example-repo/src/presentation/webview/hooks/useMessageRouter.ts
 */
import { useEffect, useRef, useCallback } from 'react';
import { MessageType, MessageEnvelope } from '@messages';

export type MessageHandler = (message: MessageEnvelope) => void;

export function useMessageRouter() {
  const handlersRef = useRef<Map<MessageType, MessageHandler>>(new Map());

  const register = useCallback((type: MessageType, handler: MessageHandler) => {
    handlersRef.current.set(type, handler);
  }, []);

  const unregister = useCallback((type: MessageType) => {
    handlersRef.current.delete(type);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<MessageEnvelope>) => {
      const message = event.data;

      // Ignore messages from webview (echo prevention)
      if (message.source?.startsWith('webview.')) {
        return;
      }

      const handler = handlersRef.current.get(message.type);
      if (handler) {
        handler(message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return { register, unregister };
}
