/**
 * ProviderBalancesCollapsed - the compact OpenRouter balance pill in the
 * header. It is a disclosure button for ProviderBalancesStrip, so it carries
 * aria-expanded/aria-controls. The headline comes from `openRouterHeadline`,
 * the same helper the expanded card uses.
 */
import React from 'react';
import { UseOpenRouterBalanceReturn } from '@hooks/domain';
import { openRouterHeadline } from './balanceFormat';
import { ChevronIcon } from './balanceIcons';
import { BALANCE_DETAILS_ID } from './ProviderBalancesStrip';
import '../../styles/components/provider-balances.css';

interface ProviderBalancesCollapsedProps {
  balances: UseOpenRouterBalanceReturn;
  expanded: boolean;
  onToggle: () => void;
}

export const ProviderBalancesCollapsed: React.FC<ProviderBalancesCollapsedProps> = ({
  balances,
  expanded,
  onToggle,
}) => {
  const headline = openRouterHeadline(balances.balance);
  const refreshing = balances.isLoading && balances.balance !== null;

  return (
    <button
      type="button"
      className={`px-balance-summary${expanded ? ' is-expanded' : ''}${refreshing ? ' is-refreshing' : ''}`}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={BALANCE_DETAILS_ID}
      title={`${headline.caption}. ${expanded ? 'Hide' : 'Show'} OpenRouter account details.`}
    >
      <span className="px-provider-dot" aria-hidden="true" />
      <span className="px-balance-summary-name">OpenRouter</span>
      <strong className={`px-balance-summary-amount is-${headline.tone}`}>{headline.text}</strong>
      <span className="px-balance-summary-chevron" aria-hidden="true">
        <ChevronIcon up={expanded} />
      </span>
    </button>
  );
};
