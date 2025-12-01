# Feature: Token Cost Widget

**Status:** Completed
**Released:** v1.0.0
**Completed:** 2025-11-30

## Summary

Token cost widget in the main view consuming TOKEN_USAGE updates.

## Description

Added per-turn token usage and cost display to show users the cost of each generation.

## What Was Done

- Display token counts per generation turn
- Display cost in USD per turn
- Consume TOKEN_USAGE_UPDATE messages from backend
- Show in both Image and SVG tabs
