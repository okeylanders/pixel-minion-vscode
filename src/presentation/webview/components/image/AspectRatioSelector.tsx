/**
 * AspectRatioSelector - Dropdown component for selecting aspect ratios
 *
 * Pattern: Reusable UI component with VSCode theme integration
 */
import React from 'react';
import { AspectRatio, ASPECT_RATIO_DIMENSIONS, SVG_ASPECT_RATIOS } from '@messages';
import '../../styles/components/aspect-ratio-selector.css';

export interface AspectRatioSelectorProps {
  selectedRatio: AspectRatio;
  onRatioChange: (ratio: AspectRatio) => void;
  disabled?: boolean;
}

// Until the selector lists each model's own ratios (roadmap P3), the Image
// tab keeps offering the seven fixed ratios it always has.
const ASPECT_RATIOS = SVG_ASPECT_RATIOS;

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  selectedRatio,
  onRatioChange,
  disabled = false,
}) => {
  return (
    <div className="aspect-ratio-selector">
      <label htmlFor="aspect-ratio-select">Aspect Ratio</label>
      <span className="select-control">
        <select
          id="aspect-ratio-select"
          value={selectedRatio}
          onChange={(e) => onRatioChange(e.target.value as AspectRatio)}
          disabled={disabled}
          className="aspect-ratio-select"
        >
          {ASPECT_RATIOS.map((ratio) => {
            const dims = ASPECT_RATIO_DIMENSIONS[ratio];
            return (
              <option key={ratio} value={ratio}>
                {ratio} ({dims.width}x{dims.height})
              </option>
            );
          })}
        </select>
      </span>
    </div>
  );
};
