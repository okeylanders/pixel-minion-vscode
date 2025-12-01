# Feature: Image/SVG Rehydration

**Status:** Completed
**Released:** v1.0.0
**Completed:** 2025-11-30

## Summary

Image and SVG conversation rehydration after extension restart.

## Description

Implemented rehydration pattern so conversations can continue after extension restart without losing context.

## What Was Done

- Webview persists conversation state via vscode.setState()
- Continuation requests include history for rehydration
- Orchestrators rebuild conversation from history if needed
- Model and aspect ratio sticky per conversation

## Technical Details

- Two-store pattern: presentation (persistent) + infrastructure (ephemeral)
- Self-contained requests enable automatic rehydration
- Handler detects missing conversation and rebuilds from history
