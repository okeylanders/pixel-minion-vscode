# SVG Architect Epic: Sprint 4 Review

**Date:** 2025-12-02
**Branch:** `epic/svg-architect/sprint/04-infrastructure-layer`
**Current Version:** v1.0.2 (on main)
**Epic:** SVG Architect - Multi-agent SVG generation pipeline

---

## Current Status

**Awaiting review of Sprint 4 before proceeding.**

---

## Epic Overview

SVG Architect is a multi-agent SVG generation pipeline with iterative refinement:
- **Blueprint Agent** - Analyzes input, creates/updates blueprint
- **Render LLM** - Generates SVG code from blueprint
- **Validation Loop** - Compares rendered PNG to intent, iterates until satisfied

---

## Completed Sprints

### Sprint 1: Debt-006 - Model Race Condition (v1.0.1)
**PR #4 - Merged**

Fixed race condition where concurrent SVG generation requests with different models could interfere.

- Added `model?: string` to `TextCompletionOptions`
- `OpenRouterDynamicTextClient.createCompletion()` uses `options.model` if provided
- Deprecated `setModel()` with warning log
- Added 32 tests

### Sprint 2-3: Debt-001 + Feature-001 (v1.0.2)
**PR #5 - Merged**

Combined sprint for SVG extraction fix and PromptLoader service.

**Debt-001 - SVG Extraction Fallback:**
- `extractSVG()` now throws error instead of returning raw content
- Logs content preview for debugging
- 16 new tests

**Feature-001 - PromptLoader Service:**
- `src/infrastructure/resources/PromptLoader.ts` with caching
- `resources/system-prompts/` directory structure
- SVG Architect placeholder prompts ready
- 19 new tests

---

## Sprint 4: Infrastructure Layer (Current Review)

**Branch:** `epic/svg-architect/sprint/04-infrastructure-layer`
**Status:** Implementation complete, awaiting review

### 4.1 Provider & Settings Configuration

**Files Modified:**
- `src/shared/types/providers.ts` - Added `svgBlueprint` to `GenerationType`
- `src/infrastructure/ai/providers/OpenRouterProvider.ts`:
  ```typescript
  export const OPENROUTER_SVG_BLUEPRINT_MODELS: ModelDefinition[] = [
    { id: 'anthropic/claude-opus-4', displayName: 'Claude Opus 4.5', ... },
    { id: 'google/gemini-3-pro-preview', displayName: 'Gemini Pro 3.0', ... },
    { id: 'openai/gpt-5.1', displayName: 'GPT-5.1', ... },
  ];
  export const DEFAULT_SVG_BLUEPRINT_MODEL = 'anthropic/claude-opus-4';
  ```
- `package.json` - Added 3 new settings:
  - `pixelMinion.svgBlueprintModel` (default: `anthropic/claude-opus-4`)
  - `pixelMinion.svgArchitectMaxIterations` (default: 5, range 1-10)
  - `pixelMinion.svgArchitectEnabled` (default: false)

### 4.2 SVGArchitectConversationManager

**File:** `src/infrastructure/ai/orchestration/SVGArchitectConversationManager.ts`

Manages iteration state and token usage across refinement cycles.

**Key Interfaces:**
```typescript
interface SVGArchitectIteration {
  iterationNumber: number;
  blueprint: string;
  svgCode: string;
  renderedPngBase64?: string;
  validationNotes?: string;
  tokenUsage?: TokenUsage;
}

interface SVGArchitectConversationState {
  id: string;
  status: 'analyzing' | 'rendering' | 'validating' | 'awaiting_user' | 'complete' | 'failed';
  originalPrompt: string;
  referenceImageBase64?: string;
  iterations: SVGArchitectIteration[];
  currentIteration: number;
  maxIterations: number;
  userNotes?: string;
  totalTokenUsage: TokenUsage;
}
```

**Key Methods:**
- `create(id, prompt, options)` - Create new conversation
- `get(id)` / `delete(id)` - CRUD operations
- `addIteration(id, iteration)` - Add refinement iteration
- `updateStatus(id, status)` - State machine transitions
- `setUserNotes(id, notes)` - User intervention
- `getContextImages(id)` - Token optimization (first + latest PNG only)
- `accumulateTokenUsage(id, usage)` - Track total costs

### 4.3 SVGArchitectOrchestrator

**File:** `src/infrastructure/ai/orchestration/SVGArchitectOrchestrator.ts`

Coordinates the multi-agent pipeline.

**Key Methods:**
```typescript
// Entry points
startGeneration(input, options, progressCallback): Promise<SVGArchitectResult>
continueWithRenderedPng(conversationId, pngBase64, progressCallback): Promise<SVGArchitectResult>
resumeWithUserNotes(conversationId, notes, progressCallback): Promise<SVGArchitectResult>

// Internal pipeline
private analyzeInput(conversation): Promise<string>        // Blueprint Agent
private generateBlueprint(conversation): Promise<string>   // Blueprint Agent
private renderSvg(conversation, blueprint): Promise<string> // Render LLM
private validateAndAnnotate(conversation): Promise<ValidationResult> // Blueprint Agent
```

**Progress Callback:**
```typescript
interface SVGArchitectProgress {
  conversationId: string;
  status: string;
  iteration: number;
  maxIterations: number;
  message: string;
  svgCode?: string;
  blueprint?: string;
}
```

### 4.4 Tests

- **53 tests** for SVGArchitectConversationManager
- **26 tests** for SVGArchitectOrchestrator
- **219 total tests** passing

---

## Remaining Sprints

### Sprint 5: Application Layer - Message Types & Handler
- Message type definitions in `src/shared/types/messages/svgArchitect.ts`
- `SVGArchitectHandler` in `src/application/handlers/domain/`
- MessageHandler integration and routing

### Sprint 6: Presentation Layer - UI Components & Hook
- `svgToPng` utility for canvas rendering
- `useSvgArchitect` hook
- ToggleSwitch, OutputSubTabs, ArchitectDashboard, ArchitectConversation components
- Integration with SVGGenerationView

### Sprint 7: Settings Integration & Polish
- Settings handler updates
- useSettings hook updates
- Blueprint model selector
- Re-hydration support
- Documentation updates

---

## Key Architectural Decisions

1. **Token Optimization**: Only send first reference + latest PNG (not all intermediate renders)
2. **Progress Callbacks**: UI receives real-time updates during pipeline execution
3. **User Intervention**: `awaiting_user` status allows users to provide notes when auto-iteration stalls
4. **Separate Clients**: Blueprint Agent and Render LLM use separate `OpenRouterDynamicTextClient` instances

---

## File Locations Summary

```
src/
├── infrastructure/ai/
│   ├── orchestration/
│   │   ├── SVGArchitectConversationManager.ts  # NEW
│   │   └── SVGArchitectOrchestrator.ts         # NEW
│   └── providers/
│       └── OpenRouterProvider.ts               # Modified
├── shared/types/
│   └── providers.ts                            # Modified
└── __tests__/infrastructure/ai/orchestration/
    ├── SVGArchitectConversationManager.test.ts # NEW
    └── SVGArchitectOrchestrator.test.ts        # NEW

package.json                                    # Modified (3 new settings)
```

---

## How to Resume

1. Checkout branch: `git checkout epic/svg-architect/sprint/04-infrastructure-layer`
2. Review the implementation (key files listed above)
3. Run tests: `npm test`
4. After review approval:
   - Create PR
   - Merge to main
   - Archive any resolved items
   - Bump version to 1.0.3
   - Update changelogs
   - Tag commit
   - Create Sprint 5 branch

---

## Branch Strategy

Using separate sprint branches:
- `epic/svg-architect/sprint/01-debt-006-model-race` (merged)
- `epic/svg-architect/sprint/02-03-svg-extraction-promptloader` (merged)
- `epic/svg-architect/sprint/04-infrastructure-layer` (current - under review)
- Future: `epic/svg-architect/sprint/05-application-layer`

---

## Test Command

```bash
npm test
# Expected: 219 tests passing
```

---

## Related Files

- Epic tasks: `.todo/epics/svg-architect/tasks.md`
- Epic overview: `.todo/epics/svg-architect/epic.md`
- Implementation plan: `docs/plans/svg-architect-implementation-plan.md`
