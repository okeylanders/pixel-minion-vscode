# Debt-004: TextOrchestrator Returns Fake Response for Max Turns

**Priority:** Medium
**Source:** v1.0 Code Review
**Date:** 2025-11-30

## Location

`src/infrastructure/ai/orchestration/TextOrchestrator.ts:91-97`

## Issue

When max turns reached, returns a synthetic response string instead of throwing. Users may think the AI is telling them to start a new conversation.

## Fix

Throw an error and let handler send proper ERROR message type.
