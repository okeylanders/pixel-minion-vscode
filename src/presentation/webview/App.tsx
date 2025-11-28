/**
 * App - Main webview application component
 *
 * Pattern: Thin orchestrator that composes domain hooks
 * Responsibilities:
 * - Manages active tab state
 * - Composes all domain hooks
 * - Handles persistence
 * - Routes to appropriate views
 * - Manages settings overlay (triggered from title bar gear icon)
 *
 * Reference: docs/example-repo/src/presentation/webview/App.tsx
 */
import React, { useState, useEffect } from 'react';
import { MessageType, TabId } from '@messages';
import {
  TabBar,
  ViewContainer,
  TabPanel,
  HelloWorldView,
  SettingsView,
  Tab2View,
  Tab,
} from './components';
import {
  useHelloWorld,
  useSettings,
  usePersistence,
  useMessageRouter,
} from './hooks';

// Define available tabs
const TABS: Tab[] = [
  { id: 'helloWorld', label: 'Hello World' },
  { id: 'tab2', label: 'Tab 2' },
];

export function App(): JSX.Element {
  const { saveState, loadState } = usePersistence();
  const { register } = useMessageRouter();

  // Load persisted state
  const persistedState = loadState();

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabId>(
    (persistedState.activeTab as TabId) || 'helloWorld'
  );

  // Settings overlay state (triggered from title bar gear icon)
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);

  // Initialize domain hooks with persisted state
  const helloWorld = useHelloWorld(persistedState.helloWorld);
  const settings = useSettings(persistedState.settings);

  // Listen for OPEN_SETTINGS_OVERLAY message from extension
  useEffect(() => {
    register(MessageType.OPEN_SETTINGS_OVERLAY, () => {
      setShowSettingsOverlay(true);
    });
  }, [register]);

  // Persist state on changes
  useEffect(() => {
    saveState({
      activeTab,
      helloWorld: helloWorld.persistedState,
      settings: settings.persistedState,
    });
  }, [
    activeTab,
    helloWorld.persistedState,
    settings.persistedState,
    saveState,
  ]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
  };

  const handleCloseSettings = () => {
    setShowSettingsOverlay(false);
  };

  return (
    <div className="app-container">
      <TabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <ViewContainer>
        <TabPanel id="helloWorld" activeTab={activeTab}>
          <HelloWorldView helloWorld={helloWorld} />
        </TabPanel>

        <TabPanel id="tab2" activeTab={activeTab}>
          <Tab2View />
        </TabPanel>
      </ViewContainer>

      {/* Settings Panel - triggered from title bar gear icon */}
      {showSettingsOverlay && (
        <div className="settings-overlay">
          <div className="settings-overlay-header">
            <h2>Settings</h2>
            <button
              type="button"
              className="settings-close-button"
              onClick={handleCloseSettings}
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>
          <div className="settings-overlay-content">
            <SettingsView settings={settings} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
