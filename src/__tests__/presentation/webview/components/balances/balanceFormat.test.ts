import {
  describeCreditsUnavailable,
  describeUnavailable,
  formatRequestCost,
  formatUsd,
  formatWhen,
  openRouterHeadline,
} from '../../../../../presentation/webview/components/balances/balanceFormat';
import type { OpenRouterBalancePayload } from '@messages';

const base = { fetchedAt: 1, accountEpoch: 0 } as const;

describe('balanceFormat', () => {
  describe('currency', () => {
    it('formats balances with cents and a leading minus for negatives', () => {
      expect(formatUsd(12.345)).toBe('$12.35');
      expect(formatUsd(-1.5)).toBe('-$1.50');
      expect(formatUsd(0)).toBe('$0.00');
    });

    it('formats request costs with four decimals', () => {
      expect(formatRequestCost(0.0123)).toBe('$0.0123');
    });
  });

  describe('formatWhen', () => {
    const now = new Date(2026, 10, 7, 18, 0).getTime();

    it('shows only the time for today', () => {
      const text = formatWhen(new Date(2026, 10, 7, 15, 41).getTime(), now);
      expect(text).toMatch(/3:41/);
      expect(text).not.toMatch(/Nov/);
    });

    it('adds the date for an earlier day', () => {
      const text = formatWhen(new Date(2026, 10, 6, 15, 41).getTime(), now);
      expect(text).toMatch(/Nov 6/);
      expect(text).toMatch(/3:41/);
      expect(text).not.toMatch(/2026/);
    });

    it('adds the year for an earlier year', () => {
      expect(formatWhen(new Date(2025, 11, 31, 9, 5).getTime(), now)).toMatch(/2025/);
    });
  });

  describe('describeCreditsUnavailable', () => {
    const capOnly = { ...base, status: 'ok', creditsStatus: 'unavailable' } as const;

    it('names the cause when there is one', () => {
      expect(describeCreditsUnavailable({ ...capOnly, creditsIssue: { kind: 'server_error', httpStatus: 503 } }))
        .toBe('Account balance unavailable: OpenRouter error (HTTP 503).');
      expect(describeCreditsUnavailable({ ...capOnly, creditsIssue: { kind: 'malformed' } }))
        .toBe('Account balance unavailable: unreadable response.');
    });

    it('stays a plain sentence without one', () => {
      expect(describeCreditsUnavailable(capOnly)).toBe('Account balance unavailable.');
    });
  });

  describe('openRouterHeadline', () => {
    it('is a muted placeholder before the first payload', () => {
      expect(openRouterHeadline(null)).toEqual(expect.objectContaining({ text: '…', tone: 'muted' }));
    });

    it('mutes "no key" so it does not read as an amount', () => {
      expect(openRouterHeadline({ ...base, status: 'no_key', creditsStatus: 'no_key' }))
        .toEqual(expect.objectContaining({ text: 'no key', tone: 'muted' }));
    });

    it('distinguishes an invalid key from being offline', () => {
      const invalid: OpenRouterBalancePayload = {
        ...base,
        status: 'unavailable',
        creditsStatus: 'unavailable',
        keyIssue: { kind: 'invalid_key', httpStatus: 401 },
        creditsIssue: { kind: 'invalid_key', httpStatus: 401 },
      };
      const offline: OpenRouterBalancePayload = {
        ...base,
        status: 'unavailable',
        creditsStatus: 'unavailable',
        keyIssue: { kind: 'network' },
        creditsIssue: { kind: 'network' },
      };

      expect(openRouterHeadline(invalid)).toEqual(expect.objectContaining({ text: 'invalid key', tone: 'muted' }));
      expect(openRouterHeadline(offline)).toEqual(expect.objectContaining({ text: 'offline', tone: 'muted' }));
      expect(describeUnavailable(invalid)).toBe(
        'Balance unavailable: API key rejected (HTTP 401). Check the key in Settings.'
      );
      expect(describeUnavailable(offline)).toBe("Balance unavailable: couldn't reach OpenRouter.");
    });

    it('leads with the account balance and marks zero or negative as zero tone', () => {
      const credits = (remaining: number): OpenRouterBalancePayload => ({
        ...base,
        status: 'ok',
        creditsStatus: 'ok',
        credits: { totalCredits: 10, totalUsage: 10 - remaining, remaining },
        keyLimit: { limit: 5, limitRemaining: 4.5, resetWindow: 'monthly' },
      });

      expect(openRouterHeadline(credits(12.34))).toEqual({ text: '$12.34', tone: 'normal', caption: 'Account balance' });
      expect(openRouterHeadline(credits(-1.5))).toEqual(expect.objectContaining({ text: '-$1.50', tone: 'zero' }));
      expect(openRouterHeadline(credits(0))).toEqual(expect.objectContaining({ tone: 'zero' }));
    });

    it('falls back to the spend cap and says so when the account balance is unreadable', () => {
      const headline = openRouterHeadline({
        ...base,
        status: 'ok',
        creditsStatus: 'unavailable',
        creditsIssue: { kind: 'forbidden', httpStatus: 403 },
        keyLimit: { limit: 5, limitRemaining: 4.5, resetWindow: 'monthly' },
      });

      expect(headline).toEqual({
        text: '$4.50',
        tone: 'normal',
        caption: "Monthly remaining on this key's spend cap; account balance unavailable",
      });
    });

    it('treats a $0 cap as a configured guard, not as a balance', () => {
      expect(openRouterHeadline({
        ...base,
        status: 'ok',
        creditsStatus: 'unavailable',
        keyLimit: { limit: 0, limitRemaining: 0, resetWindow: 'unknown' },
      })).toEqual({
        text: '$0.00',
        tone: 'zero',
        caption: 'Key spend cap is $0 (no headroom); account balance unavailable',
      });
    });

    it('shows a muted dash when there is neither a balance nor a cap', () => {
      expect(openRouterHeadline({
        ...base,
        status: 'ok',
        creditsStatus: 'unavailable',
        keyLimit: { limit: null, limitRemaining: null, resetWindow: 'unknown' },
      })).toEqual(expect.objectContaining({ text: '—', tone: 'muted' }));
    });
  });
});
