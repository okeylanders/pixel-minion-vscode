# PR #16 SVG safety review

- PR: https://github.com/okeylanders/pixel-minion-vscode/pull/16
- Reviewed source: `e59a5300b3b263c7f8596d1682fb343b8f2c1478`
- Compared with P2 base: `a2d1dc0f709cfa4348c16740f2169a555c5d2217`
- Date: 2026-11-07
- **Verdict: changes requested.** The isolated image previews are a substantial improvement, but two gaps remain in the newly introduced saved-document policy. This review does not approve or merge the upstream stack.

## Status ledger

| ID | Priority | Finding | Status |
| --- | --- | --- | --- |
| R16-1 | P1 | Repeated classification of a long open element name makes the scanner quadratic and blocks the host/webview | ⏳ Open |
| R16-2 | P2 | SVG hyperlink auditing (`a[ping]`) bypasses the no-external-requests policy for saved documents | ⏳ Open |
| R16-M1 | Validation | CSS and SMIL animation in an installed VSIX | ⏳ Open; not completed in this review |

## R16-1: Cache the open element's local-name classification

Location: `src/shared/svg/SVGDocumentPolicy.ts:545–547`.

`inStyle()` calls `localName(current)` every time the scanner encounters text or a start tag. The parent element remains on the stack while self-closing children are read, so a long parent name is rescanned and lowercased twice for each short child. Both parent-name length and child count can grow with document size: this is O(n²), despite the new linear-time contract.

The following complete, ASCII XML input is accepted:

```js
const tag = 'g'.repeat(n);
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg"><' + tag + '>' +
  '<g/>'.repeat(n) +
  '</' + tag + '></svg>';
inspectSvgDocument(svg);
```

Independent measurements against the reviewed policy, transpiled with the repository's TypeScript dependency and run with Node 24.22.1:

| n | UTF-8 bytes | Elapsed | Verdict |
| --- | ---: | ---: | --- |
| 16,000 | 96,051 | 361 ms | accepted |
| 32,000 | 192,051 | 1,453 ms | accepted |
| 64,000 | 384,051 | 5,666 ms | accepted |

Doubling input roughly quadruples runtime. The 384 KB case is less than one fifth of the 2 MiB allowance. No 2 MiB timing is claimed; it is unnecessary to block the review process for the much longer extrapolated runtime.

This is not a browser-rendering concern: the policy is invoked synchronously after generation by `SVGOrchestrator`, during webview preview rendering, and again on save. A pathological provider/native-vector result can therefore stall the extension host and then the panel before the browser decides whether to display the SVG. The twelve existing worst-case cases do not combine long open names with many descendants.

**Requested change:** calculate and store the element's local-name classification (or an `isStyle` boolean) when pushing its stack entry; make `inStyle()` constant-time. Add this input family to the performance regression suite, including an input near the document-size cap. Keep end-tag matching separate from the cached classification.

## R16-2: Reject hyperlink-auditing destinations

Locations: `src/shared/svg/SVGDocumentPolicy.ts:84` (`URL_ATTRIBUTES`) and `589–610` (`checkAttributes`).

The policy treats only `href`, `src`, and `base` as URL attributes. SVG 2 also has `ping` on `<a>`: following the link can send background HTTP POST requests to its space-separated destinations. A same-document `href` does not make the auditing destinations local.

The reviewed implementation returns exactly `{ accepted: true }` for:

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <a href="#x" ping="https://tracker.example/ping">
    <text y="20">Open</text>
  </a>
</svg>
```

Thus the authoritative host save check accepts the document unchanged. In a supporting browser, clicking that link in the saved/served SVG can contact the tracking endpoint. This does **not** escape the app's isolated `<img>` preview and is **not** a claim of script execution or an automatic request merely from opening the document. It violates the saved-file policy's explicit rejection of links/requests leaving the document.

Primary references:
- [SVG 2 linking, including the ping attribute](https://svgwg.org/svg2-draft/linking.html).
- [Chromium's SVG anchor attributes shipping discussion](https://groups.google.com/a/chromium.org/g/blink-dev/c/bQyE_lhuVOc), describing auditing behavior and targeting Chromium 144.
- [MDN SVG ping reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/ping).

Evidence boundary: policy acceptance is reproduced locally. A live beacon was not observed in this review; the available review browser could not reach the local test endpoint. Browser behavior above is supported by the referenced platform/specification sources.

**Requested change:** reject nonempty `ping` attributes entirely, or implement an explicitly safe rule for the entire whitespace-separated destination list. Simply applying `startsWith('#')` to the whole value would still allow a later external token. Add direct, entity-encoded, multiple-destination, and same-document-href regression cases. Rejection is consistent with the policy's existing approach and avoids retaining tracking behavior in generated art.

## Existing work reconciled

- The prior R5-S1–S7 changes are present at this head. Their regression fixtures and all existing policy tests pass. R16-1 is a different quadratic path from the earlier CSS `url(` backtracking bug; it does not reopen that fixed regex.
- All five generated-SVG previews use an isolated base64 image source rather than inserting provider markup into the app DOM. Existing isolation and CSP tests pass.
- Rejected SVGs remain available as code; the UI, hook, and host save handler each gate saving.
- The catalog-kind routing helper and native-vector refinement checks are wired through the view, hook, and orchestrator.
- SVG first-turn raster references are preserved in the dispatch snapshot, history, and rehydrated API transcript.
- Plain-name restrictions and lexical output-directory containment are covered by tests. Symlink traversal is already explicitly deferred in the existing ledger; this review does not represent lexical containment as a physical realpath guarantee.
- The deferred extraction-regex issue, image-reference rehydration, and lifetime/reload topics remain tracked upstream. No changes are made to their existing scope here.

## Validation

Against `e59a530`, using installed dependencies shared from the P2 checkout after confirming the package-lock files are identical:

- `npm test -- --runInBand`: **47 suites / 781 tests passed**.
- `tsc --noEmit -p tsconfig.json`: passed.
- `tsc --noEmit -p tsconfig.webview.json`: passed.
- `tsc --noEmit -p tsconfig.test.json`: passed.
- `npm run build`: passed, with webpack asset-size warnings.
- `npm run lint`: **9 errors / 20 warnings**, matching the documented pre-existing baseline; not a clean lint run.
- Adversarial probes: R16-1 accepted with quadratic timing above; R16-2 accepted.
- Remote checks for the reviewed SHA: no check runs, commit statuses, or PR-triggered workflow runs were returned. This is not a claim that required CI is green.
- Installed-VSIX CSS/SMIL animation smoke check: not run and still owed.

Only this review report is published by the review pass. No production code is changed and no PR is merged.
