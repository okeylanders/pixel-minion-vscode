# Feature-011: Branch from Image in Thread

**Status:** Planned
**Planned Version:** TBD
**Priority:** Medium
**Created:** 2025-11-30

## Summary

Create a new thread branch from any image in the current conversation.

## Description

Allow users to select an image from the thread and start a fresh generation using it as a reference, while preserving the original thread.

## Workflow

1. User clicks "Branch" on an image in thread
2. Image is loaded as reference image
3. Original thread is visually dimmed/collapsed
4. Original prompt from that turn is restored
5. User can modify prompt and generate fresh

## Requirements

- [ ] Add "Branch" button to thread images
- [ ] Implement branch state management
- [ ] Load selected image as reference
- [ ] Restore original prompt to input
- [ ] Visual indicator for branched state
- [ ] Option to return to original thread

## UI Changes

- Add branch action button on thread images
- Visual treatment for branched/dimmed thread
- Branch indicator in header
