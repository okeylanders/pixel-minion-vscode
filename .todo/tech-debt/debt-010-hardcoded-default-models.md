# Debt-010: Default Model Hardcoded in Multiple Places

**Priority:** Low
**Source:** v1.0 Code Review
**Date:** 2025-11-30

## Location

- `OpenRouterTextClient.ts`
- `OpenRouterDynamicTextClient.ts`
- `EnhanceHandler.ts`

## Issue

Model defaults are hardcoded in multiple places. If the default model needs to change, multiple files need updating.

## Fix

Centralize default model configuration in a single location (e.g., constants file or provider config).
