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
import { ProviderBalancesCollapsed, ProviderBalancesStrip } from '../balances';

export interface AppHeaderProps {
  balances: UseOpenRouterBalanceReturn;
  lastRequest?: TokenUsage;
  requestedAt?: number;
}

export function AppHeader({
  balances,
  lastRequest,
  requestedAt,
}: AppHeaderProps): JSX.Element {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="app-header-shell">
      <header className="app-header">
        <BrandMark className="app-header-mark" />
        <div className="app-header-titles">
          <h1 className="app-title">Pixel Minion</h1>
          <p className="app-subtitle">Images &amp; SVGs, conjured in your editor</p>
        </div>
        <ProviderBalancesCollapsed
          balances={balances}
          expanded={expanded}
          onToggle={() => setExpanded(value => !value)}
        />
      </header>

      <ProviderBalancesStrip
        balances={balances}
        hidden={!expanded}
        onCollapse={() => setExpanded(false)}
        lastRequest={lastRequest}
        requestedAt={requestedAt}
      />
    </div>
  );
}
