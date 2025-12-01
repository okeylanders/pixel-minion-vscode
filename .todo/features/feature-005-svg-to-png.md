# Feature-005: Convert SVG to PNG (Non-AI)

**Status:** Planned
**Planned Version:** TBD
**Priority:** Low
**Created:** 2025-11-30

## Summary

Add non-AI utility to convert SVG to PNG format.

## Description

Provide a simple conversion tool to export SVG code as a PNG image file.

## Requirements

- [ ] Add "Export as PNG" button to SVG results
- [ ] Implement SVG to PNG conversion (canvas-based or library)
- [ ] Allow resolution selection for export
- [ ] Save PNG to workspace

## Technical Approach

Options:
1. Use HTML Canvas to render SVG and export as PNG
2. Use a library like `sharp` or `svg2png`
3. Use browser APIs in webview

## Notes

This is a non-AI utility feature - pure client-side conversion.
