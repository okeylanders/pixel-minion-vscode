/**
 * SettingsView - Settings panel with API key management
 *
 * Features:
 * - Secure API key input (password masked)
 * - VSCode settings sync
 * - Status indicators
 */
import React from 'react';
import { Input, SecretInput } from '../common';
import { UseSettingsReturn } from '@hooks';

export interface SettingsViewProps {
  settings: UseSettingsReturn;
}

export function SettingsView({ settings }: SettingsViewProps): JSX.Element {
  const {
    maxConversationTurns,
    openRouterModel,
    apiKeyConfigured,
    isLoading,
    updateSetting,
    saveApiKey,
    clearApiKey,
  } = settings;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ padding: 'var(--spacing-xl)' }}>
        <span className="text-muted">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h2 style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
          Settings
        </h2>
        <p className="text-muted mb-md">
          Configure your extension settings and API credentials.
        </p>
      </div>

      {/* API Key Section */}
      <section>
        <SecretInput
          label="OpenRouter API Key"
          description="Your API key is stored securely using your operating system's credential manager."
          isConfigured={apiKeyConfigured}
          onSave={saveApiKey}
          onClear={clearApiKey}
          placeholder="sk-or-..."
        />
      </section>

      <div className="divider" />

      {/* General Settings */}
      <section className="flex flex-col gap-md">
        <h3 style={{ fontWeight: 600 }}>General Settings</h3>

        <Input
          label="Max Conversation Turns"
          description="Maximum number of turns before a conversation resets."
          type="number"
          min={1}
          max={50}
          value={maxConversationTurns}
          onChange={(e) =>
            updateSetting('maxConversationTurns', parseInt(e.target.value, 10) || 10)
          }
        />

        <Input
          label="OpenRouter Model"
          description="The AI model to use for conversations."
          value={openRouterModel}
          onChange={(e) => updateSetting('openRouterModel', e.target.value)}
          placeholder="anthropic/claude-sonnet-4"
        />
      </section>
    </div>
  );
}
