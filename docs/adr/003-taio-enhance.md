# ADR-003: Text Assistant for Prompt Enhancement

**Status**: Accepted
**Date**: 2025-11-29
**Context Owner**: Pixel Minion

## Context

- Pixel Minion adds an "Enhance" action for image/SVG prompts, powered by the Text AI Orchestrator (TAIO).
- There is no user-facing text chat UI. The text suite is infrastructure-only.
- Model selection flows via `pixelMinion.openRouterModel` and resets the text client on change.

## Decision

- Reuse existing text handler/orchestrator for prompt enhancement requests.
- Send `ENHANCE_PROMPT_REQUEST` with prompt text and optional `systemPrompt` tuned for "enhance this prompt".
- Return enhanced prompt to the invoking tab (image/SVG) and update the prompt input.

## Consequences
- Minimal UI surface change (button only), but the text suite becomes part of the user flow.
- Model changes are picked up automatically on the next request (text client resets on settings change).
