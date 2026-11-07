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
import React, { useState, useEffect, useRef } from 'react';
import { MessageType, TabId, normalizeTabId } from '@messages';
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
  TabImageIcon,
  TabSvgIcon,
  BrandMark,
} from './components';
import {
  useSettings,
  usePersistence,
  useMessageRouter,
  useImageGeneration,
  useSVGGeneration,
  useTokenTracking,
  useOpenRouterBalance,
} from './hooks';
import { useOverlayDismiss } from './hooks/useOverlayDismiss';
import { useReducedMotion } from './hooks/useReducedMotion';

const TABS: Tab[] = [
  { id: 'image', label: 'Image', icon: <TabImageIcon /> },
  { id: 'svg', label: 'SVG', icon: <TabSvgIcon /> },
];

export function App(): JSX.Element {
  const { saveState, loadState } = usePersistence();

  // Load persisted state
  const persistedState = loadState();

  // Active tab state. A saved id no tab renders (e.g. the old 'settings'
  // tab, now an overlay) falls back to Image instead of an empty panel.
  const [activeTab, setActiveTab] = useState<TabId>(
    () => normalizeTabId(persistedState.activeTab)
  );

  // Reduced motion (OS or VS Code setting): stamped on the root for CSS.
  const reducedMotion = useReducedMotion();

  // Settings overlay state (triggered from title bar gear icon)
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);

  // Initialize domain hooks with persisted state
  const settings = useSettings(persistedState.settings);
  const tokenTracking = useTokenTracking(persistedState.tokenTracking);
  const balances = useOpenRouterBalance(settings.apiKeyStatusKnown);
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

    // Prompt Enhancement messages - route based on type
    [MessageType.ENHANCE_PROMPT_RESPONSE]: (msg) => {
      const payload = msg.payload as { type?: string };
      if (payload.type === 'image') {
        imageGeneration.handleEnhanceResponse(msg);
      } else if (payload.type === 'svg') {
        svgGeneration.handleEnhanceResponse(msg);
      }
    },

    // Settings messages
    [MessageType.SETTINGS_DATA]: settings.handleSettingsData,
    [MessageType.API_KEY_STATUS]: settings.handleApiKeyStatus,

    // Token tracking messages
    [MessageType.TOKEN_USAGE_UPDATE]: tokenTracking.handleTokenUsageUpdate,
    [MessageType.OPENROUTER_BALANCE_DATA]: balances.handleBalanceData,

    // Settings overlay
    [MessageType.OPEN_SETTINGS_OVERLAY]: () => setShowSettingsOverlay(true),

    // Error routing - check source to route to correct handler
    [MessageType.ERROR]: (msg) => {
      const source = msg.source ?? '';
      if (source.includes('image') || source.includes('Image')) {
        imageGeneration.handleError(msg);
      } else if (source.includes('svg') || source.includes('SVG')) {
        svgGeneration.handleError(msg);
      } else if (source.includes('enhance')) {
        // Route enhance errors based on active tab or to both
        imageGeneration.handleError(msg);
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

  // Escape (top overlay only), focus capture/return, inert frame, focus trap,
  // paint order. Opening focuses the heading, not the quiet Close button.
  const settingsOverlayRef = useRef<HTMLDivElement>(null);
  const settingsHeadingRef = useOverlayDismiss<HTMLHeadingElement>({
    open: showSettingsOverlay,
    onClose: handleCloseSettings,
    containerRef: settingsOverlayRef,
  });

  return (
    <div className="app-container" data-reduced-motion={reducedMotion ? '' : undefined}>
      <AppHeader
        balances={balances}
        lastRequest={tokenTracking.lastRequest}
        requestedAt={tokenTracking.requestedAt}
      />

      <TabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        ariaLabel="Pixel Minion modes"
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

      {/* Settings overlay — a modal dialog over the whole webview */}
      {showSettingsOverlay && (
        <div
          ref={settingsOverlayRef}
          className="settings-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-overlay-title"
        >
          <div className="settings-overlay-content">
            {/* Header with centered icon and title */}
            <header className="settings-header">
              <div className="settings-header-content">
                <BrandMark className="settings-header-logo" />
                <h2 id="settings-overlay-title" ref={settingsHeadingRef} tabIndex={-1}>
                  Settings
                </h2>
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
