<p align="center">
  <img src="../assets/pixel-minion-icon.png" alt="Pixel Minion" width="128"/>
</p>

# Changelog (Detailed)

All notable changes to the Pixel Minion VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Overview

Draft PR #12 brings Pixel Minion onto the Frame Minion design-system skeleton (warm surface ramp, card-grid tabs, balance strip, first model-browser port, catalog refresh). The stacked **design pass 02** (PR A) addresses its round-1 review. Review ledger: [docs/pr-reviews/pr-12-design-system-alignment-review.md](pr-reviews/pr-12-design-system-alignment-review.md). Roadmap: [docs/plans/frame-parity-roadmap.md](plans/frame-parity-roadmap.md).

### Design system (PR A)

- **Tokens.**
  - `styles/design-tokens.css` defines the `--px-*` vocabulary (Frame's names, Pixel's prefix) scoped to `.app-container`. This replaces the `--pm-*` tokens, which collided with Prose Minion's.
  - The fixed brand pair `--px-a #ff6b2d` / `--px-b #8c2a13` replaces `--vscode-textLink-foreground` as the accent. `--px-info` carries semantic blue.
  - A `body.vscode-high-contrast*` block maps borders to `contrastBorder` and reserves `contrastActiveBorder` for selected states.
- **Header.**
  - `webviewHtml.ts` builds the CSP'd HTML and injects `headerLogoUri` / `loadingStillUri` as JSON-escaped globals (`webviewGlobals.ts`). A test pins it.
  - `BrandMark` renders the colour logo on a dark "CRT" tile, with the inline glyph as fallback.
  - 20 / 12.5 px title and subtitle and one 2 px brand hairline, in line with the family.
  - A container query compacts the header at ≤ 340 px.
- **Image / SVG tabs.**
  - `.tab-content` is the single scroller, so the conversation is no longer crushed (it was 42 px tall at 320×900).
  - Frame sprint-06 card layout and full-width stacked controls.
  - One field family on a 34 px control height (`--px-control-h`).
  - Frame-style user bubble, image card and seed chip; green check save tile; accent-tinted primary buttons.
  - Empty-state copy; refine bar `min-width: 0`; neutral trash at rest; readable SVG code view.
  - 10.5 px type floor with mono eyebrows.
- **Overlays and a11y.**
  - `hooks/useOverlayDismiss` adds focus capture and return, top-overlay-only Escape, `inert` background and a focus trap. It is used by the Settings dialog (now `role=dialog`) and the model browser. Ported from Prose Minion.
  - Accessible tab bar: ids, `aria-controls`, roving tabindex with arrow keys, and glyphs on a ported `LineGlyph`.
  - One `:focus-visible` ring.
  - `useReducedMotion` honours both `prefers-reduced-motion` and VS Code's `vscode-reduce-motion`, swapping the loading GIF for a still.
- **Cleanup.** Dead CSS (`model-selector.css`, unused settings rules, undefined `--border-radius`) and stale doc comments removed.

### Balances (PR A)

- **One shared host service.** `infrastructure/account/AccountBalanceService.ts` provides a 120 s cache, a shared in-flight fetch, `forceRefresh` with a 1 s floor, and per-webview subscription. Its trailing debounce is cancelled on unsubscribe or `dispose()`, so a pending refresh can't fetch into a closed webview.
- **Refresh triggers.**
  - `MessageHandler` wraps the domain post and arms a refresh on `TERMINAL_AI_RESPONSE_TYPES` (image, SVG, enhance, text), rather than whenever `usage` is present. A guard test fails if a new `*_RESPONSE` AI type is missing from that set.
  - `resetClients()` clears the cache and force-refreshes on API key save, replace or clear, so another account's balance is never shown.
- **Payload.**
  - Adds `creditsStatus` plus structured `keyIssue` / `creditsIssue` (`{ kind, httpStatus? }`). An invalid key (401) and being offline are now distinguished.
  - 5xx logs at warn, 4xx at debug.
  - `limit_reset: "daily"` now maps correctly; it previously mapped to `unknown`, and Frame Minion has the same bug.
- **UI.**
  - Extracted to `components/balances/` (`ProviderBalancesCollapsed`, `ProviderBalancesStrip`, `balanceFormat.ts`), with CSS in `styles/components/provider-balances.css`.
  - A cap-only key headlines "Monthly/Weekly/Daily/Spend cap remaining" with one "Account balance unavailable" note. A $0 cap has its own state.
  - Currency uses `Intl` everywhere, values ≤ 0 are styled, and "no key" / "offline" are muted.
  - A refresh dims the value instead of blanking it.
  - The pill carries `aria-expanded` and `aria-controls`.
- **Token tracking.** The unused session token-total pipeline is removed. `TOKEN_USAGE_UPDATE` now carries `{ lastRequest, requestedAt }` only, and "Last request" / "Updated" show a date when it isn't today.

### Models (PR A)

- **Modalities.** `OpenRouterImageClient` no longer requests `['image','text']` from image-only endpoints: the Recraft V4.1 branch is removed and `krea/` and `microsoft/mai-image-` are added. A catalog-wide test checks requested ⊆ declared output modalities, using the 2026-11-07 `/images/models` snapshot.
- **Image-API-only models removed.** A keyed probe found OpenRouter rejects `/chat/completions` for GPT Image 2 / 1 / 1 Mini and Krea 2 Large / Medium / Medium Turbo, all added by the PR #12 refresh. They were removed until the Image API transport (roadmap P3). A test pins the probed chat-blocked set. Details are in the audit addendum.
- **`RETIRED_MODELS`.** Each entry carries a reason (`'delisted' | 'images-api-only'`). `SettingsHandler` migrates saved `imageModel` / `svgModel` on read (whichever scope holds the value), persists the replacement and logs why. It covers the five v1.3.0 ids OpenRouter has since delisted.
- The `pixelMinion.svgModel` description no longer recommends a removed model.

### Test infrastructure (PR A)

- `.tsx` tests run under jsdom via a per-file docblock; `tsconfig.test.json` adds JSX and DOM settings; `.css` imports are stubbed. No new dependencies.
- `tsc -p tsconfig.webview.json` now actually type-checks the webview. It previously inherited `exclude: ["src/presentation/webview"]` and checked 0 of 52 files.
- Tests: 18 suites / 174 tests on the PR #12 head → 28 / 322 on PR A.

### PR B — Model picker parity and catalog refresh

Stacked on PR A (`claude/pixel-minion-design-review-dhbqpd`). Branch `claude/pixel-minion-picker-catalog-dhbqpd`. Roadmap row B in [docs/plans/frame-parity-roadmap.md](plans/frame-parity-roadmap.md); review rows in [docs/pr-reviews/pr-12-design-system-alignment-review.md](pr-reviews/pr-12-design-system-alignment-review.md).

| Commit | What |
| --- | --- |
| `5d8bb2d` | Catalogs move to `src/shared/models` with Frame's unit-aware types; Frame sprint-06 picker ported |
| `7038e87` | Catalog refresh from the 2026-11-07 audit, chat-routable models only |
| `a679286` | SVG turns send `max_tokens: 32000` (M1) |
| `5507ed9` | Visual-pass polish: browser search focus ring; regrouping scrolls the list to the top |

#### Catalogs and types (`5d8bb2d`)

- `[+] src/shared/models/{ImageModels,SVGModels,RetiredModels,index}.ts`. `OPENROUTER_IMAGE_MODELS`, `OPENROUTER_SVG_MODELS`, `DEFAULT_IMAGE_MODEL`, `DEFAULT_SVG_MODEL`, `RETIRED_MODELS` / `RETIRED_MODEL_REPLACEMENTS` now live in `shared`, so the webview stops importing `src/infrastructure` (it did from `ImageGenerationView`, `SVGGenerationView`, `SettingsView` and both hooks). `infrastructure/ai/providers/OpenRouterProvider.ts` keeps only `OPENROUTER_CONFIG` (Frame's layout; no re-exports).
- `src/shared/types/providers.ts`:
  - Verbatim from frame-minion@40e7949: `ImagePricingUnit`, `ImagePricing` (`unit`, `output`, `input?`, `approxUsdPerImage?`, `approxNote?`, `approxBasis?`) and `ImageModelDefinition` (`transport?`, `supportsSeed?`, `referenceImages?`, `referenceMimeTypes?`, `imagePricing?`, `supportedResolutions?`, `supportedAspectRatios?`). The old unit-mixed `ModelDefinition { inputCost, outputCost }` is gone.
  - Pixel-only: `ImageApiAspectRatio` (Frame's 25-value `AspectRatio` union under a new name, because Pixel's `AspectRatio` is still the 7 ratios the tabs send; the rename to `SVGAspectRatio` is P3's), `TextPricing { inputPer1M, outputPer1M }`, and `SvgModelDefinition = NativeVectorSvgModelDefinition (ImageModelDefinition & { kind: 'native-vector' }) | CodeSvgModelDefinition ({ kind: 'code', textPricing, acceptsImageInput, reasoning? })`. `reasoning` copies the chat feed's `mandatory` / `default_enabled` / `default_effort`.
  - Removed the unused `AIProvider` interface and with it the type import from `infrastructure/ai/clients/TextClient`.
  - The capability fields are documented `⚠️ Not yet consumed`: they're recorded from the Image API endpoint records for P3 and Frame parity, and no request reads them. `transport` is left unset on every row (no row claims a route Pixel doesn't use).
- Image rows (27 ids at this commit) copied from Frame's catalog, which changes visible names (e.g. "Nano Banana 2 (Google: Gemini 3.1 Flash Image)", "Microsoft: MAI-Image 2.5") and families (derived from the label after any "Vendor:" prefix). Nano Banana Pro keeps Pixel's ⭐ (documented delta).
- Provenance headers (`// Ported from frame-minion@40e7949 packages/core/src/<path>; keep in sync`) on `ImageModels.ts`, `providers.ts`, `ModelBrowserModal.tsx`, `ModelBrowserSelect.tsx`, `modelBrowserOptions.ts`, `model-browser.css` and `image/ModelSelector.tsx`, each listing its Pixel deltas.

#### Picker (`5d8bb2d`, `5507ed9`)

- `ModelBrowserModal.tsx` is Frame's: search over 11 fields, pivots By Provider / By Family / By Release Date (strict `YYYY-MM-DD`; invalid dates such as `2026-02-30` group as "Release date unavailable"; months newest first), group chips with counts, the OpenRouter provider highlight, and Frame's card anatomy (cost pill, release / meta / tone badges incl. `warn`, `costDescription`, narrative, supporting description).
- Pixel deltas kept or added (upstream candidates):
  - `useOverlayDismiss` wiring from PR A (Escape scoped to the top overlay, focus to search on open and back to the trigger on close, inert frame, Tab trap). Frame's own window Escape listener is not ported, and there's no `autoFocus`.
  - `role="dialog"` on the panel, presentational backdrop that closes on mousedown.
  - Pivots are a WAI-ARIA tablist (roving Tab stop, Left/Right/Home/End via PR A's `tabKeyboard.nextTabIndex`) controlling the list as a `tabpanel`; group chips are `role="group"` toggles with `aria-pressed`; cards are `aria-pressed`, named by their title (`aria-labelledby`) and described by the cost pill and details (`aria-describedby`) so a screen reader doesn't read a 300-character name.
  - The selected card is scrolled into view on open (`scrollIntoView({ block: 'center' })`, guarded for jsdom); a pivot or chip change scrolls the list to the top.
  - The query and group chip reset on close; the pivot is kept.
  - `footerLabel` prop (default "Curated by Pixel Minion").
- `modelBrowserTypes.ts` stays (Frame declares the option types in the `.tsx`): the host `tsc -p tsconfig.json` compiles the webview's `.ts` tests without JSX, and `modelBrowserOptions.ts` must not pull a `.tsx` into that program. The modal re-exports the types.
- `ModelBrowserSelect.tsx` is Frame's single-line trigger (label, chevron, `helperText`, `loadingLabel`, `Custom: <id>` fallback, `aria-label` "Browse … options. Current model: …"), plus `htmlFor` label association, `aria-haspopup="dialog"` and `aria-expanded`. Pixel's two-line 44 px trigger with its estimate sub-line is gone.
- `modelBrowserOptions.ts`: Frame's `providerFromId`, `familyFromLabel`, `stripRecommended`, `costPair`, `formatUsd`, `imageNativePricingLabel`, `imagePricingLabel`, `imagePricingDescription`, `imageUnitBadgeLabel`, `recommendedBadge` and `modelDefinitionToBrowserOption`. No `startsWith(` remains; units come from `imagePricing.unit`. Deltas: `PROVIDER_LABELS` is Frame's image/text subset plus `krea` and `qwen`; label helpers take an output noun ("| SVG"); metadata can carry `retiresOn` → a `warn` badge.
- `svgModelToBrowserOption` (Pixel-only): family is the kind ("Native SVG" / "SVG code"), which fixes Gemini 3.1 Pro being grouped as "Gemini Image" by a label regex. Native vector: `≈ $0.3 | SVG`, badges `native SVG` + `per SVG`. Code: `$4/$20 per 1M` in the pill; the 1k-in + 4k-out house estimate moves to `costDescription` with a caveat when the model reasons by default (`mandatory || default_enabled`); badges `SVG code`, `per token`, `image input`.
- `image/ModelSelector.tsx` (Frame's, with `label` / `subtitle` props) and `[+] svg/SVGModelSelector.tsx` keep an off-list selection visible as a "Custom: <id>" card with helper text ("Not in Pixel Minion's curated list. Requests still use this model id."). The tabs and Settings all use these selectors.
- `model-browser.css` is Frame's sheet on `--px-*` tokens. Deltas:
  - The trigger is a Pixel field: `--px-control-h` (34 px), `padding: 0 10px 0 11px` (12 px value inset, chevron on the select chevron's 11 px edge), `--px-field` surface, field focus ring (overrides PR A's global button outline at higher specificity). Measured in the harness: height, inset, chevron edge, surface, font and radius equal the Aspect Ratio select. Frame's trigger uses the dropdown colours and renders white beside Pixel's tan fields in Light Modern.
  - Search box and pivot track on `--px-field` (Frame: near-black / grey inset), search focus = field focus ring; card hover/selected on `--px-field-hover` (accent stays border + ring + medallion). `--px-inset` remains for code and preview wells.
  - Contrast (measured in the harness, Dark / Light Modern / Flame): group headings, counts and chip counts use muted text (Frame: dim, ~1.7:1 for counts); badges 10.5 px; accent badges and the active chip keep the accent as tint + border with foreground text (ember on the tint was ~3.1:1 in Light Modern). All measured text is ≥ 4.5:1 except the eyebrow in Light Modern (3.78:1), which uses the family `--px-accent-text` token; flagged for the token owner rather than forked here.
  - Cost pills stay on one line at ≤ 520 px (`white-space: nowrap`, ellipsis safety net; every curated label fits a 320 px card).
  - One `z-index` (the backdrop's, 1000), commented, so overlay stacking stays in one place.
  - High-contrast selected states remain in `design-tokens.css` (class names unchanged).

#### Catalog refresh (`7038e87`)

Source: [docs/model-catalog-audit-2026-11-07.md](model-catalog-audit-2026-11-07.md) §1e / §2d, filtered by the same day's `/chat/completions` probe. Models the probe found Image-API-only (GPT Image 2.5 / 2.6, FLUX.3, Qwen Image, Krea, Muse) are not added; `OpenRouterImageClient.test.ts` still fails if any reaches a catalog. Every new or changed price has a source comment (`[endpoints]`, `[chat feed]`, `[bench]`).

- Image: 27 → 36.
  - Added (9): `google/gemini-nano-banana-2.1` ⭐ (out $30/1M; prompt $1.5/1M; estimate ≈ $0.036 @ 1K is OpenRouter's measured benchmark median and says so, because Google's token count couldn't be verified), `bytedance-seed/seedream-5-0-{pro,lite,flash}`, `microsoft/mai-image-2.6`, `microsoft/mai-image-2.6-flash`, `recraft/recraft-v4.1-flash` (refs 0–0), `sourceful/riverflow-v2.6-pro`, `x-ai/grok-imagine-image-2.0`.
  - Left out although chat-routable: `recraft/recraft-v4-styles` / `-styles-pro` (refs 1–10 required; no Generate gating until P3/P4). Commented in `ImageModels.ts`.
  - Drift: input-image rates for GPT-5.4 Image 2 ($8/1M), GPT-5 Image ($10), GPT-5 Image Mini ($2.5); Riverflow V2 Pro / Fast `input: 0.2` per reference with a basis that says so; measured-above-list notes for Riverflow V2.6 Pro ($0.157), V2.5 Pro ($0.248), V2.5 Fast ($0.029) (audit O6); `@ 1K` qualifiers on tiered Riverflow rows; `supportsSeed: false` wherever the endpoint record lists no `seed` (Gemini, GPT, MAI, Riverflow, Recraft, Grok).
  - `openai/gpt-5-image-mini`: `retiresOn: '2026-12-01'` (chat feed `expiration_date`) → "retiring Dec 1, 2026" warn badge. Not added to `RETIRED_MODELS`: it is still served.
- SVG: 8 → 12 (2 native vector + 10 code), per audit §2d.
  - Added: `anthropic/claude-opus-5.5` ⭐ ($4/$20), `anthropic/claude-fable-5.1` ⭐ ($10/$50), `anthropic/claude-sonnet-5.5` ($2/$10), `anthropic/claude-haiku-5.5` ($0.10/$0.50), `openai/gpt-6.1-sol` ⭐ ($2/$10), `openai/gpt-6-astra` ($10/$50), `openai/gpt-6.1-terra` ($1/$5), `google/gemini-4-argon` ($2/$10), `google/gemini-3.8-flash` ($0.75/$3.75), `x-ai/grok-4.7` ($2/$6). ⭐ follows the owner's slots onto their successors (Opus, Fable, OpenAI high-end). No SVG-quality benchmark exists (audit O7).
  - Removed (superseded, still live): `claude-fable-5`, `claude-opus-5`, `gpt-5.6-sol`, `gpt-5.6-sol-pro` (stored $5/$30 vs live $4/$20: U6), `gpt-5.4`, `gemini-3.1-pro-preview`. **Intentionally not migrated**: OpenRouter still serves them, so a saved pick keeps working and shows as "Custom" rather than silently changing model and price.
  - Left out: `recraft/recraft-v4-styles-pro-vector` / `-styles-vector` (refs 1–10 required).
- `RETIRED_MODELS`: `grok-imagine-image-quality` → `grok-imagine-image-2.0`; `claude-opus-4` and `claude-opus-5-fast` → `claude-opus-5.5` (Opus 5 is no longer in the catalog).
- Metadata: release date (OpenRouter `created`) and narrative for every new row.
- Defaults unchanged (`google/gemini-3.1-flash-image`, `recraft/recraft-v4.1-pro-vector`).
- `package.json` `imageModel` / `svgModel` descriptions name the current recommendations.

#### SVG output budget (`a679286`, review M1)

- `SVGOrchestrator` sends `maxTokens: SVG_MAX_OUTPUT_TOKENS` (32,000) on every turn; the text client's default stays 16,384 for Enhance and chat. On OpenRouter `max_tokens` covers reasoning + visible output on most providers, and the recommended code models reason by default (Opus 5.5 / Fable 5.1 / Sonnet 5.5 / Grok 4.7 at high effort), so 16,384 could end a long SVG at `finish_reason: "length"`.
- Why not 48,000: 32,000 doubles the headroom, stays under the smallest output cap of any endpoint serving a curated code model (65,536 for Gemini 3.8 Flash and Gemini 4 Argon on vertex/us, 2026-11-07), and bounds a runaway turn at $1.60 on Fable 5.1's output rate ($2.40 at 48,000).
- `CLAUDE.md` / `AGENTS.md` claimed 48,000 for text and SVG clients; corrected to 16,384 / 32,000.

#### Not in this PR

- No request or routing change apart from M1: modalities still come from id prefixes (catalog-driven modalities and the Image API transport are P3), `SVGOrchestrator.selectClient` and the Refine gate still key on `recraft/` (P5b; a catalog test pins that every native-vector row is `recraft/` until then), no aspect ratio is sent to vector models, and no capability field is enforced.
- Image-API-only models, Recraft Styles (both kinds) and Krea K3 Edit wait for P3 (transport + reference gating).
- The GPT per-image estimate basis ("@ 1K · high" vs OpenRouter's measured medians, audit O5) is unchanged pending the family-wide decision.
- `README.md`'s model tables were already stale before this PR (they list Claude Opus 4.7 and GPT-5.1 Codex); left for the release pass.

#### Tests

- 28 suites / 322 tests → 32 suites / 497 tests. `tsc` (host and webview) clean; `npm run build` passes; ESLint unchanged (11 pre-existing errors, 22 warnings).
- Ported from Frame: `ModelBrowserModal.test.tsx` (7), `ModelBrowserSelect.test.tsx` (2), the "image pricing labels" block of `modelBrowserOptions.test.ts` (limited to Pixel's rows). Sample data renamed away from fal.ai.
- New: modal overlay/ARIA/scroll/reset/footer cases; select label, `aria-expanded` and helper cases; `SVGModelSelector.test.tsx` (kind grouping, custom cards); `shared/models/catalog.test.ts` (defaults shipped, no retired id listed, every retired id moves to a shipped model, coherent capabilities, SVG pricing shape per kind, native vector ⇔ `recraft/` while routing keys on it); refresh-specific label, rate, date and retiring-badge cases; the modality snapshot gained the 9 new image ids; `SVGOrchestrator` pins `maxTokens: 32000`.
- `modelBrowserOptions.test.ts` moved to `__tests__/presentation/webview/components/shared/` to mirror the source.

### P2: request ownership hardening (`claude/pixel-minion-request-ownership-dhbqpd`)

Roadmap phase P2 ([frame-parity-roadmap.md](plans/frame-parity-roadmap.md), [parity plan §5](plans/frame-image-parity-plan.md)). Fixes the pre-existing ownership defects confirmed in the PR #12 review (ledger S2, S3). Stacked on PR B (`claude/pixel-minion-picker-catalog-dhbqpd`). Commits `a2d5115` (ownership), `adcdb92` (adversarial-review follow-up, R5-S8/S9 below).

#### User-facing

- Stale, late or duplicated responses, errors and save results can't settle a newer request; an enhance error in one tab no longer clears the other tab's spinner.
- A failed turn is never replayed in the next request; a second concurrent refinement of one conversation is refused.
- The Image tab sends an attached SVG once (it was sent twice) and records it with its turn, so re-hydration replays it.
- Refinements use the conversation's thread settings and carry no draft attachments. New note under each tab's attachments while a conversation is active.
- "Saved" reflects the host's save result; cancel is a distinct, silent outcome; WebP/GIF save as `.webp`/`.gif`; unidentified data is refused.
- Enhance Prompt never rewrites a prompt the user moved on from: Generate and Clear discard a running enhancement, and an edit made while it runs is kept.
- A request the host fails to process (e.g. a malformed payload) is answered with an error instead of spinning forever; an error that matches no request appears in the visible tab instead of nowhere.

#### Webview

- **Correlation ids** (`src/presentation/webview/utils/requestId.ts`, `newRequestId(prefix)`): `image-` / `svg-` + `generate`, `continue`, `enhance`, `save`, `clear`. The host already echoed `correlationId` on responses, statuses and errors; no host routing change was needed.
- **Dispatch snapshots** (`useImageGeneration.ts`, `useSVGGeneration.ts`): a `pending` ref holds `{ correlationId, prompt, settings, referenceSvgText }`. The response handler ignores any other correlation id and builds the turn from the snapshot. This replaces `pendingPrompt` state plus a `useCallback(..., [])` that always read the first render's `referenceSvgText` (null), so attached SVG text was never recorded with a turn.
- **Ownership-aware errors**: `handleError` now returns `boolean` (owned or not). It settles the pending generation or enhance it matches, or shows an error for its own `*-clear-` request; anything else returns `false` and changes nothing. `App.tsx` gives every `ERROR` to both hooks. An error from a non-request host (`extension.settings`, …) that neither hook owns is shown in the active tab through the new `showError(text)` action, without touching any spinner. Previously enhance and settings errors went to both hooks and cleared both spinners.
- **SVG text once**: `generate()` sends the raw prompt plus `referenceSvgText`; only `ImageConversationManager.addUserMessage` appends `Reference SVG:` (it was appended in the hook and again in the manager). The SVG tab already sent it once on generate, but re-sent the draft attachment on every refinement.
- **Thread settings**: new `ImageThreadSettings` / `SVGThreadSettings` (`{ model, aspectRatio }`) in `@messages`, set from the dispatch snapshot on success, persisted as optional `threadSettings`. `continueChat` sends them instead of the draft controls. In memory the host already ignored the draft values, but re-hydration after a host restart used them, so the effective model depended on whether the host had restarted. Persisted state without `threadSettings` falls back to its saved `model`/`aspectRatio`, which is exactly what the old code sent. Frame's P3 `ImageThreadSettings` (mode, resolution) extends this shape.
- **No draft attachments on refine**: `referenceSvgText` was removed from `ImageGenerationContinuePayload` and `SVGGenerationContinuePayload`; `continueChat` sends only prompt, id, history and thread settings. The Image host already dropped draft raster references (the payload had no field for them).
- **Truthful save state**: the 1 s "Saved" timers in `ImageGenerationView` / `SVGGenerationView` are gone. The image hook tracks `pendingSaves` (correlation id → image id) and exposes `savingImageIds` / `savedImageIds`; the SVG hook exposes `isSaving` / `isSaved` for the SVG on screen, and a newer save supersedes an older one. `ImageSaveResultPayload` / `SVGSaveResultPayload` gained `cancelled?: boolean`.
- **Save extension**: the suggested file name uses `imageExtensionForMime` (`src/shared/media/imageFormats.ts`); an unsupported MIME is refused in the webview without posting.
- **Memoized persistence**: `persistedState` is a `useMemo` in `useImageGeneration`, `useSVGGeneration`, `useSettings` and `useTokenTracking`. All four were new objects on every render, so App's save effect called `vscode.setState` (with every base64 image) on every render.
- `clearConversation` now also posts `*_GENERATION_CLEAR` (with a `*-clear-` id), so the host frees the conversation; it was never told before.

#### Review follow-up (`adcdb92`)

An independent adversarial review of `a2d5115` (round 5) found two webview/host gaps, fixed here; ids R5-S8 / R5-S9 in the [ledger](pr-reviews/pr-12-design-system-alignment-review.md).

- **R5-S8, late enhance** (`useImageGeneration`, `useSVGGeneration`): `pendingEnhance` is now `{ correlationId, prompt }`. `generate()` and `clearConversation()` call `dropPendingEnhance()` (ref cleared, `isEnhancing` false), so the answer is ignored; before, Generate dispatched "a fox" and the answer then replaced the box with the enhanced text under the running request, and Clear left the spinner running and was refilled. The answer is applied with a functional update only while `current.trim()` still equals the sent prompt, so an edit made during the enhance wins. Generate is **not** blocked while enhancing: it commits to the text on screen (which the turn snapshot records), and blocking it would make a lost enhance reply disable Generate too. The discarded enhance still costs its one small text call.
- **R5-S9a, throws outside a handler's try** (`MessageHandler.handleMessage`): any rejection from `router.route` is logged and answered with `ERROR` (`source: 'extension.router'`, `code: 'UNHANDLED_ERROR'`, a generic message pointing at the output log) carrying the request's `correlationId`. Example: `EnhanceHandler` and both generation handlers log `prompt.substring(0, 50)` before their `try`, so a payload without a prompt threw into the provider's log-only catch and the request's spinner never stopped. If a domain handler had already answered, the extra error is stale and the webview drops it. A message that is not an envelope is ignored with a `warn`. New `MessageSource` `'extension.router'`.
- **R5-S9c, uncorrelated errors** (`App.tsx`): the unclaimed-error rule now keys on the id, not the source. An error neither hook claims is dropped only when its `correlationId` is an Image/SVG tab id (`isGenerationTabRequestId`, `utils/requestId.ts`): such an error answers a request that is no longer outstanding. Everything else, including an error from `extension.imageGeneration` / `svgGeneration` / `enhance` with no id, is shown in the visible tab (P2 dropped those). `REQUEST_SOURCES` is gone.

#### Host

- **Rollback, in-flight guard, first-turn release** (`ImageOrchestrator.ts`, ported from frame-minion@40e7949 `ImageOrchestrator.ts:102-166`; same pattern in `SVGOrchestrator.ts`): a turn records the message count, turn number and (image) seed and last images before adding the user message (turn number and last images since `adcdb92`, R5-S9b: a result without an `images` array made `addAssistantResponse` throw after it had advanced `turnNumber`, so the rollback left a phantom turn and a failed first turn was never released); any failure, including an SVG reply with no `<svg>`, splices back to it, and a conversation whose first turn failed is removed. A per-conversation `inFlight` set rejects an overlapping request (`already generating`) and a clear while a turn runs (`Wait for … to finish`). Without it, a second continuation could push its user message into the array the first request was about to serialize.
- **Deep copy** (`ImageConversationManager.addAssistantResponse`, Frame `:141`): the provider's assistant message is copied with JSON round-trip, so the transcript shares no nested parts with the result the handler reads. A non-array `content` keeps its string text (Frame `:162`).
- **Clear errors**: `handleClearConversation` in both handlers catches a refused clear and posts `ERROR` with the request's correlation id.
- **Save outcomes** (`ImageGenerationHandler`, `SVGGenerationHandler`): exactly one `*_SAVE_RESULT` per request. A dismissed dialog returns `cancelled: true` (it threw `Save cancelled` before). Opening the written file is in its own `try`; a failure there is a `warn` and no longer posts a second, failed result after the success.
- **Image extension from the bytes**: `saveImage` decodes the data URL, identifies PNG/JPEG/GIF/WebP by signature (`sniffImageMime`) and names the file after it, replacing any suggested extension. A label that disagrees with the bytes is logged; unidentified data is refused.

#### Intentionally not in P2

- Generate does not release the previous host conversation, and there are no archived threads (P4). Host memory therefore grows by one conversation per Generate until the extension restarts (R5-S9, deferred to P4's archives, which give conversations an owner and a lifetime).
- Typing in the prompt still re-serializes the whole history, because the draft and history share one persisted object; bounded persistence with a separate draft reserve is P3 (Frame R-3).
- Reloading the webview mid-generation still loses the pending request (Frame F-10, R5-S9); pending refs are not persisted by design, and a reloaded webview cannot tell a request still running on the host from one that died with it.
- Re-hydrating an image conversation after a host restart does not replay the raster references of its first turn (R5-S9): the webview doesn't persist them (base64, per-request). Replaying them needs P3's host transcript store.
- Host-side save-filename validation is P5a (ledger S4).
- Upstream to Frame: the open-after-save second result and the "Saved" timer exist in Frame's Image tab too.

#### Test coverage

516 → 569 tests (34 → 40 suites) at `a2d5115`; 583 tests (41 suites) with `adcdb92`. Counts are on top of PR B (34 suites / 516 tests).

- `ImageOrchestrator.test.ts` (new; adapted from Frame `ImageConversationModes.test.ts:120,163,203`, without modes and store): rollback of prompt and seed, first-turn release, a re-hydrated thread keeps its history on failure, one provider request under concurrency, clear refused mid-turn, SVG sent once (fresh and after re-hydration). Drives the real `OpenRouterImageClient` against a mocked `fetch`, so assertions are on request bodies.
- `SVGOrchestrator.test.ts`: rollback after a provider error and after a reply with no SVG, first-turn release, concurrency, SVG text once.
- `ImageConversationManager.test.ts`: the stored message is isolated from the provider result; Gemini stripping leaves the result intact.
- `useImageGenerationOwnership.test.tsx` / `useSVGGenerationOwnership.test.tsx` (jsdom): stale and duplicate responses and errors ignored (adapted from Frame `useImageGenerationModes.test.tsx:41`), turn recorded from the snapshot, refine payload has thread settings and no attachments, legacy state continues with saved controls, enhance and clear correlation, Saved only on success (not on cancel, failure, unknown or superseded result), `.webp`/`.gif` names, unsupported MIME refused, `persistedState` referentially stable while idle.
- `AppErrorRouting.test.tsx` (jsdom, renders `App`): an Image enhance error leaves the SVG generation running and error-free; only its own error settles it; a settings error shows in the visible tab only; an unrelated re-render doesn't call `setState`.
- `GenerationSaveHandlers.test.ts`: `.webp` from WebP bytes, bytes beat a wrong label, unidentified data refused, cancel reported as `cancelled`, open failure keeps the single success result, refused clear correlated.
- `imageFormats.test.ts`: extension map and signature sniffing.
- `adcdb92`: a late enhance after Generate, after Clear and after an edit, in both hooks (each fails without the fix); `MessageHandlerFailures.test.ts` (real domain handlers: an enhance without a prompt and a generation without a payload are answered with a correlated `extension.router` error; non-envelopes are ignored); `AppErrorRouting.test.tsx` shows an uncorrelated generation-host error and settles / drops correlated router errors; rollback after a recorded reply restores turn number, seed and last images and still releases a failed first turn (image), and restores the turn number (SVG).

Lint: 11 → 9 errors (two invalid `react-hooks` disable comments removed with the effects they annotated), 22 → 20 warnings (unused `pendingPrompt`).

### P5a: SVG safety and ownership (`claude/pixel-minion-svg-safety-dhbqpd`, stacked on P2)

Roadmap phase P5a. Fixes the pre-existing SVG defects confirmed in the PR #12 review (ledger S1, S4, S5, and the SVG Refine part of S2). Commit `9128d89`.

#### User-facing

- Generated SVG never enters the app's DOM; a hostile `<style>` or duplicate ids can't affect the panel.
- Documents that fail the new policy show a message and their code (the code view opens by itself); Save is disabled in the webview and refused by the host.
- Refine follows the conversation's model; previews use the conversation's aspect ratio.
- Re-hydrated SVG conversations replay their raster reference.
- Save refuses file names that aren't plain names.

#### Isolated preview

- `SVGPreview.tsx` renders `<img src="data:image/svg+xml;base64,…">` for all five previews (inline, 32/64/128, full) instead of `dangerouslySetInnerHTML`. Chromium renders an `<img>` SVG as a separate document in secure animated mode: no script, no external fetches, CSS and SMIL animation allowed, and its styles and ids are scoped to that document. The webview CSP already had `img-src … data: blob:`; `webviewHtml.test.ts` now pins `data:` there and that `script-src` stays nonce-only.
- `svgPreviewSource.ts` caches the last document's verdict and data URL, so the five previews scan and encode once per result. Base64 goes through `encodeURIComponent` → one char per UTF-8 byte → `btoa` (no `TextEncoder`, which jsdom lacks).
- An `<img>` that fails to decode (malformed in ways the scanner tolerates, e.g. case-mismatched tags) shows "couldn't be rendered" instead of a broken image.

#### `SVGDocumentPolicy` (`src/shared/svg/SVGDocumentPolicy.ts`)

- Shared by webview (preview, Save button, hook) and host (save handler, orchestrator log). The plan named `infrastructure/svg/`; it lives in `shared/` because the webview needs it too and must not import infrastructure.
- **Rejects, never rewrites**: a single-pass scanner with sticky regexes (linear time) over prolog, elements, attributes, text, comments and CDATA. It decodes XML entities in attribute values and `<style>` text, and CSS comments and escapes, before checking. Unknown or unparseable input is a rejection (fail closed).
- **Accepts** ordinary SVG: `<style>` with `@keyframes`, SMIL, gradients, filters, `<text>`, `href="#…"` / `url(#…)`, embedded `data:image/{png,jpeg,gif,webp}` and `data:font/*`, the XML declaration and a public DOCTYPE.
- **Rejects** documents over 2 MiB (UTF-8, counted without allocating), without exactly one `<svg>` root, or with mismatched/unclosed tags, control characters or unpaired surrogates; `<script>`, `<foreignObject>`, `<iframe>`, `<embed>`, `<object>`, `<handler>` (any namespace or case); `on*` attributes; `href` / `src` / `xml:base` that leave the document (including protocol-relative URLs and `data:image/svg+xml`); CSS `url()` that leaves it (in `<style>`, `style=`, or any attribute such as `fill=`); `@import`, `image-set()`, `expression()`, `-moz-binding`, `behavior:`; `javascript:` / `vbscript:` / `data:text/html` anywhere in an attribute; SMIL animating `href`; a DOCTYPE with an internal subset; processing instructions other than `<?xml …?>`.
- **Tradeoff, intentionally strict**: an SVG that loads a web font with `@import` or `url(https://…)` is rejected. In the `<img>` preview the font wouldn't load anyway, and a saved file would fetch it when opened. The message names the cause, so the user can ask for a version without it.

#### Ownership

- `src/shared/svg/svgRoutes.ts`: `isNativeVectorSvgModel` / `svgModelSupportsRefinement`, the single copy of the `recraft/` rule. `SVGOrchestrator.selectClient` routes with it. P5b (or PR B's SVG catalog `kind`) replaces its body.
- Refine eligibility: `SVGGenerationView` uses `threadSettings.model` (P2) instead of the draft picker; `useSVGGeneration.continueChat` refuses a native-vector thread; `SVGOrchestrator.continueSVG` throws before re-hydrating or calling a provider when the thread's model (in memory, or the payload's model for re-hydration) is native-vector. Before, switching the picker to a text model enabled Refine on a Recraft thread, and the host sent the text transcript to the vector client.
- Raster reference on replay: `SVGConversationHistoryTurn.referenceImage` / `SVGRehydrationTurn.referenceImage`. The hook records the image actually sent (none when the attachment was an SVG, which travels as text) in the dispatch snapshot, and sends it in `history`. `SVGConversationManager.userContent()` builds live and re-hydrated user turns, so a restored request equals the live one (tested). Cost: each such turn persists the reference data URL in webview state.
- Previews use `threadSettings.aspectRatio`.

#### Saving

- `src/application/handlers/saveFileName.ts` `plainSaveFileName()`: both save handlers refuse a suggested name that is empty, over 200 characters, contains `/ \ : * ? " < > |` or control characters, contains `..`, or starts with `.`. Refused, not repaired: the webview only ever sends `pixel-minion-<timestamp>.<ext>`. Before, the SVG handler joined the name onto the output folder unchecked (`..` escaped it); the image handler had the same gap.
- `SVGGenerationHandler.saveSVG` runs the policy before the dialog or write; `useSVGGeneration.saveSVG` refuses first, so a refused save never shows as in progress.

#### Removed (S5)

- `MarkdownRenderer.tsx` (claimed to sanitize, inserted raw `marked` HTML), the never-mounted `HelloWorldView.tsx`, its `useHelloWorld.ts` hook, `markdown.css`, their barrel exports and `PersistenceState.helloWorld`. Verified unreferenced. Because the components barrel re-exported `HelloWorldView`, `marked` was in the webview bundle: `webview.js` 414 KiB → 384 KiB.
- **Kept**: the `marked` dependency and the host `HelloWorldHandler` / `HELLO_WORLD_*` messages, which still import it. With the webview hook gone nothing sends `HELLO_WORLD_REQUEST`, so that host route is dead scaffold too; removing it touches `MessageHandler`, message types, two test files and `package.json`, and is left for a cleanup PR.

#### Not done here

- CSS and SMIL animation inside the `<img>` preview can't be checked in jsdom; it needs the manual installed-VSIX check (parity plan §7). Script inside the preview never runs, by design.
- Duplicate ids within one generated document are the document's own business; they no longer collide with the app's ids.

#### Test coverage

375 → 465 tests (34 → 38 suites).

- `SVGDocumentPolicy.test.ts` with `__tests__/fixtures/svgDocuments.ts`: 9 accepted fixtures (gradients, CSS animation, SMIL, entities, embedded PNG and font, namespaced root, prolog), 31 rejected (script in any case/namespace, handlers quoted/unquoted/SMIL, foreignObject form, external image/use/link/filter/xml:base, protocol-relative, javascript: plain/entity-encoded/NUL-split, SMIL href, remote `fill=url()`, `@import` plain/entity-encoded/comment-split, CSS-escaped `url()`, nested SVG and HTML data URLs, xml-stylesheet, DOCTYPE entities, HTML root, two roots, unclosed element, control characters, unpaired surrogate), the style-leak document accepted (isolation is the preview's job), the size cap in UTF-8 bytes, non-SVG input, and linear time.
- `SVGGenerationViewIsolation.test.tsx` (renders the view): five `<img>` previews whose data URLs decode to the source; no generated `<style>`, `#pixel-leak-marker`, `#monitor-frame` or `#skull` in the app DOM; the opened code view holds the markup as text; UTF-8 round trip; a rejected document has no preview, shows the message and its source, and Save is disabled and posts nothing; Refine follows the thread's model in both directions.
- `useSVGGenerationSafety.test.tsx`: native-vector refine refused without posting; rejected document never posted for save; raster reference recorded with the turn and sent in `history`; an SVG attachment's preview isn't recorded as a raster reference.
- `SVGOrchestrator.test.ts`: native-vector refine refused before any provider call, in memory and for re-hydration; a rejected native-vector document is returned and logged; a re-hydrated request equals the live one, raster reference included. `SVGConversationManager.test.ts`: re-hydrated user turn equals the live one.
- `GenerationSaveHandlers.test.ts` and `saveFileName.test.ts`: traversal, separators, drive/stream `:`, hidden names, control and reserved characters refused with no write, for both handlers; a policy-rejected SVG never reaches the dialog or disk.
- `webviewHtml.test.ts`: `img-src` allows `data:`; `script-src` is nonce-only.

Lint unchanged (9 errors, 20 warnings, all pre-existing).

---

## [1.3.0] - 2026-05-20

### Overview

Adds Recraft vector SVG support as a parallel path in the SVG suite, expands the image and SVG catalogs across multiple providers (Recraft raster, Grok Imagine, Claude Opus 4.7, GPT-5.4, Gemini Flash 3.5), fixes the Seedream 4.5 modality bug, and tightens catalog correctness (mislabel, stale pricing, dead-endpoint cleanup).

**Key Highlights:**

- 🎨 **Recraft Vector SVG** - Native vector output via Recraft's image-output models, integrated through a new TextClient adapter so the SVG tab's preview / refine / save flow works unchanged
- ⭐ **Claude Opus 4.7** - Promoted to the top SVG recommendation
- 🐛 **Seedream 4.5 fix** - Was 404'ing because it rejects `["image","text"]` modalities; added to the image-only branch
- 🧭 **Refine UX** - Disabled with a hint when a Recraft vector model is selected (Recraft regenerates from scratch instead of iterating)

**PR:** #11 - feat: expand model catalog — Recraft (vector + raster), Grok Imagine, new SVG text models

---

### Features

#### Recraft Vector SVG Integration (PR #11)

**What It Does:**

Adds native vector SVG generation to the SVG tab via Recraft's `text+image → image` models. The output is real `<svg xmlns="...">...</svg>` markup, base64-encoded inside a `data:image/svg+xml` URL.

**Technical Implementation:**

The existing SVG suite reuses text models (Gemini, Claude, GPT) via `OpenRouterDynamicTextClient`, expecting SVG markup inside markdown code blocks. Recraft is fundamentally different — it outputs SVG via the image-generation pathway with `modalities: ['image']` and returns the document in `message.images[0].image_url.url`.

To avoid a deep refactor, a new `OpenRouterImageSVGClient` implements the existing `TextClient` interface but internally:
- Calls `/chat/completions` with `modalities: ['image']`
- Validates the response shape and decodes the base64 SVG payload
- Returns the raw markup in `TextCompletionResult.content` so `SVGOrchestrator.extractSVG()` works unchanged

`SVGOrchestrator` gained a `selectClient()` method that routes on model prefix (`recraft/*` → vector client, everything else → text client).

**Files Added:**

- `src/infrastructure/ai/clients/OpenRouterImageSVGClient.ts` - New TextClient adapter for image-output SVG models
- `src/__tests__/infrastructure/ai/clients/OpenRouterImageSVGClient.test.ts` - 4 unit tests covering the happy path, both error paths, and default-model fallback

**Files Modified:**

- `src/infrastructure/ai/orchestration/SVGOrchestrator.ts` - Added `setVectorImageClient()` + `selectClient()` dispatch
- `src/application/handlers/MessageHandler.ts` - Inject the new client alongside the text client
- `src/infrastructure/ai/clients/index.ts` + `src/infrastructure/ai/index.ts` - Export the new client
- `src/__tests__/infrastructure/ai/orchestration/SVGOrchestrator.test.ts` - Added 4 dispatch tests (Recraft routing, text-client routing, both missing-client error paths)

#### Catalog Expansion

**SVG models added:**

- `recraft/recraft-v4.1-pro-vector` - ⭐ Recommended, default. ~$0.08/image. 1:1 only.
- `recraft/recraft-v4-vector` - Budget tier. ~$0.02/image. 1:1 only.
- `anthropic/claude-opus-4.7` - ⭐ Recommended for code-based SVG generation. $5/$25 per Mtok.
- `openai/gpt-5.4` - $2.50/$15 per Mtok.
- `google/gemini-3.5-flash` - $1.50/$9 per Mtok, slots between Gemini Flash 3.0 and Pro 3.1.

**Image models added:**

- `recraft/recraft-v4.1-pro` - ~$0.06/image (raster)
- `recraft/recraft-v4-pro` - ~$0.06/image (raster)
- `recraft/recraft-v4` - ~$0.04/image (raster)
- `recraft/recraft-v3` - ~$0.04/image (raster)
- `x-ai/grok-imagine-image-quality` - ~$0.05/image, returns JPEG (raster)

**Files Modified:**

- `src/infrastructure/ai/providers/OpenRouterProvider.ts` - 11 new entries, 2 stale entries removed, mislabel and pricing fixes
- `package.json` - Default SVG model switched to `recraft/recraft-v4.1-pro-vector`
- `src/application/handlers/domain/SettingsHandler.ts` - Fallback default aligned

#### Refine Button UX for Recraft

**What It Does:**

When a Recraft vector model is selected and a conversation is open, the Refine input below the SVG preview is disabled and shows a placeholder explaining that Recraft generates fresh output instead of iterating on the prior turn. Users are directed to start a new generation to change the prompt.

**Why:** Recraft's image-output path doesn't multi-turn cleanly — sending the prior SVG markup back as text in an `assistant` role doesn't communicate "your prior output" to a model that expects image inputs. Rather than ship a half-working Refine, we explicitly gate it.

**Files Modified:**

- `src/presentation/webview/components/views/SVGGenerationView.tsx` - Conditional disabled / placeholder for `ContinueChatInput`

---

### Fixed

#### Seedream 4.5 Modality Bug

- **Issue**: `bytedance-seed/seedream-4.5` was being called with `modalities: ['image', 'text']` and returning 404 `No endpoints found that support the requested output modalities`. Same shape as the FLUX / Sourceful image-only providers, but `bytedance-seed/` was missing from the image-only branch.
- **Fix**: Added `bytedance-seed/` to `OpenRouterImageClient.getModalitiesForModel`. Also added `recraft/` and `x-ai/` to the same branch since Recraft and Grok Imagine behave the same way.
- **Impact**: Seedream image generations now succeed.
- **Commit**: `84bec72`

#### `extractMimeType` Regex Drops Compound MIME Subtypes

- **Issue**: Regex `^data:(image\/\w+);base64,` doesn't match `image/svg+xml` because `\w` excludes `+`. Would have silently dropped SVG image payloads.
- **Fix**: Updated to `^data:(image\/[\w.+-]+);base64,` to accept compound MIME subtypes.
- **Commit**: `36d5aa0`

#### Catalog Correctness

- **Mislabel**: `anthropic/claude-opus-4` was showing `displayName: 'Claude Opus 4.5'` but `claude-opus-4` is a different model from `claude-opus-4.5`. Display name now reads "Claude Opus 4".
- **Pricing**: `gemini-3-flash-preview` listed at $0.15/$0.60, actual OpenRouter pricing is $0.50/$3.00 per Mtok.
- **Dead endpoints removed**: `google/gemini-2.5-flash-image-preview` (image) and `google/gemini-3-pro-preview` (SVG) had no live endpoints.
- **Commit**: `36d5aa0`

---

### Architecture Notes

The Recraft integration intentionally uses a parallel client (`OpenRouterImageSVGClient`) rather than branching inside `OpenRouterDynamicTextClient`. This keeps each client's API call shape coherent — the dynamic text client never has to know about image modalities — and isolates the dispatch decision in `SVGOrchestrator.selectClient`. Trade-off: prefix-based dispatch (`model.startsWith('recraft/')`) duplicates a prefix-classification concern that also lives in `OpenRouterImageClient.getModalitiesForModel`. Acceptable until a third axis emerges; flagged in the PR review action plan (`.claude/review-action-plan-2026-05-20.md`) for future consolidation.

### Stats

- 15 files changed, +433 / -62
- Tests: 168 passing (was 160; +8 new tests across the new client and the new orchestrator dispatch)
- 1 PR (#11), 7 commits

---

## [1.2.3] - 2026-04-24

### Overview

Refreshes the curated OpenRouter image model list against the live image-capable model catalog.

### Added

#### New Image Generation Model

- **GPT-5.4 Image 2** (`openai/gpt-5.4-image-2`) - Latest OpenAI image model on OpenRouter ($8.00/$15.00 per million tokens), with text, image, and file input support and text plus image output.

### Changed

- Updated **Nano Banana 2** (`google/gemini-3.1-flash-image-preview`) pricing metadata from $0.25/$1.50 to $0.50/$3.00 per million tokens to match OpenRouter's current model API.

### Files Modified

- `src/infrastructure/ai/providers/OpenRouterProvider.ts` - Added GPT-5.4 Image 2 and updated current pricing metadata
- `README.md` - Refreshed image model table and recommended settings copy
- `CHANGELOG.md`
- `docs/CHANGELOG-DETAILED.md`

---

## [1.2.2] - 2026-03-04

### Overview

Fixes two high-impact image generation regressions introduced by stricter provider requirements:
1) Gemini multi-turn continuation failures on thought-signature validation
2) FLUX and Sourceful Riverflow generation failures from unsupported `image,text` output modality requests

**PR:** #10 - Fix Gemini continuation and image modalities for non-text image models
**Branch:** fix/preserve-gemini-reasoning-details

---

### Fixed

#### Gemini Multi-Turn Continuation Failures

- Preserved provider reasoning metadata and assistant response blocks for continuation state
- Added Gemini-safe fallback path when assistant image parts are returned without thought signatures
- Continued image context via user-side reference images when strict assistant-image replay is not valid

**Impact:**
- Prevents `INVALID_ARGUMENT` continuation failures with Gemini image models in multi-turn conversations
- Keeps conversation continuity after first-turn image generation

#### FLUX and Sourceful Riverflow Modality Mismatch

- Added model-family-aware modality selection in OpenRouter image client
- `black-forest-labs/*` and `sourceful/*` now send `modalities: ['image']`
- Gemini-style image models continue to use `modalities: ['image', 'text']`

**Impact:**
- Resolves OpenRouter `404 No endpoints found that support requested output modalities: image, text` for FLUX and Riverflow models

### Tests Added

- `src/__tests__/infrastructure/ai/orchestration/ImageConversationManager.test.ts`
  - Verifies reasoning/signature preservation behavior and Gemini-safe continuation fallback
- `src/__tests__/infrastructure/ai/clients/OpenRouterImageClient.test.ts`
  - Verifies model-specific modality routing (`image` vs `image,text`)

### Files Modified

- `src/infrastructure/ai/clients/ImageGenerationClient.ts`
- `src/infrastructure/ai/clients/OpenRouterImageClient.ts`
- `src/infrastructure/ai/orchestration/ImageConversationManager.ts`
- `src/infrastructure/ai/orchestration/ImageOrchestrator.ts`
- `src/__tests__/infrastructure/ai/orchestration/ImageConversationManager.test.ts`
- `src/__tests__/infrastructure/ai/clients/OpenRouterImageClient.test.ts`
- `README.md`
- `CHANGELOG.md`
- `docs/CHANGELOG-DETAILED.md`
- `package.json`
- `package-lock.json`

---

## [1.2.1] - 2026-03-03

### Overview

Adds latest image and SVG generation models, updates defaults for both tabs.

**PR:** #9 - feat: add latest image and SVG generation models
**Branch:** patch/model-updates

---

### Added

#### New Image Generation Model

- **Nano Banana 2** (`google/gemini-3.1-flash-image-preview`) - Latest Gemini 3.1 Flash image model. Cheaper than previous Nano Banana ($0.25/$1.50 vs $0.30/$2.50 per million tokens). Now the recommended default.

#### New SVG Generation Models

- **Gemini Pro 3.1** (`google/gemini-3.1-pro-preview`) - Latest Google Pro model ($2.00/$12.00 per million tokens)
- **GPT-5.3 Codex** (`openai/gpt-5.3-codex`) - Latest OpenAI coding model ($1.75/$14.00 per million tokens). Now the default SVG model.

### Changed

- Default image model: `google/gemini-2.5-flash-image` → `google/gemini-3.1-flash-image-preview`
- Default SVG model: `openai/gpt-5.2-codex` → `openai/gpt-5.3-codex`

### Files Modified

- `package.json` - Version bump, updated default model IDs and descriptions
- `package-lock.json` - Version bump
- `src/infrastructure/ai/providers/OpenRouterProvider.ts` - Added 3 new models, updated defaults
- `src/application/handlers/domain/SettingsHandler.ts` - Updated image model fallback
- `src/presentation/webview/hooks/domain/useSettings.ts` - Updated image and SVG model fallbacks

---

## [1.2.0] - 2026-02-11

### Overview

Adds new image and SVG generation models, updates default SVG model.

**PR:** #8 - feat: add new image and SVG generation models

---

### Added

#### New Image Generation Models

- **FLUX.2 Klein 4B** (`black-forest-labs/flux.2-klein-4b`) - Fastest and most cost-effective model in the FLUX.2 family
- **Riverflow V2 Pro** (`sourceful/riverflow-v2-pro`) - Top-tier GA Sourceful model
- **Riverflow V2 Fast** (`sourceful/riverflow-v2-fast`) - Fast GA Sourceful model

#### New SVG Generation Models

- **Claude Opus 4.6** (`anthropic/claude-opus-4.6`) - $5/$25 per M tokens (cheaper than Opus 4)
- **GPT-5.2 Codex** (`openai/gpt-5.2-codex`) - $1.75/$14 per M tokens, 400K context

### Changed

- Default SVG model updated from `openai/gpt-5.1-codex` to `openai/gpt-5.2-codex`

**Files Modified:**

- `src/infrastructure/ai/providers/OpenRouterProvider.ts` - New model definitions, updated default
- `package.json` - Updated default SVG model setting

---

## [1.1.1] - 2025-12-27

### Overview

Adds ByteDance Seedream 4.5 image generation model.

**PR:** #7 - feat: add ByteDance Seedream 4.5 image model

---

### Added

#### New Image Generation Model

Added ByteDance Seedream 4.5 (`bytedance-seedream/seedream-4.5`) - Advanced image generation model from ByteDance.

**Files Modified:**

- `src/infrastructure/ai/providers/OpenRouterProvider.ts` - New model definition

---

## [1.1.0] - 2025-12-18

### Overview

Adds new AI models and a size warning feature for Sourceful provider limits.

**PR:** #6 - feat: add new OpenRouter models and Sourceful size warning

---

### Added

#### New Image Generation Models

Added 4 new image generation models to OpenRouter provider:

- **FLUX.2 Max** (`black-forest-labs/flux.2-max`) - Top-tier from Black Forest Labs
- **Riverflow V2 Max** (`sourceful/riverflow-v2-max-preview`) - Most powerful Riverflow variant
- **Riverflow V2 Standard** (`sourceful/riverflow-v2-standard-preview`) - Balanced performance
- **Riverflow V2 Fast** (`sourceful/riverflow-v2-fast-preview`) - Fastest Riverflow variant

#### New SVG Generation Model

Added Gemini Flash 3.0 (`google/gemini-3-flash-preview`) - high speed reasoning model for SVG generation.

#### Sourceful Size Warning

Displays a warning when reference images exceed Sourceful's 4.5MB request limit:

**Implementation:**

- `isSourcefulModel()` - Detects Sourceful provider models
- `calculateBase64Size()` - Calculates approximate byte size of base64 data URLs
- Warning displayed in yellow box below reference image uploader
- Uses VSCode theme variables for consistent styling

**Files Modified:**

- `src/infrastructure/ai/providers/OpenRouterProvider.ts` - New model definitions
- `src/presentation/webview/hooks/domain/useImageGeneration.ts` - Size checking logic
- `src/presentation/webview/components/views/ImageGenerationView.tsx` - Warning display
- `src/presentation/webview/styles/components/image-generation-view.css` - Warning styles

#### Tests

Added 16 unit tests for size warning utilities:

- 8 tests for `isSourcefulModel()` (all Sourceful variants, other providers, edge cases)
- 8 tests for `calculateBase64Size()` (empty, single, multiple, threshold validation)

---

## [1.0.2] - 2025-12-01

### Overview

Sprint 2-3 of the SVG Architect Epic - Foundation improvements and infrastructure prep.

**Key Changes:**
- SVG extraction now properly validates content
- PromptLoader service for centralized prompt management
- SVG Architect placeholder prompts ready for Phase 1

---

### Fixed

#### SVG Extraction Fallback (Debt-001)

**What Changed:**
`extractSVG()` in SVGOrchestrator now throws a user-friendly error instead of returning raw content when no valid SVG tags are found.

**Why:**
Previously, if the AI returned an explanation instead of SVG code, it would be displayed as "SVG code" in the UI - confusing users.

**Implementation:**
- Validate SVG tags even when found in markdown code blocks
- Log content preview (first 200 chars) for debugging
- Throw clear error: "No valid SVG code found in response"

**Files Modified:**
- `src/infrastructure/ai/orchestration/SVGOrchestrator.ts`

**Tests Added:** 16 tests in `SVGOrchestrator.test.ts`

---

### Added

#### PromptLoader Service (Feature-001)

**What It Does:**
Centralized system prompt management - loads prompts from files instead of inline strings.

**API:**
```typescript
const prompt = await promptLoader.load('svg', 'generation');
const exists = await promptLoader.exists('svg-architect', 'blueprint-analysis');
promptLoader.clearCache();
```

**Directory Structure:**
```
resources/system-prompts/
├── svg/
│   └── generation.md
├── enhance-svg/
│   └── enhance.md
└── svg-architect/
    ├── blueprint-analysis.md
    ├── blueprint-render.md
    └── blueprint-validation.md
```

**Files Added:**
- `src/infrastructure/resources/PromptLoader.ts`
- `resources/system-prompts/svg/generation.md`
- `resources/system-prompts/enhance-svg/enhance.md`
- `resources/system-prompts/svg-architect/blueprint-analysis.md`
- `resources/system-prompts/svg-architect/blueprint-render.md`
- `resources/system-prompts/svg-architect/blueprint-validation.md`

**Files Modified:**
- `src/extension.ts` - PromptLoader instantiation
- `tsconfig.json` - Added `@resources` path alias

**Tests Added:** 19 tests in `PromptLoader.test.ts`

**Note:** Orchestrators not yet updated to use PromptLoader - deferred to Phase 1 when SVG Architect orchestrators are built.

---

### Developer Notes

#### Test Coverage Update

140 tests across 12 test suites:

| Suite | Tests | Notes |
|-------|-------|-------|
| OpenRouterDynamicTextClient | 32 | Concurrent request handling |
| SVGOrchestrator | 16 | SVG extraction scenarios |
| PromptLoader | 19 | Load, cache, exists |
| (previous suites) | 73 | Unchanged |

---

## [1.0.1] - 2025-12-01

### Overview

Sprint 1 of the SVG Architect Epic - Fix model race condition.

**Key Changes:**
- Fixed race condition in concurrent SVG generation
- Deprecated `setModel()` in favor of per-request model passing

---

### Fixed

#### SVG Model Race Condition (Debt-006)

**What Changed:**
`OpenRouterDynamicTextClient.createCompletion()` now accepts an optional `model` parameter. SVGOrchestrator passes model directly instead of calling `setModel()`.

**Why:**
The previous pattern set `this.currentModel` as shared state. Concurrent requests with different models could race, causing wrong model to be used.

**Files Modified:**
- `src/infrastructure/ai/clients/TextClient.ts` - Added `model?: string` to options
- `src/infrastructure/ai/clients/OpenRouterDynamicTextClient.ts` - Use `options.model` if provided
- `src/infrastructure/ai/orchestration/SVGOrchestrator.ts` - Pass model to `createCompletion()`
- `CLAUDE.md` - Updated AI Client Integration docs

**Tests Added:** 32 tests in `OpenRouterDynamicTextClient.test.ts`

---

## [1.0.0] - 2025-11-30

### Overview

First release of Pixel Minion - AI-powered image and SVG generation inside VS Code. This release establishes the core architecture and provides full-featured image and SVG generation capabilities.

**Key Highlights:**
- Image generation with multi-turn conversations
- SVG generation with code preview
- Token usage tracking with cost display
- Secure API key storage
- Clean Architecture foundation

**Statistics:**
- 30+ commits
- Core feature set complete
- PR #2 for final polish

---

### Features

#### Image Generation Tab

**What It Does:**
Generate images from text prompts with iterative refinement through multi-turn conversations.

**Key Features:**
- **Text-to-Image** - Enter a prompt, get an image
- **Image-to-Image** - Upload reference images for context
- **SVG Context** - Attach SVG files sent as text context (not image)
- **Aspect Ratio** - 1:1, 16:9, 9:16, 4:3, 3:4
- **Seed Control** - Set seed for reproducibility
- **Enhance Prompt** - AI-powered prompt improvement button
- **Multi-Turn** - Refine with follow-up prompts
- **Token Display** - Per-turn tokens and cost

**Files:**
- `src/presentation/webview/components/views/ImageGenerationView.tsx`
- `src/presentation/webview/hooks/domain/useImageGeneration.ts`
- `src/application/handlers/domain/ImageGenerationHandler.ts`
- `src/infrastructure/ai/orchestration/ImageOrchestrator.ts`
- `src/infrastructure/ai/orchestration/ImageConversationManager.ts`
- `src/infrastructure/ai/clients/OpenRouterImageClient.ts`

---

#### SVG Generation Tab

**What It Does:**
Generate vector graphics as code using text models, with multi-size preview.

**Key Features:**
- **Text-to-SVG** - Describe the vector graphic
- **Reference Image** - Upload image for AI reference
- **Multi-Size Preview** - 32px, 64px, 128px thumbnails
- **Code View** - View and copy raw SVG code
- **Multi-Turn** - Refine through iteration
- **Token Display** - Per-turn tokens and cost

**Files:**
- `src/presentation/webview/components/views/SVGGenerationView.tsx`
- `src/presentation/webview/hooks/domain/useSVGGeneration.ts`
- `src/application/handlers/domain/SVGGenerationHandler.ts`
- `src/infrastructure/ai/orchestration/SVGOrchestrator.ts`
- `src/infrastructure/ai/orchestration/SVGConversationManager.ts`
- `src/infrastructure/ai/clients/OpenRouterDynamicTextClient.ts`

---

#### Token Usage Tracking (PR #1)

**What It Does:**
Display per-turn token usage and cost for both Image and SVG generation.

**Implementation:**
- Enable OpenRouter usage accounting with `usage: { include: true }`
- Parse native token counts (`native_tokens_prompt`, `native_tokens_completion`)
- Parse cost data (`cost`, `total_cost`) from responses
- Wire through orchestrators to handlers to webview

**Files Modified:**
- `src/infrastructure/ai/clients/TextClient.ts` - Added `costUsd` to `TokenUsage`
- `src/infrastructure/ai/clients/OpenRouterImageClient.ts` - Enable usage accounting
- `src/infrastructure/ai/clients/OpenRouterDynamicTextClient.ts` - Enable usage accounting
- `src/infrastructure/ai/orchestration/ImageOrchestrator.ts` - Pass through `costUsd`
- `src/infrastructure/ai/orchestration/SVGOrchestrator.ts` - Pass through `costUsd`
- `src/presentation/webview/components/image/ConversationThread.tsx` - Display usage
- `src/presentation/webview/components/views/SVGGenerationView.tsx` - Display usage

---

#### Enhance Prompt Feature (PR #2)

**What It Does:**
AI-powered prompt enhancement button for Image generation.

**Implementation:**
- New message types: `ENHANCE_PROMPT_REQUEST`, `ENHANCE_PROMPT_RESPONSE`
- EnhanceHandler calls text model to improve prompts
- UI button in Image generation header

**Files Added/Modified:**
- `src/shared/types/messages/enhance.ts` - New message types
- `src/application/handlers/domain/EnhanceHandler.ts` - New handler
- `src/presentation/webview/hooks/domain/useImageGeneration.ts` - Enhance action
- `src/presentation/webview/components/views/ImageGenerationView.tsx` - Button UI

---

#### SVG Attachment Support

**What It Does:**
Allow SVG files to be attached as text context (not as image) for reference.

**Implementation:**
- Detect SVG MIME type on upload
- Convert SVG to text and include in prompt
- Show warning for large SVGs (>16KB)

**Files Modified:**
- `src/presentation/webview/hooks/domain/useImageGeneration.ts` - SVG detection
- `src/presentation/webview/components/views/ImageGenerationView.tsx` - Warning display
- `src/presentation/webview/components/svg/SingleImageUploader.tsx` - SVG handling

---

#### Multi-Size SVG Preview

**What It Does:**
Display generated SVGs at 32px, 64px, and 128px to verify scalability.

**Files Modified:**
- `src/presentation/webview/components/views/SVGGenerationView.tsx` - Preview grid
- `src/presentation/webview/styles/components/svg-generation-view.css` - Styles

---

### Model Configuration

#### Image Models

**File:** `src/infrastructure/ai/providers/OpenRouterProvider.ts`

```typescript
export const OPENROUTER_IMAGE_MODELS: ModelDefinition[] = [
  { id: 'google/gemini-2.5-flash-image', displayName: '⭐ Nano Banana 10/25 - Recommended' },
  { id: 'google/gemini-2.5-flash-image-preview', displayName: 'Nano Banana 8/25' },
  { id: 'google/gemini-3-pro-image-preview', displayName: 'Nano Banana Pro' },
  { id: 'openai/gpt-5-image-mini', displayName: 'GPT-5 Image Mini' },
  { id: 'openai/gpt-5-image', displayName: 'GPT-5 Image' },
  { id: 'black-forest-labs/flux.2-pro', displayName: 'FLUX.2 Pro' },
  { id: 'black-forest-labs/flux.2-flex', displayName: 'FLUX.2 Flex' },
];

export const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image';
```

#### SVG Models

```typescript
export const OPENROUTER_SVG_MODELS: ModelDefinition[] = [
  { id: 'google/gemini-3-pro-preview', displayName: 'Gemini Pro 3.0' },
  { id: 'anthropic/claude-opus-4', displayName: 'Claude Opus 4.5' },
  { id: 'openai/gpt-5.1-codex', displayName: 'OpenAI: GPT-5.1 Codex' },
];

export const DEFAULT_SVG_MODEL = 'openai/gpt-5.1-codex';
```

---

### Architecture

#### Three-Suite AI Infrastructure

The extension uses three parallel AI generation suites:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Three Parallel Suites                         │
├─────────────────────────────────────────────────────────────────┤
│  TEXT SUITE              IMAGE SUITE              SVG SUITE      │
│  ───────────             ────────────             ─────────      │
│  TextOrchestrator        ImageOrchestrator        SVGOrchestrator│
│       │                        │                        │        │
│       ├── TextClient           ├── ImageClient          ├── DynamicTextClient
│       │                        │                        │        │
│       └── TextConversation     └── ImageConversation    └── SVGConversation
│           Manager                  Manager                  Manager
└─────────────────────────────────────────────────────────────────┘
```

**Pattern:**
- Orchestrator coordinates client + conversation manager
- Client handles API communication
- ConversationManager maintains state and history
- Re-hydration pattern restores state after extension restart

**Files:**
- `src/infrastructure/ai/orchestration/` - Orchestrators and managers
- `src/infrastructure/ai/clients/` - API clients

---

#### Message Envelope Pattern

All extension ↔ webview communication uses typed envelopes:

```typescript
interface MessageEnvelope<TPayload> {
  type: MessageType;
  source: MessageSource;
  payload: TPayload;
  timestamp: number;
  correlationId?: string;
}
```

**Files:**
- `src/shared/types/messages/` - Message type definitions
- `src/application/handlers/MessageHandler.ts` - Strategy pattern routing

---

#### Tripartite Hook Pattern

Domain hooks export three interfaces:

```typescript
// State (read-only)
interface ImageGenerationState { ... }

// Actions (write operations)
interface ImageGenerationActions { ... }

// Persistence (what gets saved)
interface ImageGenerationPersistence { ... }
```

**Files:**
- `src/presentation/webview/hooks/domain/useImageGeneration.ts`
- `src/presentation/webview/hooks/domain/useSVGGeneration.ts`
- `src/presentation/webview/hooks/domain/useSettings.ts`

---

### Fixed

#### Reference Image Persistence Bug (PR #2)

**Issue:** SVG reference text persisted incorrectly across sessions, causing stale SVG to be attached to new generations.

**Root Cause:** `referenceSvgText` and `referenceImages` were included in persistence, but `referenceSvgIndex` was not, creating inconsistent state after reload.

**Fix:** Removed reference images from persistence - they're now per-request context only.

**Files Modified:**
- `src/presentation/webview/hooks/domain/useImageGeneration.ts`

```typescript
// Before (bug)
export interface ImageGenerationPersistence {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImages: string[];     // BUG: persisted
  referenceSvgText: string | null; // BUG: persisted
  ...
}

// After (fix)
export interface ImageGenerationPersistence {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  // Reference images NOT persisted - per-request context only
  ...
}
```

---

### Security

#### Secure API Key Storage

**Implementation:**
- API keys stored using VS Code SecretStorage API
- macOS: Keychain Access
- Windows: Credential Manager
- Linux: libsecret

**Files:**
- `src/infrastructure/secrets/SecretStorageService.ts`
- `src/application/handlers/domain/SettingsHandler.ts`

---

### Developer Notes

#### Build Commands

```bash
npm run watch    # Development with hot reload
npm run build    # Production build
npm test         # Run tests
npm run lint     # Check code style
```

#### Testing

82 tests across 8 test suites:

| Suite | Tests | Coverage |
|-------|-------|----------|
| MessageRouter | 9 | Strategy pattern routing |
| MessageHandler | 8 | Message dispatch |
| HelloWorldHandler | 5 | Markdown rendering |
| SettingsHandler | 9 | Settings management |
| AIHandler | 8 | Conversation handling |
| SecretStorageService | 10 | Secure storage |
| LoggingService | 12 | Output channel |
| PromptLoader | 11 | Resource loading |

---

### References

- CLAUDE.md - Developer guidance and architecture documentation
- ADR files in `docs/adr/` for architectural decisions

---

### Links

- [GitHub Repository](https://github.com/okeylanders/pixel-minion-vscode)
- [OpenRouter API](https://openrouter.ai/)
- [Buy Me a Coffee](https://buymeacoffee.com/okeylanders)

---

**Thank you for using Pixel Minion! Happy creating!**
