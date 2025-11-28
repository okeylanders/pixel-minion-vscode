/**
 * useHelloWorld - Hello World domain hook
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 * Reference: docs/example-repo/src/presentation/webview/hooks/domain/useAnalysis.ts
 */
import { useState, useCallback, useEffect } from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { useMessageRouter } from '../useMessageRouter';
import {
  MessageType,
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

// 3. Persistence Interface (what gets saved)
export interface HelloWorldPersistence {
  text: string;
  renderedMarkdown: string;
}

// Composed return type
export type UseHelloWorldReturn = HelloWorldState & HelloWorldActions & {
  persistedState: HelloWorldPersistence;
};

export function useHelloWorld(
  initialState?: Partial<HelloWorldPersistence>
): UseHelloWorldReturn {
  const vscode = useVSCodeApi();
  const { register } = useMessageRouter();

  // State
  const [text, setText] = useState(initialState?.text ?? '');
  const [renderedMarkdown, setRenderedMarkdown] = useState(
    initialState?.renderedMarkdown ?? ''
  );
  const [isLoading, setIsLoading] = useState(false);

  // Register message handler
  useEffect(() => {
    register(MessageType.HELLO_WORLD_RESULT, (message) => {
      const payload = message.payload as HelloWorldResultPayload;
      setRenderedMarkdown(payload.renderedMarkdown);
      setIsLoading(false);
    });
  }, [register]);

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
    // Persistence
    persistedState,
  };
}
