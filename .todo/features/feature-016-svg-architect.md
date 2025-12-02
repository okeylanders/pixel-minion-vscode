# Feature-016: SVG Architect (High Quality Mode)

**Status:** Planned
**Planned Version:** v1.2
**Priority:** High
**Created:** 2025-12-01

## Summary

Multi-agent SVG generation pipeline with iterative refinement for higher quality output.

## Description

Separates "what to render" (Blueprint Agent) from "how to render" (Rendering LLM), with a visual feedback loop for iterative improvement. Uses browser canvas to render SVG to PNG for comparison against original input.

## Key Features

- Blueprint Agent analyzes input and creates semantic SVG structure
- Rendering LLM converts blueprint to actual SVG code
- Validation loop compares rendered output to original
- User can provide notes to guide iterations
- Confidence scoring for quality assessment

## Use Cases

1. **PNG to SVG** - Convert raster images to vector with high fidelity
2. **Text to SVG** - Enhanced text-to-SVG with iterative refinement
3. **SVG to SVG** - Modify existing SVGs with precise control

## Implementation Plan

See: [docs/plans/svg-architect-implementation-plan.md](../../docs/plans/svg-architect-implementation-plan.md)

## UI Changes

- Toggle: "Experimental: High quality mode"
- Output sub-tabs: `[SVG] [Dashboard] [Conversation]`
- Dashboard view: Static agent status boxes
- Conversation view: Scrolling iteration history

## New Settings

- `pixelMinion.svgBlueprintModel` - Model for Blueprint Agent
- `pixelMinion.svgArchitectMaxIterations` - Max refinement iterations (default: 5)
- `pixelMinion.svgArchitectEnabled` - Enable high quality mode (default: false)
