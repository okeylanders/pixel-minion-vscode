# Frame parity roadmap: design family, model picker, image generator

## Status: IN PROGRESS — 2026-11-12

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
| **#12** | Design system skeleton, first model-browser port, balance strip, catalog refresh | — | — | ✅ Merged to `main` 2026-11-12 (`035906f`) |
| **A — Design pass 02** | Family tokens + brand accent (`--px-*`), header lockup with the colour logo, Image/SVG tab layout (fixes the crushed conversation), field and control system, settings dialog, overlay a11y (`useOverlayDismiss`), tabs a11y, reduced motion, high contrast. Balance correctness (key change, spend-cap labelling, cache/dedupe, formatting). Hotfixes: modality routing (C1), delisted ids + settings migration (U1/U2). `.tsx` test infrastructure | #12 | M–L | ✅ Merged as PR #13 into #12, then `main` (`035906f`), 2026-11-12 |
| **B — Picker parity + catalog refresh** | Catalogs move to `src/shared/models`; Frame's unit-aware `ImageModelDefinition` / `ImagePricing`; explicit `SvgModelDefinition` (`kind: 'native-vector' \| 'code'`); port Frame sprint-06 `ModelBrowserModal` / `ModelBrowserSelect` / `modelBrowserOptions` + tests, keeping Pixel's a11y improvements. Price and drift fixes, expiry labels, new chat-route models only (image 27 → 35 incl. Nano Banana 2.1; SVG 8 → 12, code models re-curated), `max_tokens` 32,000 for SVG turns. No wire change otherwise | A | M | ✅ Merged as PR #14, then `main` (`035906f`), 2026-11-12 |
| **P5a — SVG safety and ownership** | Isolated `<img>` preview (no DOM injection), `SVGDocumentPolicy` before preview and save, refine eligibility from the thread's model, basename-only save filenames, remove or sanitize `MarkdownRenderer` | A (ideally before P3) | M | ✅ Merged as PR #16, then `main` (`035906f`), 2026-11-12 |
| **P2 — Request ownership** | Correlation ids in both hooks, correlated errors, SVG text sent once, rollback and in-flight guard, truthful "Saved" state, WebP/GIF extensions, memoized persistence | #12 | S–M | ✅ Merged as PR #15, then `main` (`035906f`), 2026-11-12 |
| **P3 — `/images` transport + capability-driven controls** | Frame's `ImageGenerationModes` + `OpenRouterImageTransport`; mode-aware client/orchestrator; host transcript store (Pixel-sized FileSystem/Workspace ports); resolution, `auto` ratio, seed and reference controls; bounded history; the `/images`-only models (Seedream 5, Qwen Image 3, GPT Image 2.5/2.6, MAI 2.6, FLUX.3, Riverflow 2.6, Grok Imagine 2.0, …) | B, P2 | L | ✅ Implemented 2026-11-12 on `claude/pixel-minion-images-transport-dhbqpd` (`19136ad`, `cfb0d34`, `a501ad5`), from `main`; pre-PR independent-review fixes merged in `18e36b3` (one major, W1; no blockers); awaiting Astra's review. 54 image rows (19 added, incl. the reference-gated Recraft V4.1 Flash, Krea K3 Edit, Recraft V4 Styles); Muse left out (no route). Store behind a `GlobalStorage` seam rather than ports. Each new thread's mode is chosen automatically until P4. Live qualification reached only OpenAI (the key's workspace is BYOK-restricted; $0.122). Plan: [parity plan §8](./frame-image-parity-plan.md#8-p3-as-built-2026-11-12) |
| **P4 — Modes UI and threads** | Conversation \| Single Shot pill, Earlier threads + delete, start-from-image, custom model ids, migration of untagged history to Single Shot | P3 | M | ✅ Implemented 2026-11-12 on `claude/pixel-minion-image-modes-dhbqpd` (`81d095e`, `9a7cbb2`, `c072a8f`), stacked on P3; awaiting review. Webview only. Picker filtered by mode (10 Conversation / 54 Single Shot); archiving also releases the host thread (Pixel delta); Settings takes free-text ids (C14); two-column controls from 480 px; empty state anchored near the controls. Plan: [parity plan §9](./frame-image-parity-plan.md#9-p4-as-built-2026-11-12) |
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
| Superseded-but-live model ids | Leave saved selections alone: they still work, and the picker shows them as "Custom" with helper text. Only delisted ids migrate (`RETIRED_MODELS`) | ✅ Adopted in B; Image-API-only ids stopped migrating in P3 (they are catalog models again) |
| Models that require a reference image (Recraft V4 Styles raster and vector, Krea K3 Edit) | Keep out of the catalogs until Generate can be gated on an attached reference (P3/P4) | ✅ Adopted in B; raster Styles / Styles Pro and K3 Edit added with that gating in P3 (UI and host). Styles vector waits for P5b |
| Models that accept no reference image (Recraft V4.1 Flash) | Keep out until Refine and attachments are gated by capability (P3/P4): Refine always sends the previous image. A catalog test requires `referenceImages.max ≥ 1` | ✅ Adopted 2026-11-07 after the PR #14 review (F-01), `8e53acd`; Flash added in P3 with the gating (uploader disabled, no Single Shot follow-up, host refusal), and the guard replaced by capability tests |
| Save path | Keep Pixel's `vscode.workspace.fs` save (works in virtual workspaces); don't port Frame's port-based save | ✅ Adopted |
| One branch per phase | Stacked PRs per phase for reviewable diffs | ✅ Approved 2026-11-07 |
| Keyed smoke test | ~$0.12 of generations with the owner's key to settle U3 | ✅ Done 2026-11-07 ($0.111): six PR #12 additions are Image-API-only and were removed; see the audit addendum |
| Estimate basis for GPT image models | Frame shows "high quality" references; measured benchmark medians are 4–10× lower (audit O5) | ⏳ Open; decide family-wide with Frame |

## Conventions for every phase

- Each copied file carries a provenance header, e.g. `// Ported from frame-minion@40e7949 packages/core/src/<path>; keep in sync`.
- Every PR updates `CHANGELOG.md` (public voice), `docs/CHANGELOG-DETAILED.md` (engineer voice), this table, and the review ledger.
- Paid provider validation and installed-VSIX checks are listed per phase in the parity plan §7; they are manual and owner-run.
