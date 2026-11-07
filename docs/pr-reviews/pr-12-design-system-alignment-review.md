# PR Review — feat: align Pixel Minion with Frame Minion design system

**Author:** okeylanders · PR #12 (draft)
**Reviewed:** 2026-11-07
**Base:** `main` (`28d0b05`) · **Head:** `claude/design-overhaul-review-m5ojwb` (`57bab83`)
**Fixups:** stacked PR from `claude/pixel-minion-design-review-dhbqpd`

**Status:** Round-1 review complete. Every 🔴 introduced by this PR, and every 🟠/🟡 item planned for PR A, is fixed on the stacked branch `claude/pixel-minion-design-review-dhbqpd` and was re-verified by an independent code review plus a rendered audit (Round 4, whose follow-ups are also fixed). 30 suites / 341 tests pass. The model-picker port and catalog refresh follow as PR B. Pre-existing defects found during the review, such as unsafe SVG preview and request ownership, are scheduled as later phases of the [Frame parity roadmap](../plans/frame-parity-roadmap.md). Each row's status is updated as fixups land.

---

## Blast Radius

- 52 files changed · +2141 / −397 · 4 commits (`38bd8ac` catalog refresh, `e7587b7` design system, `b36124b` model browser, `57bab83` working-area tokens).
- Surfaces:
  - design tokens and every webview stylesheet;
  - header and tab chrome;
  - a new model-browser modal and select;
  - a new OpenRouter account-balance slice (client → handler → hook → header UI);
  - the catalog refresh;
  - `OpenRouterImageClient` modality routing.
- Baseline at head: 18 suites / 174 tests pass; both `tsc` configs pass; build passes; lint has 11 errors, all pre-existing on `main` (old test `require`s and a missing `react-hooks` plugin config).

## Review Panel

Five independent read-only threads ran in parallel. Each finding below carries the IDs of every thread that raised it; agreement between threads is noted as **consensus**.

| Thread | IDs | Method |
| --- | --- | --- |
| Design fidelity | D1–D22 | Distilled the family design language from Frame Minion and Prose Minion source, then audited every Pixel surface |
| Visual (rendered) | V1–V17 | 270 Playwright screenshots of the built webview. Pixel vs Frame sprint-06 vs Pixel `main`; Dark Modern / Light Modern / Frame flame-dark; 320 px and 480 px |
| Code correctness | C1–C14 | Traced and ran the non-CSS changes. Compared against Frame's ADR-010 balance slice and its PR-12 review |
| Model catalog audit | U1–U6, M1–M3 | Live OpenRouter catalog (`/api/v1/images/models`, `/api/v1/models`, per-model `/endpoints`, benchmark pages) as of 2026-11-07. Snapshot: [model-catalog-audit-2026-11-07.md](../model-catalog-audit-2026-11-07.md) |
| Frame parity and security | S1–S6 | Gap analysis against Frame `feat/video-models-sprint-06`. Confirmed or refuted Frame's own assessment of Pixel's SVG risks ([plan](../plans/frame-image-parity-plan.md)) |

**Frame reference:** the owner's direction (2026-11-07) is that Pixel's image generator should do what Frame's does, minus fal.ai, and that the model picker should look the same. Frame's current image tab and picker live on `feat/video-models-sprint-06` (`40e7949`), not on Frame `main`. PR #12 matched Frame `main`, which is already stale.

---

## Executive Briefing

PR #12 re-skins Pixel faithfully at the skeleton level: the warm surface ramp, the card-grid tabs, the balance pill and strip, and model-browser markup. But it doesn't yet belong to the family, and it ships three functional regressions.

- **Accent and tokens.** The accent is the theme's link colour, so it is blue everywhere. The token prefix (`--pm-*`) collides with Prose Minion's.
- **Image tab.** The tab users live in only had its variables swapped. At a 320×900 sidebar the conversation area is 42 px tall.
- **Model picker.** It doesn't match Frame's current picker. Its per-image prices are invented for GPT and MAI models (GPT Image 2 shows ≈ $0.039 vs Frame's sourced ≈ $0.211).
- **Requests.** Nine image models now request a text output their endpoints don't offer, which reintroduces the Seedream "No endpoints found" 404. Two catalog ids are delisted.
- **Balance strip.** It lost several fixes Frame made in its own review, and it keeps showing the previous key's balance.

Separately, the review confirmed two pre-existing high-severity issues outside the PR's diff:

- **SVG preview.** Generated SVG markup is injected into the app DOM five times per result. A generated `<style>` can restyle or hide the UI, including the API-key field.
- **Transport risk (unverified).** OpenRouter's catalog now lists most image models, including the default SVG model, only under the dedicated `/api/v1/images` API. Pixel calls only `/chat/completions`.

## Status by item

Legend: 🔴 blocker · 🟠 major · 🟡 minor · ⚪ nit · **pre** = pre-existing on `main` (found during review, not introduced by PR #12).
Planned in: **A** = design-pass fixups (stacked PR, this branch) · **B** = picker parity + catalog refresh · **P2–P5b** = [roadmap](../plans/frame-parity-roadmap.md) phases.

| ID | Sev | Finding | Raised by | Planned | Status |
| --- | --- | --- | --- | --- | --- |
| V1 / D17 | 🔴 | Image/SVG conversation area crushed: 42 px at 320×900, 143 px at 480 (`main`: 59/165). Generated image barely visible | V, D — **consensus** | A | ✅ Fixed in `0d39415` |
| D1 / V7 | 🔴 | No brand accent: `--pm-accent` = `--vscode-textLink-foreground`. Reads as a hyperlink, clashes with the warm ramp, ignores the logo | D, V — **consensus** | A | ✅ Fixed in `078bcf4` |
| D2 | 🔴 | `--pm-*` / `.pm-*` prefix collides with Prose Minion's tokens and classes, which have different meanings. Frame vocabulary incomplete | D | A | ✅ Fixed in `078bcf4` |
| C1 / U4 | 🔴 | 9 image models (Krea 2 ×3, MAI-Image 2.5 ×2, Recraft V4.1 ×4) request `['image','text']`; live outputs are `['image']` → 404. Recraft V4.1 is a regression (code and test flipped) | C, U — **consensus** | A (hotfix) · B (catalog-driven) | ✅ Fixed in `4aee37e` (+ `ebc9f59`) |
| U1 / C2 | 🔴 | `anthropic/claude-opus-5-fast` delisted (0 endpoints) | U, C — **consensus** | A | ✅ Fixed in `76fddce` |
| U2 / C2 | 🔴 | `x-ai/grok-imagine-image-quality` delisted (0 endpoints; Image API 404). Replacement `x-ai/grok-imagine-image-2.0` | U, C — **consensus** | A (remove + migrate) · B/P3 (add 2.0) | ✅ Removed + migrated in `76fddce`; Grok Imagine 2.0 → B |
| U3 | 🔴 **pre**, verified | Transport: only the Gemini image family, the GPT-5 image wrappers and Muse list `/chat/completions`. Recraft (incl. default SVG model), FLUX, Krea, Riverflow, Seedream, MAI and `gpt-image-*` list only `/api/v1/images`. Frame reached the same conclusion 2026-09-10 | U, S | Keyed smoke test → P3 | ◐ Verified 2026-11-07 (keyed probe, $0.111): v1.3.0 catalog routes; six PR #12 additions are Image-API-only, removed in `ebc9f59`; transport → P3 |
| S1 | 🔴 **pre** | Generated SVG injected via `dangerouslySetInnerHTML` ×5 per result (`SVGPreview.tsx:20-23`). CSP blocks scripts, but `style-src 'unsafe-inline'` lets `<style>` restyle or hide the UI. Duplicate ids collide with app SVG ids. Saved files keep any `<script>` | S | P5a | ⏳ Open |
| D3 / V6 | 🟠 | Header lockup off-family: monochrome link-blue glyph on a themed tile; 17/10.5 px; doubled centred 1 px rule; tagline copied from Frame | D, V — **consensus** | A | ✅ Fixed in `9800bad` |
| D4 / V3 / C10 | 🟠 | Picker ≠ Frame sprint-06: two-line 44 px trigger; 2 pivots (no By Release Date); no OpenRouter highlight or cost description; combined price pill widened to 220 px. SVG text model Gemini 3.1 Pro grouped as "Gemini Image" | D, V, C — **consensus** | B | ⏳ Open |
| C3 / C9 / U-1b | 🟠 | Per-image estimates invented (1,290 tokens applied to all Google/OpenAI/Microsoft). Units guessed from id prefix; input charges never shown; type says "$ per 1M tokens" | C, U, S — **consensus** | B | ⏳ Open |
| D5 | 🟠 | Image/SVG tabs still the old look: user bubble, image card, 💾 save, solid-blue Generate, card spacing, control grid, prompt field | D | A | ✅ Fixed in `0d39415` |
| V2 | 🟠 | Two field-surface families: inputs on `--pm-inset` (near-black in dark, grey "disabled" in Light Modern) vs selects on `--pm-field`. Regression | V | A | ✅ Fixed in `1b2c8f1` |
| V4 / D10 | 🟠 | Controls 44 px vs Frame's 34–36 px (`main` 34–36); radii 2–12 mixed within a card; add-reference chip wraps to 3 lines at 320 | V, D — **consensus** | A | ✅ Fixed in `1b2c8f1` (picker trigger height → B) |
| V5 | 🟠 | Model/Aspect side by side with Seed orphaned at 480; picker truncated | V | A | ✅ Fixed in `0d39415` |
| D6 | 🟠 | High-contrast regression: `contrastBorder` field and tab outlines replaced by warm hairlines (≈1.15–1.3:1) | D | A | ✅ Fixed in `078bcf4` |
| D7 / C8 | 🟠 | Model browser a11y: no focus trap or return, background not inert, Escape not scoped, chips/selection unannounced, trigger label unassociated, no `aria-expanded` | D, C — **consensus** | A (overlay hook) · B (picker port) | ◐ Overlay hook + paint order in `7294c29`, `01a230c`; picker internals → B |
| C4 | 🟠 | Balance survives API key clear/replace (shows account A's balance beside the no-key alert) | C | A | ✅ Fixed in `25a6f55` |
| C5 | 🟠 | When `/credits` 403s, the key spend cap is labelled "Account balance" | C | A | ✅ Fixed in `609da39` |
| S2 | 🟠 **pre** | Request ownership: no correlation ids; stale `referenceSvgText` (SVG text never recorded, but sent twice); a failed turn is resent with the next request; Refine eligibility uses the draft model, not the thread's; an enhance error clears the other tab's spinner; `persistedState` serialized every render | S | P2 (+ P5a for SVG refine) | ⏳ Open |
| U5 | 🟠 | `openai/gpt-5-image-mini` expires 2026-12-01 | U | B | ⏳ Open |
| C6 | 🟡 | Frame PR-12 review fixes lost: zero-cap reads "depleted"; "$-1.50"; invalid key vs offline identical (status dropped); per-handler debounce timer never disposed | C | A | ✅ Fixed in `25a6f55` (d), `609da39` (a–c) |
| C7 | 🟡 | No balance cache or dedupe; `forceRefresh` ignored; every load sends 2 requests (4 HTTP calls) | C | A | ✅ Fixed in `25a6f55` |
| D8 | 🟡 | Header wraps at ~300 px; the `flex-wrap` media query is a no-op | D | A | ✅ Fixed in `9800bad`, `ac00ef1` |
| D9 | 🟡 | Text down to 9 px (dim 9 px fails AA); no mono eyebrows | D | A | ✅ Fixed in `0d39415`, `e5c37e5` (picker text → B) |
| D11 | 🟡 | Dead CSS: `model-selector.css` restyled after losing its import; unused settings rules; undefined `--border-radius` | D | A | ✅ Fixed in `ae345bc`, `a59f5fc` |
| D12 / V8 | 🟡 | Settings overlay off-family; filled-primary Close; not a dialog | D, V — **consensus** | A | ✅ Fixed in `790cc20`, `3e84d99`, `0782d22` |
| D13 | 🟡 | Tabs: dangling `aria-labelledby`, no `aria-controls` or roving tabindex; glyphs inline in `App.tsx` | D | A | ✅ Fixed in `2696d4e`, `46ec626`, `a1f37c2` |
| D14 / C13 | 🟡 | Balance pill lacks `aria-expanded`; strip hard-codes `aria-expanded="true"` | D, C — **consensus** | A | ✅ Fixed in `609da39` |
| D15 | 🟡 | No `prefers-reduced-motion` (lift, spinners, 15 s ticker, 9 MB GIF) | D | A | ✅ Fixed in `787233c`, `4d21095` |
| D16 | 🟡 | Focus rings half themed; model cards have hover but no focus style | D | A | ✅ Fixed in `787233c` |
| D18 | 🟡 | Hard-coded colours and shadows (check badge contrast, `#65d27a` "live" dot on a static catalog) | D | A | ✅ Fixed in `078bcf4` |
| V9 | 🟡 | Empty output wells are blank boxes | V | A | ✅ Fixed in `0d39415` |
| V10 | 🟡 | Field text insets zig-zag (picker 11 px vs 17 px); two chevron styles | V | A (fields) · B (picker) | ◐ Fields in `a59f5fc`; picker trigger → B |
| V11 | 🟡 **pre** | Refine bar Send overhangs by 16 px at 320 (`min-width: 0` missing) | V | A | ✅ Fixed in `0d39415` |
| V12 | 🟡 | "no key" styled like an amount | V | A | ✅ Fixed in `609da39`, `e5c37e5` |
| V13 | 🟡 **pre** | Destructive red trash icon at rest | V | A | ✅ Fixed in `0d39415` |
| V14 | 🟡 **pre** | SVG code: per-line background bands, mid-token wraps | V | A | ✅ Fixed in `0d39415` |
| U6 | 🟡 | GPT-5.6 Sol / Sol Pro stored at $5/$30; live $4/$20 | U, C — **consensus** | B | ⏳ Open |
| M1 | 🟡 **pre** | SVG text client sends `max_tokens: 16384` (CLAUDE.md says 48 000). Reasoning models can truncate long SVGs | U | B | ⏳ Open |
| S3 | 🟡 **pre** | "Saved" shown by a 1 s timer even on cancel/error (Image and SVG); WebP/GIF saved as `.jpg` | S | P2 | ⏳ Open |
| S4 | 🟡 **pre** | Webview-supplied `suggestedFilename` joined unchecked in SVG save (defence in depth) | S | P5a | ⏳ Open |
| C11 | ⚪ | Post-generation balance refresh depends on `usage` being present | C | A | ✅ Fixed in `25a6f55` |
| C12 | ⚪ | Session token totals now a dead pipeline; "Last request" persists across reloads and shows only a time of day | C | A | ✅ Fixed in `47f364e` |
| C13 | ⚪ | Duplicate unavailable reason; headline blanks to "…" on refresh; stale `svgModel` description in `package.json` | C | A | ✅ Fixed in `609da39`, `76fddce` |
| C14 | ⚪ | Settings lost free-text model id entry (custom ids) | C | P4 | ⏳ Open |
| D19 | ⚪ | Tokens on `:root` rather than `.app-container`; modal aliases lack fallbacks | D | A | ✅ Fixed in `078bcf4` |
| D20 | ⚪ | Stale doc comments describe the pre-PR UI | D | A | ✅ Fixed in `9800bad`, `2696d4e` |
| D21 | ⚪ **pre** | Inert Tailwind pipeline (all three repos) | D | ↪ Deferred: family-wide cleanup, not this PR | ↪ Deferred |
| D22 | ⚪ | No Conversation / Single Shot mode pill | D | P4 | ⏳ Open |
| V15 | ⚪ | Modal: no release-date pivot; selected card off-screen on open; cost chips wrap at 320 | V | B | ⏳ Open |
| V16 | ⚪ | Vertical rhythm and three-edge stagger (header/tabs/well) | V | A | ✅ Fixed in `0d39415` |
| V17 | ⚪ | Last-request cost hidden in the collapsed pill | V | ↪ Deferred: optional; expanded card already shows it | ↪ Deferred |
| S5 | ⚪ **pre** | `MarkdownRenderer` claims to sanitize but inserts raw `marked` output (unused today) | S | P5a (remove or sanitize) | ⏳ Open |
| M2 | ⚪ **pre** | `temperature` sent to frontier models that don't support it (silently dropped) | U | ↪ Deferred: harmless; revisit with P3 | ↪ Deferred |

## Already right (don't regress)

From the rendered audit:

- **Model-browser modal.** Header, search, segmented pivots, provider chips with counts, grouped cards, selected medallion and footer are near pixel-parity with Frame in all themes and widths.
- **Balance strip.** Matches Frame's structure. The extra **Last request / Updated** row is a genuine improvement.
- **Tab cards.** Two tabs, no truncation (Frame truncates "Orchest…" at 320).
- **Header at 320.** Cleaner than Frame's, which wraps and overlaps.
- **Light Modern.** No illegible text.
- **SVG previews.** The 32/64/128 multi-size row reads well.
- **Robustness.** No harness or console errors and no page overflow across 100 Pixel shots.

From code review, keep and upstream to Frame:

- the picker's search autofocus;
- clearing the query on close;
- closing on backdrop mousedown;
- the balance client's 8 s timeout and branding headers.

## Upstream candidates (family-wide, fix once in the sibling repos)

- High-contrast override block (no sibling handles `contrastBorder`). (D6)
- Focus restore and trap on modals; Frame's picker has neither. (D7)
- Frame's model trigger isn't covered by its image-view field overrides (2 px radius next to 5 px fields). (D4 note)
- Frame's header wraps "Frame / Minion" and overlaps its pill at 320 px. (V-notes)
- "Saved" 1 s timer exists in Frame's Image tab too. (S3)
- `x-ai/grok-imagine-image-quality` is delisted but still in Frame sprint-06's catalog. `google/gemini-nano-banana-2.1` has a live chat route Frame doesn't list. (U2, audit §1c)
- Balance stays visible after key clear/replace in Frame too. (C4)

## Validation still owed

- **Keyed smoke test (U3/O1–O3).** Needs the owner's OpenRouter key; about $0.12. One cheap generation each through Pixel's current chat path for `recraft/recraft-v4.1-vector`, `black-forest-labs/flux.2-klein-4b` and `openai/gpt-image-1-mini`, plus a 16:9 Recraft vector call. Result decides whether P3's `/images` transport is a hotfix for released v1.3.0.
- **Installed-VSIX check.** 360 px in Dark, Light and High Contrast after PR A lands; the harness substitutes for a real host.

## Resolution Status

_Populated as fixups land (commit sha per item)._

### R4 follow-up

Two independent Round-4 verifications of PR A at `1442c94` (a code review and a rendered audit in the visual harness) found the items below. All are fixed in follow-up commits on the same branch. Tests went from 28 suites / 322 tests to 30 suites / 341; the three `tsc` projects, `npm run build` and lint on every changed file are clean (the 11 pre-existing lint errors are untouched).

| ID | Sev | Finding | Status |
| --- | --- | --- | --- |
| R1 | 🟠 regression | Settings opened by the host (`OPEN_SETTINGS_OVERLAY`) over an open model browser was top in `useOverlayDismiss` (focus moved in, picker inert, Escape targeted it) but painted under the picker (z-index 1000 vs 100): a frozen picker | ✅ Fixed in `01a230c` |
| R2 + V#4 | 🟡 | Balance pill/card coloured meaningful text with `--px-text-dim` (~2.1:1 Light Modern, ~3.4:1 Dark) and used 9–10 px sizes | ✅ Fixed in `e5c37e5` (completes V12) |
| R3 | 🟡 | A failed refresh hid good figures: the handler's error fallback was stamped `fetchedAt: Date.now()`, so the webview's newest-wins check rejected the later, older cached copy | ✅ Fixed in `d513145` |
| R4 | ⚪ | Balance spinner and headroom bar ignored the app's `[data-reduced-motion]` switch | ✅ Fixed in `4d21095` |
| R5 | ⚪ | `disabled={isLoading}` on the refresh button dropped keyboard focus to `<body>` | ✅ Fixed in `4d21095` |
| R6 | ⚪ | `unavailable` balance results cached for the full 120 s TTL | ✅ Fixed in `b101a82` |
| R7 | ⚪ | Retired-model migration wrote the default id explicitly, pinning users to today's default | ✅ Fixed in `a31ca15` |
| R8 | ⚪ | `TabId` still had `'settings'`; a saved `'settings'` or unknown `activeTab` rendered an empty panel | ✅ Fixed in `a1f37c2` |
| V#1 | 🟡 | At ≤340 px the header query hid the pill's name and left the status dot alone above the amount | ✅ Fixed in `ac00ef1` |
| V#2 | 🟡 | Light Modern "You" label at 3.16:1, 10.5 px | ✅ Fixed in `c5609e2` |
| V#5 | 🟡 | Settings header (and Close) scrolled off short viewports | ✅ Fixed in `0782d22` |
| V#6 | 🟡 | First focus on the quiet Close button made its ember ring look like the primary action | ✅ Fixed in `3e84d99` |

- **R1.** `useOverlayDismiss` now stamps each open overlay root with `z-index: OVERLAY_Z_BASE (100) + stack depth` on every push and remove, so the hook's top overlay is also the top one on screen. `.settings-overlay` and `.model-browser-backdrop` keep only the shared base as the pre-stamp default; the competing 100/1000 layers are gone. jsdom tests cover picker → host opens Settings → Escape returns focus to the picker, and the nested picker-from-Settings order. Checked in real Chromium as well: picker 100 (inert), Settings 101 on top with focus on its heading, and Escape returns focus to the picker's search field.
- **R2 / V#4.** Failure notes, the pill's muted state ("no key", "invalid key", "offline"), the strip title, the card label and the meta labels moved to `--px-text-muted`. Dim is left only on the chevron and the "…" placeholder. Every balance text is ≥10.5 px; the meta rows became one two-column grid so values still align. The 320 px header stays compact (see V#1).
- **R3.** `AccountBalanceService.lastKnownBalance()` returns the current key's last payload, however old. On a thrown fetch the handler re-posts it with its own `fetchedAt`, and the `unavailable` fallback only applies when nothing is cached. A new test (`balanceRefreshFailure.test.tsx`) drives the real service and handler into the real `useOpenRouterBalance` hook; it fails without the fix.
- **R4 / R5.** The refresh button uses `aria-disabled` and ignores clicks while loading. The busy styling dims the glyph rather than the button, so the focus ring keeps full strength. The spinner and bar also follow `.app-container[data-reduced-motion]`.
- **R6.** `FAILED_BALANCE_CACHE_TTL_MS = 15 s` applies to any payload with a `keyIssue` or `creditsIssue`. Good and `no_key` payloads keep 120 s.
- **R7.** When the replacement equals what the scope would fall back to, the migration clears the value (`config.update(key, undefined, target)`) and logs "clearing the user/workspace … setting so it falls back to …". For user settings the fallback is the contributed default from `inspect().defaultValue`; for workspace settings it is the migrated user value. A workspace value that would otherwise pick up a different user choice is still written explicitly.
- **R8.** `TabId` derives from `TAB_IDS = ['image', 'svg']`. `normalizeTabId()` maps legacy, removed or junk saved ids to `'image'` on restore.
- **V#1.** Inside the `px-header` container query the amount and chevron move onto the dot's row. Verified at 320 px: one line, dot · amount · chevron.
- **V#2.** The label now uses `color-mix(in oklab, var(--px-info) 60%, var(--px-text))`, still blue. Measured on the prompt field: ~4.9:1 Light Modern, ~5.5:1 Dark Modern, ~6.4:1 Flame Dark. The 75% mix suggested in review only reached 4.1:1 on Light Modern.
- **V#5.** `.settings-header` is sticky (opaque `--px-bg`, soft rule) inside the scrolling overlay. The overlay's top padding moved into the content box, because a sticky child sticks below its scroller's padding and let cards show through above the header. Under 560 px tall the header compacts.
- **V#6.** The Settings heading (`tabIndex={-1}`, no ring) receives `useOverlayDismiss`'s initial-focus ref, and Close is the next Tab stop. The focus trap now also wraps Shift+Tab from a focused element outside the Tab order that sits before the first control; otherwise focus would leave the webview.
