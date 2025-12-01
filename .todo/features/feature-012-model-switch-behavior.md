# Feature-012: Model Switch Midstream Behavior

**Status:** Deferred
**Planned Version:** v1.1
**Priority:** Low
**Created:** 2025-11-30

## Summary

Define behavior when user changes model during an active conversation.

## Description

Currently, model and aspect ratio are sticky per conversation. This feature would allow users to switch models mid-conversation with clear behavior.

## Options to Consider

1. **Sticky (Current)** - Model stays fixed for the conversation
2. **Adopt New** - Next turn uses new model, history included
3. **Fork** - Create new conversation with new model
4. **Prompt User** - Ask what to do when model changes

## Requirements

- [ ] Define desired behavior
- [ ] Update orchestrators to support model changes
- [ ] Update UI to reflect model per conversation
- [ ] Handle context compatibility between models

## Considerations

- Some models may not understand context from different models
- Image references may work differently across models
- User expectations for continuity
