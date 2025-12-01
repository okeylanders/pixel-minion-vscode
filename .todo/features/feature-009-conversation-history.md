# Feature-009: Conversation History Access

**Status:** Planned
**Planned Version:** TBD
**Priority:** Medium
**Created:** 2025-11-30

## Summary

Access and restore prior conversation threads.

## Description

Allow users to browse past conversation history and restore previous threads to continue working on them.

## Requirements

- [ ] Persist conversation history to storage
- [ ] Add history browser UI
- [ ] Display conversation previews (first prompt, thumbnail)
- [ ] Allow restoring a past conversation
- [ ] Allow deleting old conversations
- [ ] Consider storage limits

## Storage Considerations

- Where to store (workspace vs global)
- What to store (prompts, outputs, settings)
- Size limits for image data
- Cleanup policy for old conversations

## UI Changes

- Add history button/panel
- Show conversation list with previews
- Restore and delete actions
