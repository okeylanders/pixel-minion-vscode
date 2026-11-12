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
- **Account ownership (PR #13 review F-01).** Replacing the key used to leave the previous account's figures on screen, not loading, until the new key's fetch settled (up to the client's 8 s timeout).
  - `OpenRouterBalancePayload.accountEpoch` is required: the service's key-generation counter (`accountEpoch()`), stamped at fetch start.
  - `AccountBalanceHandler.handleApiKeyChanged()` invalidates, posts `OPENROUTER_BALANCE_RESET { accountEpoch }`, then force-fetches. `useOpenRouterBalance.handleBalanceReset` clears the figures and reports `isLoading` until a payload for that epoch lands.
  - The hook drops payloads from an older epoch (still settling the request they answer), and a newer epoch replaces figures regardless of `fetchedAt`. Same-account refreshes are unchanged.
  - The handler's thrown-load fallback is stamped with the epoch read before the load, so a request for the old key that fails after the switch is discarded too.
  - Regression `balanceKeyChange.test.tsx` drives the real client, service and handler into the real hook with the new key's fetch held. It replaces the review witness `pr-13-key-replacement-repro.cjs`, which asserted the defect and is deleted.
- **Last known figures through transient failures (PR #13 review N-01).** The R3 fix (`d513145`) kept the last figures only when a load *threw*; the real client resolves offline / 429 / 5xx / unreadable replies as `unavailable`, which replaced good figures.
  - `AccountBalanceService` remembers each figure's last good read for the current key. A transient failure carries that figure over and sets `stale: { figuresFetchedAt, issue }`. Only the failed figure is carried, and the read time survives repeated failures.
  - `invalid_key` (401) and `forbidden` (403) are answers, not glitches: they forget the figure, and a later glitch can't resurrect it. `invalidate()` and a `no_key` result clear the memory, so nothing crosses a key change.
  - The payload keeps `keyIssue` / `creditsIssue`, so the 15 s failed-result TTL still drives a quick retry.
  - UI: muted amount (`is-stale`; zero keeps its colour), "Showing last known figures: <why>." in the card, "Updated <read time> · last known · couldn't refresh", and the reason in the pill tooltip.
  - Tests: service cases for each transient kind, per-figure carry, repeated failures, 401/403, key change and key cleared; a real-client integration case in `balanceRefreshFailure.test.tsx` (fetch rejects, not a mocked client method).

### Models (PR A)

- **Modalities.** `OpenRouterImageClient` no longer requests `['image','text']` from image-only endpoints: the Recraft V4.1 branch is removed and `krea/` and `microsoft/mai-image-` are added. A catalog-wide test checks requested ⊆ declared output modalities, using the 2026-11-07 `/images/models` snapshot.
- **Image-API-only models removed.** A keyed probe found OpenRouter rejects `/chat/completions` for GPT Image 2 / 1 / 1 Mini and Krea 2 Large / Medium / Medium Turbo, all added by the PR #12 refresh. They were removed until the Image API transport (roadmap P3). A test pins the probed chat-blocked set. Details are in the audit addendum.
- **`RETIRED_MODELS`.** Each entry carries a reason (`'delisted' | 'images-api-only'`). `SettingsHandler` migrates saved `imageModel` / `svgModel` on read (whichever scope holds the value), persists the replacement and logs why. It covers the five v1.3.0 ids OpenRouter has since delisted.
- The `pixelMinion.svgModel` description no longer recommends a removed model.

### Test infrastructure (PR A)

- `.tsx` tests run under jsdom via a per-file docblock; `tsconfig.test.json` adds JSX and DOM settings; `.css` imports are stubbed. No new dependencies.
- `tsc -p tsconfig.webview.json` now actually type-checks the webview. It previously inherited `exclude: ["src/presentation/webview"]` and checked 0 of 52 files.
- Tests: 18 suites / 174 tests on the PR #12 head → 28 / 322 on PR A → 30 / 341 after its R4 follow-up → 31 / 370 after the PR #13 review follow-up.

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

- Image: 27 → 35.
  - Added (8): `google/gemini-nano-banana-2.1` ⭐ (out $30/1M; prompt $1.5/1M; estimate ≈ $0.036 @ 1K is OpenRouter's measured benchmark median and says so, because Google's token count couldn't be verified), `bytedance-seed/seedream-5-0-{pro,lite,flash}`, `microsoft/mai-image-2.6`, `microsoft/mai-image-2.6-flash`, `sourceful/riverflow-v2.6-pro`, `x-ai/grok-imagine-image-2.0`.
  - Left out although chat-routable: `recraft/recraft-v4-styles` / `-styles-pro` (refs 1–10 required; no Generate gating until P3/P4) and `recraft/recraft-v4.1-flash` (refs 0–0; Refine always sends the previous image, so it waits for the same gating). Commented in `ImageModels.ts`. Flash was in the first cut of this PR; the PR #14 review (F-01) caught it and `8e53acd` deferred it.
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

#### PR #14 review follow-up (`8e53acd`)

- **F-01: Recraft V4.1 Flash deferred.** The row's `referenceImages: { min: 0, max: 0 }` was descriptive only. `ImageOrchestrator.continueConversation` sends `conversation.lastImages` as references on every Refine, attachments survive a model switch, and the uploader stays enabled, so normal use would send `image_url` parts to a text-only endpoint. The owner chose deferral over gating now: the row, its browser metadata and its modality-snapshot entry are removed, and `ImageModels.ts` records it beside Recraft V4 Styles (both return with P3/P4 capability-aware controls).
- **Guard:** `shared/models/catalog.test.ts` now requires every curated image model to accept at least one reference image (`referenceImages.max ≥ 1`). It replaces the review witness `pr-14-text-only-image-repro.cjs`, which asserted the defect and is deleted.

#### Not in this PR

- No request or routing change apart from M1: modalities still come from id prefixes (catalog-driven modalities and the Image API transport are P3), `SVGOrchestrator.selectClient` and the Refine gate still key on `recraft/` (P5b; a catalog test pins that every native-vector row is `recraft/` until then), no aspect ratio is sent to vector models, and no capability field is enforced.
- Image-API-only models, Recraft Styles (both kinds), Recraft V4.1 Flash and Krea K3 Edit wait for P3 (transport + reference gating).
- The GPT per-image estimate basis ("@ 1K · high" vs OpenRouter's measured medians, audit O5) is unchanged pending the family-wide decision.
- `README.md`'s model tables were already stale before this PR (they list Claude Opus 4.7 and GPT-5.1 Codex); left for the release pass.

#### Tests

- 28 suites / 322 tests → 32 suites / 497 tests. `tsc` (host and webview) clean; `npm run build` passes; ESLint unchanged (11 pre-existing errors, 22 warnings).
- After merging PR A's review follow-ups and the PR #14 review fix: 35 suites / 575 tests.
- Ported from Frame: `ModelBrowserModal.test.tsx` (7), `ModelBrowserSelect.test.tsx` (2), the "image pricing labels" block of `modelBrowserOptions.test.ts` (limited to Pixel's rows). Sample data renamed away from fal.ai.
- New: modal overlay/ARIA/scroll/reset/footer cases; select label, `aria-expanded` and helper cases; `SVGModelSelector.test.tsx` (kind grouping, custom cards); `shared/models/catalog.test.ts` (defaults shipped, no retired id listed, every retired id moves to a shipped model, coherent capabilities, SVG pricing shape per kind, native vector ⇔ `recraft/` while routing keys on it); refresh-specific label, rate, date and retiring-badge cases; the modality snapshot gained the 8 new image ids; `SVGOrchestrator` pins `maxTokens: 32000`.
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
- **Ownership-aware errors**: `handleError` now returns `boolean` (owned or not). It settles the pending generation, enhance or (since `fddaf41`) save it matches, or shows an error for its own `*-clear-` request; anything else returns `false` and changes nothing. `App.tsx` gives every `ERROR` to both hooks. An error from a non-request host (`extension.settings`, …) that neither hook owns is shown in the active tab through the new `showError(text)` action, without touching any spinner. Previously enhance and settings errors went to both hooks and cleared both spinners.
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

#### PR #15 review follow-up (`fddaf41`, `2252c30`)

- **N-01, router errors for saves** (`useImageGeneration`, `useSVGGeneration`): the router fallback's correlated `ERROR` for an outstanding `image-save-…` / `svg-save-…` id returned `false` from both hooks, so App dropped it as stale and the save stayed on "Saving…". `handleError` now claims it: the image hook deletes that `pendingSaves` entry and recomputes `savingImageIds` (other images' saves stay pending), the SVG hook clears `pendingSave` and `saveState`; both show the error and return `true`. The generation / enhance refs are untouched, so a refinement or new generation keeps running. A repeat or unknown save id is still unclaimed (dropped), and a late `*_SAVE_RESULT` for the settled save is ignored.
- Tests: a hook case per tab (refinement running; image also with a second save pending) and two `AppErrorRouting.test.tsx` cases through the real App router (image refine and SVG new generation running). The review witness `docs/pr-reviews/witnesses/pr-15-request-ownership.test.tsx` now passes 10 / 10 and is kept.
- `2252c30`: `AppErrorRouting.test.tsx`'s balance push carries `accountEpoch` (required since the merged #13 fix) and `satisfies OpenRouterBalancePayload`.

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

516 → 569 tests (34 → 40 suites) at `a2d5115`; 583 tests (41 suites) with `adcdb92`. Counts are on top of PR B (34 suites / 516 tests). After merging the #13 / #14 review fixes and N-01: 646 tests (42 suites).

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

Roadmap phase P5a. Fixes the pre-existing SVG defects confirmed in the PR #12 review (ledger S1, S4, S5, and the SVG Refine part of S2). Stacked on P2. Commits `9128d89` (isolation, policy, ownership, saving), `d14c5d5` (adversarial-review follow-up, R5-S1–S7 below).

#### User-facing

- Generated SVG never enters the app's DOM; a hostile `<style>` or duplicate ids can't affect the panel.
- Documents that fail the new policy show a message and their code (the code view opens by itself); Save is disabled in the webview and refused by the host.
- Refine follows the conversation's model; previews use the conversation's aspect ratio.
- Re-hydrated SVG conversations replay their raster reference.
- Save refuses file names that aren't plain names, and an output folder outside the workspace.
- Checking a document is linear in its size; a pathological 2 MB document can't stall the host or the webview.

#### Isolated preview

- `SVGPreview.tsx` renders `<img src="data:image/svg+xml;base64,…">` for all five previews (inline, 32/64/128, full) instead of `dangerouslySetInnerHTML`. Chromium renders an `<img>` SVG as a separate document in secure animated mode: no script, no external fetches, CSS and SMIL animation allowed, and its styles and ids are scoped to that document. The webview CSP already had `img-src … data: blob:`; `webviewHtml.test.ts` now pins `data:` there and that `script-src` stays nonce-only.
- `svgPreviewSource.ts` caches the last document's verdict and data URL, so the five previews scan and encode once per result. Base64 goes through `encodeURIComponent` → one char per UTF-8 byte → `btoa` (no `TextEncoder`, which jsdom lacks).
- An `<img>` that fails to decode (malformed in ways the scanner tolerates, e.g. case-mismatched tags) shows "couldn't be rendered" instead of a broken image.

#### `SVGDocumentPolicy` (`src/shared/svg/SVGDocumentPolicy.ts`)

- Shared by webview (preview, Save button, hook) and host (save handler, orchestrator log). The plan named `infrastructure/svg/`; it lives in `shared/` because the webview needs it too and must not import infrastructure.
- **Rejects, never rewrites**: a single-pass scanner over prolog, elements, attributes, text, comments and CDATA, plus a single-pass CSS tokenizer (since `d14c5d5`; see the follow-up below, which also corrected the original claim that the sticky regexes made the whole check linear). It decodes XML entities in attribute values and `<style>` text outside CDATA, and CSS comments and escapes, before checking. Unknown or unparseable input is a rejection (fail closed).
- **Accepts** ordinary SVG: `<style>` with `@keyframes`, SMIL, gradients, filters, `<text>`, `href="#…"` / `url(#…)`, embedded `data:image/{png,jpeg,gif,webp}` and `data:font/*`, the XML declaration and a public DOCTYPE.
- **Rejects** documents over 2 MiB (UTF-8, counted without allocating), without exactly one `<svg>` root, or with mismatched/unclosed tags, control characters or unpaired surrogates; `<script>`, `<foreignObject>`, `<iframe>`, `<embed>`, `<object>`, `<handler>` (any namespace or case); `on*` attributes; `href` / `src` / `xml:base` that leave the document (including protocol-relative URLs and `data:image/svg+xml`); CSS `url()` that leaves it (in `<style>`, `style=`, or any attribute such as `fill=`); `@import`, `image-set()`, `expression()`, `-moz-binding`, `behavior:`; `javascript:` / `vbscript:` / `data:text/html` anywhere in an attribute; SMIL animating `href`; a DOCTYPE with an internal subset; processing instructions other than `<?xml …?>`. Since `b853fef`: any non-empty `ping` and SMIL on `ping` (PR #16 review R16-2, below).
- **Tradeoff, intentionally strict**: an SVG that loads a web font with `@import` or `url(https://…)` is rejected. In the `<img>` preview the font wouldn't load anyway, and a saved file would fetch it when opened. The message names the cause, so the user can ask for a version without it.

#### Ownership

- `src/shared/svg/svgRoutes.ts`: `isNativeVectorSvgModel` / `svgModelSupportsRefinement`, the single copy of the routing rule. `SVGOrchestrator.selectClient` routes with it. Since `d14c5d5` it keys on PR B's catalog `kind` for curated ids and falls back to the `recraft/` prefix only for ids the catalog doesn't list (custom or superseded), so the route has one source of truth; `catalog.test.ts` keeps the catalog's native-vector rows on `recraft/` so a model routes the same way after it leaves the catalog.
- Refine eligibility: `SVGGenerationView` uses `threadSettings.model` (P2) instead of the draft picker; `useSVGGeneration.continueChat` refuses a native-vector thread; `SVGOrchestrator.continueSVG` throws before re-hydrating or calling a provider when the thread's model (in memory, or the payload's model for re-hydration) is native-vector. Before, switching the picker to a text model enabled Refine on a Recraft thread, and the host sent the text transcript to the vector client.
- Raster reference on replay: `SVGConversationHistoryTurn.referenceImage` / `SVGRehydrationTurn.referenceImage`. The hook records the image actually sent (none when the attachment was an SVG, which travels as text) in the dispatch snapshot, and sends it in `history`. `SVGConversationManager.userContent()` builds live and re-hydrated user turns, so a restored request equals the live one (tested). Cost: each such turn persists the reference data URL in webview state.
- Previews use `threadSettings.aspectRatio`.

#### Saving

- `src/application/handlers/saveFileName.ts` `plainSaveFileName()`: both save handlers refuse a suggested name that is empty, over 200 characters, contains `/ \ : * ? " < > |` or control characters, contains `..`, or starts with `.`. Refused, not repaired: the webview only ever sends `pixel-minion-<timestamp>.<ext>`. Before, the SVG handler joined the name onto the output folder unchecked (`..` escaped it); the image handler had the same gap.
- `SVGGenerationHandler.saveSVG` runs the policy before the dialog or write; `useSVGGeneration.saveSVG` refuses first, so a refused save never shows as in progress.

#### Review follow-up (`d14c5d5`)

An independent adversarial review of `9128d89` (round 5) ran scratch tests against the policy and the save path; ids R5-S1–S7 in the [ledger](pr-reviews/pr-12-design-system-alignment-review.md). Every fix rejects rather than repairs.

- **R5-S2, quadratic CSS regexes**: `checkCss` matched `url\(\s*(?:"…"|'…'|([^)]*))\s*\)` with `matchAll`, so each unterminated `url(` rescanned to the end of the CSS: 128 KB took 5.9 s and the 2 MB cap about 25 minutes, on the extension host after every generation and in the webview render. The comment-stripping `/\/\*[\s\S]*?\*\//g` was quadratic on `/*` the same way. Both are replaced by `tokenizeCss`, a single pass that advances on every step (indexOf for comments). An unterminated `url(` is a rejection: a browser still loads it, and the old regex simply didn't match it. Audit of every other pattern: the scanner's sticky regexes match at one position and span only the token they read (an `END_TAG` that fails backtracks within one name and then rejects); `EMBEDDED_DATA` and the DOCTYPE/PI patterns are anchored to one short slice; entity decoding, `compact` and the control-character tests are single character classes. 2 MB worst cases (url( / url(" / `/*` / string / escape / entity floods, 400k attributes, 700k nested elements, comment and end-tag openers, url(#id) references) now take 30–350 ms under jest, a typical code-model SVG ~0.3 ms and the 18 KB Recraft response ~0.1 ms. `SVGOrchestrator`'s log-only `inspectSvgDocument` call stays: it is diagnostic, and now cheap. Not in the policy and left as it was: `SVGOrchestrator.extractSVG`'s `<svg[\s\S]*<\/svg>` / fenced-block regexes are quadratic on many `<svg` / fence openers without a close; their input is bounded by the 32,000-token output ceiling and only the user's own prompt can produce it.
- **R5-S4, comments vs strings and url tokens**: `tokenizeCss` follows CSS Syntax: a comment is recognized only outside strings and outside an unquoted url token, escapes are decoded, strings are kept. So `content:"/*"} b{background:url(https://…)} c{content:"*/"` and `url(#a/*), url(https://…), url(#b*/)` (a browser reads three url tokens; the old stripper removed the middle one) are both rejected. A CSS comment that never closes is a rejection. `<style>` text is entity-decoded per chunk outside CDATA only, as the XML parser does: decoding a CDATA `&#47;*` invented a comment that hid the CSS after it (found while fixing this; regression fixture added).
- **R5-S3, CSS in every attribute**: `checkCss` runs on every attribute value (it ran only when a literal `url(` appeared), so `fill="\75 rl(https://…)"`, an entity-encoded `&#92;55RL(` and a CSS-escaped url in SMIL `values=` are caught. A cheap pre-check skips values without `( : @ / \`, which no check can match. `src(` and `image(` are treated like `url(`.
- **R5-S1, names**: element names are `[A-Za-z_][A-Za-z0-9_.:-]*`, attribute names may also start with `:`, end tags use the same pattern, and a name must end at XML whitespace, `/`, `>` (or `=`). `<gé/>` was read as `<g>` with an attribute `é`; it, `<pé:rect/>`, an attribute `é=` and a name followed by U+FEFF (whitespace to JavaScript, a name character to XML) are now rejections. Generated SVG uses ASCII names (including editor prefixes such as `sodipodi:`), so nothing real is lost.
- **R5-S5, namespaces**: `xmlns` / `xmlns:*` must be exactly SVG, XLink, the XML namespace or `http://c2pa.org/manifest`. The real Recraft V4.1 Vector response from the 2026-11-07 smoke test declares `xmlns:c2pa` for its C2PA provenance `<metadata>`, so that namespace is required; no other metadata namespace (Inkscape, RDF, Dublin Core) was seen in generated output, so none is allowed. The response is a fixture (`__tests__/fixtures/recraft-v4.1-vector-2026-11-07.svg`) that must pass. Other `xmlns*` attribute names are rejected as reserved.
- **R5-S6**: SMIL may not set `attributeName` to `href`, `src` or `xml:base` (any prefix). The XML declaration must be the first thing in the document (after an optional BOM), its target exactly `xml`, and any mention of an encoding must be a quoted UTF-8 label: the saved file is UTF-8, and a declared `ISO-2022-JP` (or an unquoted label a browser might still sniff) would make it read different markup than the scanner did.
- `FORBIDDEN_ELEMENTS` / the SMIL table are `Map`s: as plain objects, an element named `constructor` was "a function Object() element".

Saving (R5-S7):

- `plainSaveFileName` also refuses Windows device names with or without an extension (`CON`, `nul.tar.gz`, `NUL .svg`, `COM0`–`COM9`, `LPT0`–`LPT9`, the superscript-digit forms, `CONIN$` / `CONOUT$`), names ending in a dot (Windows drops trailing dots and spaces; leading/trailing whitespace is still trimmed), C1 controls and bidi/format controls (U+061C, U+200E/200F, U+202A–202E, U+2066–2069).
- `pixelMinion.outputDirectory` is read by `outputDirectorySegments()` (`saveFileName.ts`): a relative path of folder names that pass the same segment rules; absolute paths, drive or UNC prefixes, `..`, `:` and device names are refused with an error naming the setting. `workspaceOutputDirectory()` (new `outputDirectory.ts`) joins the segments and then proves, with `path.posix.relative` on the URI paths, that the folder is inside the first workspace folder. Before, `Uri.joinPath` resolved `../outside` (or an absolute value) out of the workspace, and a repository's `.vscode/settings.json` can set the value.
- **Scope left at the default** (resource-level): per-workspace output folders are a legitimate use, `machine` or `application` scope would silently ignore every existing workspace value, and the extension declares no `untrustedWorkspaces` capability, so it doesn't run in Restricted Mode at all; with containment, a workspace value can only choose a folder inside that workspace.
- Not covered: the containment check is lexical. A symlink inside the workspace that points elsewhere is followed by `workspace.fs.writeFile` (the API has no realpath). Writing needs the repository to ship the symlink, and file names are timestamped, so nothing existing is overwritten; left for the release pass.

#### PR #16 review follow-up (`031477e`, `b853fef`)

- **R16-1, a quadratic stack check** (`031477e`): `Scanner.inStyle()` re-derived the open element's local name (`lastIndexOf` + `slice` + `toLowerCase`) at every text run and start tag, so a long parent name with many children cost O(name × children): `'g'.repeat(n)` around n `<g/>` took 5.7 s at 384 KB in review and would take minutes at the cap. The R5-S2 audit above covered patterns, not this. Stack entries are now `{ name, isStyle }`, classified once when pushed; `inStyle()` reads the top entry and `endTag()` uses the popped entry's flag, while end-tag matching still compares the lower-cased qualified name. Audit of the rest of the per-token work: nothing else re-reads another token or walks the stack (names, values, entities and CSS are each read in time proportional to their own bytes; classification is by local name, so there is no namespace-prefix resolution, and no ancestor check beyond the top entry). New 2 MB cases, each accepted in well under a second (they run for minutes without the fix): a long open name with many children, the same prefixed, with many text runs, balanced deep nesting, deep nesting of 1,000-character names, and a long open name around a `<style>` with many CDATA runs; plus end-tag and prefixed-`<style>` behaviour checks.
- **R16-2, hyperlink auditing** (`b853fef`): `<a href="#x" ping="https://tracker.example/ping">` was accepted, and following the link in a saved `.svg` POSTs to every `ping` URL whatever `href` says. Any non-empty `ping` (entity-decoded, any element, any prefix or case) is now refused, since the space-separated list can mix local and remote entries; an empty `ping=""` is allowed. SMIL animating `ping` is refused like SMIL on `href`. Considered and left alone: `target`, `download`, `rel`, `hreflang`, `type`, `referrerpolicy` on `<a>`, which only qualify the navigation `href` makes, and `href` is already held to the document. Fixtures: direct, entity-encoded (partly and entirely), several destinations (local then external, all local), whitespace-only, no `href`, `xlink:ping`, `<svg:a>`, a non-`<a>` element, `PING`, SMIL on `ping`; an empty ping is accepted; the host save handler refuses the review's example without writing.

#### Removed (S5)

- `MarkdownRenderer.tsx` (claimed to sanitize, inserted raw `marked` HTML), the never-mounted `HelloWorldView.tsx`, its `useHelloWorld.ts` hook, `markdown.css`, their barrel exports and `PersistenceState.helloWorld`. Verified unreferenced. Because the components barrel re-exported `HelloWorldView`, `marked` was in the webview bundle: `webview.js` 414 KiB → 384 KiB.
- **Kept**: the `marked` dependency and the host `HelloWorldHandler` / `HELLO_WORLD_*` messages, which still import it. With the webview hook gone nothing sends `HELLO_WORLD_REQUEST`, so that host route is dead scaffold too; removing it touches `MessageHandler`, message types, two test files and `package.json`, and is left for a cleanup PR.

#### Not done here

- CSS and SMIL animation inside the `<img>` preview can't be checked in jsdom; it needs the manual installed-VSIX check (parity plan §7). Script inside the preview never runs, by design.
- Duplicate ids within one generated document are the document's own business; they no longer collide with the app's ids.

#### Test coverage

583 → 673 tests (41 → 45 suites) at `9128d89`; 781 tests (47 suites) with `d14c5d5`. Counts are on top of P2. After merging the #13 / #14 / #15 review fixes and R16-1 / R16-2: 865 tests (48 suites).

- `SVGDocumentPolicy.test.ts` with `__tests__/fixtures/svgDocuments.ts`: 9 accepted fixtures (gradients, CSS animation, SMIL, entities, embedded PNG and font, namespaced root, prolog), 31 rejected (script in any case/namespace, handlers quoted/unquoted/SMIL, foreignObject form, external image/use/link/filter/xml:base, protocol-relative, javascript: plain/entity-encoded/NUL-split, SMIL href, remote `fill=url()`, `@import` plain/entity-encoded/comment-split, CSS-escaped `url()`, nested SVG and HTML data URLs, xml-stylesheet, DOCTYPE entities, HTML root, two roots, unclosed element, control characters, unpaired surrogate), the style-leak document accepted (isolation is the preview's job), the size cap in UTF-8 bytes, non-SVG input, and linear time.
- `SVGGenerationViewIsolation.test.tsx` (renders the view): five `<img>` previews whose data URLs decode to the source; no generated `<style>`, `#pixel-leak-marker`, `#monitor-frame` or `#skull` in the app DOM; the opened code view holds the markup as text; UTF-8 round trip; a rejected document has no preview, shows the message and its source, and Save is disabled and posts nothing; Refine follows the thread's model in both directions.
- `useSVGGenerationSafety.test.tsx`: native-vector refine refused without posting; rejected document never posted for save; raster reference recorded with the turn and sent in `history`; an SVG attachment's preview isn't recorded as a raster reference.
- `SVGOrchestrator.test.ts`: native-vector refine refused before any provider call, in memory and for re-hydration; a rejected native-vector document is returned and logged; a re-hydrated request equals the live one, raster reference included. `SVGConversationManager.test.ts`: re-hydrated user turn equals the live one.
- `GenerationSaveHandlers.test.ts` and `saveFileName.test.ts`: traversal, separators, drive/stream `:`, hidden names, control and reserved characters refused with no write, for both handlers; a policy-rejected SVG never reaches the dialog or disk.
- `webviewHtml.test.ts`: `img-src` allows `data:`; `script-src` is nonce-only.
- `d14c5d5`: the R5 fixtures in `svgDocuments.ts` (each rejected before the fix, or accepted for the wrong reason), the Recraft response, a typical code-model SVG (gradients, defs/use, filter, clip-path, mask, `<style>` with local `url(#id)`, a comment with parentheses and an apostrophe, quoted font families, CSS animation, SMIL, an apostrophe in `aria-label`) and Object-member names, all accepted; twelve 2 MB worst cases under one second each; `svgRoutes.test.ts` (curated ids by kind, the fallback, and a mocked catalog where kind and prefix disagree); device names, trailing dots and controls in `saveFileName.test.ts`, plus `outputDirectorySegments`; `outputDirectory.test.ts` (the post-join containment check); both save handlers refuse an escaping output folder without creating or writing anything, and save into a nested one. The reviewer's scratch tests now show every listed name refused except plain look-alikes (`%2e%2e%2fx.svg`, U+2215), and the two tokenizer cases that asserted the old acceptance fail closed.

Lint unchanged (9 errors, 20 warnings, all pre-existing).

---


### P3: Image API transport and capability-driven controls (`claude/pixel-minion-images-transport-dhbqpd`)

Roadmap phase P3, on `main` after #12–#16 merged (`035906f`). Commits `19136ad` (types), `cfb0d34` (engine, controls, catalog), `a501ad5` (end-to-end witnesses, live contract), then the pre-PR independent-review fixes (`0d233e7`…`15890d1`, merged in `18e36b3`; see [Pre-PR review follow-up](#pre-pr-review-follow-up-p3) — some sections below describe the first build and point there where it changed). Plan: [parity plan §8](plans/frame-image-parity-plan.md#8-p3-as-built-2026-11-12). Ported files carry `// Ported from frame-minion@40e7949 packages/core/src/<path>; keep in sync`.

#### User-facing

- Single Shot requests go to `POST /api/v1/images`; Conversation requests go to `/chat/completions`. Each new thread's mode follows Frame's default rule (Conversation when the model has a verified chat route, otherwise Single Shot); the toggle is P4.
- 19 catalog rows that OpenRouter serves only through its Image API (or that need reference gating) are added; Muse is not.
- Controls follow the model: ratios (Auto included), Resolution, Seed, uploader count and formats. Generate is blocked, with a note, while the attachments don't fit the model; a text-only Single Shot thread offers no follow-up.
- A Conversation continues after an extension-host restart from its saved transcript; Single Shot continues from the latest images the webview sends (review H6).
- The output card shows the thread's mode and settings, a "controls apply to a new thread" note when the draft differs, recovery and storage warnings, and images at their natural shape.

#### Engine (host)

- `shared/models/ImageGenerationModes.ts` (ported): `imageRouteCapabilities(model, mode)`, `defaultImageMode`, the mode labels and endpoint copy. Pixel deltas: the conversational set is Frame's six Gemini ids + `google/gemini-nano-banana-2.1` + the three GPT-5 wrappers (2026-11-07 probe, re-run free on 2026-11-12); Muse's branch is dropped (rejected on chat, no Image API endpoint); Conversation carries the model's reference bounds (Frame leaves them unbounded); the project-frame helpers are not ported.
- `infrastructure/ai/clients/OpenRouterImageTransport.ts` (ported): the `/images` and chat adapters. Pixel delta: raster detection reuses `shared/media/imageFormats.sniffImageMime`, the same sniffer the save handler uses.
- `OpenRouterImageClient.ts` (ported, keeps Pixel's `HTTP-Referer` / `X-Title` and the Conversation signature diagnostics in the debug log): one transport per request, no retry on the other endpoint, preflight before `fetch` (reference count and MIME; ratio and resolution for an explicit mode; Conversation without a route). Modalities come from capabilities: the `IMAGE_ONLY_MODEL_PREFIXES` table is gone (the catalog-driven half of ledger C1/U4).
- Request bodies, field by field against the pre-P3 chat body `{ model, messages, modalities, seed, image_config: { aspect_ratio }, usage: { include: true } }`: Conversation now sends `{ model, messages, modalities, stream: false, seed?, image_config: { aspect_ratio?, image_size? } }` (no `usage`: deprecated, cost is always returned; `seed` only where the route takes it; `image_size` only for Gemini K tiers). Single Shot sends `{ model, prompt, seed?, aspect_ratio?, resolution?, input_references? }`; an unverified Auto ratio is omitted. Both pinned in `OpenRouterImageClient.test.ts`.
- `ImageConversationManager` gains `mode`, `resolution` and `restore()` (now identical to Frame's).
- `ImageOrchestrator` (ported): thread-setting immutability, the unknown-id guard (scoped to explicit modes as Frame F-1 in the first build; always on after review H3), Conversation transcript writes and restore, the turn-count check (Frame F-10 surfaces as an explicit error), async `clearConversation` that tombstones only conversational or unknown `img-…` ids (F-2, R-4). Pixel delta kept from P2: a failed turn also restores the turn number and last images.
- `ImageConversationStore.ts` (ported): `FileImageConversationStore`, 64 MiB (`MAX_IMAGE_TRANSCRIPT_BYTES`) checked on size, read and write; id regex; workspace-scoped directory (sha256 of the workspace folder URIs in the first build; `context.storageUri` after review H7); tombstones; one actionable message for corrupt or mismatched JSON (F-9). Pixel delta: writes through `infrastructure/storage/GlobalStorage.ts`, a three-method seam (`size` / `read` / `write` with mkdir-p) with `VsCodeGlobalStorage` over `context.globalStorageUri` and `workspace.fs` (any URI scheme). Built once in `extension.ts` and passed through `WebviewViewProvider` → `MessageHandler` → `ImageOrchestrator` (after review H1 the orchestrator itself is built once there too).
- `ImageGenerationHandler`: forwards mode and resolution; responses carry `settings`, `recoveryWarning`, and each image's requested ratio, resolution and `seedSupported`.

#### Webview

- `useImageGeneration`: `mode` (derived from the model until P4), `resolution`, `referenceIssue` (`referenceImageIssue()`, also used by Generate), normalization of ratio and resolution on model change and settings sync, thread settings from the host's response, F-8 (a failed new thread clears its optimistic settings), local refusal of a Single Shot follow-up for a text-only model or a turn whose image was not retained. Generate releases the thread it replaces with `IMAGE_GENERATION_CLEAR` (P3 has no archive, so nothing can reach it again; this also clears part of R5-S9's "unreleased conversations" deferral). The first build released it before sending the new request; after review W3 it releases only once the new generation succeeds. Pixel's P2 ownership (per-kind request ids, save tracking, enhance dropped by Generate/Clear) is unchanged.
- Migration: state saved before modes (no `threadSettings`, or P2's `{ model, aspectRatio }`) opens as Single Shot, `resolution: 'auto'`, with the ratio moved onto one the model's Single Shot route lists. The old picker offered seven ratios to every model.
- `imageHistoryPersistence.ts` (ported without archives or the desktop budget): 48 MiB, conservative UTF-16 accounting, latest images stored once, oldest previews omitted first (`imagesOmitted`), draft fallback for pathological text, a 64 KiB draft reserve, bounded history memoized apart from the draft.
- Components: `AspectRatioSelector` (ported; per model and mode, Auto labelled), `ResolutionSelector` (ported), `ImageUploader` (`maxImages` / `accept` from the route, text-only note; Frame's slice also fixes Pixel's old loop that could exceed the limit), `ImageCard` (natural dimensions first, then the requested ratio; Frame prefers the requested ratio), `ConversationThread` (omitted-previews note). SVG keeps `SVGAspectRatioSelector` (`19136ad`).

#### Catalog

- 35 → 54 image rows. Re-added (were `images-api-only` retirements): GPT Image 2 (⭐), 1, 1 Mini; Krea 2 Large / Medium / Medium Turbo. New: GPT Image 2.5 Sunburst / Flare, GPT Image 2.6 Sunburst / Flare, FLUX.3 Image, FLUX.3 Image Klein, Qwen Image 3 Pro / 3 / 2.1 Turbo, Krea K3 Edit (1–8 refs required), Recraft V4 Styles / Styles Pro (1–10 PNG/JPEG/WebP refs required), Recraft V4.1 Flash (no refs). Rows come from the 2026-11-07 audit's Part B; prices and capabilities unchanged on the 2026-11-12 re-check (one new provider listing, MiniMax H3 Image, not evaluated).
- GPT Image 2.6 has no verifiable per-image reference, so it carries only `approxNote`; `imagePricingDescription` now explains native rates and the note for such rows (Frame has none yet).
- `RETIRED_MODELS` keeps only `delisted` ids; `RetiredModelReason` is `'delisted'` and `SettingsHandler` words the log from a table.
- Browser metadata: release dates (OpenRouter `created`) and narratives for all 19.

#### Test infrastructure / coverage

865 → 1,139 tests (48 → 55 suites) in the first build; 1,204 (60 suites) after the review follow-up.

- Fixtures (`__tests__/fixtures/provider-contracts/`): `openrouter-image-chat-routes-2026-11-12.json` (chat endpoint records for the conversational set and Muse, plus the free routing probe of all 55 ids), `openrouter-image-endpoints-2026-11-12.json` (each id's Image API endpoints, intersected), `openrouter-image-live-2026-11-12.json` (paid-call metadata, no bytes).
- `ImageGenerationModes.test.ts`: the conversational set against the chat fixture; the transport guard (every chat-blocked id is Single Shot over `/images` only, every chat-routed request is in the verified set, every catalog id has probe evidence); and every row's references, ratios, resolutions, seed and prices against the endpoint fixture (documented exceptions: Gemini 3 Pro's 4K union, standard-tier prices over `/flex`). Changing one row's reference bound fails 7 tests.
- `OpenRouterImageClient.test.ts` (ported, Muse/Ming/project-frame cases replaced), `ImageConversationModes.test.ts` (ported; real orchestrator + client + store), `GlobalStorage.test.ts`, `imageHistoryPersistence.test.ts`, `useImageGenerationModes.test.tsx`, normalization and `referenceImageIssue` cases.
- `integration/imageTabRoutes.test.tsx`: the real App through the real host, for PR #14 F-01's four witnesses (UI and host with the UI bypassed), the controls, and restart recovery. Mutations that drop the Generate gate, show Refine for a text-only thread, skip the host reference check, or loosen Flash's bound each fail it.
- `OpenRouterImageLiveContract.test.ts`: the qualification's request and response shapes replayed.
- Replaced: the per-prefix modality snapshot and the "nothing chat-blocked in the catalog" / "every row takes a reference" guards.
- `setup.ts` mocks `workspace.fs.createDirectory`.

#### Live qualification (2026-11-12)

Through the real client with a proxy-injected key ([audit addendum](model-catalog-audit-2026-11-07.md#addendum-2--p3-transport-qualification-2026-11-12)). OpenRouter credit usage stayed at $0.16766: the key's workspace is now restricted to BYOK capacity, so only OpenAI calls reached a provider, billed $0.1222 to the BYOK key. Qualified: Single Shot `/images` text-to-image with Auto, a Single Shot follow-up with one `input_reference`, and a GPT-5 Image Mini Conversation turn plus a continuation restored from the transcript store. Blocked at routing (404, not billed): FLUX.3 Klein, Recraft V4.1 Flash (with and without a reference) and Nano Banana 2 Lite.

#### Pre-PR review follow-up (P3)

Three independent reviewers (host, webview, and P4 for the shared parts) read `035906f..b8dc618` before the PR was opened: no blockers, one major (W1), the rest minor. Each row in [parity plan §8](plans/frame-image-parity-plan.md#pre-pr-independent-review-r6-p3) has its id and status. Fixed on two branches merged in `18e36b3`.

Host:

- **H1** (`0d233e7`, `23f53ad`, `15890d1`): one `ImageOrchestrator` (and its client) is built in `extension.ts` beside the transcript store and injected through `WebviewViewProvider` into every `MessageHandler` (required parameter, like `AccountBalanceService`), so the in-flight lock and the conversation map survive a re-resolved view. `FileImageConversationStore.write` refuses to overwrite a tombstone (it reads a file of ≤ 256 bytes to tell). Before, a second view's clear could tombstone a thread whose turn was still running in the first, and that turn's write then resurrected it. `MessageHandlerSharedOrchestrator.test.ts`.
- **Clear nit** (`23f53ad`): `clear()` writes a tombstone only when a record exists; no record, or an existing tombstone, writes nothing. A small corrupt record is still retired.
- **H2** (`8d8cce5`): `GlobalStorage` gains `rename`; records and tombstones are written to `<id>.json.tmp` and renamed over the record (`workspace.fs.rename`, `overwrite: true`), so a crash mid-write keeps the previous record. A turn that takes a transcript past 64 MiB writes `{ deleted: true, reason: 'too-large' }` and throws `ImageTranscriptTooLargeError`; the turn's image is still returned with a warning, and after a restart the follow-up is refused before any provider call ("too large to recover after a restart"). Before, the oversized write failed and left the stale record behind. The limit is a constructor parameter so tests cross it cheaply.
- **H7** (`33449f6`): transcripts live in `image-conversations/` under `context.storageUri`, or `<globalStorageUri>/empty-window/` without a workspace (`workspaceStorageRoot()`); the first write creates the chain. The sha256-of-folder-URIs scope (Frame's) changed whenever a multi-root workspace gained, lost or reordered a folder. No migration: P3 never shipped.
- **H6** (`f5a8cae`): `ImageGenerationContinuePayload.history` → `turnCount`, plus `latestImages` for Single Shot only. A Single Shot host thread keeps `lastImages` / `lastSeed` and no messages; after a host restart it restarts from `latestImages`. A Conversation follow-up whose `turnCount` doesn't match the thread is refused on every follow-up. Before, every follow-up posted every turn's base64 images (tens of MB with 4K) that the host only counted. `continueConversation` takes one options object.
- **H3** (`6c0615c`): `ImageGenerationHandler` refuses a request without a known `mode` (correlated error, STATUS on/off, orchestrator not called); `mode` is required in both payloads, `ImageGenerationOptions` and `ImageGenerationRequest`, so the orchestrator's unknown-id guard and the client's ratio/resolution checks always run. A blank model id is refused ("Choose an image model first."). Frame keeps the F-1 carve-out for its other callers; Pixel has none.
- **H4** (`189518e`): errors append the provider's `error.message`, reduced to one plain line (control, invisible and bidi characters → spaces, whitespace collapsed, ≤ 300 characters, the API key masked if echoed), including a 200 that carries an error and no images, on both routes. Headers, metadata and the request body never appear.
- **H5** (`9622d4d`): an `/images` entry without base64 data, or not PNG/JPEG/WebP/GIF, is skipped with a `logger.warn`; the turn fails only when no image survives. OpenRouter's Image API reference (read 2026-11-12) lists `b64_json` as required and no `url`, so URL-only entries are skipped, not fetched.
- **Chat Auto** (`0c49595`): Conversation over chat omits `aspect_ratio` for Auto and drops an empty `image_config` (whether chat accepts `'auto'` was unverified).
- Mutation survivors closed: thread-setting immutability inside `generateImage` (`72788f8`) and the store's `state.id`-matches-file-name check (`23f53ad`).

Webview:

- **W1** (`8c5d592`, major): `App` reads persisted state once (`useState(loadState)`); `boundedImageHistory` ignores any incoming warning, so a warning describes only its own snapshot; the draft note is its own field (`draftWarning`, shown under the prompt); the restored "previews from an earlier session were not kept" note is derived from turns flagged `imagesOmitted` and goes with Clear or Generate; the bounded-history memo no longer depends on `initialState`. Before, the warning was copied into every later snapshot (it never cleared), the draft note was appended on every keystroke, and typing re-serialized up to 48 MiB per keystroke. `AppPersistenceRoundTrip.test.tsx` round-trips through the real `App` (two of its three cases fail on the first build).
- **W2** (`42b34ef`): thread settings are persisted and restored only with a `conversationId`; a reload during a first Generate restores an empty tab, not a ghost thread.
- **W3 + H8** (`75a7259`): the replaced thread rides in the pending generation; success releases it, failure restores it (unreleased, continuable), and the snapshot keeps it while the request runs. A release error that arrives during a generation is held and shown when it settles, after the generation's own error if it failed.
- **W5** (`7fbf472`): image stage `max-height: min(70vh, 560px)`, letterboxed.
- **W6** (`304539e`): the uploader counts raster references only (the hook exposes `referenceSvgIndex`); the SVG button stays available ("+ Add SVG Context", SVG-only) on a text-only model or with the raster slots full; an empty SVG file is skipped. The host appends SVG markup to the prompt and never sends it as a reference, so this matches what is sent, Recraft V4.1 Flash included.
- **N1** (`be9bc43`): `mode` is required in `normalizeAspectRatioForModel` / `normalizeResolutionForModel` and both selectors; the catalog-fallback branches (dead in production) and their tests are gone.
- **N2 + N3** (`a3f1ff0`): catalog fields `referenceRole: 'style' | 'edit'` (Recraft V4 Styles rows, Krea K3 Edit) and `maxRequestBytes` (the five Sourceful rows, 4.5 MB), carried by `imageRouteCapabilities`. The requirement note is built from them ("exactly N" for a fixed count); the unenforced 256 px claim is dropped from the note and the Styles descriptions. `isSourcefulModel` (an id-prefix check) is gone; the size warning counts the raster references sent, and a new warning beside the refine bar covers the latest output a Single Shot follow-up re-sends.
- **N4** (`58898e0`): Generate's `aria-describedby` points at an always-rendered `.visually-hidden` element holding the blocking reason; native `disabled` kept.
- `d0b9179`: the hook's Frame-sync header lists these Pixel-only fixes so a later sync doesn't undo them.

Tests: 1,139 → 1,204 (55 → 60 suites).

Same defects in Frame (report upstream): W1, W2, W3, W6, N3 and H7; F-1 (H3) is deliberate there.

#### Not done here (deferred)

- Paid checks of Gemini Conversation (4K, reload between turns, signed vs unsigned replay), the non-OpenAI `/images` rows and a text-only model's own reference handling: blocked by the BYOK restriction; owner-run.
- Observed, not acted on (one sample): GPT-5 Image Mini on chat returned 1024×1024 for `image_config.aspect_ratio: '3:2'`. The card shows the real shape.
- BYOK turns report `cost: 0` (OpenRouter bills nothing; the spend is in `cost_details.upstream_inference_cost`), so the turn line and the balance strip show no spend for them. Family-wide (Frame parses the same way).
- In-memory threads now outlive a view (review H1): Generate and Clear from the persisted webview state still release them, but a thread whose webview state is lost stays in memory until the extension host restarts.
- A thread whose text alone exceeds the 48 MiB webview budget is dropped from the snapshot; after a reload the tab is empty with no note (review W1 residue).
- No fallback read from a leftover `.tmp` file (review H2): VS Code's disk provider renames with Node's `fs.rename`, atomic on POSIX; not tested against real VS Code.
- `GlobalStorage` keeps its name although it can now point at workspace storage.
- Inherited from Frame and documented: F-7 (whole-transcript rewrites, no expiry, tombstones never removed), F-10 (reloading mid-generation strands a Conversation; the error is explicit), F-11 (the latest image is sent as a user reference even when signed assistant images are replayed), R-4.
- SVG native vector still uses chat (P5b).

---


### P4: Conversation | Single Shot toggle and threads (`claude/pixel-minion-image-modes-dhbqpd`, stacked on P3)

Roadmap phase P4. Commits `c9c61fb` (toggle, Earlier threads, start-from-image, filtered picker, two-column controls), `aced642` (Settings custom ids, ledger C14), `6816817` (empty-state placement), rebased onto P3's review fixes (`bb4bd5a` updates P3's tests for the toggle), then the pre-PR review fixes `967a4a4`…`efa6bcb` ([below](#pre-pr-review-follow-up-p4); sections here describe the result). Plan: [parity plan §9](plans/frame-image-parity-plan.md#9-p4-as-built-2026-11-12). Webview only, apart from the SVG raster refusal (review n2); the host contract is P3's.

#### User-facing

- The mode pill (Frame's `.image-mode-selector` look, on `--px-*` tokens) sits on the input card's top border: two native buttons with `aria-pressed` in a labelled group (Frame uses radios), switching only on click, Enter or Space, disabled while a generation or enhance runs. Ledger D22.
- The mode applies to the next thread. The output card names the thread on screen by its own mode (`threadSettings.mode`); the endpoint note under the controls describes the selected one (Frame's `imageModeEndpointDescription`, plus "Longer conversations may cost more" and "Switching modes starts a new thread and keeps earlier threads below").
- The picker lists only models with a route in the selected mode (10 in Conversation, all 54 in Single Shot). A selection outside the list stays visible: a catalog model keeps its own name (new `catalog` prop on `ModelSelector`) and the helper says it has no verified route in that mode; a custom id says it runs in Single Shot only.
- Primary action: "⚡ Start Conversation" / "⚡ Generate"; the follow-up box submits with "Send" / "Generate" (`ContinueChatInput.submitLabel`). The trash button is "Clear thread".
- Earlier threads (newest first): mode, first 40 characters of the first prompt, turn count; opening one shows its turns with Save and start-from-image, and Delete thread. They never continue.
- "Start a conversation / Single Shot from this image" on every image card (current and earlier threads): archives the current thread and attaches the image to the draft. Shown only when the draft model has a route in the selected mode that takes a reference, and only for an image in a format that route accepts; hidden while busy. Focus moves to the prompt.
- Settings: a "Custom image model id" and "Custom SVG model id" field under the two pickers (`CustomModelIdField`), applied on Use or Enter: `vendor/model[:variant]`, each part starting with a letter or digit, `. _ -` allowed, ≤ 200 characters; a case-insensitive match for a catalog id stores the catalog id. The SVG field refuses raster image models. Ledger C14.
- Controls: two columns from 480 px (Model + Aspect Ratio, Resolution + Seed; `minmax(0, 1fr) minmax(142px, 180px)`); a control alone on the last row spans both (`:last-child:nth-child(odd)`), so a model without Seed shows Resolution full width. Stacked below 480 px.
- Empty state: anchored near the top of the output card (`.generation-empty`, shared with the SVG tab) instead of centred, and the hint follows the mode (and a text-only model).

#### Webview

- `useImageGeneration`: `mode` state (initial: saved mode, else the restored thread's, else Single Shot for untagged history, else `defaultImageMode(model)`; until the user commits — the control, an Image-tab pick, Generate or a restored thread — it follows the configured model from `SETTINGS_DATA` and isn't saved), `setMode` (refused while a request or enhance is pending; normalizes ratio and resolution for the new mode; archives nothing when no thread is on screen), `archivedThreads`, `startFromImage`, `removeArchivedThread`; `archiveCurrentThread` runs on mode switch, Generate and start-from-image. A settings-sync model change uses the current mode through a ref. Restored state is validated by `restoredImageState.ts`.
- Pixel delta from Frame: archiving releases the archived thread on the host (`IMAGE_GENERATION_CLEAR`; an earlier thread never continues, so its transcript would be orphaned). A mode switch and start-from-image release at once. Generate archives provisionally, keeping P3's release-after-success rule: the replaced thread is listed under Earlier threads while the request runs (Delete refused), released and kept there on success, and restored as the current, continuable thread on failure; meanwhile the snapshot saves it as the current thread with no archive copy, so a reload mid-request restores it unreleased. Delete thread posts the clear again, as Frame does; after P3's store fix it writes nothing on the host.
- `imageHistoryPersistence`: `MAX_PERSISTED_IMAGE_ARCHIVES = 5` (Frame's); archive images are omitted before the current thread's; the note says which were left out (older threads, images, or both) and exists only while something was; `mode` rides the draft and the pathological fallback (which drops archives).
- `ImageCard` / `ConversationThread`: `onStartFromImage` + `startFromImageLabel`. `ModelSelector`: optional `catalog`.
- CSS: `image-generation-view.css` (pill, card padding under it, the 480 px grid, Earlier threads), `image-card.css` (`.image-card-action`), `design-tokens.css` (high contrast: the pressed half is a solid inset `contrastActiveBorder` ring; keyboard focus is a separate dashed rounded `::after` ring inside the pill), `global.css` (custom-id row), `generation-view.css` (empty state).

#### Test infrastructure / coverage

1,139 → 1,156 tests (55 → 56 suites) as first built on P3's first build; 1,266 (63 suites) after the rebase onto P3's review fixes (1,204 / 60) and P4's own review follow-up.

- `useImageGenerationModes.test.tsx` (14 → 22): Frame's cases (archive on switch and reload, archive on Generate + Delete, mode switch refused while generating, Single Shot copy, start-from-image incl. text-only, custom ids in both modes, migration of untagged history, filtered list counts, curated-model-unavailable helper, five-archive persistence) with Pixel's request ids and release-on-archive.
- `imageHistoryPersistence.test.ts` (5 → 7): five newest archives kept with live history intact; archive images dropped first.
- `SettingsViewCustomModel.test.tsx` (new, 6): Use/Enter only, validation and its message, disabled while empty, helper text, saved custom id shown.
- `imageTabRoutes.test.tsx`: helpers pick the mode explicitly; new empty-state copy case.

#### Visual check

Harness copied to `scratchpad/roundP4/visual/harness` with new states (`image-single-shot`, `image-single-shot-thread`, `image-earlier-threads`) for Pixel and Frame, plus `dark-hc` in the default theme list. Frame was built from a `git archive` of the sprint-06 worktree (the worktree itself has no `dist/`). Shot in Dark Modern, Light Modern and Dark High Contrast at 320 and 480 px, and 480 × 1400 / 480 × 640 for the empty state; no horizontal overflow or console errors. Fixes from looking: the high-contrast outline on the pill was rectangular (now rounded), the custom-id field used Settings' larger label style (now the picker's), and the empty state sat mid-card in a tall sidebar. Re-shot after the review fixes (54 shots, the same themes and widths, plus focus states for the mode control and the SVG-only uploader): one more fix from looking — the first focus rule lost to the app-wide button focus rule in dark themes and showed only a sliver, so focus is now a rounded `::after` ring.

Frame differences seen, left as they are: Frame shows Seed for Nano Banana 2 in Single Shot (Pixel follows the Image API's `supportsSeed: false`, pinned in P3); Frame's controls stay stacked at 480 px; Frame renders a stray `0` under the uploader for models whose minimum reference count is 0 (`min && …`), an upstream candidate.

#### Pre-PR review follow-up (P4)

An independent reviewer read `b8dc618..4af8acd` before the PR was opened. No blockers. The thread state machine held: every archiving path is guarded, late responses are dropped by correlation id, no release targets an id in use, and Conversation with a Single-Shot-only model is refused in both the UI and the host. Each row is in [parity plan §9](plans/frame-image-parity-plan.md#pre-pr-independent-review-r6-p4) with its status.

- **M1** (`967a4a4`, major): the Earlier-threads note was copied forward from restored state (P3's W1 root), so after a seventh thread it never left. With P3's fix in place, the note now has three precise forms (older threads, images, both) and exists only while something was left out. Round trip through `App`: seven threads → note; reload → five restored, no note; a sixth → note; delete all, Clear, reload → nothing.
- **m1** (`b31b744`): a fresh install took its mode from `useSettings`' placeholder model, so a configured Recraft or custom default opened in Conversation with Generate disabled. The mode now follows `defaultImageMode(configured model)` until the user commits, and it is saved only once committed. The integration harness asserts the configured model's default mode; it used to assert the bug.
- **m2 + m3** (`35381b0`): native radios selected on arrow keys, so moving through the pill archived the thread and released its transcript, with no undo. The pill is now two `aria-pressed` buttons, each its own Tab stop (no roving tabindex to get wrong), that switch on click, Enter or Space only; switching with no thread on screen archives nothing. In high contrast, the checked rule (specificity 0,4,3) had hidden the focus rule, and HC themes give focus and active borders one colour. Pressed is now a solid inset ring and focus a dashed rounded `::after` ring. A stylesheet test fails on the old CSS. jsdom can't fire Enter/Space activation, so that test pins native buttons and no radios.
- **m3 focus** (`8b4db36`): after start-from-image, focus goes to the prompt; after Delete, to the next thread summary, else the (now focusable) Earlier-threads heading, else the prompt. Both used to drop focus to `<body>`.
- **m4** (`f7ff226`): the start-from-image test reused the SVG preview's data URL, so its "unchanged" assertion couldn't fail. It now uses distinct URLs and asserts settings, archives and no clear. Removing any of five guards (start-from-image in flight, `setMode` with enhance pending, and three more, including Delete during a running Generate) fails a test, checked by hand.
- **n1** (`6d2a254`): custom-id validation (see User-facing). Non-catalog ids keep their case; OpenRouter's case rules are unknown.
- **n2** (`424bf8a`): any `recraft/` id took the native-vector SVG route, so a Recraft raster id was billed and then failed with "unexpected payload". An unlisted id now takes the vector route only if it ends in `-vector`. The chat-route fixture shows OpenRouter accepts Recraft raster ids on chat too, so routing alone can't prevent the spend. Known raster ids (every Image-catalog id, and unlisted `recraft/` ids without `-vector`) are refused before either client is called, in `SVGOrchestrator` and in the Settings SVG field. The help copy is fixed.
- **n3** (`f5e1989`): confirmed through the real host and store that Delete's repeated release writes nothing and shows no error (P3 `23f53ad`).
- **n4** (`c30805a`): new `restoredImageState.ts` validates saved state field by field.
  - A malformed earlier thread is dropped.
  - A malformed current thread is dropped whole and released once.
  - An unknown mode falls back to the default rule, and unknown thread settings open as Single Shot.
  - Before, a non-array `archivedThreads` crashed the tab on every load. Bypassing the validator fails five tests.
- **n5** (`96ca422`): start-from-image is gated on the route and format (see User-facing).
- **n6** (`4b77278`): `ArchivedImageThread` loses its `persistenceWarning` and `recoveryWarning`. An archive never continues, so its recovery note had nothing to say; a thread that a failed Generate restores keeps its note.
- `efa6bcb`: the hook's Frame-sync header lists the P4 review fixes.

Same in Frame (report upstream): m1, m2, m3 and m4 apply to Frame's radio pill and hook as ported.

#### Not done here (deferred)

- Earlier threads stay read-only (Frame's design): a Conversation can't be resumed from the archive.
- In-session archives are unbounded (as in Frame); only the saved snapshot keeps five, and the warning says so.
- The paid and installed-VSIX checks owed by P3 still apply; P4 adds no provider calls.
- A faint card-border line shows through the unpressed half of the pill in Dark High Contrast (pre-existing).
- Mixed-case custom ids that match no catalog id are stored as typed.

---

### Packaging (pre-merge cleanup)

- `.vscodeignore` now excludes `docs/**`, `screenshots/**`, `AGENTS.md`, `tsconfig.webview.json`, `tsconfig.test.json`, `tailwind.config.js` and `postcss.config.js`. The VSIX shrinks from 21.2 MB / 89 files to 10.4 MB / 22 files. `vsce` already rewrites the README's relative image links to `github.com/…/raw/HEAD/…`, so the Marketplace page keeps its screenshots, and review-witness test files no longer ship.
- Not changed: `package.json` says `"license": "SEE LICENSE IN LICENSE"` but the repository has no `LICENSE` file (vsce warns; pre-existing). Adding one is the owner's call.

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
