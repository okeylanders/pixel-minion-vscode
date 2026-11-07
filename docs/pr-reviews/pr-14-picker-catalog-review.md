# PR #14 review: picker parity and catalog refresh

**Reviewed:** 2026-11-07

**PR:** https://github.com/okeylanders/pixel-minion-vscode/pull/14

**Code head:** `fa85d0c17d51e6fc9478aef597e3dc8ed3665f95`

**Reviewed stack ancestor:** `e946faae8e4a074e7a62ab1166afeca8e024fbf3` (#13)

**Current #13 head at publication:** `481bd5f3602d96267e91695317e416de07c9581a` (report-only follow-up; its F-01 remains open)

**Status (2026-11-07):** F-01 resolved by deferral (the review's allowed option) in `8e53acd`: Recraft V4.1 Flash is out of the catalog until capability-aware controls land, and a catalog guard keeps any zero-reference model out meanwhile. The witness is deleted and replaced by that guard. #13's F-01/N-01 fixes are merged in (`b5cea17`). 35 suites / 575 tests pass; see [Resolution status](#resolution-status).

**Verdict: changes requested for F-01.** The new Recraft V4.1 Flash catalog entry is usable for text-only generation, but Pixel exposes image-input/refinement flows it cannot support. No other new blocking defect was established in the scoped delta. This is not approval to merge the stack.

## Status by item

| ID | Priority | Finding | Status |
| --- | --- | --- | --- |
| F-01 | P2 / medium | Text-only Recraft V4.1 Flash is listed while Refine and attachments send it image input | ↪ Deferred (row removed until P3/P4 capability gating) in `8e53acd`; guard test added |

## ↪ Deferred - F-01: gate text-only Recraft Flash before exposing it in the conversational Image tab

**Priority:** P2 / medium. **Status:** ↪ Deferred in `8e53acd` (row removed; returns with capability-aware controls).

**Changed location:** `src/shared/models/ImageModels.ts:109`.

The newly curated `recraft/recraft-v4.1-flash` explicitly has `referenceImages: { min: 0, max: 0 }`. OpenRouter's [current model page](https://openrouter.ai/recraft/recraft-v4.1-flash), independently read on 2026-11-07, confirms it accepts text, not image inputs. Its [Image API endpoint record](https://openrouter.ai/api/v1/images/models/recraft/recraft-v4.1-flash/endpoints) also omits input-reference support. This agrees with the committed catalog and audit.

The capability is currently descriptive only:

- `ImageGenerationView` enables the reference uploader and Generate for this model. Existing attachments also survive changing to this model. `ImageOrchestrator.generateImage` forwards those references and `OpenRouterImageClient` serializes them as `image_url` parts.
- More importantly, even a valid prompt-only first generation leads to an enabled **Refine** input. `ImageOrchestrator.continueConversation` automatically passes `conversation.lastImages` as `referenceImages`, so every normal refinement injects the generated image into a text-only endpoint. The user does not need to attach anything to reach this mismatch.

The result is a request with unsupported image input: it cannot provide the promised reference-based edit and may fail at provider routing. A warning on the model card does not make the enabled refinement flow safe. The catalog-wide modality tests verify output modalities, not accepted inputs, so they do not detect this.

**Requested correction:** either defer this row until capability-aware controls land, or gate both initial references and continuation now. Block unsupported input in the host as well as the UI; handle references already attached before a model switch and restored conversations. Do not silently drop reference images while presenting the action as refinement. Add regressions for prompt-only generation, initial attached references, a model switch with references attached, and first-turn-to-refinement behavior.

### Independent executable witness

`pr-14-text-only-image-repro.cjs` (deleted in `8e53acd`; replaced by the catalog guard below) loaded the real catalog, Image tab, orchestrator, conversation manager, and image client. It mocks secret storage and fetch, using no real credentials, provider calls, or charges.

```sh
node docs/pr-reviews/witnesses/pr-14-text-only-image-repro.cjs
```

It verifies that:

1. A prompt-only first request contains no image input.
2. Continuing the successful conversation sends the prior generated image as an `image_url` user part to `recraft/recraft-v4.1-flash`.
3. An initial attached image is also serialized despite the catalog's zero-reference capability.
4. The actual Image tab leaves Generate enabled with that attachment and exposes an enabled Refine input after a turn.

The witness asserts the observed defect, not desired behavior. Replace it with expected-behavior regressions when fixed. Provider failure itself was not tested with a paid call; the mismatch is established by actual serialized requests and the provider's documented input contract.

## Review coverage

- Picker: provider/family/release grouping, strict date handling, filtering, counts, selection/reset, custom saved selections, keyboard tabs, ARIA names/pressed states, initial selected-card scroll, and reuse of the overlay stack.
- Shared catalog migration: imports and layer boundaries, 36 image / 12 SVG models, defaults, retired-id mappings, superseded-but-live custom selections, explicit SVG kind, pricing units, estimate qualifications, and reasoning caveats.
- Routing: existing prefix dispatch still matches every curated SVG kind; image output-modality rules cover the added families. Image-API-only and required-reference models remain excluded as planned. F-01 identifies the missing inverse case: a newly listed model that cannot accept any reference.
- SVG budget: generation and continuation flow through the 32,000-token option; the current curated caps documented in the audit exceed it. This remains a ceiling, not a bill or a guarantee against truncation.
- Visual evidence: inspected the committed 480 px Dark Modern browser comparison and Light Modern trigger comparison. These are author-supplied screenshots, not a fresh browser or installed-VSIX acceptance pass.

## Independent validation

| Check | Result at reviewed code head |
| --- | --- |
| `npm test -- --runInBand` | **34 suites / 516 tests passed** |
| `tsc --noEmit -p tsconfig.json` | Passed |
| `tsc --noEmit -p tsconfig.webview.json` | Passed |
| `tsc --noEmit -p tsconfig.test.json` | Passed |
| `npm run build` | Passed; three webpack size/performance warnings |
| `npm run lint` | **Failed: 11 errors / 22 warnings**; normalized diagnostics exactly match the independent #13 run apart from line numbers |
| F-01 executable witness | Passed its observed-defect assertions, including actual UI state and serialized request bodies |
| `node --check` for witness; `git diff --check` | Passed |
| Remote CI for `fa85d0c` | No commit statuses or PR-triggered workflow runs returned; **not claimed green** |
| Fresh browser / installed VSIX smoke test | Not run in this review |

## Stack and remaining boundaries

- GitHub reported #14 open and mergeable against #13 during review. Mergeability does not mean review approval or a passing CI gate.
- #13's wrong-account stale-balance finding F-01 was open at its report-only head `481bd5f`; it is now fixed on #13 (`b19a691`) and merged into this branch (`b5cea17`).
- Request ownership, SVG DOM isolation, the dedicated Image API transport, and broad capability-driven controls remain later phases. F-01 does not ask for that whole roadmap now: deferring the incompatible new row is a sufficient scoped option.
- The author's GPT estimate-basis decision, light-theme accent contrast note, and installed-VSIX acceptance pass remain outstanding. This review does not independently verify every live provider price or generation path.
- No production code edits, provider charges, merge, auto-merge, or deployment were performed. Publication adds only this review and its executable witness.

## Resolution status

- **F-01 ↪ Deferred in `8e53acd`** (owner decision; the review allows deferring the incompatible row).
  - `recraft/recraft-v4.1-flash` is removed from `OPENROUTER_IMAGE_MODELS`, from `IMAGE_MODEL_METADATA` in `modelBrowserOptions.ts`, and from the modality snapshot in `OpenRouterImageClient.test.ts` (plus its two `modelBrowserOptions.test.ts` cases).
  - `ImageModels.ts` records it in the "Pixel deltas" header and beside the Recraft V4 Styles "NOT HERE" note: Styles needs references Pixel can't require yet; Flash takes none, and Pixel can't withhold them yet. Both return with the P3/P4 capability-aware controls (gate Generate, attachments, model switches with attachments, restored conversations and Refine in both UI and host).
  - **Guard (replaces the witness):** `shared/models/catalog.test.ts` checks every curated image model has `referenceImages.max ≥ 1`, with a comment naming why (`continueConversation` sends `lastImages`). Changing any row to `max: 0` fails it.
  - Not done here, by design: the regression set the review lists for the gating option (prompt-only, attached references, model switch with references, first turn → Refine). Those belong with the gating in P3/P4.
  - Docs: `CHANGELOG.md` drops the Flash bullet. `docs/CHANGELOG-DETAILED.md` (image 27 → 35, 8 adds, a follow-up note), the roadmap (row B count and a new decision row), the PR #12 ledger's PR B section, the audit's Flash row, and `CLAUDE.md` / `AGENTS.md` (new invariant) are updated.
- **Stack:** #13's F-01 / N-01 fixes merged in `b5cea17` (one doc conflict in the PR #12 ledger: kept #14's D7 / C8 row and #13's C4 row).
- **Validation after the fix:** `npx jest` 35 suites / 575 tests; the three `tsc --noEmit` projects clean; `npm run build` passes with the usual three webpack size warnings; `npm run lint` unchanged at 11 errors / 22 warnings.
