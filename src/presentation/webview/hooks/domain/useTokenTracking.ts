/**
 * useTokenTracking - Token usage tracking hook
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 * Tracks accumulated token usage and costs across AI operations.
 */
import { useState, useCallback, useEffect } from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { useMessageRouter } from '../useMessageRouter';
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
  handleTokenUsageUpdate: (message: MessageEnvelope<TokenUsageUpdatePayload>) => void;
  resetTokens: () => void;
}

// 3. Persistence Interface
export interface TokenTrackingPersistence {
  tokenTracking: TokenUsage;
}

export type UseTokenTrackingReturn = TokenTrackingState &
  TokenTrackingActions & {
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
  const { register } = useMessageRouter();

  // State - initialize from persisted state
  const [usage, setUsage] = useState<TokenUsage>({
    ...DEFAULT_USAGE,
    ...(initialState?.tokenTracking ?? {}),
  });

  // Handle TOKEN_USAGE_UPDATE messages from extension
  const handleTokenUsageUpdate = useCallback(
    (message: MessageEnvelope<TokenUsageUpdatePayload>) => {
      if (message.type === MessageType.TOKEN_USAGE_UPDATE) {
        const { totals } = message.payload;
        setUsage(totals);
      }
    },
    []
  );

  // Reset tokens to zero
  const resetTokens = useCallback(() => {
    setUsage(DEFAULT_USAGE);
    vscode.postMessage(
      createEnvelope(MessageType.RESET_TOKEN_USAGE, 'webview.settings', {})
    );
  }, [vscode]);

  // Register message handler
  useEffect(() => {
    register(MessageType.TOKEN_USAGE_UPDATE, (msg) =>
      handleTokenUsageUpdate(msg as MessageEnvelope<TokenUsageUpdatePayload>)
    );
  }, [register, handleTokenUsageUpdate]);

  // Persistence
  const persistedState: TokenTrackingPersistence = {
    tokenTracking: usage,
  };

  return {
    // State
    usage,
    // Actions
    handleTokenUsageUpdate,
    resetTokens,
    // Persistence
    persistedState,
  };
}
