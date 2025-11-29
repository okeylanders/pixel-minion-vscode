/**
 * useTokenTracking - Token usage tracking hook
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 * Tracks accumulated token usage and costs across AI operations.
 * Message handlers are exposed for App-level registration (prose-minion pattern).
 */
import { useState, useCallback } from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import {
  MessageType,
  createEnvelope,
  TokenUsage,
  TokenUsageUpdatePayload,
  MessageEnvelope,
} from '@messages';

// 1. State Interface
export interface TokenTrackingState {
  usage: TokenUsage;
}

// 2. Actions Interface
export interface TokenTrackingActions {
  resetTokens: () => void;
}

// 2b. Message Handlers Interface (for App-level routing)
export interface TokenTrackingHandlers {
  handleTokenUsageUpdate: (message: MessageEnvelope) => void;
}

// 3. Persistence Interface
export interface TokenTrackingPersistence {
  tokenTracking: TokenUsage;
}

export type UseTokenTrackingReturn = TokenTrackingState &
  TokenTrackingActions &
  TokenTrackingHandlers & {
    persistedState: TokenTrackingPersistence;
  };

const DEFAULT_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  costUsd: 0,
};

export function useTokenTracking(
  initialState?: Partial<TokenTrackingPersistence>
): UseTokenTrackingReturn {
  const vscode = useVSCodeApi();

  // State - initialize from persisted state
  const [usage, setUsage] = useState<TokenUsage>({
    ...DEFAULT_USAGE,
    ...(initialState?.tokenTracking ?? {}),
  });

  // Message handlers (exposed for App-level routing)
  const handleTokenUsageUpdate = useCallback((message: MessageEnvelope) => {
    if (message.type === MessageType.TOKEN_USAGE_UPDATE) {
      const { totals } = message.payload as TokenUsageUpdatePayload;
      setUsage(totals);
    }
  }, []);

  // Reset tokens to zero
  const resetTokens = useCallback(() => {
    setUsage(DEFAULT_USAGE);
    vscode.postMessage(
      createEnvelope(MessageType.RESET_TOKEN_USAGE, 'webview.settings', {})
    );
  }, [vscode]);

  // Persistence
  const persistedState: TokenTrackingPersistence = {
    tokenTracking: usage,
  };

  return {
    // State
    usage,
    // Actions
    resetTokens,
    // Message Handlers (for App-level routing)
    handleTokenUsageUpdate,
    // Persistence
    persistedState,
  };
}
