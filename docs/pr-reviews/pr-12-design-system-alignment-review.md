# PR Review — feat: align Pixel Minion with Frame Minion design system

**Author:** okeylanders · PR #12 (draft)
**Reviewed:** 2026-11-07
**Base:** `main` (`28d0b05`) · **Head:** `claude/design-overhaul-review-m5ojwb` (`57bab83`)
**Fixups:** stacked PR from `claude/pixel-minion-design-review-dhbqpd`

**Status:** Round-1 review complete. Fixups for every 🔴 introduced by this PR, and for most 🟠/🟡 items, are in progress on the stacked branch (PR A). The model-picker port and catalog refresh follow as PR B. Pre-existing defects found during the review, such as unsafe SVG preview and request ownership, are scheduled as later phases of the [Frame parity roadmap](../plans/frame-parity-roadmap.md). Each row's status is updated as fixups land.

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
| V1 / D17 | 🔴 | Image/SVG conversation area crushed: 42 px at 320×900, 143 px at 480 (`main`: 59/165). Generated image barely visible | V, D — **consensus** | A | ⏳ Open |
| D1 / V7 | 🔴 | No brand accent: `--pm-accent` = `--vscode-textLink-foreground`. Reads as a hyperlink, clashes with the warm ramp, ignores the logo | D, V — **consensus** | A | ⏳ Open |
| D2 | 🔴 | `--pm-*` / `.pm-*` prefix collides with Prose Minion's tokens and classes, which have different meanings. Frame vocabulary incomplete | D | A | ⏳ Open |
| C1 / U4 | 🔴 | 9 image models (Krea 2 ×3, MAI-Image 2.5 ×2, Recraft V4.1 ×4) request `['image','text']`; live outputs are `['image']` → 404. Recraft V4.1 is a regression (code and test flipped) | C, U — **consensus** | A (hotfix) · B (catalog-driven) | ⏳ Open |
| U1 / C2 | 🔴 | `anthropic/claude-opus-5-fast` delisted (0 endpoints) | U, C — **consensus** | A | ⏳ Open |
| U2 / C2 | 🔴 | `x-ai/grok-imagine-image-quality` delisted (0 endpoints; Image API 404). Replacement `x-ai/grok-imagine-image-2.0` | U, C — **consensus** | A (remove + migrate) · B/P3 (add 2.0) | ⏳ Open |
| U3 | 🔴 **pre**, unverified | Transport: only the Gemini image family, the GPT-5 image wrappers and Muse list `/chat/completions`. Recraft (incl. default SVG model), FLUX, Krea, Riverflow, Seedream, MAI and `gpt-image-*` list only `/api/v1/images`. Frame reached the same conclusion 2026-09-10 | U, S | Keyed smoke test → P3 | ⏳ Open (needs owner key) |
| S1 | 🔴 **pre** | Generated SVG injected via `dangerouslySetInnerHTML` ×5 per result (`SVGPreview.tsx:20-23`). CSP blocks scripts, but `style-src 'unsafe-inline'` lets `<style>` restyle or hide the UI. Duplicate ids collide with app SVG ids. Saved files keep any `<script>` | S | P5a | ⏳ Open |
| D3 / V6 | 🟠 | Header lockup off-family: monochrome link-blue glyph on a themed tile; 17/10.5 px; doubled centred 1 px rule; tagline copied from Frame | D, V — **consensus** | A | ⏳ Open |
| D4 / V3 / C10 | 🟠 | Picker ≠ Frame sprint-06: two-line 44 px trigger; 2 pivots (no By Release Date); no OpenRouter highlight or cost description; combined price pill widened to 220 px. SVG text model Gemini 3.1 Pro grouped as "Gemini Image" | D, V, C — **consensus** | B | ⏳ Open |
| C3 / C9 / U-1b | 🟠 | Per-image estimates invented (1,290 tokens applied to all Google/OpenAI/Microsoft). Units guessed from id prefix; input charges never shown; type says "$ per 1M tokens" | C, U, S — **consensus** | B | ⏳ Open |
| D5 | 🟠 | Image/SVG tabs still the old look: user bubble, image card, 💾 save, solid-blue Generate, card spacing, control grid, prompt field | D | A | ⏳ Open |
| V2 | 🟠 | Two field-surface families: inputs on `--pm-inset` (near-black in dark, grey "disabled" in Light Modern) vs selects on `--pm-field`. Regression | V | A | ⏳ Open |
| V4 / D10 | 🟠 | Controls 44 px vs Frame's 34–36 px (`main` 34–36); radii 2–12 mixed within a card; add-reference chip wraps to 3 lines at 320 | V, D — **consensus** | A | ⏳ Open |
| V5 | 🟠 | Model/Aspect side by side with Seed orphaned at 480; picker truncated | V | A | ⏳ Open |
| D6 | 🟠 | High-contrast regression: `contrastBorder` field and tab outlines replaced by warm hairlines (≈1.15–1.3:1) | D | A | ⏳ Open |
| D7 / C8 | 🟠 | Model browser a11y: no focus trap or return, background not inert, Escape not scoped, chips/selection unannounced, trigger label unassociated, no `aria-expanded` | D, C — **consensus** | A (overlay hook) · B (picker port) | ⏳ Open |
| C4 | 🟠 | Balance survives API key clear/replace (shows account A's balance beside the no-key alert) | C | A | ⏳ Open |
| C5 | 🟠 | When `/credits` 403s, the key spend cap is labelled "Account balance" | C | A | ⏳ Open |
| S2 | 🟠 **pre** | Request ownership: no correlation ids; stale `referenceSvgText` (SVG text never recorded, but sent twice); a failed turn is resent with the next request; Refine eligibility uses the draft model, not the thread's; an enhance error clears the other tab's spinner; `persistedState` serialized every render | S | P2 (+ P5a for SVG refine) | ⏳ Open |
| U5 | 🟠 | `openai/gpt-5-image-mini` expires 2026-12-01 | U | B | ⏳ Open |
| C6 | 🟡 | Frame PR-12 review fixes lost: zero-cap reads "depleted"; "$-1.50"; invalid key vs offline identical (status dropped); per-handler debounce timer never disposed | C | A | ⏳ Open |
| C7 | 🟡 | No balance cache or dedupe; `forceRefresh` ignored; every load sends 2 requests (4 HTTP calls) | C | A | ⏳ Open |
| D8 | 🟡 | Header wraps at ~300 px; the `flex-wrap` media query is a no-op | D | A | ⏳ Open |
| D9 | 🟡 | Text down to 9 px (dim 9 px fails AA); no mono eyebrows | D | A | ⏳ Open |
| D11 | 🟡 | Dead CSS: `model-selector.css` restyled after losing its import; unused settings rules; undefined `--border-radius` | D | A | ⏳ Open |
| D12 / V8 | 🟡 | Settings overlay off-family; filled-primary Close; not a dialog | D, V — **consensus** | A | ⏳ Open |
| D13 | 🟡 | Tabs: dangling `aria-labelledby`, no `aria-controls` or roving tabindex; glyphs inline in `App.tsx` | D | A | ⏳ Open |
| D14 / C13 | 🟡 | Balance pill lacks `aria-expanded`; strip hard-codes `aria-expanded="true"` | D, C — **consensus** | A | ⏳ Open |
| D15 | 🟡 | No `prefers-reduced-motion` (lift, spinners, 15 s ticker, 9 MB GIF) | D | A | ⏳ Open |
| D16 | 🟡 | Focus rings half themed; model cards have hover but no focus style | D | A | ⏳ Open |
| D18 | 🟡 | Hard-coded colours and shadows (check badge contrast, `#65d27a` "live" dot on a static catalog) | D | A | ⏳ Open |
| V9 | 🟡 | Empty output wells are blank boxes | V | A | ⏳ Open |
| V10 | 🟡 | Field text insets zig-zag (picker 11 px vs 17 px); two chevron styles | V | A (fields) · B (picker) | ⏳ Open |
| V11 | 🟡 **pre** | Refine bar Send overhangs by 16 px at 320 (`min-width: 0` missing) | V | A | ⏳ Open |
| V12 | 🟡 | "no key" styled like an amount | V | A | ⏳ Open |
| V13 | 🟡 **pre** | Destructive red trash icon at rest | V | A | ⏳ Open |
| V14 | 🟡 **pre** | SVG code: per-line background bands, mid-token wraps | V | A | ⏳ Open |
| U6 | 🟡 | GPT-5.6 Sol / Sol Pro stored at $5/$30; live $4/$20 | U, C — **consensus** | B | ⏳ Open |
| M1 | 🟡 **pre** | SVG text client sends `max_tokens: 16384` (CLAUDE.md says 48 000). Reasoning models can truncate long SVGs | U | B | ⏳ Open |
| S3 | 🟡 **pre** | "Saved" shown by a 1 s timer even on cancel/error (Image and SVG); WebP/GIF saved as `.jpg` | S | P2 | ⏳ Open |
| S4 | 🟡 **pre** | Webview-supplied `suggestedFilename` joined unchecked in SVG save (defence in depth) | S | P5a | ⏳ Open |
| C11 | ⚪ | Post-generation balance refresh depends on `usage` being present | C | A | ⏳ Open |
| C12 | ⚪ | Session token totals now a dead pipeline; "Last request" persists across reloads and shows only a time of day | C | A | ⏳ Open |
| C13 | ⚪ | Duplicate unavailable reason; headline blanks to "…" on refresh; stale `svgModel` description in `package.json` | C | A | ⏳ Open |
| C14 | ⚪ | Settings lost free-text model id entry (custom ids) | C | P4 | ⏳ Open |
| D19 | ⚪ | Tokens on `:root` rather than `.app-container`; modal aliases lack fallbacks | D | A | ⏳ Open |
| D20 | ⚪ | Stale doc comments describe the pre-PR UI | D | A | ⏳ Open |
| D21 | ⚪ **pre** | Inert Tailwind pipeline (all three repos) | D | ↪ Deferred: family-wide cleanup, not this PR | ↪ Deferred |
| D22 | ⚪ | No Conversation / Single Shot mode pill | D | P4 | ⏳ Open |
| V15 | ⚪ | Modal: no release-date pivot; selected card off-screen on open; cost chips wrap at 320 | V | B | ⏳ Open |
| V16 | ⚪ | Vertical rhythm and three-edge stagger (header/tabs/well) | V | A | ⏳ Open |
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
