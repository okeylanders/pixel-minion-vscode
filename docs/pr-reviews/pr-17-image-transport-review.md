# PR #17 Image API transport and recovery review

- PR: https://github.com/okeylanders/pixel-minion-vscode/pull/17
- Reviewed source: `befd256731db9257ab50606d29d6a969d310ae11`
- Base: `035906f610f267253ed795d51b52658c017fc2b9`
- Date: 2026-11-12
- Verdict: **scoped technical approval; no new blocking finding.** This does not assert completion of native-VSIX or paid-provider validation. No merge performed.

## Status ledger

| ID | Area | Status |
| --- | --- | --- |
| R17-C1 | Transport, capabilities, thread ownership, failure rollback, restart recovery | Reviewed; no new blocking finding at the source above |
| R17-M1 | Installed VSIX at 360 px in Dark, Light and High Contrast | ⏳ Open; not performed in this review |
| R17-M2 | Remaining live provider matrix (Gemini 4K/reload; FLUX.3, Qwen, Krea K3 Edit, Recraft Flash) | ⏳ Open; no paid provider calls performed in this review; retain the PR's owner-run checks |
| R17-D1 | Existing lint configuration/debt | ↪ Deferred (unchanged baseline: 9 errors / 20 warnings) |

## Architecture and scope

Observed flow: Image tab controls → correlation-owned hook request → thin image handler → extension-lifetime ImageOrchestrator → mode-specific OpenRouter transport. Conversation recovery flows through the workspace-scoped FileImageConversationStore; the webview stores bounded display history separately.

The important boundaries remain explicit:

- `ImageGenerationModes.ts` is shared by presentation and host preflight validation; mode and wire endpoint are distinct.
- `OpenRouterImageClient.ts` and `OpenRouterImageTransport.ts` select one endpoint without retrying a failed generation on another, preserve opaque assistant messages for Conversation, and validate route capabilities.
- `ImageOrchestrator.ts` owns immutable thread settings, turn-count checks, per-thread in-flight locks, rollback, and host transcript recovery. `extension.ts` injects one orchestrator across view re-resolution.
- `ImageConversationStore.ts` uses constrained IDs, temp-and-rename replacement, a per-thread size cap, and tombstones; corrupt/missing/stale recovery is explicit rather than fabricated from display history.
- `useImageGeneration.ts` retains a replaced thread until the replacement succeeds, restores it on failure, and correlates responses to the dispatch snapshot. The persisted snapshot preserves the old thread while replacement is pending.
- `imageHistoryPersistence.ts` bounds preview data without removing live-session images, separates draft warnings from omitted-preview warnings, and preserves thread identity for host recovery.

Reviewed the UI/host capability paths for text-only, required-reference, reference-format/count, ratio, resolution, and seed behavior; legacy thread restoration; SVG-only attachment treatment; and the supporting catalog/provider fixtures. Also inspected the narrow SVG type changes and App's one-time persisted-state read. Existing pre-PR review fixes were treated as evidence to verify, not as a substitute for review. PR #18's incremental behavior is reviewed separately.

## Independent verification

Using Node 24.22.1 and existing installed dependencies after confirming the package-lock matches:

- `npx jest --runInBand`: **60 suites / 1,204 tests passed**.
- `tsc --noEmit` for `tsconfig.json`, `tsconfig.webview.json`, and `tsconfig.test.json`: passed.
- Production webpack build: passed, with three bundle-size warnings.
- `eslint src --ext ts,tsx`: **9 errors / 20 warnings**, not a clean lint run. Compared JSON diagnostics by file/rule/severity/message with base `035906f`; they match exactly.
- Independent backend pass: 166 targeted tests across client, conversation modes/store, and GlobalStorage passed (overlapping the full suite above, not additional unique coverage).
- GitHub commit-status and PR-triggered workflow queries returned no entries for the reviewed code SHA. This is not a claim that remote CI is green.

## Verification limits

No fresh native VS Code/installed-VSIX visual, keyboard, screen-reader, or theme acceptance pass was performed. No paid model generation was invoked. The repository's captured provider fixtures and claimed live checks were inspected as supplied evidence; their live results were not independently repeated. The scoped approval covers the reviewed code and automated checks, not those remaining release checks.
