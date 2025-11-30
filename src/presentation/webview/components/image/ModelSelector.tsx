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

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  onModelChange,
  disabled = false,
}) => {
  const hasSelected = models.some((m) => m.id === selectedModel);
  const options = hasSelected
    ? models
    : [...models, { id: selectedModel, displayName: `Custom: ${selectedModel}` }];

  return (
    <div className="model-selector">
      <label htmlFor="model-select">Model</label>
      <select
        id="model-select"
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={disabled}
        className="model-select"
      >
        {options.map((model) => (
          <option key={model.id} value={model.id}>
            {model.displayName}
          </option>
        ))}
      </select>
    </div>
  );
};
