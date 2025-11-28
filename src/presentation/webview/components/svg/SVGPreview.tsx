import React from 'react';
import '../../styles/components/svg-preview.css';

interface SVGPreviewProps {
  svgCode: string | null;
  aspectRatio: string;
}

export const SVGPreview: React.FC<SVGPreviewProps> = ({ svgCode, aspectRatio }) => {
  if (!svgCode) {
    return (
      <div className="svg-preview svg-preview-empty">
        <span>Generated SVG will appear here</span>
      </div>
    );
  }

  return (
    <div className="svg-preview" data-aspect={aspectRatio}>
      <div
        className="svg-preview-content"
        dangerouslySetInnerHTML={{ __html: svgCode }}
      />
    </div>
  );
};
