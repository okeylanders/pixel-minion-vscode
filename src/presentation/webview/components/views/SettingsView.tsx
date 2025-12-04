/**
 * SettingsView - Settings panel with card sections (Prose Minion style)
 *
 * Features:
 * - Card sections for API key, models, general settings
 * - Secure API key input
 * - VSCode settings sync
 */
import React from 'react';
import { SecretInput, ToggleSwitch } from '../common';
import { UseSettingsReturn, UseTokenTrackingReturn } from '@hooks';

export interface SettingsViewProps {
  settings: UseSettingsReturn;
  tokenTracking: UseTokenTrackingReturn;
}

export function SettingsView({ settings, tokenTracking }: SettingsViewProps): JSX.Element {
  const {
    maxConversationTurns,
    imageModel,
    svgModel,
    svgBlueprintModel,
    svgArchitectMaxIterations,
    svgArchitectEnabled,
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
    <>
      {/* API Key Section */}
      <section className="settings-section">
        <h3 className="settings-section-title">🔐 OpenRouter API Key (Secure Storage)</h3>
        <p className="settings-description mb-sm">
          Your API key is stored securely using OS-level encryption (Keychain/Credential Manager).
          It will never appear in settings files or be synced to the cloud.
        </p>
        <SecretInput
          isConfigured={apiKeyConfigured}
          onSave={saveApiKey}
          onClear={clearApiKey}
          placeholder="sk-or-..."
        />
        <p className="settings-description mt-sm">
          Requires an OpenRouter pay-as-you-go account for AI features. OpenRouter routes to
          leading models with configurable privacy (no logging, no training).
          Learn more at{' '}
          <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer">
            openrouter.ai
          </a>
          .
        </p>
      </section>

      {/* Models Section */}
      <section className="settings-section">
        <h3 className="settings-section-title">Models</h3>

        <label className="settings-label">
          <span className="settings-label-title">Image Model</span>
          <input
            type="text"
            className="settings-input"
            value={imageModel}
            onChange={(e) => updateSetting('imageModel', e.target.value)}
            placeholder="google/gemini-2.5-flash-image"
          />
          <span className="settings-description">
            Powers text-to-image and image-to-image generation. Recommended: Nano Banana 10/25.
          </span>
        </label>

        <label className="settings-label">
          <span className="settings-label-title">SVG Model</span>
          <input
            type="text"
            className="settings-input"
            value={svgModel}
            onChange={(e) => updateSetting('svgModel', e.target.value)}
            placeholder="openai/gpt-5.1-codex"
          />
          <span className="settings-description">
            Powers SVG code generation from text prompts. Recommended: GPT-5.1 Codex or Gemini Pro 3.
          </span>
        </label>
      </section>

      {/* SVG Architect Section */}
      <section className="settings-section">
        <h3 className="settings-section-title">SVG Architect (High Quality Mode)</h3>
        <p className="settings-description mb-sm">
          Multi-agent pipeline for higher quality SVG output. Uses a Blueprint Agent to plan
          and validate, with iterative refinement for better results.
        </p>

        <div className="settings-toggle-row">
          <ToggleSwitch
            checked={svgArchitectEnabled}
            onChange={(enabled) => updateSetting('svgArchitectEnabled', enabled)}
            label="Enable SVG Architect by default"
          />
        </div>

        <label className="settings-label">
          <span className="settings-label-title">Blueprint Model</span>
          <input
            type="text"
            className="settings-input"
            value={svgBlueprintModel}
            onChange={(e) => updateSetting('svgBlueprintModel', e.target.value)}
            placeholder="openai/gpt-5.1-codex"
          />
          <span className="settings-description">
            Model for blueprint analysis and validation. Recommended: GPT-5.1 Codex.
          </span>
        </label>

        <label className="settings-label">
          <span className="settings-label-title">Max Iterations</span>
          <input
            type="number"
            className="settings-input small"
            min={1}
            max={10}
            value={svgArchitectMaxIterations}
            onChange={(e) =>
              updateSetting('svgArchitectMaxIterations', parseInt(e.target.value, 10) || 5)
            }
          />
          <span className="settings-description">
            Maximum refinement iterations (1-10). Higher values may improve quality but use more tokens.
          </span>
        </label>
      </section>

      {/* General Section */}
      <section className="settings-section">
        <h3 className="settings-section-title">General</h3>

        <label className="settings-label">
          <span className="settings-label-title">Max Conversation Turns</span>
          <input
            type="number"
            className="settings-input small"
            min={1}
            max={50}
            value={maxConversationTurns}
            onChange={(e) =>
              updateSetting('maxConversationTurns', parseInt(e.target.value, 10) || 10)
            }
          />
          <span className="settings-description">
            Maximum turns before a conversation resets. Higher values use more context.
          </span>
        </label>
      </section>

      {/* Token Usage Section */}
      <section className="settings-section">
        <h3 className="settings-section-title">Token Usage</h3>
        <p className="settings-description mb-sm">
          Displays running token totals in the header. Resets manually or on reload.
        </p>
        <button
          type="button"
          className="reset-token-button"
          onClick={tokenTracking.resetTokens}
        >
          Reset Token Usage
        </button>
      </section>
    </>
  );
}
