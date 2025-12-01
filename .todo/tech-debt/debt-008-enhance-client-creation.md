# Debt-008: Text Client Created on Every Enhance Request

**Priority:** Low
**Source:** v1.0 Code Review
**Date:** 2025-11-30

## Location

`src/application/handlers/domain/EnhanceHandler.ts:78`

## Issue

Text client is created on every enhance request instead of being injected.

## Fix

Create client once in MessageHandler and inject for consistency with other handlers.
