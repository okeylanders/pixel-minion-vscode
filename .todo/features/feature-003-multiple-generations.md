# Feature-003: Multiple Generations Per Turn

**Status:** Planned
**Planned Version:** TBD
**Priority:** Medium
**Created:** 2025-11-30

## Summary

Allow users to generate multiple images/SVGs per turn (1-4) with random seeds.

## Description

Add an option to generate multiple outputs in a single generation request. Each generation would use a random seed for variety.

## Requirements

- [ ] Add generation count selector (1-4) to Image tab
- [ ] Add generation count selector (1-4) to SVG tab
- [ ] Store preference in VS Code settings for persistence
- [ ] Generate multiple outputs with different random seeds
- [ ] Display all generated outputs in the thread
- [ ] Update save functionality for multiple outputs

## UI Changes

Add a number selector or dropdown near the Generate button.

## Notes

This may require API support for batch generation or multiple sequential calls.
