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
import { RETIRED_MODELS, RETIRED_MODEL_REPLACEMENTS, RetiredModelReason } from '../../../shared/models';

/** Settings that hold a catalog model id and must never point at a retired one. */
const MODEL_SETTING_KEYS = ['imageModel', 'svgModel'] as const;
type ModelSettingKey = typeof MODEL_SETTING_KEYS[number];

export class SettingsHandler {
  private readonly configSection = 'pixelMinion';
  private retiredModelMigration?: Promise<void>;

  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService,
    private readonly onSettingsChanged?: (settings: SettingsPayload) => void,
    private readonly onSecretsChanged?: () => void
  ) {}

  /**
   * Handle request for current settings
   */
  async handleRequestSettings(message: MessageEnvelope): Promise<void> {
    this.logger.debug('Fetching current settings');
    await this.migrateRetiredModelSelections();
    const settings = this.getCurrentSettings();

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

      const updatedSettings = this.getCurrentSettings();
      this.onSettingsChanged?.(updatedSettings);

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
      this.onSecretsChanged?.();

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
      this.onSecretsChanged?.();

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

  /**
   * Build the current settings payload from configuration
   */
  getCurrentSettings(): SettingsPayload {
    const config = vscode.workspace.getConfiguration(this.configSection);
    const legacyConfig = vscode.workspace.getConfiguration('templateExtension');

    return {
      maxConversationTurns: config.get<number>('maxConversationTurns', legacyConfig.get('maxConversationTurns', 10)),
      openRouterModel: config.get<string>('openRouterModel', legacyConfig.get('openRouterModel', 'openai/gpt-5.1')),
      imageModel: replaceRetiredModel(config.get<string>('imageModel', 'google/gemini-3.1-flash-image')),
      svgModel: replaceRetiredModel(config.get<string>('svgModel', 'recraft/recraft-v4.1-pro-vector')),
    };
  }

  /**
   * Rewrite saved model selections that OpenRouter has delisted. Runs once per
   * handler (the webview's first settings request). `getCurrentSettings()`
   * already substitutes on read, so a failed write never sends a dead id to a
   * request; this just stops the stale value lingering in settings.json.
   */
  private migrateRetiredModelSelections(): Promise<void> {
    this.retiredModelMigration ??= this.runRetiredModelMigration();
    return this.retiredModelMigration;
  }

  private async runRetiredModelMigration(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration(this.configSection);
      for (const key of MODEL_SETTING_KEYS) {
        const inspected = config.inspect<string>(key);
        // User settings fall back to the contributed (package.json) default;
        // workspace settings fall back to the user value, once migrated.
        const userValue = await this.migrateRetiredModel(
          config, key, inspected?.globalValue, vscode.ConfigurationTarget.Global, inspected?.defaultValue
        );
        await this.migrateRetiredModel(
          config, key, inspected?.workspaceValue, vscode.ConfigurationTarget.Workspace,
          userValue ?? inspected?.defaultValue
        );
      }
    } catch (error) {
      // Never block the settings response on housekeeping.
      this.logger.error('Retired model migration failed', error);
    }
  }

  /**
   * Move one scope off a retired id. When the replacement is what the scope
   * would fall back to anyway (for user settings, the contributed default),
   * the saved value is cleared instead of rewritten: writing today's default
   * explicitly would pin the user to it after the default moves on.
   *
   * Returns the value this scope now contributes (undefined when unset), for
   * the next scope's fallback.
   */
  private async migrateRetiredModel(
    config: vscode.WorkspaceConfiguration,
    key: ModelSettingKey,
    saved: string | undefined,
    target: vscode.ConfigurationTarget,
    fallback: string | undefined
  ): Promise<string | undefined> {
    const retired = saved ? RETIRED_MODELS[saved] : undefined;
    if (!saved || !retired) return saved;
    const { replacement } = retired;
    const clear = replacement === fallback;

    const why = RETIRED_REASON_TEXT[retired.reason];
    const scope = target === vscode.ConfigurationTarget.Global ? 'user' : 'workspace';
    this.logger.info(clear
      ? `Model ${saved} ${why}; clearing the ${scope} ${key} setting so it falls back to ${replacement}`
      : `Model ${saved} ${why}; switching ${key} to ${replacement}`);
    try {
      await config.update(key, clear ? undefined : replacement, target);
    } catch (error) {
      this.logger.error(`Failed to migrate retired ${key} selection`, error);
      // Still saved, so still read (and substituted) as the replacement.
      return replacement;
    }
    return clear ? undefined : replacement;
  }
}

/** How the migration log explains each reason a model was retired. */
const RETIRED_REASON_TEXT: Record<RetiredModelReason, string> = {
  delisted: 'is no longer available on OpenRouter',
};

function replaceRetiredModel(model: string): string {
  return RETIRED_MODEL_REPLACEMENTS[model] ?? model;
}
