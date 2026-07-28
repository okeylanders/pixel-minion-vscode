/**
 * ModelSelector - Dropdown component for selecting AI models
 *
 * Pattern: Reusable UI component with VSCode theme integration
 */
import React from 'react';
import { ModelDefinition } from '../../../../shared/types/providers';
import '../../styles/components/model-selector.css';

export interface ModelSelectorProps {
  models: ModelDefinition[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

const costUnitFor = (modelId: string): string => {
  if (modelId.startsWith('black-forest-labs/')) return 'MP';
  if (modelId.startsWith('google/') || modelId.startsWith('openai/') || modelId.startsWith('microsoft/')) {
    return modelId.includes('image') ? '1M image tokens' : '1M tokens';
  }
  if (modelId.startsWith('anthropic/')) return '1M tokens';
  return 'image';
};

const formatCost = (model: ModelDefinition): string | undefined => {
  if (model.inputCost === undefined && model.outputCost === undefined) return undefined;
  const unit = costUnitFor(model.id);
  const input = model.inputCost === undefined ? '' : `$${model.inputCost}/in`;
  const output = model.outputCost === undefined ? '' : `$${model.outputCost}/out`;
  return `${input}${input && output ? ' · ' : ''}${output} per ${unit}`;
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  onModelChange,
  disabled = false,
}) => {
  const [isBrowserOpen, setIsBrowserOpen] = React.useState(false);
  const hasSelected = models.some((m) => m.id === selectedModel);
  const options = hasSelected
    ? models
    : [...models, { id: selectedModel, displayName: `Custom: ${selectedModel}` }];

  return (
    <div className="model-selector">
      <label>Model</label>
      <button
        type="button"
        className="model-select model-browser-trigger"
        onClick={() => setIsBrowserOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label={`Browse models. Current model: ${options.find(model => model.id === selectedModel)?.displayName ?? selectedModel}`}
      >
        <span>{options.find(model => model.id === selectedModel)?.displayName ?? selectedModel}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {isBrowserOpen && (
        <div
          className="model-browser-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Model browser"
          onClick={() => setIsBrowserOpen(false)}
        >
          <section className="model-browser" onClick={event => event.stopPropagation()}>
            <header className="model-browser-header">
              <div>
                <span>MODEL BROWSER</span>
                <h2>Choose a model</h2>
              </div>
              <button type="button" onClick={() => setIsBrowserOpen(false)} aria-label="Close model browser">×</button>
            </header>
            <input
              autoFocus
              className="model-browser-search"
              placeholder="Search models…"
              onChange={event => {
                const query = event.currentTarget.value.toLowerCase();
                document.querySelectorAll<HTMLElement>('[data-model-name]').forEach(card => {
                  card.hidden = !card.dataset.modelName?.includes(query);
                });
              }}
            />
            <div className="model-browser-list">
              {options.map(model => (
                <button
                  type="button"
                  key={model.id}
                  data-model-name={`${model.displayName} ${model.id}`.toLowerCase()}
                  className={`model-browser-option${model.id === selectedModel ? ' selected' : ''}`}
                  onClick={() => {
                    onModelChange(model.id);
                    setIsBrowserOpen(false);
                  }}
                >
                  <strong>{model.displayName.replace(/⭐\s*|\s*- Recommended/g, '')}</strong>
                  <small>{model.id}</small>
                  {formatCost(model) && <em>{formatCost(model)}</em>}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
