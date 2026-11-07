/**
 * useReducedMotion — whether the user asked for less motion, from either
 * source a webview can see:
 * - the OS setting, via `prefers-reduced-motion: reduce`;
 * - VS Code's own `workbench.reduceMotion`, which the host reflects as the
 *   `vscode-reduce-motion` class on <body> (a CSS media query can't see it).
 *
 * One matchMedia listener and one class observer are shared by every
 * consumer (useSyncExternalStore), and both sources are re-read on change.
 */
import * as React from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const VSCODE_REDUCE_MOTION_CLASS = 'vscode-reduce-motion';

export function prefersReducedMotion(): boolean {
  const fromOs = typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
  return fromOs || document.body.classList.contains(VSCODE_REDUCE_MOTION_CLASS);
}

const listeners = new Set<() => void>();
let stopWatching: (() => void) | null = null;

function startWatching(): () => void {
  const notify = () => listeners.forEach(listener => listener());
  const media = typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : null;
  media?.addEventListener('change', notify);
  const observer = new MutationObserver(notify);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return () => {
    media?.removeEventListener('change', notify);
    observer.disconnect();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!stopWatching) {
    stopWatching = startWatching();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stopWatching) {
      stopWatching();
      stopWatching = null;
    }
  };
}

export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, prefersReducedMotion);
}
