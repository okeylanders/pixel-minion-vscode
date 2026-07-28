/**
 * AppHeader - Main application header with branding and token widget
 *
 * Layout matches Prose Minion design:
 * - Left: Title + subtitle
 * - Right: Icon (64x64) + token widget
 *
 * SVG uses currentColor for theme adaptation.
 */
import React from 'react';
import { TokenUsage } from '@messages';
import { UseOpenRouterBalanceReturn } from '@hooks/domain';

export interface AppHeaderProps {
  balances: UseOpenRouterBalanceReturn;
  lastRequest?: TokenUsage;
  requestedAt?: number;
}

/**
 * Pixel Minion skull monitor icon - inline SVG for theme adaptation
 * Uses currentColor to match VSCode theme
 */
const PixelMinionIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1024 1024"
    className={className}
    fill="currentColor"
    aria-hidden="true"
  >
    <title>Pixel Minion</title>
    {/* Monitor Frame */}
    <g id="monitor-frame">
      <path
        fillRule="evenodd"
        d="M112 112C67.8 112 32 147.8 32 192V704C32 748.2 67.8 784 112 784H912C956.2 784 992 748.2 992 704V192C992 147.8 956.2 112 912 112H112ZM112 192H912V704H112V192Z"
      />
      <rect x="432" y="784" width="160" height="80" />
      <path d="M312 864H712C729.6 864 744 878.4 744 896V912H280V896C280 878.4 294.4 864 312 864Z" />
    </g>
    {/* Glitch Pixels */}
    <g id="glitch-pixels">
      <rect x="160" y="240" width="40" height="40" />
      <rect x="210" y="240" width="40" height="40" />
      <rect x="160" y="290" width="40" height="40" />
      <rect x="260" y="290" width="40" height="40" />
      <rect x="160" y="340" width="40" height="40" />
      <rect x="210" y="450" width="40" height="40" />
      <rect x="160" y="550" width="40" height="40" />
      <rect x="210" y="550" width="40" height="40" />
      <rect x="260" y="600" width="40" height="40" />
      <rect x="160" y="600" width="40" height="40" />
      <rect x="360" y="220" width="40" height="40" />
      <rect x="610" y="220" width="40" height="40" />
      <rect x="660" y="220" width="40" height="40" />
      <rect x="810" y="240" width="40" height="40" />
      <rect x="760" y="240" width="40" height="40" />
      <rect x="810" y="290" width="40" height="40" />
      <rect x="710" y="340" width="40" height="40" />
      <rect x="810" y="450" width="40" height="40" />
      <rect x="810" y="550" width="40" height="40" />
      <rect x="760" y="550" width="40" height="40" />
      <rect x="710" y="600" width="40" height="40" />
      <rect x="810" y="600" width="40" height="40" />
      <rect x="760" y="650" width="40" height="40" />
    </g>
    {/* Skull */}
    <g id="skull">
      <path
        fillRule="evenodd"
        d="M512 260C406 260 320 346 320 452C320 520 350 570 390 600L390 630C390 660 410 680 440 680H584C614 680 634 660 634 630L634 600C674 570 704 520 704 452C704 346 618 260 512 260ZM432 400C405 400 384 421 384 448C384 475 405 496 432 496C459 496 480 475 480 448C480 421 459 400 432 400ZM592 400C565 400 544 421 544 448C544 475 565 496 592 496C619 496 640 475 640 448C640 421 619 400 592 400ZM512 520L482 570H542L512 520Z"
      />
    </g>
  </svg>
);

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
        <div className="app-header-mark" aria-hidden="true">
          <PixelMinionIcon className="app-header-icon" />
        </div>
        <div className="app-header-titles">
          <h1 className="app-title">Pixel Minion</h1>
          <p className="app-subtitle">AI-powered graphics generation</p>
        </div>
        <button
          type="button"
          className={`pm-balance-summary${expanded ? ' expanded' : ''}`}
          onClick={() => setExpanded(value => !value)}
          title="Show OpenRouter account details"
        >
          <span className="pm-provider-dot" />
          <span>OpenRouter</span>
          <strong>{balanceText}</strong>
          <span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
        </button>
        <button
          type="button"
          className={`app-header-refresh${balances.isLoading ? ' spinning' : ''}`}
          onClick={balances.refresh}
          disabled={balances.isLoading}
          title="Refresh OpenRouter balance"
          aria-label="Refresh OpenRouter balance"
        >
          ↻
        </button>
      </header>

      {expanded && (
        <section className="pm-account-strip">
          <div>
            <span>ACCOUNT BALANCE</span>
            <strong>{balanceText}</strong>
            {balances.balance?.credits && (
              <small>
                ${balances.balance.credits.totalUsage.toFixed(2)} used of ${balances.balance.credits.totalCredits.toFixed(2)}
              </small>
            )}
          </div>
          <div>
            <span>LAST REQUEST</span>
            <strong>{lastCost !== undefined ? `$${lastCost.toFixed(4)}` : '—'}</strong>
            <small>
              {lastRequest
                ? `${lastRequest.totalTokens.toLocaleString()} tokens${requestedAt ? ` · ${new Date(requestedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`
                : 'No request this session'}
            </small>
          </div>
          <div>
            <span>UPDATED</span>
            <strong>
              {balances.balance?.fetchedAt
                ? new Date(balances.balance.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                : '—'}
            </strong>
            <small>{balances.balance?.reason ?? 'Refreshes after generation'}</small>
          </div>
        </section>
      )}
    </div>
  );
}
