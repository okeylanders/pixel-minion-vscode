# Feature-006: AI Inpainting

**Status:** Planned
**Planned Version:** TBD
**Priority:** High
**Created:** 2025-11-30

## Summary

Add AI-powered inpainting capability for editing specific regions of images.

## Description

Allow users to select regions of an image and use AI to regenerate or modify those specific areas while preserving the rest.

## Requirements

- [ ] Research inpainting API support (OpenRouter models)
- [ ] Add region selection UI (brush/mask tool)
- [ ] Create mask from selection
- [ ] Send image + mask + prompt to inpainting model
- [ ] Display and save result

## UI Changes

- Add inpainting mode toggle
- Add brush size selector
- Add mask overlay visualization
- Add "Inpaint Selected Area" button

## Technical Considerations

- Mask format requirements for API
- Image format compatibility
- Canvas-based selection tool in webview
