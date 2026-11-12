// Ported from frame-minion@40e7949 packages/core/src/presentation/webview/components/image/AspectRatioSelector.tsx; keep in sync
/**
 * AspectRatioSelector - the Image tab's aspect-ratio dropdown.
 *
 * Lists exactly the ratios the selected model's route accepts, `auto`
 * included where the route advertises it. The SVG tab has its own fixed list
 * (svg/SVGAspectRatioSelector.tsx).
 *
 * Pixel deltas: the select sits in Pixel's `.select-control` wrapper (the
 * family chevron), and `mode` is required (Frame's optional mode fell back to
 * the catalog row, bypassing the route; no caller used it).
 */
import React from 'react';
import { AspectRatio, ImageGenerationMode } from '@messages';
import { imageRouteCapabilities } from '@shared/models';
import '../../styles/components/aspect-ratio-selector.css';

export interface AspectRatioSelectorProps {
  selectedRatio: AspectRatio;
  onRatioChange: (ratio: AspectRatio) => void;
  model: string;
  /** Required: the ratios come from the model's route in this mode. */
  mode: ImageGenerationMode;
  disabled?: boolean;
}

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  selectedRatio,
  onRatioChange,
  model,
  mode,
  disabled = false,
}) => {
  const aspectRatios = imageRouteCapabilities(model, mode)?.supportedAspectRatios ?? [selectedRatio];
  const value = aspectRatios.includes(selectedRatio) ? selectedRatio : aspectRatios[0];

  return (
    <div className="aspect-ratio-selector">
      <label htmlFor="aspect-ratio-select">Aspect Ratio</label>
      <span className="select-control">
        <select
          id="aspect-ratio-select"
          value={value}
          onChange={(e) => onRatioChange(e.target.value as AspectRatio)}
          disabled={disabled}
          className="aspect-ratio-select"
        >
          {aspectRatios.map((ratio) => (
            <option key={ratio} value={ratio}>
              {ratio === 'auto' ? 'Auto (model chooses)' : ratio}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
};
