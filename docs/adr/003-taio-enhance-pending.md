# ADR-003: Pending - Text Assistant for Prompt Enhancement

**Status**: Proposed / Pending  
**Date**: 2025-11-29  
**Context Owner**: Pixel Minion

## Context
- Pixel Minion will add a “Enhance” action for image/SVG prompts, powered by the Text AI Orchestrator (TAIO).
- There will be no user-facing text chat UI initially. The text suite is infrastructure-only.
- Resilience is required: extension restarts should not lose the enhancement thread if history is available.
- Model selection now flows via `pixelMinion.openRouterModel` and resets the text client on change.

## Decision (pending)
- Reuse existing text handler/orchestrator for prompt enhancement requests.
- Send `AI_CONVERSATION_REQUEST` with `conversationId` + `history` (user/assistant turns) + optional `systemPrompt` tuned for “enhance this prompt”.
- Persist hidden text history alongside image/SVG state so rehydration works after restart.
- Return enhanced prompt to the invoking tab (image/SVG) and update the prompt input.

## Consequences
- Minimal UI surface change (button only), but the text suite becomes part of the user flow.
- Requires wiring the webview to send text history (not currently implemented).
- Model changes are picked up automatically on the next request (text client resets on settings change).
