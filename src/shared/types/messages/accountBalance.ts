/**
 * OpenRouter account-balance message payloads.
 *
 * Every shape here is SANITIZED: numbers, enums and HTTP status codes only.
 * API keys and raw response bodies never leave the extension host.
 */

/** Availability of the account as a whole, or of one figure (`creditsStatus`). */
export type OpenRouterBalanceStatus = 'ok' | 'no_key' | 'unavailable';

/** Why one OpenRouter account call returned no usable data. */
export type OpenRouterAccountIssueKind =
  /** HTTP 401: OpenRouter rejected the stored key. */
  | 'invalid_key'
  /** HTTP 403: the key works but may not read this endpoint. */
  | 'forbidden'
  /** HTTP 429. */
  | 'rate_limited'
  /** HTTP 5xx: OpenRouter is having trouble. */
  | 'server_error'
  /** Any other non-2xx response. */
  | 'http_error'
  /** The request never completed: offline, DNS failure, or the 8 s timeout. */
  | 'network'
  /** A 2xx response whose body could not be read. */
  | 'malformed';

export interface OpenRouterAccountIssue {
  kind: OpenRouterAccountIssueKind;
  /** HTTP status for HTTP failures; absent for `network` and `malformed`. */
  httpStatus?: number;
}

/** `GET /api/v1/key`: the key's own spend limit. */
export interface OpenRouterKeyLimit {
  /** Enforced spend limit in USD, or `null` when the key has none. */
  limit: number | null;
  /** Headroom left against `limit`, or `null` when unlimited. */
  limitRemaining: number | null;
  /** When the limit resets, from `limit_reset`. `unknown` covers no reset and unrecognized values. */
  resetWindow: 'daily' | 'weekly' | 'monthly' | 'unknown';
}

/** `GET /api/v1/credits`: the account balance. */
export interface OpenRouterCredits {
  totalCredits: number;
  totalUsage: number;
  /** `totalCredits - totalUsage`; negative when the account is overdrawn. */
  remaining: number;
}

export interface OpenRouterBalancePayload {
  /** `ok` when there is a figure to show; `no_key` when no key is stored. */
  status: OpenRouterBalanceStatus;
  /** Present when `/key` succeeded, or carried over from the last read (see `stale`). */
  keyLimit?: OpenRouterKeyLimit;
  /** Present when `/credits` succeeded, or carried over from the last read (see `stale`). */
  credits?: OpenRouterCredits;
  /**
   * Outcome of this attempt's `/credits` call on its own. A key can read its
   * spend limit while `/credits` fails, and the UI must then not present the
   * cap as the balance.
   */
  creditsStatus: OpenRouterBalanceStatus;
  /** Why `/key` failed, when it did. */
  keyIssue?: OpenRouterAccountIssue;
  /** Why `/credits` failed, when it did. */
  creditsIssue?: OpenRouterAccountIssue;
  /**
   * Set when this refresh could not read a figure for a transient reason
   * (offline, 429, 5xx, unreadable reply) and the payload carries that
   * figure's last good value for the same stored key instead. Never set
   * across a key change. A rejected key or a forbidden endpoint is an answer,
   * not a glitch, so those drop the old figure rather than going stale.
   */
  stale?: OpenRouterBalanceStaleness;
  /**
   * Which stored key these figures belong to. The host bumps it whenever the
   * key is saved, replaced or cleared, and stamps each payload with the epoch
   * its fetch started under; the webview ignores payloads from an older epoch.
   */
  accountEpoch: number;
  /** Epoch ms when the host made this attempt (see `stale` for older figures). */
  fetchedAt: number;
}

export interface OpenRouterBalanceStaleness {
  /** When the oldest figure carried over was actually read. */
  figuresFetchedAt: number;
  /** Why the latest attempt could not refresh it. */
  issue: OpenRouterAccountIssue;
}

/**
 * Sent the moment the stored key changes, before the new key's figures are
 * fetched: the webview must stop showing the previous account's figures now,
 * not when the (possibly slow) fetch settles.
 */
export interface OpenRouterBalanceResetPayload {
  /** The new key's epoch; payloads stamped with an older one are discarded. */
  accountEpoch: number;
}

export interface RequestOpenRouterBalancePayload {
  /** Bypass the host's 120 s cache (manual refresh). Rate-limited host-side. */
  forceRefresh?: boolean;
}
