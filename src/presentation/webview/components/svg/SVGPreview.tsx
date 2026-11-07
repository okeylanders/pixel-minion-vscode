/**
 * SVGPreview - renders a generated SVG in isolation.
 *
 * The markup is never inserted into the app's DOM. It is shown through
 * `<img src="data:image/svg+xml;base64,…">`, where the browser renders it as
 * a separate document in secure mode: no script, no remote loads, and its
 * <style> and ids can't reach the app (the webview CSP's `img-src` allows
 * `data:`). CSS and SMIL animation still play. A document the
 * SVGDocumentPolicy rejects isn't rendered at all.
 */
import React from 'react';
import { svgPreviewSource } from './svgPreviewSource';
import '../../styles/components/svg-preview.css';

interface SVGPreviewProps {
  svgCode: string | null;
  aspectRatio: string;
  /** Accessible name; thumbnails pass their size. */
  alt?: string;
  /** Thumbnails stay wordless when there is nothing to show. */
  variant?: 'full' | 'thumbnail';
}

export const SVGPreview: React.FC<SVGPreviewProps> = ({
  svgCode,
  aspectRatio,
  alt = 'Generated SVG',
  variant = 'full',
}) => {
  const source = React.useMemo(() => (svgCode ? svgPreviewSource(svgCode) : null), [svgCode]);
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);

  if (!svgCode || !source) {
    return (
      <div className="svg-preview svg-preview-empty">
        <span>Generated SVG will appear here</span>
      </div>
    );
  }

  const unavailable = !source.verdict.accepted
    ? `No preview: this SVG ${source.verdict.reason}.`
    : failedUrl === source.dataUrl
      ? "No preview: the SVG couldn't be rendered (it may be malformed)."
      : null;

  if (unavailable || !source.dataUrl) {
    // The full preview says why once; thumbnails stay silent for screen
    // readers rather than repeat it.
    return variant === 'full' ? (
      <div className="svg-preview svg-preview-unavailable" data-aspect={aspectRatio}>
        <span>{unavailable}</span>
      </div>
    ) : (
      <div
        className="svg-preview svg-preview-unavailable"
        data-aspect={aspectRatio}
        title={unavailable ?? undefined}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="svg-preview" data-aspect={aspectRatio}>
      <div className="svg-preview-content">
        <img
          className="svg-preview-image"
          src={source.dataUrl}
          alt={alt}
          draggable={false}
          onError={() => setFailedUrl(source.dataUrl)}
        />
      </div>
    </div>
  );
};
