/**
 * SettingsView - Settings panel with card sections (Frame Minion settings view)
 *
 * Features:
 * - Card sections for API key, models, general settings
 * - Secure API key input
 * - VSCode settings sync
 */
import React from 'react';
import { SecretInput } from '../common';
import { ModelSelector } from '../image/ModelSelector';
import { SVGModelSelector } from '../svg/SVGModelSelector';
import { OFF_LIST_MODEL_HELP } from '../shared/modelBrowserOptions';
import { CustomModelIdField } from '../shared/CustomModelIdField';
import { UseSettingsReturn } from '@hooks';
import { OPENROUTER_IMAGE_MODELS, OPENROUTER_SVG_MODELS } from '@shared/models';

export interface SettingsViewProps {
  settings: UseSettingsReturn;
}

export function SettingsView({ settings }: SettingsViewProps): JSX.Element {
  const {
    maxConversationTurns,
    imageModel,
    svgModel,
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
        <div className="settings-section-heading">
          <span className="settings-section-kicker">Provider</span>
          <h3 className="settings-section-title">OpenRouter</h3>
        </div>
        <p className="settings-description mb-sm">
          Your API key is stored in VS Code Secret Storage using OS-level encryption.
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
        <div className="settings-section-heading">
          <span className="settings-section-kicker">Generation</span>
          <h3 className="settings-section-title">Default models</h3>
        </div>
        <div className="settings-model-grid">
          <ModelSelector
            label="Image model"
            subtitle="Choose the default raster image generator."
            models={OPENROUTER_IMAGE_MODELS}
            selectedModel={imageModel}
            onModelChange={model => updateSetting('imageModel', model)}
            unavailableLabel={OFF_LIST_MODEL_HELP}
          />
          <CustomModelIdField
            label="Custom image model id"
            help="Any OpenRouter image model. A custom id runs as Single Shot with automatic dimensions; Conversation needs a verified route."
            onUse={model => updateSetting('imageModel', model)}
          />
          <SVGModelSelector
            label="SVG model"
            subtitle="Choose native vector generation or an editable SVG-code model."
            models={OPENROUTER_SVG_MODELS}
            selectedModel={svgModel}
            onModelChange={model => updateSetting('svgModel', model)}
            unavailableLabel={OFF_LIST_MODEL_HELP}
          />
          <CustomModelIdField
            label="Custom SVG model id"
            help="Any OpenRouter model. An id starting with recraft/ makes native vector SVG; any other writes SVG code."
            onUse={model => updateSetting('svgModel', model)}
          />
        </div>
      </section>

      {/* General Section */}
      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-section-kicker">Conversations</span>
          <h3 className="settings-section-title">Context</h3>
        </div>

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
    </>
  );
}
