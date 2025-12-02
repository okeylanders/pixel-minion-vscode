# SVG Architect - Sprint Tasks

## Phase 0: Foundation (Pre-requisites)

### Sprint 1: Debt-006 - Model Race Condition

**Source:** [.todo/tech-debt/debt-006-svg-model-race-condition.md](../../tech-debt/debt-006-svg-model-race-condition.md)

**Problem:** `setModel()` sets shared state on client. If two concurrent SVG requests use different models, they may race.

**Location:** `src/infrastructure/ai/orchestration/SVGOrchestrator.ts:88`

**Tasks:**

- [x] 1.1 Update `OpenRouterDynamicTextClient.createCompletion()` to accept optional `model` parameter
- [x] 1.2 Update `SVGOrchestrator` to pass model directly to `createCompletion()` instead of calling `setModel()`
- [x] 1.3 Deprecate or remove `setModel()` method (or keep for backwards compatibility with warning)
- [x] 1.4 Update any other callers that rely on `setModel()` pattern (N/A - only SVGOrchestrator used it)
- [x] 1.5 Add test for concurrent requests with different models
- [x] 1.6 Update CLAUDE.md AI Client Integration section if pattern changes

**Acceptance Criteria:**

- [x] Two concurrent SVG generation requests with different models execute correctly without race condition
- [x] Existing single-request flows continue to work

---

### Sprint 2: Debt-001 - SVG Extraction Fallback

**Source:** [.todo/tech-debt/debt-001-svg-extraction-fallback.md](../../tech-debt/debt-001-svg-extraction-fallback.md)

**Problem:** `extractSVG()` returns content as-is if no SVG tags found. Could return error messages or explanations that get displayed as "SVG code".

**Location:** `src/infrastructure/ai/orchestration/SVGOrchestrator.ts:194`

**Tasks:**

- [x] 2.1 Modify `extractSVG()` to throw error instead of returning raw content
- [x] 2.2 Update error message to be user-friendly: "No valid SVG code found in response"
- [x] 2.3 Update handler to catch this specific error and surface appropriately to UI (handler already propagates errors)
- [x] 2.4 Add tests for:
  - Valid SVG extraction (existing)
  - Response with no SVG tags (should throw)
  - Response with malformed SVG (edge case)
- [x] 2.5 Consider logging the raw response for debugging when extraction fails

**Acceptance Criteria:**

- [x] LLM responses without valid SVG show clear error instead of displaying raw text
- [x] Valid SVG extraction continues to work
- [x] Failed extractions are logged for debugging

---

### Sprint 3: Feature-001 - System Prompt Management (PromptLoader)

**Source:** [.todo/features/feature-001-system-prompt-management.md](../../features/feature-001-system-prompt-management.md)

**Problem:** System prompts are scattered as string literals throughout orchestrators. SVG Architect adds 3 complex prompts.

**Tasks:**

- [x] 3.1 Create `src/infrastructure/resources/PromptLoader.ts` service
- [x] 3.2 Create directory structure: `resources/system-prompts/{image,svg,enhance-image,enhance-svg,svg-architect}/`
- [x] 3.3 Create prompt template files as `.md` or `.txt` files
- [x] 3.4 Implement `PromptLoader.load(category: string, name: string): string`
- [x] 3.5 Add caching to avoid repeated file reads
- [x] 3.6 Migrate existing prompts from orchestrators to prompt files:
  - `svg/generation.md` - Main SVG generation system prompt
  - `enhance-svg/enhance.md` - SVG enhancement assistant prompt
  - (others as identified)
- [x] 3.7 Create SVG Architect prompt files (for use in Phase 1):
  - `svg-architect/blueprint-analysis.md`
  - `svg-architect/blueprint-render.md`
  - `svg-architect/blueprint-validation.md`
- [ ] 3.8 Update orchestrators to use PromptLoader instead of inline strings (deferred to Phase 1)
- [x] 3.9 Add PromptLoader to DI in `extension.ts`
- [x] 3.10 Add tests for PromptLoader

**Acceptance Criteria:**

- [x] All system prompts loaded from files at runtime
- [x] Prompts organized by category in `resources/system-prompts/`
- [x] SVG Architect prompts created and ready for Phase 1
- [x] Existing functionality unchanged

**Notes:**
- Consider future enhancement: Allow user prompt customization via settings or `.pixelminion/prompts/` override

---

## Phase 1: Infrastructure Layer

### Sprint 4: SVGArchitectOrchestrator & ConversationManager

**Reference:** [Implementation Plan - Phase 1](../../../docs/plans/svg-architect-implementation-plan.md#phase-1-infrastructure-layer)

**Tasks:**

#### 4.1 Provider & Settings Configuration

- [ ] 4.1.1 Add `svgBlueprint` to `GenerationType` in `src/shared/types/providers.ts`
- [ ] 4.1.2 Add `OPENROUTER_SVG_BLUEPRINT_MODELS` list in OpenRouterProvider.ts
- [ ] 4.1.3 Add `DEFAULT_SVG_BLUEPRINT_MODEL` constant
- [ ] 4.1.4 Update `OPENROUTER_CONFIG.models` to include `svgBlueprint`
- [ ] 4.1.5 Add settings to `package.json`:
  - `pixelMinion.svgBlueprintModel` (string)
  - `pixelMinion.svgArchitectMaxIterations` (number, 1-10, default 5)
  - `pixelMinion.svgArchitectEnabled` (boolean, default false)

#### 4.2 Conversation Manager

- [ ] 4.2.1 Create `src/infrastructure/ai/orchestration/SVGArchitectConversationManager.ts`
- [ ] 4.2.2 Define `SVGArchitectIteration` interface
- [ ] 4.2.3 Define `SVGArchitectConversationState` interface
- [ ] 4.2.4 Implement conversation CRUD methods: `create()`, `get()`, `delete()`
- [ ] 4.2.5 Implement `addIteration()` method
- [ ] 4.2.6 Implement `updateStatus()` method
- [ ] 4.2.7 Implement `setUserNotes()` method
- [ ] 4.2.8 Implement `getContextImages()` for token optimization (first + latest PNG only)
- [ ] 4.2.9 Add re-hydration support method

#### 4.3 Orchestrator

- [ ] 4.3.1 Create `src/infrastructure/ai/orchestration/SVGArchitectOrchestrator.ts`
- [ ] 4.3.2 Implement `setBlueprintClient()` and `setRenderClient()` methods
- [ ] 4.3.3 Define input/output interfaces (`SVGArchitectInput`, `SVGArchitectOptions`, `SVGArchitectProgress`, `SVGArchitectResult`)
- [ ] 4.3.4 Implement `startGeneration()` entry point with progress callback
- [ ] 4.3.5 Implement `continueWithRenderedPng()` for validation loop
- [ ] 4.3.6 Implement `resumeWithUserNotes()` for user intervention
- [ ] 4.3.7 Implement internal pipeline steps:
  - `analyzeInput()` - First Blueprint Agent call
  - `generateBlueprint()` - Create/update blueprint
  - `renderSvg()` - Rendering LLM call
  - `validateAndAnnotate()` - Comparison and annotation
- [ ] 4.3.8 Integrate with PromptLoader (from Sprint 3)
- [ ] 4.3.9 Add token usage tracking

#### 4.4 Tests

- [ ] 4.4.1 Unit tests for SVGArchitectConversationManager
- [ ] 4.4.2 Unit tests for SVGArchitectOrchestrator (mock clients)
- [ ] 4.4.3 Integration test for full pipeline flow (mock API responses)

**Acceptance Criteria:**
- Orchestrator can run complete analysis → render → validate cycle
- Iteration loop correctly limits to maxIterations
- Context optimization keeps only first + latest PNG
- Token usage tracked across all LLM calls

---

## Phase 2: Application Layer

### Sprint 5: Message Types & Handler

**Reference:** [Implementation Plan - Phase 2](../../../docs/plans/svg-architect-implementation-plan.md#phase-2-application-layer)

**Tasks:**

#### 5.1 Message Types

- [ ] 5.1.1 Create `src/shared/types/messages/svgArchitect.ts`
- [ ] 5.1.2 Define `SVGArchitectRequestPayload` interface
- [ ] 5.1.3 Define `SVGArchitectProgressPayload` interface
- [ ] 5.1.4 Define `SVGArchitectPngPayload` interface
- [ ] 5.1.5 Define `SVGArchitectResumePayload` interface
- [ ] 5.1.6 Define `SVGArchitectResultPayload` interface
- [ ] 5.1.7 Add message types to `MessageType` enum in `base.ts`:
  - `SVG_ARCHITECT_REQUEST`
  - `SVG_ARCHITECT_PROGRESS`
  - `SVG_ARCHITECT_PNG_READY`
  - `SVG_ARCHITECT_RESUME`
  - `SVG_ARCHITECT_RESULT`
  - `SVG_ARCHITECT_CANCEL`
- [ ] 5.1.8 Export from `src/shared/types/messages/index.ts`

#### 5.2 Handler

- [ ] 5.2.1 Create `src/application/handlers/domain/SVGArchitectHandler.ts`
- [ ] 5.2.2 Implement constructor with orchestrator DI
- [ ] 5.2.3 Implement `handleGenerationRequest()` with progress callback
- [ ] 5.2.4 Implement `handlePngReady()` for validation loop continuation
- [ ] 5.2.5 Implement `handleResume()` for user notes
- [ ] 5.2.6 Implement `handleCancel()` for cancellation
- [ ] 5.2.7 Add token usage callback integration
- [ ] 5.2.8 Export from handlers index

#### 5.3 MessageHandler Integration

- [ ] 5.3.1 Create SVGArchitectOrchestrator in MessageHandler constructor
- [ ] 5.3.2 Create and wire Blueprint client (OpenRouterDynamicTextClient)
- [ ] 5.3.3 Create and wire Render client (OpenRouterDynamicTextClient)
- [ ] 5.3.4 Create SVGArchitectHandler instance
- [ ] 5.3.5 Register routes for all SVG Architect message types

#### 5.4 Tests

- [ ] 5.4.1 Unit tests for SVGArchitectHandler
- [ ] 5.4.2 Integration test for message routing

**Acceptance Criteria:**
- All SVG Architect messages routed correctly
- Progress updates stream to webview during generation
- PNG submission from webview continues validation loop
- User notes resume stalled conversations

---

## Phase 3: Presentation Layer

### Sprint 6: UI Components & Hook

**Reference:** [Implementation Plan - Phase 3](../../../docs/plans/svg-architect-implementation-plan.md#phase-3-presentation-layer)

**Tasks:**

#### 6.1 SVG→PNG Utility

- [ ] 6.1.1 Create `src/presentation/webview/utils/svgToPng.ts`
- [ ] 6.1.2 Implement `renderSvgToPng(svgCode, width, height)` using canvas
- [ ] 6.1.3 Add error handling for malformed SVG
- [ ] 6.1.4 Add cleanup for blob URLs

#### 6.2 Hook

- [ ] 6.2.1 Create `src/presentation/webview/hooks/domain/useSvgArchitect.ts`
- [ ] 6.2.2 Define `SvgArchitectState` interface
- [ ] 6.2.3 Define `SvgArchitectActions` interface
- [ ] 6.2.4 Define `SvgArchitectHandlers` interface
- [ ] 6.2.5 Implement state management (status, iteration, results)
- [ ] 6.2.6 Implement `generate()` action
- [ ] 6.2.7 Implement `submitUserNotes()` action
- [ ] 6.2.8 Implement `cancel()` action
- [ ] 6.2.9 Implement `handleProgress()` handler
- [ ] 6.2.10 Implement `handleResult()` handler
- [ ] 6.2.11 Add auto-render effect: when status='validating' + svgCode, render PNG and send back
- [ ] 6.2.12 Add conversation entry tracking for Conversation view
- [ ] 6.2.13 Add persistence support
- [ ] 6.2.14 Export from hooks index

#### 6.3 Common Components

- [ ] 6.3.1 Create `src/presentation/webview/components/common/ToggleSwitch.tsx`
- [ ] 6.3.2 Create `src/presentation/webview/styles/components/toggle-switch.css`

#### 6.4 SVG Tab Components

- [ ] 6.4.1 Create `src/presentation/webview/components/svg/OutputSubTabs.tsx`
- [ ] 6.4.2 Create `src/presentation/webview/styles/components/output-sub-tabs.css`
- [ ] 6.4.3 Create `src/presentation/webview/components/svg/ArchitectDashboard.tsx`
- [ ] 6.4.4 Create `src/presentation/webview/styles/components/architect-dashboard.css`
- [ ] 6.4.5 Create `src/presentation/webview/components/svg/ArchitectConversation.tsx`
- [ ] 6.4.6 Create `src/presentation/webview/styles/components/architect-conversation.css`
- [ ] 6.4.7 Implement auto-scroll in ArchitectConversation

#### 6.5 Integration

- [ ] 6.5.1 Update `SVGGenerationView.tsx`:
  - Add useSvgArchitect hook
  - Add outputSubTab state
  - Add ToggleSwitch in input section
  - Add OutputSubTabs between output and input (no well)
  - Add conditional rendering for Dashboard/Conversation views
  - Auto-switch to Dashboard when Architect starts
- [ ] 6.5.2 Register message handlers in `App.tsx`:
  - `SVG_ARCHITECT_PROGRESS`
  - `SVG_ARCHITECT_RESULT`
- [ ] 6.5.3 Export new components from barrel files

#### 6.6 Tests

- [ ] 6.6.1 Unit tests for svgToPng utility
- [ ] 6.6.2 Unit tests for useSvgArchitect hook
- [ ] 6.6.3 Component tests for new UI components

**Acceptance Criteria:**
- Toggle enables/disables high quality mode
- Sub-tabs switch between SVG/Dashboard/Conversation views
- Dashboard shows static agent status boxes that refresh in place
- Conversation shows scrolling history with auto-scroll
- SVG renders to PNG automatically in validation loop
- Architect tabs disabled when toggle is off

---

## Phase 4: Settings Integration

### Sprint 7: Settings & Polish

**Reference:** [Implementation Plan - Phase 4](../../../docs/plans/svg-architect-implementation-plan.md#phase-4-settings-integration)

**Tasks:**

#### 7.1 Settings Handler

- [ ] 7.1.1 Update `SettingsHandler.ts` to include:
  - `svgBlueprintModel`
  - `svgArchitectMaxIterations`
  - `svgArchitectEnabled`
- [ ] 7.1.2 Update `SettingsPayload` interface in messages

#### 7.2 Settings Hook

- [ ] 7.2.1 Update `useSettings.ts` to handle new settings
- [ ] 7.2.2 Add state for svgBlueprintModel, maxIterations, enabled
- [ ] 7.2.3 Add actions to update settings

#### 7.3 UI Integration

- [ ] 7.3.1 Add Blueprint Model selector dropdown (visible when high-quality enabled)
- [ ] 7.3.2 Wire model selection to generation request
- [ ] 7.3.3 Sync toggle state with setting

#### 7.4 Re-hydration

- [ ] 7.4.1 Add re-hydration support for Architect conversations
- [ ] 7.4.2 Verify persistence across webview reload
- [ ] 7.4.3 Verify re-hydration after extension restart

#### 7.5 Polish & Documentation

- [ ] 7.5.1 Review all CSS for VSCode theme compatibility
- [ ] 7.5.2 Add loading states and error handling throughout
- [ ] 7.5.3 Update CLAUDE.md with SVG Architect architecture (new suite)
- [ ] 7.5.4 Manual QA: Full flow testing
- [ ] 7.5.5 Update feature file status to "Complete"

**Acceptance Criteria:**
- All settings sync between VS Code and webview
- Blueprint Model dropdown visible when enabled
- Conversations persist and re-hydrate correctly
- UI follows VSCode theme
- Documentation updated

---

## Completion Checklist

- [ ] All 7 sprints complete
- [ ] All tests passing
- [ ] No regressions in existing SVG generation flow
- [ ] CLAUDE.md updated with new architecture
- [ ] Feature-016 status updated to "Complete"
- [ ] Ready for v1.2 release
