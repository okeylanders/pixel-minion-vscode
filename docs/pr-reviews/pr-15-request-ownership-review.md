# PR #15 review: image and SVG request ownership

**Reviewed:** 2026-11-07  
**PR:** https://github.com/okeylanders/pixel-minion-vscode/pull/15  
**Code head:** `a2d1dc0f709cfa4348c16740f2169a555c5d2217`  
**Current stack base:** `3978da9a9d8c763a418e50d3f37a9302ebe1e707` (`claude/pixel-minion-picker-catalog-dhbqpd`)  
**Diff merge base:** `fa85d0c17d51e6fc9478aef597e3dc8ed3665f95`. The base branch's later commit contains the #14 review only.

**Status (2026-11-07):** N-01 fixed in `fddaf41`; the witness's two expected-behavior assertions now pass (10 / 10). The inherited #13 and #14 findings are resolved on their branches and merged in (`afba2aa`). 42 suites / 646 tests pass; see [Resolution status](#resolution-status).

**Verdict: approve the scoped P2 request-ownership changes, with one nonblocking follow-up.** No new blocking defect was found in the ordinary generation, refinement, enhancement or save flows. This is not approval to release or merge the full stack: the existing #13 and #14 findings remain open.

## Status by item

| ID | Priority | Finding | Status |
| --- | --- | --- | --- |
| N-01 | P3 / low, nonblocking | Generic router `ERROR` responses cannot settle pending saves | ✅ Fixed in `fddaf41` |
| S-13 | Inherited P2 | API-key replacement temporarily leaves the previous account's balance visible | ✅ Fixed in #13 (`b19a691`), merged here in `afba2aa` |
| S-14 | Inherited P2 | Text-only Recraft V4.1 Flash still accepts reference-bearing generation and refinement | ↪ Deferred in #14 (`8e53acd`: row removed until capability gating, guard test added), merged here in `afba2aa` |

## ✅ Fixed - N-01: include saves in generic-error ownership

**Locations at the reviewed head:**
- `src/presentation/webview/hooks/domain/useImageGeneration.ts:282–295`
- `src/presentation/webview/hooks/domain/useSVGGeneration.ts:243–256`
- `src/presentation/webview/App.tsx:117–122`

The new router fallback answers an exception escaping a route with a correlated `ERROR`. Both hooks recognize generation, enhancement and clear errors, but neither checks its pending save. Therefore, an `ERROR` carrying an outstanding `image-save-…` or `svg-save-…` ID returns `false` from both hooks. App then identifies that ID as a stale tab request and drops it. The save remains in `Saving…`, and its button stays disabled.

The ordinary save handlers correctly catch write/validation/dialog failures and emit `IMAGE_SAVE_RESULT` or `SVG_SAVE_RESULT`; those paths passed. This follow-up is nonblocking because the demonstrated gap requires the generic fallback path, such as a malformed save payload or an unexpected exception outside the save handler's catch. No ordinary user flow producing a malformed save payload was found. The documentation's broader claim that any route exception settles its spinner is nevertheless not true for saves.

**Suggested correction:** when a generic error matches an outstanding save, remove that save's pending entry, clear its saving state, show the error and return `true`. Preserve generation and enhancement state. Drop genuinely unknown or already-settled save IDs as before. Add tests for both hooks through App's router, including a simultaneous generation that must remain running.

**Reproduction:** [pr-15-request-ownership.test.tsx](witnesses/pr-15-request-ownership.test.tsx) contains eight passing independent checks and two deliberately red expected-behavior assertions for N-01. It injects the fallback envelope into the real hooks; it does not claim a filesystem fault normally takes this route.

```sh
npx jest --runInBand --roots docs/pr-reviews/witnesses --testMatch '**/pr-15-request-ownership.test.tsx'
```

Result at the reviewed head: **8 passed, 2 failed**. After `fddaf41`: **10 passed**. The two failing assertions expect `handleError` to claim its own save; it returns `false`. The file is outside the default `src` test roots and does not make the normal suite red. To run only the passing review checks:

```sh
npx jest --runInBand --roots docs/pr-reviews/witnesses --testMatch '**/pr-15-request-ownership.test.tsx' -t 'independent request-ownership checks'
```

## Review coverage

- Compared all 34 changed files against the stacked merge base. Read the repository rules and reconciled the author-side P2/P5a adversarial follow-ups before testing.
- Webview dispatch snapshots: prompt, SVG reference text and thread model/aspect ratio are captured at dispatch, rather than read from later controls. Refine no longer appends draft attachments again.
- Ownership: synchronous duplicate Generate calls, simultaneous Image/SVG requests, stale response after a failed request and a new dispatch, duplicate answers, cross-tab errors, and failed refinement preserving completed history.
- Enhancement: an edit wins over the reply; Generate and Clear invalidate the outstanding enhancement. Independent refinement input remains separate from the draft prompt.
- Host transactions: provider failure, extraction failure, partially recorded responses, message/turn/seed/last-image rollback, first-turn disposal, per-conversation in-flight guard, refused clear, and retry request bodies.
- Saves: host confirmation replaces timers, cancellation remains silent, editor-open failure cannot reverse the completed write, unknown raster formats are refused, and filename extensions follow PNG/JPEG/WebP/GIF bytes. A pending save cannot settle a generation; an old SVG save cannot mark different generated code saved.
- Persistence: memoized state identities, new thread settings and the explicit fallback for state created before those fields existed.
- Inherited native-vector refinement gating and SVG isolation belong to #16; no duplicate finding is raised here. The #14 text-only-image capability gap remains relevant because #15 continues supplying the prior image during refinement.

## Independent validation

| Check | Result at reviewed code head |
| --- | --- |
| `npx jest --runInBand` | **41 suites / 583 tests passed** |
| `npx tsc --noEmit -p tsconfig.json` | Passed |
| `npx tsc --noEmit -p tsconfig.webview.json` | Passed |
| `npx tsc --noEmit -p tsconfig.test.json` | Passed |
| `npm run build` | Passed; the existing three webpack size/performance warnings remain |
| `npm run lint` | **Failed: 9 errors / 20 warnings**. Existing require-style test errors and the remaining unknown `react-hooks/exhaustive-deps` rule in `useSettings`; no new error category |
| Independent ownership probes | **8 passed** |
| N-01 expected-behavior probes | **2 failed**, reproducing the nonblocking gap described above |
| Remote CI | No commit status entries or PR-triggered workflow runs returned for `a2d1dc0`; CI is **not claimed green** |

## Boundaries

- No installed VSIX, real VS Code save dialog, real provider requests, charges or live-model outputs were exercised. Host tests use VS Code mocks; hook/component tests use jsdom.
- Pending requests across webview reload, old host conversations discarded by a new Generate, and raster-reference/transcript rehydration remain in the existing roadmap. This review does not expand the P2 verdict to those deferred areas.
- Existing #13 account ownership and #14 text-only-model blockers must be addressed before treating the stack as ready. (Since addressed: #13 fixed, #14's row deferred; both merged in `afba2aa`.)
- Publication adds this report and its review-only witness. No production code change, merge, auto-merge or deployment was performed.

## Resolution status

- **N-01 ✅ `fddaf41`.**
  - `useImageGeneration.handleError`: an error whose id is in `pendingSaves` deletes that entry, recomputes `savingImageIds` (another image's pending save stays pending), shows the error and returns `true`.
  - `useSVGGeneration.handleError`: an error matching `pendingSave` clears it and `saveState`, shows the error and returns `true`.
  - Neither touches the generation or enhance refs, so a running refinement or new generation continues and settles on its own answer. A repeat of the settled id or an unknown `*-save-` id still returns `false` and App drops it; a late `*_SAVE_RESULT` for the settled save is ignored.
  - Tests: one hook case per tab (`useImageGenerationOwnership` / `useSVGGenerationOwnership`), each with a refinement running and, for images, a second save pending. Two `AppErrorRouting.test.tsx` cases go through App's real router: Image tab with a refinement running, and SVG tab with a new generation running (the same SVG returns, and its button is no longer stuck on "Saving…"). Both App cases fail with the hook change reverted.
  - The witness file is kept. `npx jest --runInBand --roots docs/pr-reviews/witnesses --testMatch '**/pr-15-request-ownership.test.tsx'` now reports **10 passed**. Its second `describe` is still titled "expected to fail until fixed", as written by the reviewer.
  - Docs: the `CHANGELOG.md` save bullet, `docs/CHANGELOG-DETAILED.md` (the `handleError` description and a review follow-up section), and the CLAUDE.md / AGENTS.md request-ownership invariant now include saves.
- **Stack:** `afba2aa` merges #14, including #13's fixes, with no conflicts. `2252c30` adds the now-required `accountEpoch` to `AppErrorRouting.test.tsx`'s balance push.
- **Validation:** `npx jest` 42 suites / 646 tests; the three `tsc --noEmit` projects clean; `npm run build` passes with the three usual webpack size warnings; `npm run lint` unchanged at 9 errors / 20 warnings.
