/**
 * SVGAspectRatioSelector - the SVG tab's aspect-ratio dropdown (Pixel-only).
 *
 * The SVG prompt asks for a viewBox from ASPECT_RATIO_DIMENSIONS, so the SVG
 * tab keeps its seven fixed ratios and shows their pixel sizes. The Image
 * tab's selector lists whatever the selected model's route supports instead
 * (image/AspectRatioSelector.tsx).
 */
import React from 'react';
import { ASPECT_RATIO_DIMENSIONS, SVG_ASPECT_RATIOS, SVGAspectRatio } from '@messages';
import '../../styles/components/aspect-ratio-selector.css';

export interface SVGAspectRatioSelectorProps {
  selectedRatio: SVGAspectRatio;
  onRatioChange: (ratio: SVGAspectRatio) => void;
  disabled?: boolean;
}

export const SVGAspectRatioSelector: React.FC<SVGAspectRatioSelectorProps> = ({
  selectedRatio,
  onRatioChange,
  disabled = false,
}) => (
  <div className="aspect-ratio-selector">
    <label htmlFor="svg-aspect-ratio-select">Aspect Ratio</label>
    <span className="select-control">
      <select
        id="svg-aspect-ratio-select"
        value={selectedRatio}
        onChange={(e) => onRatioChange(e.target.value as SVGAspectRatio)}
        disabled={disabled}
        className="aspect-ratio-select"
      >
        {SVG_ASPECT_RATIOS.map((ratio) => {
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
