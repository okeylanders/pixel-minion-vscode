/**
 * Token Usage - Types for tracking AI token consumption and costs
 *
 * Pattern: Follows example-repo/src/shared/types/messages/tokenUsage.ts
 */

/**
 * Token usage metrics from AI API responses
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
  isEstimate?: boolean;
}

/**
 * Payload for TOKEN_USAGE_UPDATE messages
 */
export interface TokenUsageUpdatePayload {
  totals: TokenUsage;
}

/**
 * Alias for accumulated totals (same structure as TokenUsage)
 */
export type TokenUsageTotals = TokenUsage;
