import React from 'react';
import { ModelDefinition } from '../../../../shared/types/providers';
import { ModelBrowserKind, ModelBrowserSelect, modelToBrowserOption } from '../shared';

export interface ModelSelectorProps {
  models: ModelDefinition[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  kind: ModelBrowserKind;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  onModelChange,
  kind,
  disabled = false,
}) => (
  <ModelBrowserSelect
    label={kind === 'image' ? 'Image model' : 'SVG model'}
    subtitle={
      kind === 'image'
        ? 'Compare image models, native pricing, and a normalized per-image estimate.'
        : 'Choose native vector output or an editable SVG-code model.'
    }
    options={models.map(model => modelToBrowserOption(model, kind))}
    value={selectedModel}
    onChange={onModelChange}
    disabled={disabled}
  />
);
