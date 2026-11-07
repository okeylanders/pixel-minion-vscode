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
  /** `ok` when either call returned data; `no_key` when no key is stored. */
  status: OpenRouterBalanceStatus;
  /** Present iff `/key` succeeded. */
  keyLimit?: OpenRouterKeyLimit;
  /** Present iff `/credits` succeeded. */
  credits?: OpenRouterCredits;
  /**
   * Outcome of `/credits` on its own. A key can read its spend limit while
   * `/credits` fails, and the UI must then not present the cap as the balance.
   */
  creditsStatus: OpenRouterBalanceStatus;
  /** Why `/key` failed, when it did. */
  keyIssue?: OpenRouterAccountIssue;
  /** Why `/credits` failed, when it did. */
  creditsIssue?: OpenRouterAccountIssue;
  /** Epoch ms when the host fetched these figures. */
  fetchedAt: number;
}

export interface RequestOpenRouterBalancePayload {
  /** Bypass the host's 120 s cache (manual refresh). Rate-limited host-side. */
  forceRefresh?: boolean;
}
