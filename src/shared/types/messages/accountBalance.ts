export type OpenRouterBalanceStatus = 'ok' | 'no_key' | 'unavailable';

export interface OpenRouterKeyLimit {
  limit: number | null;
  limitRemaining: number | null;
  resetWindow: 'daily' | 'weekly' | 'monthly' | 'unknown';
}

export interface OpenRouterCredits {
  totalCredits: number;
  totalUsage: number;
  remaining: number;
}

export interface OpenRouterBalancePayload {
  status: OpenRouterBalanceStatus;
  keyLimit?: OpenRouterKeyLimit;
  credits?: OpenRouterCredits;
  reason?: string;
  fetchedAt: number;
}

export interface RequestOpenRouterBalancePayload {
  forceRefresh?: boolean;
}
