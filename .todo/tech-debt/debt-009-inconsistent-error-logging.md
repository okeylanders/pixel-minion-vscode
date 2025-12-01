# Debt-009: Inconsistent Error Logging

**Priority:** Low
**Source:** v1.0 Code Review
**Date:** 2025-11-30

## Issue

Various handlers log errors differently. Some log just the message, others log partial error objects.

## Fix

Standardize on full error object for stack traces across all handlers.
