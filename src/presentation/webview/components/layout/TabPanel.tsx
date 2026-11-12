/**
 * TabPanel - Individual tab panel wrapper
 *
 * Pattern: Accessible tab panel, labelled by its tab in TabBar (the ids come
 * from the shared tabDomId / panelDomId helpers so they can't drift).
 */
import React from 'react';
import { TabId } from '@messages';
import { panelDomId, tabDomId } from './TabBar';

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
      id={panelDomId(id)}
      aria-labelledby={tabDomId(id)}
      hidden={!isActive}
      className="tab-panel"
    >
      {isActive && children}
    </div>
  );
}
