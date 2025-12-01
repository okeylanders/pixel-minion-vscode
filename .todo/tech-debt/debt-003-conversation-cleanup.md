# Debt-003: No Conversation Cleanup (Memory Leak Potential)

**Priority:** Medium
**Source:** v1.0 Code Review
**Date:** 2025-11-30

## Location

- `ImageConversationManager.ts`
- `SVGConversationManager.ts`
- `TextConversationManager.ts`

## Issue

Conversations stored in `Map` with no expiration. Old conversations persist indefinitely, including base64 image data.

## Fix

Implement cleanup policy:

- Clear on extension reload
- Or add TTL (e.g., 1 hour of inactivity)
- Or limit to N most recent conversations
