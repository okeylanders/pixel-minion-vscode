# PR #16 SVG safety review

- PR: https://github.com/okeylanders/pixel-minion-vscode/pull/16
- Original reviewed source: `e59a5300b3b263c7f8596d1682fb343b8f2c1478`
- Independently re-reviewed source: `ba8ad846d95d922d21cb0a900721ca79859c505f`
- Compared with P2 base: `a2d1dc0f709cfa4348c16740f2169a555c5d2217`
- Date: 2026-11-07
- **Status (2026-11-07):** R16-1 fixed in `031477e`, R16-2 fixed in `b853fef`; R16-M1 (installed-VSIX animation check) is still owed and is a manual owner check. The #13 / #14 / #15 review fixes are merged in (`cee70de`). 48 suites / 865 tests pass; see [Resolution status](#resolution-status).
- **Current verdict: scoped technical approval.** R16-1 and R16-2 are independently verified fixed at `ba8ad84`. R16-M1 remains an open installed-VSIX animation check, so this is not a claim that all release validation or upstream-stack review is complete. No merge is authorized or performed.
- **Original verdict at `e59a530`: changes requested.** The two original findings and measurements below are retained as history; they no longer describe the current source.

## Status ledger

| ID | Priority | Finding | Status |
| --- | --- | --- | --- |
| R16-1 | P1 | Repeated classification of a long open element name makes the scanner quadratic and blocks the host/webview | ✅ Fixed in `031477e`; independently verified at `ba8ad84` |
| R16-2 | P2 | SVG hyperlink auditing (`a[ping]`) bypasses the no-external-requests policy for saved documents | ✅ Fixed in `b853fef`; independently verified at `ba8ad84` |
| R16-M1 | Validation | CSS and SMIL animation in an installed VSIX | ⏳ Open; not completed in this review |

## ✅ Fixed - R16-1: Cache the open element's local-name classification

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

## ✅ Fixed - R16-2: Reject hyperlink-auditing destinations

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

## Resolution status

- **R16-1 ✅ `031477e`.**
  - The scanner's stack holds `{ name, isStyle }`, with `isStyle` worked out once when the element is pushed. `inStyle()` reads the top entry in constant time, and `endTag()` uses the popped entry's flag. End-tag matching still compares the lower-cased qualified name exactly, separate from the cached classification.
  - The review's input now scans in about 20 ms at n = 16,000, 32,000 and 64,000 (flat), against 0.9 s / 3.0 s / 12.2 s before the fix on this executor. At the 2 MiB cap (n ≈ 349,000) it takes about 90 ms.
  - **Audit of other per-token work.** Nothing else in `SVGDocumentPolicy` re-reads another token or walks the open-element stack:
    - Element, end-tag and attribute names are matched by single-position sticky regexes and lower-cased once each.
    - Attribute values, entity decoding, `compact()` and the CSS tokenizer are proportional to that value's own bytes.
    - Classification (forbidden elements, `<style>`, SMIL elements, URL attributes) uses the local name, so there is no namespace-prefix resolution. The only ancestor fact used is the top entry's `isStyle`.
    - Declarations, processing instructions, comments and CDATA are each consumed by one `indexOf`.
    - Measured at about 2 MB: balanced deep nesting about 200 ms; 1,000-character names nested about 1,000 deep about 30 ms; a long name around many text runs, a long prefixed name, many `<style>` elements, many SMIL `attributeName`s and many `xmlns:` declarations each 70–130 ms.
  - **Regressions** (`SVGDocumentPolicy.test.ts`, "long names and deep nesting stay linear (R16-1)"): six accepted documents between 90% and 100% of the cap, each under one second. They cover a long open name with many children, the same prefixed, with many text runs, balanced deep nesting, deep nesting of long names, and a long name around a `<style>` with many CDATA runs. Without the fix they run for minutes. Behaviour checks pin case-insensitive end-tag matching, a mismatched end tag, a prefixed `<style>` still CSS-checked, and `stylex` not treated as `style`.
- **R16-2 ✅ `b853fef`.**
  - Any non-empty `ping` is refused, after entity decoding, on any element, under any prefix (`xlink:ping`) and in any case (`PING`). Reason: "sends hyperlink-auditing pings when a link is followed (…)". No per-destination rule is attempted, because the list can mix local and remote entries. An empty `ping=""` names no destination and stays accepted.
  - SMIL setting `attributeName="ping"` is refused like SMIL on `href` / `src` / `xml:base`.
  - Considered and left alone, with the reasoning in the code: `target`, `download`, `rel`, `hreflang`, `type`, `referrerpolicy` on `<a>`. They only qualify the navigation `href` makes, and `href` is already held to the document.
  - **Regressions:** the review's example, direct, entity-encoded (partly and entirely), several destinations (local then external, and all local), whitespace-only, no `href`, `xlink:ping`, `<svg:a>`, a non-`<a>` element, `PING` and SMIL on `ping`, all rejected; an empty ping accepted. The host save handler refuses the review's example without opening a dialog or writing (`GenerationSaveHandlers.test.ts`).
- **R16-M1 ⏳ still owed:** the CSS / SMIL animation check in an installed VSIX is a manual pass and was not run here.
- **Docs:** `CHANGELOG.md` (unsafe-SVG bullet), `docs/CHANGELOG-DETAILED.md` (policy list, a PR #16 follow-up section, test totals), the roadmap's P5a row, the PR #12 ledger's R5-S2 note (its audit missed this path), and the CLAUDE.md / AGENTS.md SVG-safety invariant (per-token work, stack classification, `ping`).
- **Stack:** `cee70de` merges #15, including #13 and #14. The doc conflicts were resolved by keeping both sides: #15's request-ownership line with this branch's SVG-safety line, and #14's roadmap B row with this branch's P5a row.
- **Validation:** `npx jest` 48 suites / 865 tests; the three `tsc --noEmit` projects clean; `npm run build` passes with the usual webpack size warnings; `npm run lint` unchanged at 9 errors / 20 warnings.

## Independent verification of the fixes (2026-11-07)

**Reviewed source:** `ba8ad846d95d922d21cb0a900721ca79859c505f`, including the upstream fixes merged by `cee70de`. Both original code findings are closed. This independent pass confirms the implementation follow-up above rather than relying on its test claims.

### R16-1 verified

The scanner now computes `isStyle` on push and reads that boolean in `inStyle()` and at close. There is no repeated ancestor-name classification in the per-child path. Matching closing tags remains separate.

Replayed the original input family with Node 24.22.1 and the repository TypeScript compiler:

| n | Bytes | Current elapsed | Verdict |
| --- | ---: | ---: | --- |
| 16,000 | 96,051 | 14.52 ms | accepted |
| 32,000 | 192,051 | 22.73 ms | accepted |
| 64,000 | 384,051 | 24.94 ms | accepted |
| 349,516 | 2,097,147 | 124.75 ms | accepted |

A separately constructed 1,650,091-byte input with a 150,000-character namespace prefix and 300,000 short children completed in 101.39 ms. These are observed timings, not extrapolations. The repository's six new near-cap structure cases also pass.

### R16-2 verified

Independently replayed the direct external ping, upper-case and prefixed attribute names, mixed local/external lists, XML-encoded separators/destinations, a wholly numeric-entity-encoded URL, whitespace-only values, and SMIL targeting a prefixed ping. All are rejected. An empty ping remains accepted. The host save-handler regression confirms the original fixture reaches no filesystem write.

Additional probes preserve CSS checking after a long parent, across sibling style blocks, and inside prefixed style/CDATA; ordinary text after a style block is not misclassified. **All 18 independent probes passed.**

### Fresh validation and remaining limits

- `npm test -- --runInBand`: **48 suites / 865 tests passed**.
- All three `tsc --noEmit` projects: passed.
- `npm run build`: passed, with the existing webpack asset-size warnings.
- Full lint: **9 errors / 20 warnings**, unchanged baseline. Lint on the policy and its three directly changed test/fixture files: clean.
- Dependencies were shared from the local PR #14 checkout after confirming identical package-lock contents.
- Exact-head GitHub check runs, commit statuses, and PR-triggered workflow runs: all returned empty for `ba8ad84`. No remote CI pass is claimed.
- **R16-M1 remains open:** no installed-VSIX CSS/SMIL animation smoke pass was performed.
- This follow-up publishes only the review report and updated review verdict. It does not change production code or merge any PR.
