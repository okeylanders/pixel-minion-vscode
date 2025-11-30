/**
 * TabBar - Button-style tab navigation component
 *
 * Pattern: Controlled component for tab switching
 * Design: Prose Minion button-style tabs with icons
 * Reference: docs/example-repo/src/presentation/webview/components/shared/TabBar.tsx
 */
import React from 'react';
import { TabId } from '@messages';

export interface Tab {
  id: TabId;
  label: string;
  /** Optional emoji/icon (e.g., '🖼️', '📐') - renders before label */
  icon?: string;
}

export interface TabBarProps {
  tabs: Tab[];
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  /** Optional - disables all tab buttons (useful for loading states) */
  disabled?: boolean;
}

export function TabBar({
  tabs,
  activeTab,
  onTabChange,
  disabled = false,
}: TabBarProps): JSX.Element {
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id ? 'true' : 'false'}
          aria-label={tab.label}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          disabled={disabled}
        >
          {tab.icon && <span className="tab-icon">{tab.icon}</span>}
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
