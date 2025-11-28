/**
 * SecretStorageService - Secure API key storage using VSCode's SecretStorage API
 *
 * Pattern: Wraps VSCode's SecretStorage which uses OS-level encryption:
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: libsecret
 *
 * Reference: docs/example-repo/src/infrastructure/secrets/SecretStorageService.ts
 */
import * as vscode from 'vscode';
import { LoggingService } from '@logging';

export class SecretStorageService {
  private static readonly API_KEY_SECRET = 'openRouterApiKey';

  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly logger: LoggingService
  ) {}

  /**
   * Get the stored API key
   * @returns The API key or undefined if not set
   */
  async getApiKey(): Promise<string | undefined> {
    try {
      return await this.secrets.get(SecretStorageService.API_KEY_SECRET);
    } catch (error) {
      this.logger.error('Failed to retrieve API key from SecretStorage', error);
      return undefined;
    }
  }

  /**
   * Store the API key securely
   * @param key The API key to store
   */
  async setApiKey(key: string): Promise<void> {
    try {
      await this.secrets.store(SecretStorageService.API_KEY_SECRET, key);
      this.logger.info('API key stored successfully');
    } catch (error) {
      this.logger.error('Failed to store API key in SecretStorage', error);
      throw error;
    }
  }

  /**
   * Delete the stored API key
   */
  async deleteApiKey(): Promise<void> {
    try {
      await this.secrets.delete(SecretStorageService.API_KEY_SECRET);
      this.logger.info('API key deleted successfully');
    } catch (error) {
      this.logger.error('Failed to delete API key from SecretStorage', error);
      throw error;
    }
  }

  /**
   * Check if an API key is configured (without revealing the key)
   * @returns true if an API key is stored
   */
  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return key !== undefined && key.length > 0;
  }

  /**
   * Register a listener for secret changes
   * @param listener Callback when secrets change
   * @returns Disposable to unregister the listener
   */
  onDidChange(listener: () => void): vscode.Disposable {
    return this.secrets.onDidChange(() => {
      listener();
    });
  }
}
