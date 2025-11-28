/**
 * AspectRatioSelector - Dropdown component for selecting aspect ratios
 *
 * Pattern: Reusable UI component with VSCode theme integration
 */
import React from 'react';
import { AspectRatio, ASPECT_RATIO_DIMENSIONS } from '../../../../shared/types/messages/imageGeneration';
import '../../styles/components/aspect-ratio-selector.css';

export interface AspectRatioSelectorProps {
  selectedRatio: AspectRatio;
  onRatioChange: (ratio: AspectRatio) => void;
  disabled?: boolean;
}

const ASPECT_RATIOS: AspectRatio[] = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'];

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  selectedRatio,
  onRatioChange,
  disabled = false,
}) => {
  return (
    <div className="aspect-ratio-selector">
      <label htmlFor="aspect-ratio-select">Aspect Ratio</label>
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
    </div>
  );
};
