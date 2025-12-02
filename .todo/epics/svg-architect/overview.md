# Epic: SVG Architect

**Target Version:** v1.2
**Created:** 2025-12-01
**Status:** Planning

## Summary

Multi-agent SVG generation pipeline with iterative refinement for higher quality output. Separates "what to render" (Blueprint Agent) from "how to render" (Rendering LLM), with visual feedback loop for iterative improvement.

## Goals

1. **High-Quality SVG Generation** - Achieve significantly better PNG-to-SVG conversion fidelity through iterative refinement
2. **Multi-Agent Architecture** - Blueprint Agent analyzes/plans, Rendering LLM executes
3. **Visual Validation Loop** - Browser canvas renders SVG to PNG for comparison against original
4. **User Control** - Confidence scoring, user notes for resumption, max iteration limits
5. **Non-Disruptive** - Toggle-based opt-in, preserves existing zero-shot SVG flow

## Related Documents

- **Implementation Plan:** [docs/plans/svg-architect-implementation-plan.md](../../../docs/plans/svg-architect-implementation-plan.md)
- **Feature Spec:** [.todo/features/feature-016-svg-architect.md](../../features/feature-016-svg-architect.md)

## Pre-requisites (Phase 0)

Before implementing SVG Architect, three foundational items must be addressed:

| Item | Why Required |
|------|--------------|
| Debt-006: Model Race Condition | SVG Architect uses two concurrent clients (Blueprint + Render) which would both hit the `setModel()` race condition |
| Debt-001: SVG Extraction Fallback | Rendering LLM output must be reliably extracted; silent fallback to raw content would break validation loop |
| Feature-001: PromptLoader | SVG Architect introduces 3 new complex prompts; centralized prompt management prevents scattered string literals |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SVG Architect Pipeline                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INPUT                    BLUEPRINT AGENT              RENDERING LLM        │
│  ─────                    ───────────────              ─────────────        │
│  PNG/Text/SVG      →      1. Analyze input       →     3. Receive:          │
│                           2. Generate:                    - Original input   │
│                              - Description                - Description      │
│                              - SVG Blueprint              - Blueprint        │
│                                                        4. Render SVG code    │
│                                                                              │
│  VALIDATION LOOP                                                             │
│  ───────────────                                                             │
│  5. Webview renders SVG → Canvas → PNG data URL                              │
│  6. Blueprint Agent compares to original                                     │
│  7. If errors: Annotate blueprint, add description → goto step 3            │
│  8. If good: Return with confidence score                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Sprint Summary

| Sprint | Focus | Description |
|--------|-------|-------------|
| S1 | Debt-006 | Fix model race condition - pass model to `createCompletion()` directly |
| S2 | Debt-001 | Fix SVG extraction fallback - throw error instead of returning raw content |
| S3 | Feature-001 | Implement PromptLoader service for centralized system prompt management |
| S4 | Phase 1 | Infrastructure Layer - Orchestrator, ConversationManager, prompts, settings |
| S5 | Phase 2 | Application Layer - Message types, handler, MessageHandler wiring |
| S6 | Phase 3 | Presentation Layer - Hook, components (toggle, sub-tabs, dashboard, conversation), SVG→PNG utility |
| S7 | Phase 4 | Settings Integration - SettingsHandler, useSettings hook, UI model selectors |

## Success Criteria

- [ ] PNG-to-SVG conversion achieves ≥85% user-reported quality improvement
- [ ] Iteration loop completes in reasonable time (≤60s for 5 iterations)
- [ ] Toggle cleanly enables/disables without affecting standard SVG flow
- [ ] Dashboard and Conversation views provide clear progress visibility
- [ ] Extension restart correctly re-hydrates Architect conversations
