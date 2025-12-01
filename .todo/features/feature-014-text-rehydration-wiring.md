# Feature-014: Text Rehydration Webview Wiring

**Status:** In Progress
**Planned Version:** v1.0.x
**Priority:** Medium
**Created:** 2025-11-30
**Progress:** 50%

## Summary

Complete the webview wiring for text conversation rehydration.

## Description

The text rehydration infrastructure is ready in the backend, but the webview needs to be wired to send history with requests (similar to Image/SVG tabs).

## Current State

- Infrastructure layer supports rehydration
- Orchestrator can rebuild from history
- Webview does not yet send history with enhance requests

## Requirements

- [ ] Update Enhance flow to send conversation history
- [ ] Store enhance conversation state in webview
- [ ] Include history in ENHANCE_PROMPT_REQUEST messages
- [ ] Test rehydration after extension restart

## Notes

This will enable the Enhance Prompt feature to maintain context across extension restarts.
