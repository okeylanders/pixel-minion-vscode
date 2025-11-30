/**
 * useSettings - Settings domain hook with API key management
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 * Message handlers are exposed for App-level registration (prose-minion pattern).
 */
import { useState, useCallback, useEffect } from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  SettingsPayload,
  ApiKeyStatusPayload,
  AspectRatio,
} from '@messages';

// 1. State Interface
export interface SettingsState {
  maxConversationTurns: number;
  openRouterModel: string;
  imageModel: string;
  svgModel: string;
  apiKeyConfigured: boolean;
  isLoading: boolean;
}

// 2. Actions Interface
export interface SettingsActions {
  updateSetting: <K extends keyof SettingsPayload>(
    key: K,
    value: SettingsPayload[K]
  ) => void;
  saveApiKey: (apiKey: string) => void;
  clearApiKey: () => void;
  refreshSettings: () => void;
  refreshApiKeyStatus: () => void;
}

// 2b. Message Handlers Interface (for App-level routing)
export interface SettingsHandlers {
  handleSettingsData: (message: MessageEnvelope) => void;
  handleApiKeyStatus: (message: MessageEnvelope) => void;
}

// 3. Persistence Interface
export interface SettingsPersistence {
  maxConversationTurns: number;
  openRouterModel: string;
  imageModel: string;
  svgModel: string;
}

export type UseSettingsReturn = SettingsState & SettingsActions & SettingsHandlers & {
  persistedState: SettingsPersistence;
};

export function useSettings(
  initialState?: Partial<SettingsPersistence>
): UseSettingsReturn {
  const vscode = useVSCodeApi();

  // State
  const [maxConversationTurns, setMaxConversationTurns] = useState(
    initialState?.maxConversationTurns ?? 10
  );
  const [openRouterModel, setOpenRouterModel] = useState(
    initialState?.openRouterModel ?? 'openai/gpt-5.1'
  );
  const [imageModel, setImageModel] = useState(
    initialState?.imageModel ?? 'google/gemini-3-pro-image-preview'
  );
  const [svgModel, setSvgModel] = useState(
    initialState?.svgModel ?? 'openai/gpt-5.1-codex'
  );
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Message handlers (exposed for App-level routing)
  const handleSettingsData = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as SettingsPayload;
    setMaxConversationTurns(payload.maxConversationTurns);
    setOpenRouterModel(payload.openRouterModel);
    setImageModel(payload.imageModel);
    setSvgModel(payload.svgModel);
    setIsLoading(false);
  }, []);

  const handleApiKeyStatus = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as ApiKeyStatusPayload;
    setApiKeyConfigured(payload.isConfigured);
  }, []);

  // Actions
  const updateSetting = useCallback(
    <K extends keyof SettingsPayload>(key: K, value: SettingsPayload[K]) => {
      vscode.postMessage(
        createEnvelope(MessageType.UPDATE_SETTING, 'webview.settings', {
          key,
          value,
        })
      );

      // Optimistic update
      if (key === 'maxConversationTurns') {
        setMaxConversationTurns(value as number);
      } else if (key === 'openRouterModel') {
        setOpenRouterModel(value as string);
      } else if (key === 'imageModel') {
        setImageModel(value as string);
      } else if (key === 'svgModel') {
        setSvgModel(value as string);
      }
    },
    [vscode]
  );

  const saveApiKey = useCallback(
    (apiKey: string) => {
      vscode.postMessage(
        createEnvelope(MessageType.SAVE_API_KEY, 'webview.settings', { apiKey })
      );
    },
    [vscode]
  );

  const clearApiKey = useCallback(() => {
    vscode.postMessage(
      createEnvelope(MessageType.CLEAR_API_KEY, 'webview.settings', {})
    );
  }, [vscode]);

  const refreshSettings = useCallback(() => {
    setIsLoading(true);
    vscode.postMessage(
      createEnvelope(MessageType.REQUEST_SETTINGS, 'webview.settings', {})
    );
  }, [vscode]);

  const refreshApiKeyStatus = useCallback(() => {
    vscode.postMessage(
      createEnvelope(MessageType.REQUEST_API_KEY_STATUS, 'webview.settings', {})
    );
  }, [vscode]);

  // Request initial data
  useEffect(() => {
    refreshSettings();
    refreshApiKeyStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistence
  const persistedState: SettingsPersistence = {
    maxConversationTurns,
    openRouterModel,
    imageModel,
    svgModel,
  };

  return {
    // State
    maxConversationTurns,
    openRouterModel,
    imageModel,
    svgModel,
    apiKeyConfigured,
    isLoading,
    // Actions
    updateSetting,
    saveApiKey,
    clearApiKey,
    refreshSettings,
    refreshApiKeyStatus,
    // Message Handlers (for App-level routing)
    handleSettingsData,
    handleApiKeyStatus,
    // Persistence
    persistedState,
  };
}
