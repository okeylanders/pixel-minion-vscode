# Feature-008: Prompt Library

**Status:** Deferred
**Planned Version:** TBD
**Priority:** Medium
**Created:** 2025-11-30

## Summary

Save and reuse prompts for Image and SVG generation.

## Description

Allow users to save successful prompts to a library for reuse, organization, and sharing.

## Requirements

- [ ] Add "Save Prompt" button to generation results
- [ ] Create prompt library storage (workspace or global)
- [ ] Add prompt library browser UI
- [ ] Allow categorization/tagging of prompts
- [ ] Quick-insert saved prompts into input
- [ ] Import/export prompt collections

## Storage Options

1. Workspace `.vscode/pixel-minion-prompts.json`
2. VS Code globalState
3. Separate prompts file in workspace

## UI Changes

- Add prompt library panel or modal
- Add save/favorite button on results
- Add prompt selector in input area
