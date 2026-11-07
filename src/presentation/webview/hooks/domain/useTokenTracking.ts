/**
 * useTokenTracking - usage of the most recent AI request
 *
 * Pattern: Tripartite Interface (State, Handlers, Persistence)
 * Feeds the balance card's "Last request" row. Persisted, so after a reload
 * the row can show a request from an earlier session; the UI dates it.
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
  lastRequest?: TokenUsage;
  requestedAt?: number;
}

// 2b. Message Handlers Interface (for App-level routing)
export interface TokenTrackingHandlers {
  handleTokenUsageUpdate: (message: MessageEnvelope) => void;
}

// 3. Persistence Interface
export interface TokenTrackingPersistence {
  lastRequest?: TokenUsage;
  requestedAt?: number;
}

export type UseTokenTrackingReturn = TokenTrackingState &
  TokenTrackingHandlers & {
    persistedState: TokenTrackingPersistence;
  };

export function useTokenTracking(
  initialState?: Partial<TokenTrackingPersistence>
): UseTokenTrackingReturn {
  const [lastRequest, setLastRequest] = useState<TokenUsage | undefined>(initialState?.lastRequest);
  const [requestedAt, setRequestedAt] = useState<number | undefined>(initialState?.requestedAt);

  // Message handlers (exposed for App-level routing)
  const handleTokenUsageUpdate = useCallback((message: MessageEnvelope) => {
    if (message.type === MessageType.TOKEN_USAGE_UPDATE) {
      const payload = message.payload as TokenUsageUpdatePayload;
      setLastRequest(payload.lastRequest);
      setRequestedAt(payload.requestedAt);
    }
  }, []);

  // Persistence
  const persistedState: TokenTrackingPersistence = {
    lastRequest,
    requestedAt,
  };

  return {
    // State
    lastRequest,
    requestedAt,
    // Message Handlers (for App-level routing)
    handleTokenUsageUpdate,
    // Persistence
    persistedState,
  };
}
