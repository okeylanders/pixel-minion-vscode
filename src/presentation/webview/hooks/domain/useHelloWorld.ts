/**
 * useHelloWorld - Hello World domain hook
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 * Message handlers are exposed for App-level registration (prose-minion pattern).
 */
import { useState, useCallback } from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  HelloWorldResultPayload,
} from '@messages';

// 1. State Interface (read-only)
export interface HelloWorldState {
  text: string;
  renderedMarkdown: string;
  isLoading: boolean;
}

// 2. Actions Interface (write operations)
export interface HelloWorldActions {
  setText: (text: string) => void;
  submitText: () => void;
  clearResult: () => void;
}

// 2b. Message Handlers Interface (for App-level routing)
export interface HelloWorldHandlers {
  handleResult: (message: MessageEnvelope) => void;
}

// 3. Persistence Interface (what gets saved)
export interface HelloWorldPersistence {
  text: string;
  renderedMarkdown: string;
}

// Composed return type
export type UseHelloWorldReturn = HelloWorldState & HelloWorldActions & HelloWorldHandlers & {
  persistedState: HelloWorldPersistence;
};

export function useHelloWorld(
  initialState?: Partial<HelloWorldPersistence>
): UseHelloWorldReturn {
  const vscode = useVSCodeApi();

  // State
  const [text, setText] = useState(initialState?.text ?? '');
  const [renderedMarkdown, setRenderedMarkdown] = useState(
    initialState?.renderedMarkdown ?? ''
  );
  const [isLoading, setIsLoading] = useState(false);

  // Message handlers (exposed for App-level routing)
  const handleResult = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as HelloWorldResultPayload;
    setRenderedMarkdown(payload.renderedMarkdown);
    setIsLoading(false);
  }, []);

  // Actions
  const submitText = useCallback(() => {
    if (!text.trim()) return;

    setIsLoading(true);
    vscode.postMessage(
      createEnvelope(
        MessageType.HELLO_WORLD_REQUEST,
        'webview.helloWorld',
        { text }
      )
    );
  }, [text, vscode]);

  const clearResult = useCallback(() => {
    setRenderedMarkdown('');
  }, []);

  // Persistence object
  const persistedState: HelloWorldPersistence = {
    text,
    renderedMarkdown,
  };

  return {
    // State
    text,
    renderedMarkdown,
    isLoading,
    // Actions
    setText,
    submitText,
    clearResult,
    // Message Handlers (for App-level routing)
    handleResult,
    // Persistence
    persistedState,
  };
}
