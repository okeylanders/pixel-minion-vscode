/**
 * ProviderBalancesStrip - the expanded OpenRouter account card disclosed by
 * ProviderBalancesCollapsed. Always rendered (hidden when collapsed) so the
 * pill's aria-controls target exists.
 *
 * What it leads with, honestly:
 * - `/credits` readable: the account balance, with any key spend cap below.
 * - `/credits` not readable but the key has a cap: the cap's headroom,
 *   labelled as a cap ("Monthly remaining"), plus "Account balance
 *   unavailable" and why, once.
 * - neither: why the balance is unavailable (invalid key vs offline vs
 *   OpenRouter error), once.
 * A refresh keeps the current figures on screen and marks the card busy.
 */
import React from 'react';
import { OpenRouterBalancePayload, OpenRouterKeyLimit, TokenUsage } from '@messages';
import { UseOpenRouterBalanceReturn } from '@hooks/domain';
import {
  RESET_LABELS,
  describeIssue,
  describeUnavailable,
  formatRequestCost,
  formatUsd,
  formatWhen,
  hasEnforcedLimit,
} from './balanceFormat';
import { ChevronIcon, RefreshIcon } from './balanceIcons';
import '../../styles/components/provider-balances.css';

/** Target of the pill's aria-controls. There is one header per webview. */
export const BALANCE_DETAILS_ID = 'px-openrouter-balance-details';

interface ProviderBalancesStripProps {
  balances: UseOpenRouterBalanceReturn;
  hidden: boolean;
  onCollapse: () => void;
  lastRequest?: TokenUsage;
  requestedAt?: number;
}

export const ProviderBalancesStrip: React.FC<ProviderBalancesStripProps> = ({
  balances,
  hidden,
  onCollapse,
  lastRequest,
  requestedAt,
}) => {
  const { balance, isLoading, refresh } = balances;
  const refreshing = isLoading && balance !== null;

  return (
    <section
      id={BALANCE_DETAILS_ID}
      className="px-balances-strip"
      hidden={hidden}
      aria-label="OpenRouter account balance"
    >
      <div className="px-balances-strip-head">
        <button
          type="button"
          className="px-balances-strip-title"
          onClick={onCollapse}
          title="Hide account balance"
        >
          <ChevronIcon up />
          Account balance
        </button>
        <button
          type="button"
          className={`px-balances-refresh${isLoading ? ' spinning' : ''}`}
          onClick={refresh}
          disabled={isLoading}
          title="Refresh OpenRouter balance"
          aria-label="Refresh OpenRouter balance"
        >
          <RefreshIcon />
        </button>
      </div>
      <div className={`px-balance-card${refreshing ? ' is-refreshing' : ''}`} aria-busy={isLoading}>
        <div className="px-balance-provider">
          <span className="px-provider-dot" aria-hidden="true" />
          <span>OpenRouter</span>
        </div>
        <OpenRouterBody balance={balance} />
        <div className="px-balance-meta">
          <span>
            <b>Last request</b>
            {lastRequest ? describeLastRequest(lastRequest, requestedAt) : 'None yet'}
          </span>
          <span>
            <b>Updated</b>
            {balance ? formatWhen(balance.fetchedAt) : '—'}
            {refreshing ? ' · refreshing…' : ''}
          </span>
        </div>
      </div>
    </section>
  );
};

function describeLastRequest(usage: TokenUsage, requestedAt?: number): string {
  const cost = usage.costUsd !== undefined ? formatRequestCost(usage.costUsd) : 'cost unavailable';
  const when = requestedAt ? ` · ${formatWhen(requestedAt)}` : '';
  return `${cost} · ${usage.totalTokens.toLocaleString()} tokens${when}`;
}

const OpenRouterBody: React.FC<{ balance: OpenRouterBalancePayload | null }> = ({ balance }) => {
  if (!balance) {
    return <div className="px-balance-amount is-muted">…</div>;
  }
  if (balance.status === 'no_key') {
    return <div className="px-balance-note">Add an OpenRouter key in Settings.</div>;
  }
  if (balance.status === 'unavailable') {
    return <div className="px-balance-note">{describeUnavailable(balance)}</div>;
  }

  const { credits, keyLimit } = balance;
  if (credits) {
    return (
      <>
        <div className={`px-balance-amount${credits.remaining <= 0 ? ' is-zero' : ''}`}>
          {formatUsd(credits.remaining)}
        </div>
        <div className="px-balance-label">Account balance</div>
        {hasEnforcedLimit(keyLimit) && <KeyLimitDetail keyLimit={keyLimit} />}
      </>
    );
  }

  const creditsNote = `Account balance unavailable: ${describeIssue(balance.creditsIssue)}.`;
  if (hasEnforcedLimit(keyLimit)) {
    return (
      <>
        <KeyLimitHeadline keyLimit={keyLimit} />
        <div className="px-balance-note">{creditsNote}</div>
      </>
    );
  }
  // The key has no cap and the account balance can't be read.
  return <div className="px-balance-note">{creditsNote}</div>;
};

type EnforcedLimit = OpenRouterKeyLimit & { limit: number; limitRemaining: number };

/** The key's spend cap as the headline, used only when the account balance is unreadable. */
const KeyLimitHeadline: React.FC<{ keyLimit: EnforcedLimit }> = ({ keyLimit }) => {
  // A $0 cap is a configured guard, not depletion: say so instead of "$0.00 / $0.00".
  if (keyLimit.limit === 0) {
    return (
      <>
        <div className="px-balance-amount is-zero">{formatUsd(0)}</div>
        <div className="px-balance-label">Spend cap (no headroom)</div>
      </>
    );
  }
  return (
    <>
      <div className={`px-balance-amount${keyLimit.limitRemaining <= 0 ? ' is-zero' : ''}`}>
        {formatUsd(keyLimit.limitRemaining)}
        <span className="px-balance-of">/ {formatUsd(keyLimit.limit)}</span>
      </div>
      <div className="px-balance-label">{RESET_LABELS[keyLimit.resetWindow]}</div>
      <HeadroomBar keyLimit={keyLimit} />
    </>
  );
};

/** The key's spend cap as a sub-line under the account balance. */
const KeyLimitDetail: React.FC<{ keyLimit: EnforcedLimit }> = ({ keyLimit }) => {
  if (keyLimit.limit === 0) {
    return <div className="px-balance-sub is-zero">Key spend cap: no headroom</div>;
  }
  return (
    <>
      <div className={`px-balance-sub${keyLimit.limitRemaining <= 0 ? ' is-zero' : ''}`}>
        Key spend limit: {formatUsd(keyLimit.limitRemaining)} / {formatUsd(keyLimit.limit)}
      </div>
      <HeadroomBar keyLimit={keyLimit} />
    </>
  );
};

const HeadroomBar: React.FC<{ keyLimit: EnforcedLimit }> = ({ keyLimit }) => {
  const pct = Math.max(0, Math.min(100, (keyLimit.limitRemaining / keyLimit.limit) * 100));
  return (
    <div className="px-balance-bar" aria-hidden="true">
      <span style={{ width: `${pct}%` }} />
    </div>
  );
};
