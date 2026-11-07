/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AppHeader } from '../../../../../presentation/webview/components/layout/AppHeader';
import type { UseOpenRouterBalanceReturn } from '../../../../../presentation/webview/hooks/domain/useOpenRouterBalance';
import type { OpenRouterBalancePayload, TokenUsage } from '@messages';

const NOW = new Date(2026, 10, 7, 18, 0).getTime();

function balances(
  balance: OpenRouterBalancePayload | null,
  overrides: Partial<UseOpenRouterBalanceReturn> = {}
): UseOpenRouterBalanceReturn {
  return {
    balance,
    isLoading: false,
    refresh: jest.fn(),
    handleBalanceData: jest.fn(),
    handleBalanceReset: jest.fn(),
    ...overrides,
  };
}

function renderHeader(
  value: UseOpenRouterBalanceReturn,
  extra: { lastRequest?: TokenUsage; requestedAt?: number } = {}
) {
  const utils = render(<AppHeader balances={value} {...extra} />);
  const pill = screen.getByRole('button', { name: /OpenRouter/ });
  const strip = utils.container.querySelector('#px-openrouter-balance-details') as HTMLElement;
  const amount = pill.querySelector('.px-balance-summary-amount') as HTMLElement;
  const expand = () => fireEvent.click(pill);
  return { ...utils, pill, strip, amount, expand };
}

const ok = (fields: Partial<OpenRouterBalancePayload>): OpenRouterBalancePayload => ({
  status: 'ok',
  creditsStatus: 'ok',
  accountEpoch: 0,
  fetchedAt: new Date(2026, 10, 7, 17, 55).getTime(),
  ...fields,
});

describe('OpenRouter balance header', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  describe('disclosure', () => {
    it('wires the pill to the strip with aria-expanded and aria-controls', () => {
      const { pill, strip, expand } = renderHeader(balances(ok({
        credits: { totalCredits: 20, totalUsage: 7.66, remaining: 12.34 },
      })));

      expect(pill.getAttribute('aria-controls')).toBe('px-openrouter-balance-details');
      expect(strip).not.toBeNull();
      expect(pill.getAttribute('aria-expanded')).toBe('false');
      expect(strip.hidden).toBe(true);

      expand();
      expect(pill.getAttribute('aria-expanded')).toBe('true');
      expect(strip.hidden).toBe(false);

      const hide = within(strip).getByRole('button', { name: /Account balance/ });
      expect(hide.hasAttribute('aria-expanded')).toBe(false);
      fireEvent.click(hide);
      expect(pill.getAttribute('aria-expanded')).toBe('false');
      expect(strip.hidden).toBe(true);
    });
  });

  it('mutes "no key" in the pill and asks for a key in the card', () => {
    const { amount, strip } = renderHeader(balances({ status: 'no_key', creditsStatus: 'no_key', accountEpoch: 0, fetchedAt: NOW }));

    expect(amount.textContent).toBe('no key');
    expect(amount.classList.contains('is-muted')).toBe(true);
    expect(strip.textContent).toContain('Add an OpenRouter key in Settings.');
  });

  it('shows the account balance with the key spend limit as a sub-line', () => {
    const { amount, strip } = renderHeader(balances(ok({
      credits: { totalCredits: 20, totalUsage: 7.66, remaining: 12.34 },
      keyLimit: { limit: 5, limitRemaining: 4.5, resetWindow: 'monthly' },
    })));

    expect(amount.textContent).toBe('$12.34');
    expect(strip.querySelector('.px-balance-amount')?.textContent).toBe('$12.34');
    expect(strip.querySelector('.px-balance-label')?.textContent).toBe('Account balance');
    expect(strip.querySelector('.px-balance-sub')?.textContent).toBe('Key spend limit: $4.50 / $5.00');
  });

  it('headlines a spend cap as a cap, never as the account balance, when /credits fails', () => {
    const { amount, pill, strip } = renderHeader(balances(ok({
      creditsStatus: 'unavailable',
      creditsIssue: { kind: 'forbidden', httpStatus: 403 },
      keyLimit: { limit: 5, limitRemaining: 4.5, resetWindow: 'monthly' },
    })));

    expect(amount.textContent).toBe('$4.50');
    expect(pill.getAttribute('title')).toMatch(/^Monthly remaining on this key's spend cap; account balance unavailable/);
    expect(strip.querySelector('.px-balance-amount')?.textContent).toBe('$4.50/ $5.00');
    expect(strip.querySelector('.px-balance-label')?.textContent).toBe('Monthly remaining');
    const labels = Array.from(strip.querySelectorAll('.px-balance-label')).map((el) => el.textContent);
    expect(labels).toEqual(['Monthly remaining']);
    expect(strip.querySelectorAll('.px-balance-note')).toHaveLength(1);
    expect(strip.querySelector('.px-balance-note')?.textContent).toBe(
      'Account balance unavailable: not permitted for this key (HTTP 403).'
    );
  });

  it('labels a capped key with no reset window as a spend cap', () => {
    const { strip } = renderHeader(balances(ok({
      creditsStatus: 'unavailable',
      keyLimit: { limit: 5, limitRemaining: 1, resetWindow: 'unknown' },
    })));

    expect(strip.querySelector('.px-balance-label')?.textContent).toBe('Spend cap remaining');
  });

  it('gives a $0 cap its own state instead of "$0.00 / $0.00"', () => {
    const { strip } = renderHeader(balances(ok({
      creditsStatus: 'unavailable',
      keyLimit: { limit: 0, limitRemaining: 0, resetWindow: 'unknown' },
    })));

    expect(strip.querySelector('.px-balance-label')?.textContent).toBe('Spend cap (no headroom)');
    expect(strip.textContent).not.toContain('$0.00 / $0.00');
  });

  it('formats an overdrawn account with Intl and zero styling in both places', () => {
    const { amount, strip } = renderHeader(balances(ok({
      credits: { totalCredits: 10, totalUsage: 11.5, remaining: -1.5 },
    })));

    expect(amount.textContent).toBe('-$1.50');
    expect(amount.classList.contains('is-zero')).toBe(true);
    const cardAmount = strip.querySelector('.px-balance-amount') as HTMLElement;
    expect(cardAmount.textContent).toBe('-$1.50');
    expect(cardAmount.classList.contains('is-zero')).toBe(true);
  });

  it('says why the balance is unavailable exactly once', () => {
    const { amount, strip } = renderHeader(balances({
      status: 'unavailable',
      creditsStatus: 'unavailable',
      keyIssue: { kind: 'invalid_key', httpStatus: 401 },
      creditsIssue: { kind: 'invalid_key', httpStatus: 401 },
      accountEpoch: 0,
      fetchedAt: NOW,
    }));

    expect(amount.textContent).toBe('invalid key');
    const reason = 'Balance unavailable: API key rejected (HTTP 401). Check the key in Settings.';
    expect(strip.textContent?.split(reason)).toHaveLength(2);
    expect(strip.textContent).not.toContain('rejected (HTTP 401) ·');
  });

  it('tells an offline user something different from an invalid-key user', () => {
    const { amount, strip } = renderHeader(balances({
      status: 'unavailable',
      creditsStatus: 'unavailable',
      keyIssue: { kind: 'network' },
      creditsIssue: { kind: 'network' },
      accountEpoch: 0,
      fetchedAt: NOW,
    }));

    expect(amount.textContent).toBe('offline');
    expect(strip.textContent).toContain("Balance unavailable: couldn't reach OpenRouter.");
  });

  it('shows last known figures as last known, with when they were read and why they could not refresh', () => {
    const { amount, pill, strip, expand } = renderHeader(balances(ok({
      creditsStatus: 'unavailable',
      credits: { totalCredits: 20, totalUsage: 7.66, remaining: 12.34 },
      creditsIssue: { kind: 'network' },
      keyIssue: { kind: 'network' },
      stale: { figuresFetchedAt: new Date(2026, 10, 7, 15, 41).getTime(), issue: { kind: 'network' } },
      fetchedAt: NOW,
    })));
    expand();

    expect(amount.textContent).toBe('$12.34');
    expect(amount.classList.contains('is-stale')).toBe(true);
    expect(pill.getAttribute('title')).toMatch(/^Account balance\. Last known figures: couldn't reach OpenRouter\./);
    expect(strip.querySelector('.px-balance-card')?.classList.contains('is-stale')).toBe(true);
    expect(strip.querySelector('.px-balance-amount')?.textContent).toBe('$12.34');
    expect(strip.querySelector('.px-balance-note')?.textContent).toBe(
      "Showing last known figures: couldn't reach OpenRouter."
    );
    const updated = strip.querySelectorAll('.px-balance-meta span')[1] as HTMLElement;
    expect(updated.textContent).toMatch(/^Updated3:41\sPM · last known · couldn't refresh$/);
  });

  it('keeps the current value on screen while a refresh is in flight', () => {
    const { amount, pill, strip, expand } = renderHeader(balances(ok({
      credits: { totalCredits: 20, totalUsage: 7.66, remaining: 12.34 },
    }), { isLoading: true }));
    expand();

    expect(amount.textContent).toBe('$12.34');
    expect(pill.classList.contains('is-refreshing')).toBe(true);
    const card = strip.querySelector('.px-balance-card') as HTMLElement;
    expect(card.getAttribute('aria-busy')).toBe('true');
    expect(card.querySelector('.px-balance-amount')?.textContent).toBe('$12.34');
    expect(strip.textContent).toContain('refreshing…');
    const refresh = within(strip).getByRole('button', { name: 'Refresh OpenRouter balance' });
    expect(refresh.getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps keyboard focus on the refresh button while it is busy, and ignores clicks', () => {
    const value = balances(ok({ credits: { totalCredits: 1, totalUsage: 0, remaining: 1 } }));
    const { strip, expand, rerender } = renderHeader(value);
    expand();
    const refresh = within(strip).getByRole('button', { name: 'Refresh OpenRouter balance' });
    refresh.focus();
    expect(refresh.getAttribute('aria-disabled')).toBeNull();

    // The refresh is now in flight.
    const busy = { ...value, isLoading: true };
    rerender(<AppHeader balances={busy} />);

    expect(refresh.hasAttribute('disabled')).toBe(false);
    expect(refresh.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(refresh);
    fireEvent.click(refresh);
    expect(value.refresh).not.toHaveBeenCalled();
  });

  it('shows the placeholder only before the first payload', () => {
    const { amount } = renderHeader(balances(null, { isLoading: true }));

    expect(amount.textContent).toBe('…');
    expect(amount.classList.contains('is-muted')).toBe(true);
  });

  it('forces a refresh from the refresh button', () => {
    const value = balances(ok({ credits: { totalCredits: 1, totalUsage: 0, remaining: 1 } }));
    const { strip, expand } = renderHeader(value);
    expand();

    fireEvent.click(within(strip).getByRole('button', { name: 'Refresh OpenRouter balance' }));

    expect(value.refresh).toHaveBeenCalledTimes(1);
  });

  describe('last request', () => {
    const usage: TokenUsage = { promptTokens: 10, completionTokens: 1224, totalTokens: 1234, costUsd: 0.0123 };

    it('shows the time for a request made today', () => {
      const { strip } = renderHeader(balances(null), {
        lastRequest: usage,
        requestedAt: new Date(2026, 10, 7, 15, 41).getTime(),
      });

      const row = strip.querySelector('.px-balance-meta span') as HTMLElement;
      expect(row.textContent).toMatch(/^Last request\$0\.0123 · 1,234 tokens · 3:41\sPM$/);
    });

    it('dates a request from an earlier day instead of presenting it as this session', () => {
      const { strip } = renderHeader(balances(null), {
        lastRequest: usage,
        requestedAt: new Date(2026, 10, 6, 15, 41).getTime(),
      });

      const row = strip.querySelector('.px-balance-meta span') as HTMLElement;
      expect(row.textContent).toMatch(/Nov 6/);
      expect(strip.textContent).not.toMatch(/this session/i);
    });

    it('says "None yet" with no request', () => {
      const { strip } = renderHeader(balances(null));

      expect((strip.querySelector('.px-balance-meta span') as HTMLElement).textContent).toBe('Last requestNone yet');
    });
  });
});
