/**
 * OutputSubTabs - Sub-tab navigation for SVG output display
 *
 * Pattern: Controlled component for switching between SVG/Dashboard/Conversation views
 * Sprint 6.4 - SVG Tab Components
 */
import React from 'react';

export type OutputSubTab = 'svg' | 'dashboard' | 'conversation';

export interface OutputSubTabsProps {
  activeSubTab: OutputSubTab;
  onSubTabChange: (tab: OutputSubTab) => void;
  architectEnabled: boolean;
}

export function OutputSubTabs({
  activeSubTab,
  onSubTabChange,
  architectEnabled,
}: OutputSubTabsProps): JSX.Element {
  return (
    <div className="output-sub-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={activeSubTab === 'svg'}
        className={`output-sub-tab ${activeSubTab === 'svg' ? 'active' : ''}`}
        onClick={() => onSubTabChange('svg')}
      >
        SVG
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeSubTab === 'dashboard'}
        className={`output-sub-tab ${activeSubTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onSubTabChange('dashboard')}
        disabled={!architectEnabled}
        title={!architectEnabled ? 'Enable SVG Architect to view dashboard' : undefined}
      >
        Dashboard
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeSubTab === 'conversation'}
        className={`output-sub-tab ${activeSubTab === 'conversation' ? 'active' : ''}`}
        onClick={() => onSubTabChange('conversation')}
        disabled={!architectEnabled}
        title={!architectEnabled ? 'Enable SVG Architect to view conversation' : undefined}
      >
        Conversation
      </button>
    </div>
  );
}
