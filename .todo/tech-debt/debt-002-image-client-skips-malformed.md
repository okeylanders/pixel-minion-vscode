# Debt-002: Image Client Silently Skips Malformed Images

**Priority:** Medium
**Source:** v1.0 Code Review
**Date:** 2025-11-30

## Location

`src/infrastructure/ai/clients/OpenRouterImageClient.ts:84-101`

## Issue

If OpenRouter returns images with missing URLs or invalid data URLs, they're skipped with just a warning. Users see fewer images than expected with no explanation.

## Fix

Either throw if any image is malformed, or send a warning to the webview so users understand why they got fewer images.
