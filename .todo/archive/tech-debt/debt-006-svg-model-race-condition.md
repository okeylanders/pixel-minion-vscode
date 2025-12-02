# Debt-006: SVG Concurrent Requests May Race on Model

**Priority:** Medium
**Source:** v1.0 Code Review
**Date:** 2025-11-30
**Status:** ✅ RESOLVED (2025-12-01)
**Resolution:** [EPIC: SVG-ARCHITECT] Sprint 1

## Location

`src/infrastructure/ai/orchestration/SVGOrchestrator.ts:88`

## Issue

`setModel()` sets shared state on client. If two concurrent SVG requests use different models, they may race.

## Fix

Pass model to `createCompletion()` directly instead of relying on shared `setModel()` state.
