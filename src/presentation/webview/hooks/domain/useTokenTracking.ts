/**
 * useTokenTracking - Token usage tracking hook
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 * Tracks accumulated token usage and costs across AI operations.
 * Message handlers are exposed for App-level registration (prose-minion pattern).
 */
import { useState, useCallback } from 'react';
import {
  MessageType,
  TokenUsage,
  TokenUsageUpdatePayload,
  MessageEnvelope,
} from '@messages';

// 1. State Interface
export interface TokenTrackingState {
  usage: TokenUsage;
  lastRequest?: TokenUsage;
  requestedAt?: number;
}

// 2b. Message Handlers Interface (for App-level routing)
export interface TokenTrackingHandlers {
  handleTokenUsageUpdate: (message: MessageEnvelope) => void;
}

// 3. Persistence Interface
export interface TokenTrackingPersistence {
  tokenTracking: TokenUsage;
  lastRequest?: TokenUsage;
  requestedAt?: number;
}

export type UseTokenTrackingReturn = TokenTrackingState &
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
  // State - initialize from persisted state
  const [usage, setUsage] = useState<TokenUsage>({
    ...DEFAULT_USAGE,
    ...(initialState?.tokenTracking ?? {}),
  });
  const [lastRequest, setLastRequest] = useState<TokenUsage | undefined>(initialState?.lastRequest);
  const [requestedAt, setRequestedAt] = useState<number | undefined>(initialState?.requestedAt);

  // Message handlers (exposed for App-level routing)
  const handleTokenUsageUpdate = useCallback((message: MessageEnvelope) => {
    if (message.type === MessageType.TOKEN_USAGE_UPDATE) {
      const { totals, lastRequest: request, requestedAt: at } =
        message.payload as TokenUsageUpdatePayload;
      setUsage(totals);
      if (request) setLastRequest(request);
      if (at) setRequestedAt(at);
    }
  }, []);

  // Persistence
  const persistedState: TokenTrackingPersistence = {
    tokenTracking: usage,
    lastRequest,
    requestedAt,
  };

  return {
    // State
    usage,
    lastRequest,
    requestedAt,
    // Message Handlers (for App-level routing)
    handleTokenUsageUpdate,
    // Persistence
    persistedState,
  };
}
