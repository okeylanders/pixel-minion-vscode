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
  inspect: jest.fn(),
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
        imageModel: 'google/gemini-2.5-flash-image',
        svgModel: 'openai/gpt-5.3-codex',
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
            imageModel: 'google/gemini-2.5-flash-image',
            svgModel: 'openai/gpt-5.3-codex',
          },
          correlationId: 'correlation-123',
        })
      );
    });
  });

  describe('retired model migration', () => {
    const requestSettings = () => handler.handleRequestSettings(
      createEnvelope(MessageType.REQUEST_SETTINGS, 'webview.settings', {})
    );

    const savedSettings = (overrides: Record<string, string>) => {
      mockConfig.get.mockImplementation((key: string, defaultValue: unknown) => {
        const settings: Record<string, unknown> = {
          maxConversationTurns: 10,
          openRouterModel: 'openai/gpt-5.1',
          imageModel: 'google/gemini-3.1-flash-image',
          svgModel: 'recraft/recraft-v4.1-pro-vector',
          ...overrides,
        };
        return settings[key] ?? defaultValue;
      });
    };

    it('reports the replacement for a delisted saved model instead of the dead id', async () => {
      savedSettings({
        imageModel: 'x-ai/grok-imagine-image-quality',
        svgModel: 'anthropic/claude-opus-5-fast',
      });

      await requestSettings();

      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.SETTINGS_DATA,
        payload: {
          maxConversationTurns: 10,
          openRouterModel: 'openai/gpt-5.1',
          imageModel: 'google/gemini-3.1-flash-image',
          svgModel: 'anthropic/claude-opus-5',
        },
      }));
    });

    it('persists the replacement in the scope that held the delisted id, once', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      mockConfig.inspect.mockImplementation((key: string) => (
        key === 'imageModel'
          ? { key, globalValue: 'x-ai/grok-imagine-image-quality' }
          : { key, workspaceValue: 'anthropic/claude-opus-5-fast' }
      ));

      await requestSettings();
      await requestSettings();

      expect(mockConfig.update.mock.calls).toEqual([
        ['imageModel', 'google/gemini-3.1-flash-image', vscode.ConfigurationTarget.Global],
        ['svgModel', 'anthropic/claude-opus-5', vscode.ConfigurationTarget.Workspace],
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Model x-ai/grok-imagine-image-quality is no longer available on OpenRouter; switching imageModel to google/gemini-3.1-flash-image'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Model anthropic/claude-opus-5-fast is no longer available on OpenRouter; switching svgModel to anthropic/claude-opus-5'
      );
    });

    it('moves Image-API-only selections and says why', async () => {
      savedSettings({ imageModel: 'krea/krea-2-large' });
      mockConfig.inspect.mockImplementation((key: string) => (
        key === 'imageModel' ? { key, globalValue: 'krea/krea-2-large' } : { key }
      ));

      await requestSettings();

      expect(mockConfig.update.mock.calls).toEqual([
        ['imageModel', 'google/gemini-3.1-flash-image', vscode.ConfigurationTarget.Global],
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Model krea/krea-2-large is only served by OpenRouter's Image API, which Pixel Minion does not use yet; switching imageModel to google/gemini-3.1-flash-image"
      );
    });

    it('leaves live model selections alone', async () => {
      mockConfig.inspect.mockImplementation((key: string) => ({
        key,
        globalValue: key === 'imageModel' ? 'openai/gpt-5.4-image-2' : 'anthropic/claude-opus-5',
      }));

      await requestSettings();

      expect(mockConfig.update).not.toHaveBeenCalled();
    });

    it('still answers the settings request when persisting the replacement fails', async () => {
      savedSettings({ imageModel: 'x-ai/grok-imagine-image-quality' });
      mockConfig.inspect.mockImplementation((key: string) => (
        key === 'imageModel' ? { key, globalValue: 'x-ai/grok-imagine-image-quality' } : { key }
      ));
      mockConfig.update.mockRejectedValue(new Error('read-only settings'));

      await requestSettings();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to migrate retired imageModel selection',
        expect.any(Error)
      );
      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.SETTINGS_DATA,
        payload: expect.objectContaining({ imageModel: 'google/gemini-3.1-flash-image' }),
      }));
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
