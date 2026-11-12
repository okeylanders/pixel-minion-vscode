# PR #20: Results-pane thread navigation review

## Verdict

**Scoped technical approval. No blocking findings.** Reviewed code head `768be804bdaa1b6b7599bfbde467e7dd0fab469c` against `da2d07f8e819ba49eb68a35154b3ff5378069a92` on 2026-11-12. This approval covers the navigation/state delta, not native VS Code or live-provider acceptance.

## Status ledger

| Item | Status | Result |
| --- | --- | --- |
| Thread selection and ownership | ✅ Verified at 768be80 | Browsing is local presentation state; it does not continue, archive, or release the active conversation. |
| Current draft and stale submission | ✅ Verified at 768be80 | Composer stays mounted while hidden, retains the draft, and refuses a stale Enter event while browsing an archive. |
| Generate and failure recovery | ✅ Verified at 768be80 | Pending generation selects the current result and locks navigation; failure restores the live thread without releasing it. |
| Delete and start-from-image transitions | ✅ Verified at 768be80 | Neighbor selection, focus placement, and host release target remain correct. |
| Native VS Code, visual/accessibility acceptance and live generation | ↪ Deferred (not exercised in this review) | DOM-level focus/labels/hidden behavior were tested; no fresh browser rendering, screen-reader, VSIX, or paid-provider run was performed. |

## Independent verification

- Full checked-in Jest suite: **63 suites / 1,272 tests passed**.
- Extension, webview, and test TypeScript configurations: **all passed** (`tsc --noEmit`).
- Production build: **passed**, with existing bundle-size warnings.
- Full lint: **9 errors / 20 warnings**, reproduced at the exact base commit. Both changed production TSX files passed focused lint.
- Additional temporary real-hook UI probes passed: clearing current exposes newest archive and releases only current; deleting an old/interior archive selects the newer neighbor while preserving the hidden live draft; starting from a browsed archive preserves that archive, archives/releases only the live thread, and focuses the prompt. Scratch probes were removed before publication.
- Exact-code-head GitHub combined statuses and pull-request workflow queries returned no entries. This is not a remote-CI pass claim.

## Scope and reasoning

Inspected the full diff, the shared composer and conversation renderer, the thread-navigation integration tests, and the persistence round-trip adaptations. Navigation derives the visible turns and settings together, so the archive's model/mode metadata follows its images. During an in-flight generation the current result wins over any selected archive. Saving/deleting uses the visible image/thread rather than the live conversation by accident. The shared composer's new hidden flag defaults false, preserving SVG callers.

No merge, auto-merge, or provider request was performed. The GitHub review is submitted as COMMENT with this technical verdict because the connected account is also the PR author.
