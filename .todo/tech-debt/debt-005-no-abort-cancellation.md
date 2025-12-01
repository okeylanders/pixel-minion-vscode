# Debt-005: No Abort/Cancellation for Long Operations

**Priority:** Medium
**Source:** v1.0 Code Review
**Date:** 2025-11-30

## Location

AI clients:

- `OpenRouterTextClient.ts`
- `OpenRouterDynamicTextClient.ts`
- `OpenRouterImageClient.ts`

## Issue

Clients accept `signal` option but handlers don't pass AbortController. Long-running requests can't be cancelled.

## Fix

Add timeout/cancellation support in handlers, pass AbortController to clients.
