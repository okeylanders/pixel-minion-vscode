/**
 * Bootstrap values the extension host injects into the webview as
 * `window.__PIXEL_MINION__` (see application/providers/webviewHtml.ts).
 *
 * Every entry is an `asWebviewUri` string for a bundled asset. All keys are
 * optional so the webview keeps rendering (with fallbacks) if one is missing.
 */
export interface PixelMinionWebviewGlobals {
  /** Animated GIF shown while a generation is in flight. */
  loadingAnimationUri?: string;
  /** Animated colour logo shown in the header and Settings brand tiles. */
  headerLogoUri?: string;
}
