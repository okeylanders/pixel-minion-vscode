/**
 * Tests for the sidebar webview HTML builder.
 */
import { buildWebviewHtml, serializeWebviewGlobals } from '../../../application/providers/webviewHtml';

const CSP_SOURCE = 'https://file+.vscode-resource.vscode-cdn.net';

const build = (globals = {}) =>
  buildWebviewHtml({
    cspSource: CSP_SOURCE,
    nonce: 'n0nce',
    scriptUri: `${CSP_SOURCE}/ext/dist/webview.js`,
    globals,
  });

describe('serializeWebviewGlobals', () => {
  it('round-trips the injected asset URIs', () => {
    const globals = {
      loadingAnimationUri: `${CSP_SOURCE}/ext/assets/loading.gif`,
      headerLogoUri: `${CSP_SOURCE}/ext/assets/logo.svg`,
    };
    expect(JSON.parse(serializeWebviewGlobals(globals))).toEqual(globals);
  });

  it('cannot break out of the inline <script> or its string literals', () => {
    const hostile = { headerLogoUri: 'x"</script><script>alert(1)</script><!--\\' };
    const serialized = serializeWebviewGlobals(hostile);

    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized)).toEqual(hostile);
  });
});

describe('buildWebviewHtml', () => {
  it('injects the header logo alongside the loading animation', () => {
    const html = build({ loadingAnimationUri: 'a.gif', headerLogoUri: 'logo.svg' });

    expect(html).toContain('window.__PIXEL_MINION__ = {"loadingAnimationUri":"a.gif","headerLogoUri":"logo.svg"};');
  });

  it('allows the logo through img-src and keeps scripts nonce-gated', () => {
    const html = build();

    expect(html).toContain(`img-src ${CSP_SOURCE} data: blob:;`);
    expect(html).toContain("default-src 'none';");
    expect(html).toContain("script-src 'nonce-n0nce';");
    expect(html.match(/<script nonce="n0nce"/g)).toHaveLength(2);
  });

  it('allows data: images, which the isolated SVG preview relies on, without allowing script', () => {
    const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(build())![1];
    const directive = (name: string) => csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `));

    // SVGPreview renders generated SVG as <img src="data:image/svg+xml;base64,…">.
    expect(directive('img-src')?.split(/\s+/)).toContain('data:');
    expect(directive('script-src')).toBe("script-src 'nonce-n0nce'");
  });
});
