/**
 * BrandMark — the Pixel Minion logo on its fixed dark "CRT" tile.
 *
 * The family header lockup puts the full-colour logo on a fixed tile (Frame
 * and Prose use white). Pixel's logo has a white skull, so its tile is dark
 * and theme-independent — Pixel's signature in the family. Shared by the
 * header and the Settings overlay so there is one mark, not two.
 *
 * The animated logo arrives as `headerLogoUri`. A static inline copy of the
 * same artwork renders instead when the URI is missing or fails to load, and
 * when the user prefers reduced motion (the logo's pixels blink forever).
 */
import React from 'react';
import { getWebviewGlobals } from '../../webviewGlobals';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export interface BrandMarkProps {
  /** Placement class: sizes the tile (`app-header-mark`, `settings-header-logo`). */
  className?: string;
}

type PixelTone = 'b' | 'o' | 'w';

/** Glitch pixels from assets/pixel-minion-logo-animated-color.svg: x, y, tone. */
const GLITCH_PIXELS: ReadonlyArray<readonly [number, number, PixelTone]> = [
  [160, 240, 'b'], [210, 240, 'o'], [160, 290, 'w'], [260, 290, 'b'], [160, 340, 'o'],
  [210, 450, 'w'], [160, 550, 'b'], [210, 550, 'o'], [260, 600, 'w'], [160, 600, 'b'],
  [360, 220, 'w'], [610, 220, 'b'], [660, 220, 'o'], [810, 240, 'w'], [760, 240, 'b'],
  [810, 290, 'o'], [710, 340, 'w'], [810, 450, 'b'], [810, 550, 'o'], [760, 550, 'w'],
  [710, 600, 'b'], [810, 600, 'o'], [760, 650, 'w'],
];

const TONE_FILL: Record<PixelTone, string> = { b: '#7a1d0f', o: '#ff6b2d', w: '#ffffff' };

/** Static colour copy of the logo (no animation). */
export const PixelMinionLogo: React.FC<{ className?: string }> = ({ className }) => {
  // Unique gradient ids: two copies can be on screen (header + Settings).
  const uid = React.useId().replace(/:/g, '');
  const frameId = `px-logo-frame-${uid}`;
  const standId = `px-logo-stand-${uid}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={frameId} x1="0" y1="112" x2="0" y2="784" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8c2a13" />
          <stop offset="1" stopColor="#5b1409" />
        </linearGradient>
        <linearGradient id={standId} x1="0" y1="784" x2="0" y2="944" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a33a18" />
          <stop offset="1" stopColor="#6a1d0c" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${frameId})`}
        fillRule="evenodd"
        d="M112 112C67.8 112 32 147.8 32 192V704C32 748.2 67.8 784 112 784H912C956.2 784 992 748.2 992 704V192C992 147.8 956.2 112 912 112H112ZM112 192H912V704H112V192Z"
      />
      <rect x="432" y="784" width="160" height="80" fill="#7a1d0f" />
      <path
        fill={`url(#${standId})`}
        d="M312 864H712C729.6 864 744 878.4 744 896V912H280V896C280 878.4 294.4 864 312 864Z"
      />
      {GLITCH_PIXELS.map(([x, y, tone]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="40" height="40" fill={TONE_FILL[tone]} />
      ))}
      <path
        fill="#ffffff"
        fillRule="evenodd"
        d="M512 260C406 260 320 346 320 452C320 520 350 570 390 600L390 630C390 660 410 680 440 680H584C614 680 634 660 634 630L634 600C674 570 704 520 704 452C704 346 618 260 512 260ZM432 400C405 400 384 421 384 448C384 475 405 496 432 496C459 496 480 475 480 448C480 421 459 400 432 400ZM592 400C565 400 544 421 544 448C544 475 565 496 592 496C619 496 640 475 640 448C640 421 619 400 592 400ZM512 520L482 570H542L512 520Z"
      />
    </svg>
  );
};

export function BrandMark({ className = '' }: BrandMarkProps): JSX.Element {
  const { headerLogoUri } = getWebviewGlobals();
  const [logoFailed, setLogoFailed] = React.useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <span className={`brand-tile ${className}`.trim()} aria-hidden="true">
      {headerLogoUri && !logoFailed && !reducedMotion ? (
        <img className="brand-tile-img" src={headerLogoUri} alt="" onError={() => setLogoFailed(true)} />
      ) : (
        <PixelMinionLogo className="brand-tile-img" />
      )}
    </span>
  );
}
