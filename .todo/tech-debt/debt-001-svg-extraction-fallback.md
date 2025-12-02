# Debt-001: SVG Extraction Fallback Returns Raw Content

**Priority:** Medium
**Source:** v1.0 Code Review
**Date:** 2025-11-30
**Status:** ✅ RESOLVED (2025-12-01)
**Resolution:** [EPIC: SVG-ARCHITECT] Sprint 2

## Location

`src/infrastructure/ai/orchestration/SVGOrchestrator.ts:194`

## Issue

`extractSVG()` returns content as-is if no SVG tags found. Could return error messages or explanations that get displayed as "SVG code".

## Fix

Throw an error instead of returning raw content:

```typescript
throw new Error('No valid SVG code found in response');
```
