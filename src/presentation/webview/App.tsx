/**
 * App - Main webview application component
 *
 * Pattern: Thin orchestrator that composes domain hooks
 * Responsibilities:
 * - Manages active tab state
 * - Composes all domain hooks
 * - Routes messages at App level (prose-minion pattern)
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
  SettingsView,
  Tab,
  ImageGenerationView,
  SVGGenerationView,
} from './components';
import {
  useSettings,
  usePersistence,
  useMessageRouter,
  useImageGeneration,
  useSVGGeneration,
} from './hooks';

// Define available tabs
const TABS: Tab[] = [
  { id: 'image', label: 'Image Generation' },
  { id: 'svg', label: 'SVG Generation' },
];

export function App(): JSX.Element {
  const { saveState, loadState } = usePersistence();

  // Load persisted state
  const persistedState = loadState();

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabId>(
    (persistedState.activeTab as TabId) || 'image'
  );

  // Settings overlay state (triggered from title bar gear icon)
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);

  // Initialize domain hooks with persisted state
  const settings = useSettings(persistedState.settings);
  const imageGeneration = useImageGeneration(persistedState.imageGeneration, {
    selectedModel: settings.imageModel,
    onModelChange: (model) => settings.updateSetting('imageModel', model),
  });
  const svgGeneration = useSVGGeneration(persistedState.svgGeneration, {
    selectedModel: settings.svgModel,
    onModelChange: (model) => settings.updateSetting('svgModel', model),
  });

  // Message routing at App level (prose-minion pattern)
  // Handlers stay registered even when views unmount
  useMessageRouter({
    // Image Generation messages
    [MessageType.IMAGE_GENERATION_RESPONSE]: imageGeneration.handleGenerationResponse,
    [MessageType.IMAGE_SAVE_RESULT]: imageGeneration.handleSaveResult,

    // SVG Generation messages
    [MessageType.SVG_GENERATION_RESPONSE]: svgGeneration.handleGenerationResponse,
    [MessageType.SVG_SAVE_RESULT]: svgGeneration.handleSaveResult,

    // Settings messages
    [MessageType.SETTINGS_DATA]: settings.handleSettingsData,
    [MessageType.API_KEY_STATUS]: settings.handleApiKeyStatus,

    // Settings overlay
    [MessageType.OPEN_SETTINGS_OVERLAY]: () => setShowSettingsOverlay(true),

    // Error routing - check source to route to correct handler
    [MessageType.ERROR]: (msg) => {
      const source = msg.source ?? '';
      if (source.includes('image') || source.includes('Image')) {
        imageGeneration.handleError(msg);
      } else if (source.includes('svg') || source.includes('SVG')) {
        svgGeneration.handleError(msg);
      } else {
        // Default: send to both (they'll handle based on their loading state)
        imageGeneration.handleError(msg);
        svgGeneration.handleError(msg);
      }
    },
  });

  // Persist state on changes
  useEffect(() => {
    saveState({
      activeTab,
      settings: settings.persistedState,
      imageGeneration: imageGeneration.persistedState,
      svgGeneration: svgGeneration.persistedState,
    });
  }, [
    activeTab,
    settings.persistedState,
    imageGeneration.persistedState,
    svgGeneration.persistedState,
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
        <TabPanel id="image" activeTab={activeTab}>
          <ImageGenerationView imageGeneration={imageGeneration} />
        </TabPanel>

        <TabPanel id="svg" activeTab={activeTab}>
          <SVGGenerationView svgGeneration={svgGeneration} />
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
