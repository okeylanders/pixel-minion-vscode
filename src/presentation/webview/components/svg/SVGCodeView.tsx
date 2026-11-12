import React, { useState } from 'react';
import '../../styles/components/svg-code-view.css';

interface SVGCodeViewProps {
  svgCode: string | null;
  onCopy: () => void;
  /** Open on mount, e.g. when the code is all there is to see. */
  initiallyExpanded?: boolean;
}

const ChevronIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SVGCodeView: React.FC<SVGCodeViewProps> = ({ svgCode, onCopy, initiallyExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const codeId = React.useId();

  if (!svgCode) return null;

  return (
    <div className="svg-code-view">
      <div className="svg-code-header">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="svg-code-toggle"
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? codeId : undefined}
        >
          <ChevronIcon /> SVG code
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
        <pre className="svg-code-content" id={codeId}>
          <code>{svgCode}</code>
        </pre>
      )}
    </div>
  );
};
