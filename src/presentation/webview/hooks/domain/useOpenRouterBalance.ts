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
 * Account ownership: every payload carries the `accountEpoch` of the key it
 * was fetched for. When the key changes the host first sends
 * `OPENROUTER_BALANCE_RESET` with the new epoch, which clears the previous
 * account's figures at once (the view shows its loading state until the new
 * key's figures land). Payloads from an older epoch are then ignored, so a
 * late answer for the previous key can never bring its figures back.
 *
 * Not persisted: a balance from a previous session would be stale.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageEnvelope,
  MessageType,
  OpenRouterBalancePayload,
  OpenRouterBalanceResetPayload,
  RequestOpenRouterBalancePayload,
  createEnvelope,
} from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';

export interface OpenRouterBalanceState {
  /** Latest payload for the current key; `null` until it arrives (and right after a key change). */
  balance: OpenRouterBalancePayload | null;
  /**
   * A request from this webview is in flight, or a key change is waiting for
   * the new key's figures. During a refresh the previous value stays visible.
   */
  isLoading: boolean;
}

export interface OpenRouterBalanceActions {
  /** Force a fresh fetch, bypassing the host cache. */
  refresh: () => void;
}

export interface OpenRouterBalanceHandlers {
  handleBalanceData: (message: MessageEnvelope) => void;
  handleBalanceReset: (message: MessageEnvelope) => void;
}

export type UseOpenRouterBalanceReturn = OpenRouterBalanceState &
  OpenRouterBalanceActions &
  OpenRouterBalanceHandlers;

let requestSequence = 0;

/** Below any epoch the host stamps (it starts at 0), so the first payload is always accepted. */
const NO_EPOCH = -1;

export function useOpenRouterBalance(apiKeyStatusKnown: boolean): UseOpenRouterBalanceReturn {
  const vscode = useVSCodeApi();
  const [balance, setBalance] = useState<OpenRouterBalancePayload | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const [awaitingNewAccount, setAwaitingNewAccount] = useState(false);
  const pendingRequestId = useRef<string | undefined>(undefined);
  const requestedOnMount = useRef(false);
  /** Highest account epoch seen. Messages are handled one at a time, in order, so a ref is enough. */
  const accountEpoch = useRef(NO_EPOCH);

  const request = useCallback((forceRefresh: boolean) => {
    requestSequence += 1;
    const correlationId = `openrouter-balance-${requestSequence}`;
    pendingRequestId.current = correlationId;
    setRequestPending(true);
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
    // Our request is answered even when the answer turns out to be stale, so
    // the busy state can't stick. Unsolicited pushes don't settle it.
    if (message.correlationId && message.correlationId === pendingRequestId.current) {
      pendingRequestId.current = undefined;
      setRequestPending(false);
    }

    // The previous key's figures, arriving late: never show them again.
    if (payload.accountEpoch < accountEpoch.current) return;
    const newAccount = payload.accountEpoch > accountEpoch.current;
    accountEpoch.current = payload.accountEpoch;
    setAwaitingNewAccount(false);
    // Within one account responses can arrive out of order, so never replace
    // newer figures with older ones. A newer account always replaces.
    setBalance((current) => (
      !newAccount && current && payload.fetchedAt < current.fetchedAt ? current : payload
    ));
  }, []);

  const handleBalanceReset = useCallback((message: MessageEnvelope) => {
    const { accountEpoch: next } = message.payload as OpenRouterBalanceResetPayload;
    // Already showing that key (or a newer one): nothing to clear.
    if (next <= accountEpoch.current) return;
    accountEpoch.current = next;
    setBalance(null);
    setAwaitingNewAccount(true);
  }, []);

  useEffect(() => {
    if (!apiKeyStatusKnown || requestedOnMount.current) return;
    requestedOnMount.current = true;
    // Not forced: a cached host value is fine for a fresh view.
    request(false);
  }, [apiKeyStatusKnown, request]);

  return {
    balance,
    isLoading: requestPending || awaitingNewAccount,
    refresh,
    handleBalanceData,
    handleBalanceReset,
  };
}
