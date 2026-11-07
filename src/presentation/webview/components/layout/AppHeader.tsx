/**
 * AppHeader — the family "branded marquee" lockup: the colour logo on Pixel's
 * dark CRT tile, the product title + tagline, and one brand hairline as the
 * bottom rule (global.css `.app-header`). The right side carries the
 * collapsed OpenRouter balance summary; clicking it discloses the full strip.
 */
import React from 'react';
import { TokenUsage } from '@messages';
import { UseOpenRouterBalanceReturn } from '@hooks/domain';
import { BrandMark } from './BrandMark';

export interface AppHeaderProps {
  balances: UseOpenRouterBalanceReturn;
  lastRequest?: TokenUsage;
  requestedAt?: number;
}

const ChevronIcon: React.FC<{ up?: boolean }> = ({ up = false }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d={up ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const RefreshIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const formatUsd = (value: number, minimumFractionDigits = 2): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits: Math.max(minimumFractionDigits, 4),
  }).format(value);

export function AppHeader({
  balances,
  lastRequest,
  requestedAt,
}: AppHeaderProps): JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const remaining = balances.balance?.credits?.remaining;
  const balanceText = balances.isLoading
    ? '…'
    : balances.balance?.status === 'no_key'
      ? 'no key'
      : remaining !== undefined
        ? `$${remaining.toFixed(2)}`
        : balances.balance?.keyLimit?.limitRemaining !== null &&
            balances.balance?.keyLimit?.limitRemaining !== undefined
          ? `$${balances.balance.keyLimit.limitRemaining.toFixed(2)}`
          : '—';
  const lastCost = lastRequest?.costUsd;

  return (
    <div className="app-header-shell">
      <header className="app-header">
        <BrandMark className="app-header-mark" />
        <div className="app-header-titles">
          <h1 className="app-title">Pixel Minion</h1>
          <p className="app-subtitle">Images &amp; SVGs, conjured in your editor</p>
        </div>
        <button
          type="button"
          className={`pm-balance-summary${expanded ? ' expanded' : ''}`}
          onClick={() => setExpanded(value => !value)}
          title="Show OpenRouter account details"
        >
          <span className="pm-provider-dot" />
          <span className="pm-balance-summary-name">OpenRouter</span>
          <strong>{balanceText}</strong>
          <span className="pm-balance-summary-chevron">
            <ChevronIcon up={expanded} />
          </span>
        </button>
      </header>

      {expanded && (
        <section className="pm-balances-strip">
          <div className="pm-balances-strip-head">
            <button
              type="button"
              className="pm-balances-strip-title"
              onClick={() => setExpanded(false)}
              aria-expanded="true"
              title="Hide account balance"
            >
              <ChevronIcon up />
              Account balance
            </button>
            <button
              type="button"
              className={`pm-balances-refresh${balances.isLoading ? ' spinning' : ''}`}
              onClick={balances.refresh}
              disabled={balances.isLoading}
              title="Refresh OpenRouter balance"
              aria-label="Refresh OpenRouter balance"
            >
              <RefreshIcon />
            </button>
          </div>
          <div className="pm-balance-card">
            <div className="pm-balance-provider">
              <span className="pm-provider-dot" />
              <span>OpenRouter</span>
            </div>
            {balances.balance?.status === 'no_key' ? (
              <div className="pm-balance-status">Add an OpenRouter key in Settings</div>
            ) : balances.balance?.status === 'unavailable' ? (
              <div className="pm-balance-status">
                {balances.balance.reason ?? 'Balance unavailable'}
              </div>
            ) : (
              <>
                <div className="pm-balance-amount">{balanceText}</div>
                <div className="pm-balance-label">Account balance</div>
                {balances.balance?.keyLimit?.limit !== null &&
                  balances.balance?.keyLimit?.limit !== undefined &&
                  balances.balance.keyLimit.limitRemaining !== null &&
                  balances.balance.keyLimit.limitRemaining !== undefined && (
                    <>
                      <div className="pm-balance-sub">
                        Key spend limit: {formatUsd(balances.balance.keyLimit.limitRemaining)} /{' '}
                        {formatUsd(balances.balance.keyLimit.limit)}
                      </div>
                      <div className="pm-balance-bar" aria-hidden="true">
                        <span
                          style={{
                            width: `${Math.max(0, Math.min(
                              100,
                              balances.balance.keyLimit.limit === 0
                                ? 0
                                : (balances.balance.keyLimit.limitRemaining /
                                    balances.balance.keyLimit.limit) *
                                    100
                            ))}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
              </>
            )}
            <div className="pm-balance-meta">
              <span>
                <b>Last request</b>
                {lastRequest
                  ? `${lastCost !== undefined ? formatUsd(lastCost, 4) : 'cost unavailable'} · ${lastRequest.totalTokens.toLocaleString()} tokens${requestedAt ? ` · ${new Date(requestedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`
                  : 'No request this session'}
              </span>
              <span>
                <b>Updated</b>
                {balances.balance?.fetchedAt
                  ? new Date(balances.balance.fetchedAt).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : '—'}
                {balances.balance?.reason ? ` · ${balances.balance.reason}` : ''}
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
