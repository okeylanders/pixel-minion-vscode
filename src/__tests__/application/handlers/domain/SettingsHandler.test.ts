/**
 * SettingsHandler tests
 *
 * Tests settings and API key management
 */
import { SettingsHandler } from '../../../../application/handlers/domain/SettingsHandler';
import {
  MessageType,
  createEnvelope,
  UpdateSettingPayload,
  SaveApiKeyPayload,
} from '@messages';
import * as vscode from 'vscode';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockSecretStorage = {
  getApiKey: jest.fn(),
  setApiKey: jest.fn(),
  deleteApiKey: jest.fn(),
  hasApiKey: jest.fn(),
};

// Mock vscode.workspace.getConfiguration
const mockConfig = {
  get: jest.fn(),
  update: jest.fn(),
};

describe('SettingsHandler', () => {
  let postMessage: jest.Mock;
  let handler: SettingsHandler;
  let onSettingsChanged: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    postMessage = jest.fn();
    onSettingsChanged = jest.fn();
    handler = new SettingsHandler(
      postMessage,
      mockSecretStorage as never,
      mockLogger as never,
      onSettingsChanged
    );

    // Setup default config mock behavior
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
    mockConfig.get.mockImplementation((key: string, defaultValue: unknown) => {
      const settings: Record<string, unknown> = {
        maxConversationTurns: 10,
        openRouterModel: 'anthropic/claude-sonnet-4',
        defaultImageModel: 'google/gemini-2.5-flash-image',
        defaultSVGModel: 'google/gemini-3-pro-preview',
        defaultAspectRatio: '1:1',
      };
      return settings[key] ?? defaultValue;
    });
  });

  describe('handleRequestSettings', () => {
    it('should return current settings', async () => {
      const message = createEnvelope(
        MessageType.REQUEST_SETTINGS,
        'webview.settings',
        {},
        'correlation-123'
      );

      await handler.handleRequestSettings(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SETTINGS_DATA,
          source: 'extension.settings',
          payload: {
            maxConversationTurns: 10,
            openRouterModel: 'anthropic/claude-sonnet-4',
            defaultImageModel: 'google/gemini-2.5-flash-image',
            defaultSVGModel: 'google/gemini-3-pro-preview',
            defaultAspectRatio: '1:1',
          },
          correlationId: 'correlation-123',
        })
      );
    });
  });

  describe('handleUpdateSetting', () => {
    it('should update a setting and return updated settings', async () => {
      mockConfig.update.mockResolvedValue(undefined);

      const message = createEnvelope<UpdateSettingPayload>(
        MessageType.UPDATE_SETTING,
        'webview.settings',
        { key: 'maxConversationTurns', value: 20 },
        'correlation-456'
      );

      await handler.handleUpdateSetting(message);

      expect(mockConfig.update).toHaveBeenCalledWith(
        'maxConversationTurns',
        20,
        vscode.ConfigurationTarget.Global
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Updating setting: maxConversationTurns');
      expect(onSettingsChanged).toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      mockConfig.update.mockRejectedValue(new Error('Update failed'));

      const message = createEnvelope<UpdateSettingPayload>(
        MessageType.UPDATE_SETTING,
        'webview.settings',
        { key: 'maxConversationTurns', value: 20 },
        'correlation-789'
      );

      await handler.handleUpdateSetting(message);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update setting maxConversationTurns',
        expect.any(Error)
      );

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: {
            message: expect.stringContaining('Failed to update setting'),
            code: 'SETTINGS_UPDATE_ERROR',
          },
          correlationId: 'correlation-789',
        })
      );
    });
  });

  describe('handleApiKeyStatusRequest', () => {
    it('should return true when API key is configured', async () => {
      mockSecretStorage.hasApiKey.mockResolvedValue(true);

      const message = createEnvelope(
        MessageType.REQUEST_API_KEY_STATUS,
        'webview.settings',
        {},
        'correlation-123'
      );

      await handler.handleApiKeyStatusRequest(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.API_KEY_STATUS,
          payload: { isConfigured: true },
          correlationId: 'correlation-123',
        })
      );
    });

    it('should return false when API key is not configured', async () => {
      mockSecretStorage.hasApiKey.mockResolvedValue(false);

      const message = createEnvelope(
        MessageType.REQUEST_API_KEY_STATUS,
        'webview.settings',
        {}
      );

      await handler.handleApiKeyStatusRequest(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.API_KEY_STATUS,
          payload: { isConfigured: false },
        })
      );
    });
  });

  describe('handleSaveApiKey', () => {
    it('should save API key and return success status', async () => {
      mockSecretStorage.setApiKey.mockResolvedValue(undefined);

      const message = createEnvelope<SaveApiKeyPayload>(
        MessageType.SAVE_API_KEY,
        'webview.settings',
        { apiKey: 'sk-test-key-123' },
        'correlation-456'
      );

      await handler.handleSaveApiKey(message);

      expect(mockSecretStorage.setApiKey).toHaveBeenCalledWith('sk-test-key-123');
      expect(mockLogger.info).toHaveBeenCalledWith('Saving API key to secure storage');

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.API_KEY_STATUS,
          payload: { isConfigured: true },
          correlationId: 'correlation-456',
        })
      );
    });

    it('should handle save errors', async () => {
      mockSecretStorage.setApiKey.mockRejectedValue(new Error('Storage error'));

      const message = createEnvelope<SaveApiKeyPayload>(
        MessageType.SAVE_API_KEY,
        'webview.settings',
        { apiKey: 'sk-test-key' },
        'correlation-789'
      );

      await handler.handleSaveApiKey(message);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save API key',
        expect.any(Error)
      );

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: {
            message: 'Failed to save API key',
            code: 'API_KEY_SAVE_ERROR',
          },
          correlationId: 'correlation-789',
        })
      );
    });
  });

  describe('handleClearApiKey', () => {
    it('should clear API key and return success status', async () => {
      mockSecretStorage.deleteApiKey.mockResolvedValue(undefined);

      const message = createEnvelope(
        MessageType.CLEAR_API_KEY,
        'webview.settings',
        {},
        'correlation-123'
      );

      await handler.handleClearApiKey(message);

      expect(mockSecretStorage.deleteApiKey).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Clearing API key from secure storage');

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.API_KEY_STATUS,
          payload: { isConfigured: false },
          correlationId: 'correlation-123',
        })
      );
    });

    it('should handle clear errors', async () => {
      mockSecretStorage.deleteApiKey.mockRejectedValue(new Error('Delete error'));

      const message = createEnvelope(
        MessageType.CLEAR_API_KEY,
        'webview.settings',
        {},
        'correlation-456'
      );

      await handler.handleClearApiKey(message);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to clear API key',
        expect.any(Error)
      );

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: {
            message: 'Failed to clear API key',
            code: 'API_KEY_CLEAR_ERROR',
          },
          correlationId: 'correlation-456',
        })
      );
    });
  });
});
