# PR #14 review: picker parity and catalog refresh

**Reviewed:** 2026-11-07

**PR:** https://github.com/okeylanders/pixel-minion-vscode/pull/14

**Code head:** `fa85d0c17d51e6fc9478aef597e3dc8ed3665f95`

**Reviewed stack ancestor:** `e946faae8e4a074e7a62ab1166afeca8e024fbf3` (#13)

**Current #13 head at publication:** `481bd5f3602d96267e91695317e416de07c9581a` (report-only follow-up; its F-01 remains open)

**Verdict: changes requested for F-01.** The new Recraft V4.1 Flash catalog entry is usable for text-only generation, but Pixel exposes image-input/refinement flows it cannot support. No other new blocking defect was established in the scoped delta. This is not approval to merge the stack.

## F-01: gate text-only Recraft Flash before exposing it in the conversational Image tab

**Priority:** P2 / medium. **Status:** Open.

**Changed location:** `src/shared/models/ImageModels.ts:109`.

The newly curated `recraft/recraft-v4.1-flash` explicitly has `referenceImages: { min: 0, max: 0 }`. OpenRouter's [current model page](https://openrouter.ai/recraft/recraft-v4.1-flash), independently read on 2026-11-07, confirms it accepts text, not image inputs. Its [Image API endpoint record](https://openrouter.ai/api/v1/images/models/recraft/recraft-v4.1-flash/endpoints) also omits input-reference support. This agrees with the committed catalog and audit.

The capability is currently descriptive only:

- `ImageGenerationView` enables the reference uploader and Generate for this model. Existing attachments also survive changing to this model. `ImageOrchestrator.generateImage` forwards those references and `OpenRouterImageClient` serializes them as `image_url` parts.
- More importantly, even a valid prompt-only first generation leads to an enabled **Refine** input. `ImageOrchestrator.continueConversation` automatically passes `conversation.lastImages` as `referenceImages`, so every normal refinement injects the generated image into a text-only endpoint. The user does not need to attach anything to reach this mismatch.

The result is a request with unsupported image input: it cannot provide the promised reference-based edit and may fail at provider routing. A warning on the model card does not make the enabled refinement flow safe. The catalog-wide modality tests verify output modalities, not accepted inputs, so they do not detect this.

**Requested correction:** either defer this row until capability-aware controls land, or gate both initial references and continuation now. Block unsupported input in the host as well as the UI; handle references already attached before a model switch and restored conversations. Do not silently drop reference images while presenting the action as refinement. Add regressions for prompt-only generation, initial attached references, a model switch with references attached, and first-turn-to-refinement behavior.

### Independent executable witness

[pr-14-text-only-image-repro.cjs](witnesses/pr-14-text-only-image-repro.cjs) loads the real catalog, Image tab, orchestrator, conversation manager, and image client. It mocks secret storage and fetch, using no real credentials, provider calls, or charges.

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
- #13's wrong-account stale-balance finding F-01 remains open at its report-only head `481bd5f`. #14 must retain that dependency; it does not fix or supersede the balance finding.
- Request ownership, SVG DOM isolation, the dedicated Image API transport, and broad capability-driven controls remain later phases. F-01 does not ask for that whole roadmap now: deferring the incompatible new row is a sufficient scoped option.
- The author's GPT estimate-basis decision, light-theme accent contrast note, and installed-VSIX acceptance pass remain outstanding. This review does not independently verify every live provider price or generation path.
- No production code edits, provider charges, merge, auto-merge, or deployment were performed. Publication adds only this review and its executable witness.
