/**
 * SettingsHandler - Handles Settings domain messages including API key management
 *
 * Pattern: Domain handler with secure secret storage integration
 * Reference: docs/example-repo/src/application/handlers/domain/ConfigurationHandler.ts
 */
import * as vscode from 'vscode';
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  SettingsPayload,
  UpdateSettingPayload,
  ApiKeyStatusPayload,
  SaveApiKeyPayload,
} from '@messages';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';

export class SettingsHandler {
  private readonly configSection = 'templateExtension';

  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService
  ) {}

  /**
   * Handle request for current settings
   */
  async handleRequestSettings(message: MessageEnvelope): Promise<void> {
    this.logger.debug('Fetching current settings');
    const config = vscode.workspace.getConfiguration(this.configSection);

    const settings: SettingsPayload = {
      maxConversationTurns: config.get<number>('maxConversationTurns', 10),
      openRouterModel: config.get<string>('openRouterModel', 'anthropic/claude-sonnet-4'),
    };

    this.postMessage(createEnvelope<SettingsPayload>(
      MessageType.SETTINGS_DATA,
      'extension.settings',
      settings,
      message.correlationId
    ));
  }

  /**
   * Handle setting update
   */
  async handleUpdateSetting(message: MessageEnvelope<UpdateSettingPayload>): Promise<void> {
    const { key, value } = message.payload;
    const config = vscode.workspace.getConfiguration(this.configSection);

    try {
      this.logger.info(`Updating setting: ${key}`);
      await config.update(key, value, vscode.ConfigurationTarget.Global);

      // Send updated settings back
      await this.handleRequestSettings(message);
    } catch (error) {
      this.logger.error(`Failed to update setting ${key}`, error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.settings',
        {
          message: `Failed to update setting ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'SETTINGS_UPDATE_ERROR',
        },
        message.correlationId
      ));
    }
  }

  /**
   * Handle API key status request (only returns boolean, never the key!)
   */
  async handleApiKeyStatusRequest(message: MessageEnvelope): Promise<void> {
    const isConfigured = await this.secretStorage.hasApiKey();
    this.logger.debug(`API key status: ${isConfigured ? 'configured' : 'not configured'}`);

    this.postMessage(createEnvelope<ApiKeyStatusPayload>(
      MessageType.API_KEY_STATUS,
      'extension.settings',
      { isConfigured },
      message.correlationId
    ));
  }

  /**
   * Handle saving API key to secure storage
   */
  async handleSaveApiKey(message: MessageEnvelope<SaveApiKeyPayload>): Promise<void> {
    try {
      this.logger.info('Saving API key to secure storage');
      await this.secretStorage.setApiKey(message.payload.apiKey);

      // Send updated status
      this.postMessage(createEnvelope<ApiKeyStatusPayload>(
        MessageType.API_KEY_STATUS,
        'extension.settings',
        { isConfigured: true },
        message.correlationId
      ));
    } catch (error) {
      this.logger.error('Failed to save API key', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.settings',
        {
          message: 'Failed to save API key',
          code: 'API_KEY_SAVE_ERROR',
        },
        message.correlationId
      ));
    }
  }

  /**
   * Handle clearing API key from secure storage
   */
  async handleClearApiKey(message: MessageEnvelope): Promise<void> {
    try {
      this.logger.info('Clearing API key from secure storage');
      await this.secretStorage.deleteApiKey();

      // Send updated status
      this.postMessage(createEnvelope<ApiKeyStatusPayload>(
        MessageType.API_KEY_STATUS,
        'extension.settings',
        { isConfigured: false },
        message.correlationId
      ));
    } catch (error) {
      this.logger.error('Failed to clear API key', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.settings',
        {
          message: 'Failed to clear API key',
          code: 'API_KEY_CLEAR_ERROR',
        },
        message.correlationId
      ));
    }
  }
}
