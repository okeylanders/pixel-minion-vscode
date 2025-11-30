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
  AppHeader,
  TabBar,
  ViewContainer,
  TabPanel,
  SettingsView,
  Tab,
  ImageGenerationView,
  SVGGenerationView,
  OpenRouterAlert,
} from './components';
import {
  useSettings,
  usePersistence,
  useMessageRouter,
  useImageGeneration,
  useSVGGeneration,
  useTokenTracking,
} from './hooks';

// Define available tabs with icons (Prose Minion style)
const TABS: Tab[] = [
  { id: 'image', label: 'Image', icon: '🎨' },
  { id: 'svg', label: 'SVG', icon: '📐' },
];

/**
 * Settings icon (reuses Pixel Minion skull) - inline SVG for theme adaptation
 */
const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1024 1024"
    className={className}
    fill="currentColor"
    aria-hidden="true"
  >
    <g id="monitor-frame">
      <path
        fillRule="evenodd"
        d="M112 112C67.8 112 32 147.8 32 192V704C32 748.2 67.8 784 112 784H912C956.2 784 992 748.2 992 704V192C992 147.8 956.2 112 912 112H112ZM112 192H912V704H112V192Z"
      />
      <rect x="432" y="784" width="160" height="80" />
      <path d="M312 864H712C729.6 864 744 878.4 744 896V912H280V896C280 878.4 294.4 864 312 864Z" />
    </g>
    <g id="skull">
      <path
        fillRule="evenodd"
        d="M512 260C406 260 320 346 320 452C320 520 350 570 390 600L390 630C390 660 410 680 440 680H584C614 680 634 660 634 630L634 600C674 570 704 520 704 452C704 346 618 260 512 260ZM432 400C405 400 384 421 384 448C384 475 405 496 432 496C459 496 480 475 480 448C480 421 459 400 432 400ZM592 400C565 400 544 421 544 448C544 475 565 496 592 496C619 496 640 475 640 448C640 421 619 400 592 400ZM512 520L482 570H542L512 520Z"
      />
    </g>
  </svg>
);

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
  const tokenTracking = useTokenTracking(persistedState.tokenTracking);
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

    // Token tracking messages
    [MessageType.TOKEN_USAGE_UPDATE]: tokenTracking.handleTokenUsageUpdate,

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
      tokenTracking: tokenTracking.persistedState,
    });
  }, [
    activeTab,
    settings.persistedState,
    imageGeneration.persistedState,
    svgGeneration.persistedState,
    tokenTracking.persistedState,
    saveState,
  ]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
  };

  const handleCloseSettings = () => {
    setShowSettingsOverlay(false);
  };

  const handleOpenSettings = () => {
    setShowSettingsOverlay(true);
  };

  return (
    <div className="app-container">
      <AppHeader
        tokenCount={tokenTracking.usage.totalTokens}
        tokenCost={tokenTracking.usage.costUsd ?? 0}
      />

      <TabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <ViewContainer>
        {/* Show alert when API key not configured */}
        {!settings.apiKeyConfigured && (
          <OpenRouterAlert onOpenSettings={handleOpenSettings} />
        )}

        <TabPanel id="image" activeTab={activeTab}>
          <ImageGenerationView imageGeneration={imageGeneration} />
        </TabPanel>

        <TabPanel id="svg" activeTab={activeTab}>
          <SVGGenerationView svgGeneration={svgGeneration} />
        </TabPanel>
      </ViewContainer>

      {/* Settings Panel - Prose Minion style overlay */}
      {showSettingsOverlay && (
        <div className="settings-overlay">
          <div className="settings-overlay-content">
            {/* Header with centered icon and title */}
            <header className="settings-header">
              <div className="settings-header-content">
                <SettingsIcon className="settings-header-icon" />
                <h2>Settings</h2>
              </div>
              <button
                type="button"
                className="settings-close-button"
                onClick={handleCloseSettings}
                aria-label="Close settings"
              >
                Close
              </button>
            </header>
            <SettingsView settings={settings} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
