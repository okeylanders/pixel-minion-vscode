/**
 * Read access to the bootstrap globals the extension host injects
 * (`window.__PIXEL_MINION__`, built in application/providers/webviewHtml.ts).
 */
import type { PixelMinionWebviewGlobals } from '@shared/types/webviewGlobals';

declare global {
  interface Window {
    __PIXEL_MINION__?: PixelMinionWebviewGlobals;
  }
}

export function getWebviewGlobals(): PixelMinionWebviewGlobals {
  return window.__PIXEL_MINION__ ?? {};
}
