/**
 * Tab-bar glyphs — neutral line icons for Pixel Minion's two modes, drawn on
 * the shared LineGlyph (20px, stroke 1.7) so they match the family's tab set.
 */
import React from 'react';
import { LineGlyph } from '../common/LineGlyph';

export interface TabIconProps {
  size?: number;
}

/** Framed picture — raster image generation. */
export const TabImageIcon: React.FC<TabIconProps> = ({ size = 20 }) => (
  <LineGlyph size={size}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M21 16l-5-5-9 9" />
  </LineGlyph>
);

/** Code brackets — SVG markup generation. */
export const TabSvgIcon: React.FC<TabIconProps> = ({ size = 20 }) => (
  <LineGlyph size={size}>
    <path d="M8 7l-5 5 5 5" />
    <path d="M16 7l5 5-5 5" />
    <path d="M14 4l-4 16" />
  </LineGlyph>
);
