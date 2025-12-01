# Tech Debt

Track technical debt items here.

## Purpose

This is a place to document known technical issues that need future attention but aren't blocking current work.

## Format

Create individual markdown files for each debt item: `debt-XXX-description.md`

## Current Items

### Medium Priority

| ID | Description | Location |
|----|-------------|----------|
| 001 | SVG extraction fallback returns raw content | SVGOrchestrator.ts |
| 002 | Image client silently skips malformed images | OpenRouterImageClient.ts |
| 003 | No conversation cleanup (memory leak) | ConversationManagers |
| 004 | TextOrchestrator returns fake response for max turns | TextOrchestrator.ts |
| 005 | No abort/cancellation for long operations | AI clients |
| 006 | SVG concurrent requests may race on model | SVGOrchestrator.ts |
| 007 | No MIME type validation for images | ImageGenerationHandler.ts |

### Low Priority

| ID | Description | Location |
|----|-------------|----------|
| 008 | Text client created on every enhance request | EnhanceHandler.ts |
| 009 | Inconsistent error logging | Various handlers |
| 010 | Default model hardcoded in multiple places | Multiple files |
| 011 | TokenUsage interface in TextClient, not shared | TextClient.ts |
| 012 | TextClient vs DynamicTextClient duplication | AI clients |
