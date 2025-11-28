/**
 * useSettings - Settings domain hook with API key management
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 */
import { useState, useCallback, useEffect } from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { useMessageRouter } from '../useMessageRouter';
import {
  MessageType,
  createEnvelope,
  SettingsPayload,
  ApiKeyStatusPayload,
} from '@messages';

// 1. State Interface
export interface SettingsState {
  maxConversationTurns: number;
  openRouterModel: string;
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

// 3. Persistence Interface
export interface SettingsPersistence {
  maxConversationTurns: number;
  openRouterModel: string;
}

export type UseSettingsReturn = SettingsState & SettingsActions & {
  persistedState: SettingsPersistence;
};

export function useSettings(
  initialState?: Partial<SettingsPersistence>
): UseSettingsReturn {
  const vscode = useVSCodeApi();
  const { register } = useMessageRouter();

  // State
  const [maxConversationTurns, setMaxConversationTurns] = useState(
    initialState?.maxConversationTurns ?? 10
  );
  const [openRouterModel, setOpenRouterModel] = useState(
    initialState?.openRouterModel ?? 'anthropic/claude-sonnet-4'
  );
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Register message handlers
  useEffect(() => {
    register(MessageType.SETTINGS_DATA, (message) => {
      const payload = message.payload as SettingsPayload;
      setMaxConversationTurns(payload.maxConversationTurns);
      setOpenRouterModel(payload.openRouterModel);
      setIsLoading(false);
    });

    register(MessageType.API_KEY_STATUS, (message) => {
      const payload = message.payload as ApiKeyStatusPayload;
      setApiKeyConfigured(payload.isConfigured);
    });
  }, [register]);

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
  };

  return {
    // State
    maxConversationTurns,
    openRouterModel,
    apiKeyConfigured,
    isLoading,
    // Actions
    updateSetting,
    saveApiKey,
    clearApiKey,
    refreshSettings,
    refreshApiKeyStatus,
    // Persistence
    persistedState,
  };
}
