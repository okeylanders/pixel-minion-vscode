// Ported from frame-minion@40e7949 packages/core/src/presentation/webview/components/image/ResolutionSelector.tsx; keep in sync
/**
 * ResolutionSelector - output tier for models whose route publishes tiers.
 * Auto leaves the size to the provider (the request omits `resolution`).
 *
 * Pixel deltas: the select sits in Pixel's `.select-control` wrapper, and
 * `mode` is required (Frame's optional mode fell back to the catalog row,
 * bypassing the route; no caller used it).
 */
import React from 'react';
import { imageRouteCapabilities } from '@shared/models';
import { ImageResolution, ImageGenerationMode } from '@messages';
import '../../styles/components/aspect-ratio-selector.css';

export interface ResolutionSelectorProps {
  model: string;
  /** Required: the tiers come from the model's route in this mode. */
  mode: ImageGenerationMode;
  selectedResolution: ImageResolution;
  onResolutionChange: (resolution: ImageResolution) => void;
  disabled?: boolean;
}

export const ResolutionSelector: React.FC<ResolutionSelectorProps> = ({
  model,
  mode,
  selectedResolution,
  onResolutionChange,
  disabled = false,
}) => {
  const resolutions = imageRouteCapabilities(model, mode)?.supportedResolutions ?? [];
  const value = selectedResolution === 'auto' || resolutions.includes(selectedResolution)
    ? selectedResolution
    : 'auto';

  return (
    <div className="aspect-ratio-selector">
      <label htmlFor="image-resolution-select">Resolution</label>
      <span className="select-control">
        <select
          id="image-resolution-select"
          value={value}
          onChange={(event) => onResolutionChange(event.target.value as ImageResolution)}
          disabled={disabled}
          className="aspect-ratio-select"
        >
          <option value="auto">Auto (model default)</option>
          {resolutions.map(resolution => <option key={resolution} value={resolution}>{resolution}</option>)}
        </select>
      </span>
    </div>
  );
};
