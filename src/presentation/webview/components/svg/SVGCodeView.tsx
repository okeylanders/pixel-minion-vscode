import React, { useState } from 'react';
import '../../styles/components/svg-code-view.css';

interface SVGCodeViewProps {
  svgCode: string | null;
  onCopy: () => void;
}

export const SVGCodeView: React.FC<SVGCodeViewProps> = ({ svgCode, onCopy }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!svgCode) return null;

  return (
    <div className="svg-code-view">
      <div className="svg-code-header">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="svg-code-toggle"
        >
          {isExpanded ? '▼' : '▶'} SVG Code
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="svg-code-copy"
          title="Copy to clipboard"
        >
          Copy
        </button>
      </div>
      {isExpanded && (
        <pre className="svg-code-content">
          <code>{svgCode}</code>
        </pre>
      )}
    </div>
  );
};
