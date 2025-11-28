/**
 * usePersistence - Manages webview state persistence
 *
 * Pattern: Composed persistence from domain hooks
 * Uses VSCode's setState/getState for persistence across webview reloads
 */
import { useEffect, useCallback } from 'react';
import { useVSCodeApi } from './useVSCodeApi';

export interface PersistenceState {
  helloWorld?: {
    text: string;
    renderedMarkdown: string;
  };
  settings?: {
    maxConversationTurns: number;
    openRouterModel: string;
  };
  activeTab?: string;
}

export function usePersistence() {
  const vscode = useVSCodeApi();

  const saveState = useCallback((state: PersistenceState) => {
    vscode.setState(state);
  }, [vscode]);

  const loadState = useCallback((): PersistenceState => {
    return (vscode.getState() as PersistenceState) || {};
  }, [vscode]);

  return { saveState, loadState };
}
