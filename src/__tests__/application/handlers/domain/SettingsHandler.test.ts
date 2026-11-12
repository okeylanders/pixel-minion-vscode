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

    /** package.json defaults, as `inspect()` reports them in `defaultValue`. */
    const CONTRIBUTED_DEFAULTS: Record<string, string> = {
      imageModel: 'google/gemini-3.1-flash-image',
      svgModel: 'recraft/recraft-v4.1-pro-vector',
    };
    type Scopes = { globalValue?: string; workspaceValue?: string };
    const savedScopes = (scopes: Record<string, Scopes>) => {
      mockConfig.inspect.mockImplementation((key: string) => ({
        key,
        defaultValue: CONTRIBUTED_DEFAULTS[key],
        ...scopes[key],
      }));
    };

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
          imageModel: 'x-ai/grok-imagine-image-2.0',
          svgModel: 'anthropic/claude-opus-5.5',
        },
      }));
    });

    it('fixes each scope that held a retired id, once: clears it when the replacement is the default', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      savedScopes({
        imageModel: { globalValue: 'x-ai/grok-imagine-image-quality' },
        svgModel: { workspaceValue: 'anthropic/claude-opus-5-fast' },
      });

      await requestSettings();
      await requestSettings();

      expect(mockConfig.update.mock.calls).toEqual([
        ['imageModel', 'x-ai/grok-imagine-image-2.0', vscode.ConfigurationTarget.Global],
        ['svgModel', 'anthropic/claude-opus-5.5', vscode.ConfigurationTarget.Workspace],
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Model x-ai/grok-imagine-image-quality is no longer available on OpenRouter; switching imageModel to x-ai/grok-imagine-image-2.0'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Model anthropic/claude-opus-5-fast is no longer available on OpenRouter; switching svgModel to anthropic/claude-opus-5.5'
      );
    });

    it('leaves Image API models alone now that Pixel speaks the Image API', async () => {
      // These were migrated as `images-api-only` until roadmap P3.
      savedSettings({ imageModel: 'krea/krea-2-large' });
      savedScopes({ imageModel: { globalValue: 'krea/krea-2-large', workspaceValue: 'openai/gpt-image-1' } });

      await requestSettings();

      expect(mockConfig.update).not.toHaveBeenCalled();
      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.SETTINGS_DATA,
        payload: expect.objectContaining({ imageModel: 'krea/krea-2-large' }),
      }));
    });

    it('clears a workspace value that would fall back to the replacement anyway', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      // The user value is already the replacement: the workspace can just fall back to it.
      savedScopes({
        imageModel: { globalValue: 'x-ai/grok-imagine-image-2.0', workspaceValue: 'x-ai/grok-imagine-image-quality' },
      });

      await requestSettings();

      expect(mockConfig.update.mock.calls).toEqual([
        ['imageModel', undefined, vscode.ConfigurationTarget.Workspace],
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Model x-ai/grok-imagine-image-quality is no longer available on OpenRouter; clearing the workspace imageModel setting so it falls back to x-ai/grok-imagine-image-2.0'
      );
    });

    it('writes the replacement into a workspace value when clearing would pick up another user choice', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      savedScopes({
        imageModel: { globalValue: 'openai/gpt-5.4-image-2', workspaceValue: 'x-ai/grok-imagine-image-quality' },
      });

      await requestSettings();

      expect(mockConfig.update.mock.calls).toEqual([
        ['imageModel', 'x-ai/grok-imagine-image-2.0', vscode.ConfigurationTarget.Workspace],
      ]);
    });

    it('clears a workspace value that falls back to a user value migrated in the same pass', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      savedScopes({
        svgModel: { globalValue: 'anthropic/claude-opus-4', workspaceValue: 'anthropic/claude-opus-5-fast' },
      });

      await requestSettings();

      expect(mockConfig.update.mock.calls).toEqual([
        ['svgModel', 'anthropic/claude-opus-5.5', vscode.ConfigurationTarget.Global],
        ['svgModel', undefined, vscode.ConfigurationTarget.Workspace],
      ]);
    });

    it('leaves live model selections alone, including ones the curated list has superseded', async () => {
      // Claude Opus 5 left the SVG list for Opus 5.5 but OpenRouter still serves it.
      savedScopes({
        imageModel: { globalValue: 'openai/gpt-5.4-image-2' },
        svgModel: { globalValue: 'anthropic/claude-opus-5' },
      });

      await requestSettings();

      expect(mockConfig.update).not.toHaveBeenCalled();
    });

    it('still answers the settings request when persisting the replacement fails', async () => {
      savedSettings({ imageModel: 'x-ai/grok-imagine-image-quality' });
      savedScopes({ imageModel: { globalValue: 'x-ai/grok-imagine-image-quality' } });
      mockConfig.update.mockRejectedValue(new Error('read-only settings'));

      await requestSettings();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to migrate retired imageModel selection',
        expect.any(Error)
      );
      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.SETTINGS_DATA,
        payload: expect.objectContaining({ imageModel: 'x-ai/grok-imagine-image-2.0' }),
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
