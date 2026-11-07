/**
 * Balance formatting and copy, shared by the collapsed pill and the expanded
 * card so the two can never disagree on which number they lead with or what
 * it means. Pure functions; no React.
 */
import {
  OpenRouterAccountIssue,
  OpenRouterBalancePayload,
  OpenRouterKeyLimit,
} from '@messages';

/** USD with cents, via Intl so negatives read "-$1.50", not "$-1.50". */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Per-request cost: sub-cent amounts need four decimals to be visible. */
export function formatRequestCost(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

/** Time of day for today; otherwise include the date (and the year if it differs). */
export function formatWhen(timestamp: number, now: number = Date.now()): string {
  const at = new Date(timestamp);
  const today = new Date(now);
  const time: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  if (at.toDateString() === today.toDateString()) {
    return at.toLocaleTimeString([], time);
  }
  return at.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    ...(at.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
    ...time,
  });
}

/** Short clause explaining why a call failed, e.g. "API key rejected (HTTP 401)". */
export function describeIssue(issue: OpenRouterAccountIssue | undefined): string {
  if (!issue) return 'no details';
  const http = issue.httpStatus !== undefined ? ` (HTTP ${issue.httpStatus})` : '';
  switch (issue.kind) {
    case 'invalid_key':
      return `API key rejected${http}`;
    case 'forbidden':
      return `not permitted for this key${http}`;
    case 'rate_limited':
      return `rate-limited${http}`;
    case 'server_error':
      return `OpenRouter error${http}`;
    case 'http_error':
      return `unexpected response${http}`;
    case 'network':
      return "couldn't reach OpenRouter";
    case 'malformed':
      return 'unreadable response';
  }
}

/** The single sentence shown when no balance figure could be read at all. */
export function describeUnavailable(balance: OpenRouterBalancePayload): string {
  const issue = balance.keyIssue ?? balance.creditsIssue;
  if (!issue) return 'Balance unavailable.';
  const hint = issue.kind === 'invalid_key' ? ' Check the key in Settings.' : '';
  return `Balance unavailable: ${describeIssue(issue)}.${hint}`;
}

/** True when the key has a spend cap with known headroom. */
export function hasEnforcedLimit(
  keyLimit: OpenRouterKeyLimit | undefined
): keyLimit is OpenRouterKeyLimit & { limit: number; limitRemaining: number } {
  return keyLimit !== undefined && keyLimit.limit !== null && keyLimit.limitRemaining !== null;
}

export const RESET_LABELS: Record<OpenRouterKeyLimit['resetWindow'], string> = {
  daily: 'Daily remaining',
  weekly: 'Weekly remaining',
  monthly: 'Monthly remaining',
  unknown: 'Spend cap remaining',
};

/** Tone drives styling: `muted` for non-amounts, `zero` for no money left. */
export type BalanceTone = 'normal' | 'muted' | 'zero';

export interface BalanceHeadline {
  text: string;
  tone: BalanceTone;
  /** What `text` is, for the pill's tooltip. */
  caption: string;
}

/**
 * The one number to lead with: the account balance when `/credits` was
 * readable, otherwise the key's spend-cap headroom (labelled as such).
 */
export function openRouterHeadline(balance: OpenRouterBalancePayload | null): BalanceHeadline {
  if (!balance) {
    return { text: '…', tone: 'muted', caption: 'Loading balance' };
  }
  if (balance.status === 'no_key') {
    return { text: 'no key', tone: 'muted', caption: 'No OpenRouter API key' };
  }
  if (balance.status === 'unavailable') {
    const issue = balance.keyIssue ?? balance.creditsIssue;
    if (issue?.kind === 'invalid_key') {
      return { text: 'invalid key', tone: 'muted', caption: describeUnavailable(balance) };
    }
    if (issue?.kind === 'network') {
      return { text: 'offline', tone: 'muted', caption: describeUnavailable(balance) };
    }
    return { text: '—', tone: 'muted', caption: describeUnavailable(balance) };
  }

  if (balance.credits) {
    const { remaining } = balance.credits;
    return { text: formatUsd(remaining), tone: remaining <= 0 ? 'zero' : 'normal', caption: 'Account balance' };
  }

  const keyLimit = balance.keyLimit;
  if (hasEnforcedLimit(keyLimit)) {
    const capCaption = keyLimit.limit === 0
      ? 'Key spend cap is $0 (no headroom)'
      : `${RESET_LABELS[keyLimit.resetWindow]} on this key's spend cap`;
    return {
      text: formatUsd(keyLimit.limit === 0 ? 0 : keyLimit.limitRemaining),
      tone: keyLimit.limit === 0 || keyLimit.limitRemaining <= 0 ? 'zero' : 'normal',
      caption: `${capCaption}; account balance unavailable`,
    };
  }

  return { text: '—', tone: 'muted', caption: 'Account balance unavailable' };
}
