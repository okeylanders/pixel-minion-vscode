/**
 * LineGlyph — a 24-viewBox line-icon `<svg>` that inherits `currentColor` and
 * uses round caps/joins. Ported from Frame Minion's shared wrapper so the
 * family's tab and tile glyphs share one stroke language. Callers pass the
 * path children, plus `size` / `sw` where they need to override the defaults.
 */
import React from 'react';

export interface LineGlyphProps {
  size?: number;
  /** stroke-width */
  sw?: number;
  children: React.ReactNode;
}

export const LineGlyph: React.FC<LineGlyphProps> = ({ size = 22, sw = 1.7, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);
