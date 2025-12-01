# Feature-001: System Prompt Management via PromptLoader

**Status:** Deferred
**Planned Version:** v1.1
**Priority:** Medium
**Created:** 2025-11-30

## Summary

Better system prompt management via PromptLoader that reads system prompts from resources.

## Description

Create a PromptLoader service that reads system prompts from `resources/system-prompts/` organized by category:

- `image/` - Image generation prompts
- `svg/` - SVG generation prompts
- `enhance-image/` - Image prompt enhancement
- `enhance-svg/` - SVG prompt enhancement
- `describe-image/` - Image description prompts
- `describe-svg/` - SVG description prompts

## Requirements

- [ ] Create PromptLoader service
- [ ] Organize prompts in resources folder
- [ ] Load prompts at activation
- [ ] Consider exposing prompts for user editing

## Notes

This would allow users to customize system prompts without modifying code.
