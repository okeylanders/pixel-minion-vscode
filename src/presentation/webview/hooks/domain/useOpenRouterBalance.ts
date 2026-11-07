/**
 * useOpenRouterBalance - OpenRouter account balance shown in the header.
 *
 * Balances are fetched by the extension host (keys never reach the webview);
 * this hook requests them and holds the sanitized payload. It requests:
 * - once on mount, but only after the API-key status is known, so a fresh
 *   load doesn't fire one request for "no key" and another for the real key;
 * - on demand via `refresh()` (forced; rate-limited host-side).
 * The host also pushes fresh balances after AI requests complete and after
 * the key is saved, replaced or cleared; those arrive through
 * `handleBalanceData` too.
 *
 * Not persisted: a balance from a previous session would be stale.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageEnvelope,
  MessageType,
  OpenRouterBalancePayload,
  RequestOpenRouterBalancePayload,
  createEnvelope,
} from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';

export interface OpenRouterBalanceState {
  /** Latest payload; `null` until the first one arrives. */
  balance: OpenRouterBalancePayload | null;
  /** A request from this webview is in flight. The previous value stays visible. */
  isLoading: boolean;
}

export interface OpenRouterBalanceActions {
  /** Force a fresh fetch, bypassing the host cache. */
  refresh: () => void;
}

export interface OpenRouterBalanceHandlers {
  handleBalanceData: (message: MessageEnvelope) => void;
}

export type UseOpenRouterBalanceReturn = OpenRouterBalanceState &
  OpenRouterBalanceActions &
  OpenRouterBalanceHandlers;

let requestSequence = 0;

export function useOpenRouterBalance(apiKeyStatusKnown: boolean): UseOpenRouterBalanceReturn {
  const vscode = useVSCodeApi();
  const [balance, setBalance] = useState<OpenRouterBalancePayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pendingRequestId = useRef<string | undefined>(undefined);
  const requestedOnMount = useRef(false);

  const request = useCallback((forceRefresh: boolean) => {
    requestSequence += 1;
    const correlationId = `openrouter-balance-${requestSequence}`;
    pendingRequestId.current = correlationId;
    setIsLoading(true);
    vscode.postMessage(createEnvelope<RequestOpenRouterBalancePayload>(
      MessageType.REQUEST_OPENROUTER_BALANCE,
      'webview.account',
      { forceRefresh },
      correlationId
    ));
  }, [vscode]);

  const refresh = useCallback(() => request(true), [request]);

  const handleBalanceData = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as OpenRouterBalancePayload;
    // Responses can arrive out of order; never replace newer figures with older ones.
    setBalance((current) => (current && payload.fetchedAt < current.fetchedAt ? current : payload));
    // Unsolicited pushes (post-request refresh, key change) don't settle our request.
    if (message.correlationId && message.correlationId === pendingRequestId.current) {
      pendingRequestId.current = undefined;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!apiKeyStatusKnown || requestedOnMount.current) return;
    requestedOnMount.current = true;
    // Not forced: a cached host value is fine for a fresh view.
    request(false);
  }, [apiKeyStatusKnown, request]);

  return { balance, isLoading, refresh, handleBalanceData };
}
