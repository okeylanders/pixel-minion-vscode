/**
 * TabPanel - Individual tab panel wrapper
 *
 * Pattern: Accessible tab panel with proper ARIA attributes
 */
import React from 'react';
import { TabId } from '@messages';

export interface TabPanelProps {
  id: TabId;
  activeTab: TabId;
  children: React.ReactNode;
}

export function TabPanel({ id, activeTab, children }: TabPanelProps): JSX.Element {
  const isActive = id === activeTab;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!isActive}
      className="tab-panel"
    >
      {isActive && children}
    </div>
  );
}
