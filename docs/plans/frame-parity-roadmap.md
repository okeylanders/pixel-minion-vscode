# Frame parity roadmap: design family, model picker, image generator

## Status: IN PROGRESS — 2026-11-07

**Decision owner:** Okey.
**Goal:**
- Pixel Minion belongs to the same design family as Frame Minion and Prose Minion.
- Its model picker looks and behaves the same as Frame's.
- Its image generator does what Frame's does, OpenRouter only (no fal.ai).

**Frame reference:** `feat/video-models-sprint-06` (`40e7949`). It contains Frame PR #54 (Conversation / Single Shot modes), the image-model refresh, and the newest model browser. Frame `main` is older; PR #12 matched it.

**Inputs:**
- [PR #12 review ledger](../pr-reviews/pr-12-design-system-alignment-review.md): the consolidated findings with per-item status.
- [Frame image parity plan](./frame-image-parity-plan.md): the 29-row parity matrix, scope boundaries, SVG-tab recommendation, risk check, and Phase-1 file plan.
- [Model catalog audit 2026-11-07](../model-catalog-audit-2026-11-07.md): the live OpenRouter verification, additions, pricing representation, and open questions.

## Status by item

| PR | Scope | Depends on | Size | Status |
| --- | --- | --- | --- | --- |
| **#12** | Design system skeleton, first model-browser port, balance strip, catalog refresh | — | — | Draft; under review |
| **A — Design pass 02** | Family tokens + brand accent (`--px-*`), header lockup with the colour logo, Image/SVG tab layout (fixes the crushed conversation), field and control system, settings dialog, overlay a11y (`useOverlayDismiss`), tabs a11y, reduced motion, high contrast. Balance correctness (key change, spend-cap labelling, cache/dedupe, formatting). Hotfixes: modality routing (C1), delisted ids + settings migration (U1/U2). `.tsx` test infrastructure | #12 | M–L | 🔄 In review — `claude/pixel-minion-design-review-dhbqpd` (stacked on #12) |
| **B — Picker parity + catalog refresh** | Catalogs move to `src/shared/models`; Frame's unit-aware `ImageModelDefinition` / `ImagePricing`; explicit `SvgModelDefinition` (`kind: 'native-vector' \| 'code'`); port Frame sprint-06 `ModelBrowserModal` / `ModelBrowserSelect` / `modelBrowserOptions` + tests, keeping Pixel's a11y improvements. Price and drift fixes, expiry labels, new chat-route models only (image 27 → 36 incl. Nano Banana 2.1; SVG 8 → 12, code models re-curated), `max_tokens` 32,000 for SVG turns. No wire change otherwise | A | M | ✅ Implemented on `claude/pixel-minion-picker-catalog-dhbqpd` (`5d8bb2d`, `7038e87`, `a679286`, `5507ed9`); awaiting review. Deviates from parity plan §5 P1 ("no new models") by the owner's catalog-refresh direction, limited to models the 2026-11-07 chat probe passed |
| **P5a — SVG safety and ownership** | Isolated `<img>` preview (no DOM injection), `SVGDocumentPolicy` before preview and save, refine eligibility from the thread's model, basename-only save filenames, remove or sanitize `MarkdownRenderer` | A (ideally before P3) | M | 🔄 In progress — `claude/pixel-minion-svg-safety-dhbqpd` (stacked on P2) |
| **P2 — Request ownership** | Correlation ids in both hooks, correlated errors, SVG text sent once, rollback and in-flight guard, truthful "Saved" state, WebP/GIF extensions, memoized persistence | #12 | S–M | ✅ Implemented 2026-11-07 (`claude/pixel-minion-request-ownership-dhbqpd`, `a2d5115`, stacked on B); awaiting review. Also: refinements use thread settings with no draft attachments; clear is correlated and frees the host copy |
| **P3 — `/images` transport + capability-driven controls** | Frame's `ImageGenerationModes` + `OpenRouterImageTransport`; mode-aware client/orchestrator; host transcript store (Pixel-sized FileSystem/Workspace ports); resolution, `auto` ratio, seed and reference controls; bounded history; the `/images`-only models (Seedream 5, Qwen Image 3, GPT Image 2.5/2.6, MAI 2.6, FLUX.3, Riverflow 2.6, Grok Imagine 2.0, …) | B, P2 | L | ⏳ Pending — not a hotfix (smoke test: v1.3.0's catalog still routes over chat), but required for every Image-API-only model |
| **P4 — Modes UI and threads** | Conversation \| Single Shot pill, Earlier threads + delete, start-from-image, custom model ids, migration of untagged history to Single Shot | P3 | M | ⏳ Pending |
| **P5b — Native vector over `/images`** | `OpenRouterVectorSVGClient` (SVG-only decoder), vector aspect ratios and references, `supportsRefinement` | P3, P5a | M | ⏳ Pending: needs paid qualification |

Effort: P1–P5b were estimated at roughly 18–26 engineering days plus review and paid validation (parity plan §5). PR A was not in that estimate.

## Pace

Owner decision (2026-11-07): build A, B, P2 and P5a now, then pause before P3 for Astra's first reviews.

## Decisions

| Decision | Recommendation | Status |
| --- | --- | --- |
| Brand accent | Fixed pair from the logo: ember `#ff6b2d` / oxblood `#8c2a13`, on a dark "CRT" logo tile. The white skull disappears on the family's white tile. Never the theme link colour | ✅ Confirmed by owner 2026-11-07; implemented in PR A |
| Token prefix | `--px-*` / `.px-*` over Frame's vocabulary (Prose owns `pm`) | ✅ Adopted in PR A |
| Picker trigger | Frame's single-line trigger (geometry; keep Pixel's native-dropdown colours where Frame's renders white in Light Modern) | ✅ Adopted for B |
| Superseded-but-live model ids | Leave saved selections alone: they still work, and the picker shows them as "Custom" with helper text. Only delisted or Image-API-only ids migrate (`RETIRED_MODELS`) | ✅ Adopted in B |
| Models that require a reference image (Recraft V4 Styles raster and vector, Krea K3 Edit) | Keep out of the catalogs until Generate can be gated on an attached reference (P3/P4) | ✅ Adopted in B |
| Save path | Keep Pixel's `vscode.workspace.fs` save (works in virtual workspaces); don't port Frame's port-based save | ✅ Adopted |
| One branch per phase | Stacked PRs per phase for reviewable diffs | ✅ Approved 2026-11-07 |
| Keyed smoke test | ~$0.12 of generations with the owner's key to settle U3 | ✅ Done 2026-11-07 ($0.111): six PR #12 additions are Image-API-only and were removed; see the audit addendum |
| Estimate basis for GPT image models | Frame shows "high quality" references; measured benchmark medians are 4–10× lower (audit O5) | ⏳ Open; decide family-wide with Frame |

## Conventions for every phase

- Each copied file carries a provenance header, e.g. `// Ported from frame-minion@40e7949 packages/core/src/<path>; keep in sync`.
- Every PR updates `CHANGELOG.md` (public voice), `docs/CHANGELOG-DETAILED.md` (engineer voice), this table, and the review ledger.
- Paid provider validation and installed-VSIX checks are listed per phase in the parity plan §7; they are manual and owner-run.
