/**
 * HTML document for the Pixel Minion sidebar webview.
 *
 * Kept free of the `vscode` module so the escaping and CSP rules can be unit
 * tested: the provider resolves asset URIs and hands over plain strings.
 */
import type { PixelMinionWebviewGlobals } from '@shared/types/webviewGlobals';

export interface WebviewHtmlOptions {
  /** `webview.cspSource` — the origin allowed to serve scripts, styles and images. */
  cspSource: string;
  /** Per-render nonce for the inline bootstrap and the bundle script. */
  nonce: string;
  /** `asWebviewUri` of `dist/webview.js`. */
  scriptUri: string;
  /** Injected as `window.__PIXEL_MINION__`. */
  globals: PixelMinionWebviewGlobals;
}

/**
 * Serialises the bootstrap globals for an inline `<script>`. JSON.stringify
 * makes the value escape-safe (a stray quote or backslash can't break out of
 * a string literal); escaping `<` closes the `</script>` / `<!--` HTML-context
 * breakout that JSON alone leaves open.
 */
export function serializeWebviewGlobals(globals: PixelMinionWebviewGlobals): string {
  return JSON.stringify(globals).replace(/</g, '\\u003c');
}

export function buildWebviewHtml({ cspSource, nonce, scriptUri, globals }: WebviewHtmlOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${cspSource} data: blob:;">
  <title>Pixel Minion</title>
  <script nonce="${nonce}">
    window.__PIXEL_MINION__ = ${serializeWebviewGlobals(globals)};
  </script>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
