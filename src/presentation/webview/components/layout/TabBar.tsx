/**
 * TabBar - Tab navigation component
 *
 * Pattern: Controlled component for tab switching
 * Reference: docs/example-repo/src/presentation/webview/components/shared/TabBar.tsx
 */
import React from 'react';
import { TabId } from '@messages';

export interface Tab {
  id: TabId;
  label: string;
}

export interface TabBarProps {
  tabs: Tab[];
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps): JSX.Element {
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
