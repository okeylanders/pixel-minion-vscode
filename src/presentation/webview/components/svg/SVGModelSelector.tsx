/**
 * SVGModelSelector — the SVG model picker (trigger + browser). Pixel-only;
 * the SVG counterpart of image/ModelSelector.
 *
 * The browser's "By Family" pivot groups models by how they make SVG
 * (native vector vs SVG code). An off-list selection stays visible as a
 * "Custom: <id>" card, as in the image picker.
 */
import React from 'react';
import { SvgModelDefinition } from '../../../../shared/types/providers';
import { ModelBrowserSelect, customSvgModelToBrowserOption, svgModelToBrowserOption } from '../shared';

export interface SVGModelSelectorProps {
  models: SvgModelDefinition[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  /** Helper text shown under the trigger while the selection is off the list. */
  unavailableLabel?: string;
  label?: string;
  subtitle?: string;
}

export const SVG_MODEL_SUBTITLE =
  'Choose native vector output, or a model that writes editable SVG code you can refine.';

export const SVGModelSelector: React.FC<SVGModelSelectorProps> = ({
  models,
  selectedModel,
  onModelChange,
  disabled = false,
  unavailableLabel,
  label = 'Model',
  subtitle = SVG_MODEL_SUBTITLE,
}) => {
  const hasSelected = models.some((m) => m.id === selectedModel);
  const options = models.map(svgModelToBrowserOption);
  const browserOptions = hasSelected ? options : [...options, customSvgModelToBrowserOption(selectedModel)];

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
