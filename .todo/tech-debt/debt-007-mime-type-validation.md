# Debt-007: No MIME Type Validation for Images

**Priority:** Medium
**Source:** v1.0 Code Review
**Date:** 2025-11-30

## Location

`src/application/handlers/domain/ImageGenerationHandler.ts:273-278`

## Issue

Regex allows any `\w+` for image type. Could match invalid MIME types.

## Fix

Validate against known types: `png`, `jpeg`, `webp`, `gif`.
