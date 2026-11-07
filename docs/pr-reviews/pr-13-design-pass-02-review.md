# PR #13 review: design pass 02

**Reviewed:** 2026-11-07
**PR:** https://github.com/okeylanders/pixel-minion-vscode/pull/13
**Original code head:** `e946faae8e4a074e7a62ab1166afeca8e024fbf3`
**Independently re-reviewed code head:** `9b19065eed7631cd1c424d25ec8b290d3cff210a`
**Stack base:** `57bab8382dad17a32a02bb18cdd23dcb8b8f38c3` (`claude/design-overhaul-review-m5ojwb`, draft PR #12)

**Final verdict: approve the scoped changes.** F-01 and N-01 are independently verified closed at `9b19065`. No remaining blocking findings in this review. This approves the stacked fix-up's reviewed scope, not release of the whole stack, merging #12, or the deferred features below.

The initial review requested changes for F-01. The author fixed the ownership gap in `b19a691` and implemented explicit same-account stale retention in `068bc16`. Independent verification of the combined head passed **31 suites / 370 tests**, all three TypeScript projects, production build, and an additional rapid-account-switch integration probe. Lint remains at the same pre-existing **11 errors / 22 warnings**. Remote CI is not claimed green: GitHub returns no commit statuses or PR-triggered workflow runs for the reviewed head.

## Status by item

| ID | Priority | Finding | Status |
| --- | --- | --- | --- |
| F-01 | P2 / medium | Replacing the API key leaves the previous account's figures visible until the new account fetch completes | ✅ Fixed in `b19a691`; independently verified at `9b19065` |
| N-01 | P3 / low, nonblocking | The claim that failed refreshes retain good figures is broader than the implemented exceptional-throw fallback | ✅ Fixed in `068bc16`; independently verified at `9b19065` |

## ✅ Fixed - F-01: clear account A's figures when account B becomes active

**Location:** `src/application/handlers/domain/AccountBalanceHandler.ts:40–42`.

`handleApiKeyChanged()` invalidates the host cache and then awaits a fresh fetch before posting anything to the webview. The existing `useOpenRouterBalance` state is not reset by `API_KEY_STATUS`, and an unsolicited key-change fetch does not set its loading state. Consequently, after saving B's key, A's monetary figures remain presented as the current account balance until B's `/key` and `/credits` requests settle. A slow request can leave the wrong account's balance visible for the client's eight-second timeout window.

This is the remaining part of C4, which the prior ledger marks fixed. The cache and in-flight generation protection correctly prevent A's results from being stored as B's result, but they do not remove A's already displayed figures when ownership changes.

**Independent reproduction:** `pr-13-key-replacement-repro.cjs` (deleted in `b19a691`; replaced by `src/__tests__/presentation/webview/hooks/domain/balanceKeyChange.test.tsx`). From the repository root after installing dependencies, at the reviewed head:

```sh
node docs/pr-reviews/witnesses/pr-13-key-replacement-repro.cjs
```

The witness loads the actual `OpenRouterAccountClient`, `AccountBalanceService`, `AccountBalanceHandler`, and `useOpenRouterBalance`. It uses Testing Library/jsdom, mocked fetch/secret storage/VS Code messaging, and no provider calls or real credentials.

1. Load A with a $75 balance. The hook finishes loading.
2. Replace the stored key with B and hold B's credits response pending.
3. The host cache is empty, but the hook still contains A's $75 and `isLoading === false`; no replacement/reset message has been sent.
4. Resolve B's response with $1. Only then does the hook switch to $1.

**Requested correction:** signal the ownership change to the webview immediately and clear the old account figures before waiting for B's network response. Keep this distinct from a same-account refresh, where retaining previous figures can be appropriate. Preserve request/epoch ordering so a delayed A response cannot restore A's figures after the reset. Add a regression that holds the replacement fetch unresolved and asserts that A's figures are already gone, then confirms B's response appears. The committed witness asserts the observed defect and should be replaced by the expected-behavior regression when fixed.

## ✅ Fixed - N-01: narrow the failed-refresh retention claim (resolved by retaining, not narrowing)

The PR description says “a failed refresh keeps the last good figures.” The R3 fix preserves the service cache when `getBalance()` rejects. However, the real account client converts ordinary network, HTTP and malformed-response failures into resolved `unavailable` results. `AccountBalanceService` then caches a new payload without the previous figures, and the hook accepts its newer `fetchedAt`.

An independent probe using the actual client/service confirms that a successful $75 read followed by rejected network fetches yields `status: 'unavailable'` with no credits. The checked-in R3 integration test instead mocks a client method that rejects. This distinction is not a new regression against #12, so it is nonblocking. Either describe the implemented guarantee as exceptional-load-failure retention, or separately cover ordinary transport failures while ensuring stale figures are clearly marked and never carried across a key change.

## Review coverage

- Reconciled the author-side PR #12 ledger and R4 follow-ups before reviewing. This report does not reopen the explicitly planned picker, request-ownership, transport or SVG-safety phases.
- Account slice: discriminated `/key` and `/credits` results, key/credits partial success, short failure cache TTL, in-flight deduplication, forced-refresh handling, stale-key generation protection, terminal-response refresh scheduling and disposal, formatting, zero-cap behavior, and hook correlation ordering.
- Models/settings: removed chat-incompatible entries, image-only modality dispatch, catalog-wide regression coverage, delisted selections, global/workspace migration and clearing values that would otherwise pin today's default. Live provider availability and paid generations were not independently rerun.
- Webview: overlay stacking and paint order, focus trap/return, inert background, Settings integration, tab keyboard/ARIA handling, reduced motion, shared layout styles, and HTML bootstrap globals/CSP. Inspected the committed 320 px conversation and 480 px Settings comparison images as author-supplied visual evidence.
- Test infrastructure: JSX/jsdom support and the webview/test TypeScript configurations.

## Initial independent validation at `e946faa`

| Check | Result at reviewed code head |
| --- | --- |
| `npm test -- --runInBand` | **30 suites / 341 tests passed** |
| `tsc --noEmit -p tsconfig.json` | Passed |
| `tsc --noEmit -p tsconfig.webview.json` | Passed |
| `tsc --noEmit -p tsconfig.test.json` | Passed |
| `npm run build` | Passed; three webpack size/performance warnings |
| `npm run lint` | **Failed: 11 errors / 22 warnings**, same diagnostics as stack base `57bab838` apart from moved line numbers |
| F-01 independent integration witness | Observed wrong-account display reproduced, including hook state |
| Fresh browser-rendered smoke check | **Not run successfully.** Chromium could not launch because this executor refused its process socket; no fresh visual pass is claimed |
| Remote CI | No commit status entries or PR-triggered workflow runs returned for `e946faa`; remote CI is **not claimed green** |

Focused checks of eight account/settings suites (106 tests) and four overlay/motion/tab/HTML suites (23 tests) also passed; these overlap the full suite and are not additional test totals.

## Remaining boundaries

- The installed-VSIX 360 px Dark, Light and High Contrast acceptance pass remains owed, as already recorded by the author.
- Picker internals/pricing, request ownership, generated SVG DOM isolation and dedicated Image API transport remain in their documented later phases. Passing this scoped review will not imply those risks are resolved.
- The reviewer made no production code changes, provider charges, merge, auto-merge or deployment. The initial publication added this report and an executable defect witness; the author replaced that witness with expected-behavior tests while fixing the code. This final review publication changes only the report.

## Resolution status

Follow-up commits on `claude/pixel-minion-design-review-dhbqpd`. Validation after the fixes: `npx jest` 31 suites / 370 tests (was 30 / 341); `tsc --noEmit` clean for `tsconfig.json`, `tsconfig.webview.json` and `tsconfig.test.json`; `npm run build` passes with the same three webpack size warnings; `npm run lint` unchanged at 11 errors / 22 warnings (all pre-existing, none in changed code).

- **F-01 ✅ `b19a691`.** Ownership travels with the data instead of relying on arrival order.
  - `OpenRouterBalancePayload.accountEpoch` (required) is the service's key-generation counter, stamped when the fetch starts (`AccountBalanceService.accountEpoch()`).
  - `AccountBalanceHandler.handleApiKeyChanged()` invalidates, then posts `OPENROUTER_BALANCE_RESET { accountEpoch }` synchronously, before the new key's fetch. `useOpenRouterBalance.handleBalanceReset` sets `balance` to `null` (the header's existing "…" loading state) and `isLoading` until a payload for that epoch arrives.
  - The hook ignores payloads from an older epoch, so a delayed A reply can't restore A's figures. It still settles the request such a reply answers, so the spinner can't stick. A newer epoch replaces figures regardless of `fetchedAt`; within one epoch the newest-wins rule is unchanged, so same-account refreshes keep their figures.
  - The handler's thrown-load fallback is stamped with the epoch read *before* the load, so a request for A that fails after the switch is discarded instead of showing "unavailable" for B.
  - **Regression:** `balanceKeyChange.test.tsx` drives the real `OpenRouterAccountClient`, `AccountBalanceService` and `AccountBalanceHandler` into the real hook (fetch and secret storage stubbed). It holds B's `/credits` reply, asserts A's $75 is gone and `isLoading` is true before B settles, then that B's $1 appears; that A's real reply delivered after the reset (before and after B lands) is ignored; and that a failed-A fallback after the switch is ignored. The first three cases fail with the reset post removed. Unit cases in `useOpenRouterBalance.test.tsx`, `AccountBalanceHandler.test.ts`, `AccountBalanceService.test.ts` and `MessageHandler.test.ts` pin the ordering and epoch rules.
  - The witness, which asserted the defect, is deleted.
- **N-01 ✅ `068bc16`.** Chose retention over narrowing the claim: the change stayed inside the service plus a small UI marker.
  - `AccountBalanceService` remembers each figure's last good read for the current key. When a refresh can't read a figure for a transient reason (`network`, `rate_limited`, `server_error`, `malformed`, `http_error`), it carries that figure over and sets `stale: { figuresFetchedAt, issue }`. Only the failed figure is carried; the original read time survives repeated failures; success clears the marker.
  - `invalid_key` (401) and `forbidden` (403) forget the figure instead (an answer, not a glitch), and a later glitch can't resurrect it. `invalidate()` and a `no_key` result clear the memory, so stale figures never cross a key change. The payload keeps its issues, so the 15 s failed-result TTL still retries soon.
  - UI: the amount is muted (`is-stale`; a zero balance keeps its warning colour), the card says "Showing last known figures: <why>.", the meta row reads "Updated <read time> · last known · couldn't refresh", and the pill tooltip gives the reason.
  - Tests cover each transient kind, per-figure carry, repeated failures, 401/403, key change and key cleared, the rendered marker, and a real-client integration case where `fetch` rejects (not a mocked client method that throws).
  - **Partial-failure scope.** When one call succeeds and the other fails transiently, the fresh figure is shown and the failed one is carried. When the failure is a 401/403, the existing "unavailable" copy is unchanged.
- **Docs.** `CHANGELOG.md` and `docs/CHANGELOG-DETAILED.md` describe both behaviors. The PR #12 ledger's C4 and R3 rows now point at these commits and say what `d513145` covered. The CLAUDE.md / AGENTS.md "Balance ownership" invariant records the epoch and stale rules.
- **Not changed:** the PR #13 description still says "a failed refresh keeps the last good figures"; after `068bc16` that is accurate for both thrown and transport failures.


## Independent re-review at `9b19065`

The author-side resolution notes above were checked against the actual source and rerun locally.

- **F-01 closed.** The handler posts `OPENROUTER_BALANCE_RESET` synchronously after invalidation and before fetching. App routes it to the hook, which immediately clears the displayed balance and waits for the new account. Data and exceptional fallbacks carry epochs; older epochs cannot restore old figures. Same-account refresh behavior remains separate.
- **N-01 closed.** Real-client network failures now retain only this account's last good figures with the explicit stale marker and original read time. The service clears remembered values at invalidation/no-key and forgets an individual figure after a 401/403. Successful fresh reads remove staleness.
- **Additional independent race probe:** start A at $75, switch to B with its response held, then to C with its response held. Both resets immediately remove the previous figures. Complete C at $2 before releasing B at $999; C remains displayed. A late A payload and late B reset do not restore older ownership, loading settles, and a subsequent C network failure retains only C's $2 marked stale. This probe used the real client/service/handler/hook, mocked fetch and secret storage, and no external requests. It passed; the temporary probe was removed afterward.
- **Full checks:** 31 Jest suites / 370 tests passed; `tsc --noEmit` passed for `tsconfig.json`, `tsconfig.webview.json`, and `tsconfig.test.json`; production build passed with the same three webpack size/performance warnings. Eight focused balance suites / 118 tests also passed and overlap the full suite. The additional race probe is one extra case, not five additional cases (its test run also repeated four existing cases).
- **Lint:** rerun on both the final code head and stack base `57bab838`; 11 errors / 22 warnings remain, with the same diagnostic messages apart from moved line numbers.
- **CI:** the GitHub connector returned no statuses and no PR-triggered workflow runs for `9b19065`. This is an absence of reported CI, not a passing CI result.
- **Limits unchanged:** no independent installed-VSIX or fresh browser-rendered acceptance pass, live provider probe or paid generation. The prior blocked Chromium launch is not treated as successful validation. The later picker, request-ownership and SVG-safety work is outside this verdict.
