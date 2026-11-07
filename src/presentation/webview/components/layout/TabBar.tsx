/**
 * TabBar — the family card-grid mode bar (icon over label).
 *
 * Implements the WAI-ARIA tabs pattern: the labelled tablist owns tabs that
 * point at their panels (`aria-controls` ↔ TabPanel's `aria-labelledby`),
 * only the active tab is in the Tab order, and Left/Right/Home/End move
 * focus and activate (see tabKeyboard.ts).
 */
import React from 'react';
import { TabId } from '@messages';
import { nextTabIndex } from './tabKeyboard';

export interface Tab {
  id: TabId;
  label: string;
  icon?: React.ReactNode;
}

export interface TabBarProps {
  tabs: Tab[];
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  /** Accessible name for the tablist. */
  ariaLabel: string;
  /** Optional - disables all tab buttons (useful for loading states) */
  disabled?: boolean;
}

/** DOM ids shared by a tab and its panel. */
export const tabDomId = (id: TabId): string => `tab-${id}`;
export const panelDomId = (id: TabId): string => `panel-${id}`;

export function TabBar({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel,
  disabled = false,
}: TabBarProps): JSX.Element {
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  // The tab that holds the single Tab stop: the active one, or the first if
  // the active id matches no tab (e.g. stale persisted state).
  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  const tabStopIndex = activeIndex >= 0 ? activeIndex : 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const focused = tabRefs.current.findIndex(tab => tab === event.target);
    const current = focused >= 0 ? focused : tabStopIndex;
    const next = nextTabIndex(event.key, current, tabs.length);
    if (next === null || disabled) {
      return;
    }
    event.preventDefault();
    onTabChange(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="tab-bar" role="tablist" aria-label={ariaLabel} onKeyDown={handleKeyDown}>
      {tabs.map((tab, index) => {
        const selected = activeTab === tab.id;
        return (
          <button
            type="button"
            key={tab.id}
            ref={element => {
              tabRefs.current[index] = element;
            }}
            id={tabDomId(tab.id)}
            role="tab"
            aria-selected={selected}
            aria-controls={panelDomId(tab.id)}
            tabIndex={index === tabStopIndex ? 0 : -1}
            className={`tab-button${selected ? ' active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            disabled={disabled}
          >
            {tab.icon && <span className="tab-icon">{tab.icon}</span>}
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
