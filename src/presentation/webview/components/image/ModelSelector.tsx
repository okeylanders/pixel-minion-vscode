// Ported from frame-minion@40e7949 packages/core/src/presentation/webview/components/image/ModelSelector.tsx; keep in sync
/**
 * ModelSelector — the image model picker (trigger + browser).
 *
 * A selection that isn't in the curated list (a custom id, or a model the
 * list has since superseded) stays visible as a "Custom: <id>" card instead
 * of silently showing the first model.
 *
 * Pixel deltas from Frame: `label`, `subtitle` and `footerLabel` are props
 * (Frame hard-codes "Model" and frame-specific copy), and Pixel's field
 * styles live in model-browser.css rather than model-selector.css. When the
 * list is filtered (the Image tab lists only models the selected mode
 * supports), a catalog model outside it keeps its own name rather than
 * reading "Custom: <id>" (`catalog`); the helper text says why it is listed.
 */
import React from 'react';
import { ImageModelDefinition } from '../../../../shared/types/providers';
import { ModelBrowserSelect, modelDefinitionToBrowserOption } from '../shared';

export interface ModelSelectorProps {
  models: ImageModelDefinition[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  /** Helper text shown under the trigger while the selection is off the list. */
  unavailableLabel?: string;
  label?: string;
  subtitle?: string;
  /** Every curated model, to name a selection the filtered `models` omit. */
  catalog?: ImageModelDefinition[];
}

export const IMAGE_MODEL_SUBTITLE =
  'Image models vary by provider, cost, and reference-image behavior. Pick the model that best fits this image.';

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  unavailableLabel,
  selectedModel,
  onModelChange,
  disabled = false,
  label = 'Model',
  subtitle = IMAGE_MODEL_SUBTITLE,
  catalog,
}) => {
  const hasSelected = models.some((m) => m.id === selectedModel);
  const curated = catalog?.find((m) => m.id === selectedModel);
  const options = hasSelected
    ? models
    : [...models, curated ?? { id: selectedModel, displayName: `Custom: ${selectedModel}` }];
  const browserOptions = options.map(modelDefinitionToBrowserOption);

  return (
    <ModelBrowserSelect
      label={label}
      options={browserOptions}
      value={selectedModel}
      onChange={onModelChange}
      disabled={disabled}
      helperText={!hasSelected ? unavailableLabel : undefined}
      subtitle={subtitle}
    />
  );
};
