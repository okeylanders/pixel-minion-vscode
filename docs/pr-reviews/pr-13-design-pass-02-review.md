# PR #13 review: design pass 02

**Reviewed:** 2026-11-07  
**PR:** https://github.com/okeylanders/pixel-minion-vscode/pull/13  
**Code head:** `e946faae8e4a074e7a62ab1166afeca8e024fbf3`  
**Stack base:** `57bab8382dad17a32a02bb18cdd23dcb8b8f38c3` (`claude/design-overhaul-review-m5ojwb`, draft PR #12)

**Verdict: changes requested for F-01.** One remaining account-switch correctness gap in the C4 fix. The rest of the scoped code review found no further blocking defects. This is a review of the stacked fix-up, not approval to release the entire stack or merge #12.

## Status by item

| ID | Priority | Finding | Status |
| --- | --- | --- | --- |
| F-01 | P2 / medium | Replacing the API key leaves the previous account's figures visible until the new account fetch completes | ⏳ Open |
| N-01 | P3 / low, nonblocking | The claim that failed refreshes retain good figures is broader than the implemented exceptional-throw fallback | ⏳ Open: clarify the claim or track the remaining behavior |

## F-01: clear account A's figures when account B becomes active

**Location:** `src/application/handlers/domain/AccountBalanceHandler.ts:40–42`.

`handleApiKeyChanged()` invalidates the host cache and then awaits a fresh fetch before posting anything to the webview. The existing `useOpenRouterBalance` state is not reset by `API_KEY_STATUS`, and an unsolicited key-change fetch does not set its loading state. Consequently, after saving B's key, A's monetary figures remain presented as the current account balance until B's `/key` and `/credits` requests settle. A slow request can leave the wrong account's balance visible for the client's eight-second timeout window.

This is the remaining part of C4, which the prior ledger marks fixed. The cache and in-flight generation protection correctly prevent A's results from being stored as B's result, but they do not remove A's already displayed figures when ownership changes.

**Independent reproduction:** [pr-13-key-replacement-repro.cjs](witnesses/pr-13-key-replacement-repro.cjs). From the repository root after installing dependencies:

```sh
node docs/pr-reviews/witnesses/pr-13-key-replacement-repro.cjs
```

The witness loads the actual `OpenRouterAccountClient`, `AccountBalanceService`, `AccountBalanceHandler`, and `useOpenRouterBalance`. It uses Testing Library/jsdom, mocked fetch/secret storage/VS Code messaging, and no provider calls or real credentials.

1. Load A with a $75 balance. The hook finishes loading.
2. Replace the stored key with B and hold B's credits response pending.
3. The host cache is empty, but the hook still contains A's $75 and `isLoading === false`; no replacement/reset message has been sent.
4. Resolve B's response with $1. Only then does the hook switch to $1.

**Requested correction:** signal the ownership change to the webview immediately and clear the old account figures before waiting for B's network response. Keep this distinct from a same-account refresh, where retaining previous figures can be appropriate. Preserve request/epoch ordering so a delayed A response cannot restore A's figures after the reset. Add a regression that holds the replacement fetch unresolved and asserts that A's figures are already gone, then confirms B's response appears. The committed witness asserts the observed defect and should be replaced by the expected-behavior regression when fixed.

## N-01: narrow the failed-refresh retention claim

The PR description says “a failed refresh keeps the last good figures.” The R3 fix preserves the service cache when `getBalance()` rejects. However, the real account client converts ordinary network, HTTP and malformed-response failures into resolved `unavailable` results. `AccountBalanceService` then caches a new payload without the previous figures, and the hook accepts its newer `fetchedAt`.

An independent probe using the actual client/service confirms that a successful $75 read followed by rejected network fetches yields `status: 'unavailable'` with no credits. The checked-in R3 integration test instead mocks a client method that rejects. This distinction is not a new regression against #12, so it is nonblocking. Either describe the implemented guarantee as exceptional-load-failure retention, or separately cover ordinary transport failures while ensuring stale figures are clearly marked and never carried across a key change.

## Review coverage

- Reconciled the author-side PR #12 ledger and R4 follow-ups before reviewing. This report does not reopen the explicitly planned picker, request-ownership, transport or SVG-safety phases.
- Account slice: discriminated `/key` and `/credits` results, key/credits partial success, short failure cache TTL, in-flight deduplication, forced-refresh handling, stale-key generation protection, terminal-response refresh scheduling and disposal, formatting, zero-cap behavior, and hook correlation ordering.
- Models/settings: removed chat-incompatible entries, image-only modality dispatch, catalog-wide regression coverage, delisted selections, global/workspace migration and clearing values that would otherwise pin today's default. Live provider availability and paid generations were not independently rerun.
- Webview: overlay stacking and paint order, focus trap/return, inert background, Settings integration, tab keyboard/ARIA handling, reduced motion, shared layout styles, and HTML bootstrap globals/CSP. Inspected the committed 320 px conversation and 480 px Settings comparison images as author-supplied visual evidence.
- Test infrastructure: JSX/jsdom support and the webview/test TypeScript configurations.

## Independent validation

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
- No production code changes, provider charges, merge, auto-merge or deployment were performed. Publication adds only this report and its executable review witness.
