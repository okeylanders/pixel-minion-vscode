# SVG Architect Implementation Plan

## Overview

**Feature**: Multi-agent SVG generation pipeline with iterative refinement for higher quality output.

**Core Concept**: Separate "what to render" (Blueprint Agent) from "how to render" (Rendering LLM), with visual feedback loop for iterative improvement.

---

## Architecture

### Pipeline Flow

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
│  7. If errors: Annotate blueprint, provide additional description ( as next user message ) goto step 3                               │
│  8. If good: Return with confidence score                                    │
│                                                                              │
│  CONTEXT OPTIMIZATION                                                        │
│  ────────────────────                                                        │
│  - Only first PNG + latest PNG kept in context                               │
│  - Intermediate renders discarded to save tokens                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Blueprint Format

```xml
<svg>
  <!-- Element: Centered Circle -->
  <!-- Render a 200px diameter circle centered in viewport, fill #FF0000, no stroke -->

  <!-- Element: Inner Square -->
  <!-- Render an 80px square rotated 45deg, centered, fill #0000FF -->

  <!-- Element: Border Frame -->
  <!-- Render viewport-sized rect with 2px stroke #333333, transparent fill -->
</svg>
```

### Use Cases
// Note all instances may have multiple image attachements ( 1 png and/or 1 svg ) User will be exepected to indicate in intention for which in original prompt
| Mode | Input | Blueprint Agent Role |
|------|-------|---------------------|
| PNG → SVG | PNG image + prompt:optional-for-mods | Analyze image, describe SVG primitives needed |
| Text → SVG | Text prompt + PNG image:optional can be used for style guidance/influence/colors/etc | Enhance description, create blueprint structure |
| SVG → SVG | Existing SVG + prompt:optional(will just semantically formalize svg if no prompt is provided) | Describe current SVG, plan modifications |

---

## Implementation Phases

### Phase 1: Infrastructure Layer

#### 1.1 Add Generation Type & Model List

**File**: `src/shared/types/providers.ts`
```typescript
export type GenerationType = 'image' | 'svg' | 'svgBlueprint';
```

**File**: `src/infrastructure/ai/providers/OpenRouterProvider.ts`
```typescript
// Add new model list (same models as SVG, tracked separately)
export const OPENROUTER_SVG_BLUEPRINT_MODELS: ModelDefinition[] = [
  { id: 'google/gemini-3-pro-preview', displayName: 'Gemini Pro 3.0', inputCost: 1.25, outputCost: 10.00 },
  { id: 'anthropic/claude-opus-4', displayName: 'Claude Opus 4.5', inputCost: 15.00, outputCost: 75.00 },
  { id: 'openai/gpt-5.1-codex', displayName: 'OpenAI: GPT-5.1 Codex' },
];

export const DEFAULT_SVG_BLUEPRINT_MODEL = 'google/gemini-3-pro-preview';

// Update OPENROUTER_CONFIG.models
models: {
  image: OPENROUTER_IMAGE_MODELS,
  svg: OPENROUTER_SVG_MODELS,
  svgBlueprint: OPENROUTER_SVG_BLUEPRINT_MODELS,
},
```

#### 1.2 Add Settings

**File**: `package.json` (contributes.configuration.properties)
```json
{
  "pixelMinion.svgBlueprintModel": {
    "type": "string",
    "default": "google/gemini-3-pro-preview",
    "description": "Model for SVG Blueprint Agent (analyzes and plans SVG structure)"
  },
  "pixelMinion.svgArchitectMaxIterations": {
    "type": "number",
    "default": 5,
    "minimum": 1,
    "maximum": 10,
    "description": "Maximum refinement iterations for SVG Architect high-quality mode"
  },
  "pixelMinion.svgArchitectEnabled": {
    "type": "boolean",
    "default": false,
    "description": "Enable experimental SVG Architect high-quality mode"
  }
}
```

#### 1.3 Create SVGArchitectConversationManager

**File**: `src/infrastructure/ai/orchestration/SVGArchitectConversationManager.ts`

```typescript
export interface SVGArchitectIteration {
  iterationNumber: number;
  blueprint: string;           // SVG blueprint with comments
  renderedSvg: string;         // Actual SVG code
  renderedPng?: string;        // Base64 PNG from webview (for comparison)
  annotations?: string;        // Error annotations from Blueprint Agent
  confidenceScore?: number;    // 0-100
}

export interface SVGArchitectConversationState {
  id: string;
  mode: 'png-to-svg' | 'text-to-svg' | 'svg-to-svg';
  blueprintModel: string;
  renderModel: string;
  aspectRatio: AspectRatio;

  // Input (persisted for comparison)
  originalInput: {
    png?: string;              // Base64 original image
    prompt: string;
    existingSvg?: string;
  };

  // Description from Blueprint Agent
  description: string;

  // Iteration history
  iterations: SVGArchitectIteration[];
  currentIteration: number;
  maxIterations: number;

  // Status
  status: 'analyzing' | 'rendering' | 'validating' | 'complete' | 'awaiting-user';
  userNotes?: string;          // User feedback for resumption
}
```

**Key Methods**:
- `create(mode, blueprintModel, renderModel, aspectRatio, maxIterations): State`
- `get(id): State | undefined`
- `addIteration(id, iteration): void`
- `updateStatus(id, status): void`
- `setUserNotes(id, notes): void`
- `getContextImages(id): { first: string, latest: string }` - Returns only first + latest PNG

#### 1.4 Create SVGArchitectOrchestrator

**File**: `src/infrastructure/ai/orchestration/SVGArchitectOrchestrator.ts`

```typescript
export class SVGArchitectOrchestrator {
  private conversationManager: SVGArchitectConversationManager;
  private blueprintClient: OpenRouterDynamicTextClient;
  private renderClient: OpenRouterDynamicTextClient;

  constructor(logger: LoggingService) { ... }

  setBlueprintClient(client: OpenRouterDynamicTextClient): void
  setRenderClient(client: OpenRouterDynamicTextClient): void

  // Main entry points
  async startGeneration(
    input: SVGArchitectInput,
    options: SVGArchitectOptions,
    onProgress: (progress: SVGArchitectProgress) => void
  ): Promise<SVGArchitectResult>

  async continueWithRenderedPng(
    conversationId: string,
    renderedPng: string  // From webview
  ): Promise<SVGArchitectProgress>

  async resumeWithUserNotes(
    conversationId: string,
    userNotes: string
  ): Promise<SVGArchitectProgress>

  // Internal pipeline steps
  private async analyzeInput(state: State): Promise<AnalysisResult>
  private async generateBlueprint(state: State): Promise<string>
  private async renderSvg(state: State, blueprint: string): Promise<string>
  private async validateAndAnnotate(state: State, renderedPng: string): Promise<ValidationResult>
}

export interface SVGArchitectInput {
  prompt: string;
  referencePng?: string;       // For PNG→SVG or style reference
  existingSvg?: string;        // For SVG→SVG
}

export interface SVGArchitectOptions {
  blueprintModel: string;
  renderModel: string;
  aspectRatio: AspectRatio;
  maxIterations: number;
}

export interface SVGArchitectProgress {
  conversationId: string;
  status: 'analyzing' | 'rendering' | 'validating' | 'awaiting-png' | 'complete' | 'awaiting-user';
  iteration: number;
  maxIterations: number;
  message: string;

  // Current results (may be partial)
  description?: string;
  blueprint?: string;
  svgCode?: string;
  confidenceScore?: number;
}

export interface SVGArchitectResult {
  conversationId: string;
  finalSvg: string;
  description: string;
  iterations: number;
  confidenceScore: number;
  usage: TokenUsage;
}
```

#### 1.5 System Prompts

**File**: `src/infrastructure/ai/prompts/svgArchitectPrompts.ts`

```typescript
export const BLUEPRINT_ANALYSIS_PROMPT = `You are an SVG Blueprint Architect. Analyze the provided image and create:

1. **Description**: A detailed technical description of the image suitable for SVG recreation:
   - Shapes, colors (hex values), positions, sizes
   - Layer ordering (what's on top)
   - Any gradients, patterns, or effects

2. **SVG Blueprint**: A commented SVG structure showing what elements to render:
   - Use XML comments to describe each element
   - Specify exact colors, positions, and dimensions
   - Do NOT write actual SVG code, only the blueprint structure

Example output:
---
**Description**: A logo featuring a red circle with a centered blue square rotated 45 degrees...

**Blueprint**:
\`\`\`svg
<svg viewBox="0 0 {width} {height}">
  <!-- Background: Full viewport rect, fill #FFFFFF -->

  <!-- Main Circle: 200px diameter, centered, fill #FF0000, no stroke -->

  <!-- Inner Square: 80px, centered, rotated 45deg, fill #0000FF -->
</svg>
\`\`\`
---`;

export const BLUEPRINT_RENDER_PROMPT = `You are an SVG Rendering Expert. Convert the blueprint into valid SVG code.

You will receive:
1. Original image (for reference)
2. Technical description
3. SVG Blueprint with element specifications

Create clean, valid SVG code that matches the blueprint exactly. Use the specified:
- viewBox dimensions
- Colors (hex values)
- Positions and sizes
- Element types

Output ONLY the SVG code wrapped in \`\`\`svg code blocks.`;

export const BLUEPRINT_VALIDATION_PROMPT = `Compare the rendered SVG (shown as PNG), and SVG Code against the original image, blueprint, user instructions.

Evaluate accuracy on these criteria:
- Shape accuracy (correct primitives, proportions)
- Color accuracy (correct hex values)
- Position accuracy (correct layout, alignment)
- Overall fidelity

Provide:
1. **Confidence Score**: 0-100 (100 = perfect match)
2. **Annotations**: If score < 90, annotate the blueprint with corrections:
   - Wrap corrections in <!-- FIX: description --> comments
   - Be specific about what needs to change

If confidence >= 90, respond with:
APPROVED: [confidence score]

Otherwise respond with the annotated blueprint, narrative, etc  for another render pass.`;
```

---

### Phase 2: Application Layer

#### 2.1 Message Types

**File**: `src/shared/types/messages/svgArchitect.ts`

```typescript
// Request to start SVG Architect generation
export interface SVGArchitectRequestPayload {
  prompt: string;
  referencePng?: string;
  existingSvg?: string;
  blueprintModel: string;
  renderModel: string;
  aspectRatio: AspectRatio;
  maxIterations: number;
}

// Progress updates (sent multiple times during generation)
export interface SVGArchitectProgressPayload {
  conversationId: string;
  status: 'analyzing' | 'rendering' | 'validating' | 'awaiting-png' | 'complete' | 'awaiting-user';
  iteration: number;
  maxIterations: number;
  message: string;
  description?: string;
  blueprint?: string;
  svgCode?: string;
  confidenceScore?: number;
}

// Webview sends rendered PNG back
export interface SVGArchitectPngPayload {
  conversationId: string;
  renderedPng: string;  // Base64 data URL
}

// User provides notes to resume
export interface SVGArchitectResumePayload {
  conversationId: string;
  userNotes: string;
}

// Final result
export interface SVGArchitectResultPayload {
  conversationId: string;
  finalSvg: string;
  description: string;
  iterations: number;
  confidenceScore: number;
  usage?: TokenUsage;
}
```

**File**: `src/shared/types/messages/base.ts` (add to MessageType enum)
```typescript
// SVG Architect
SVG_ARCHITECT_REQUEST = 'SVG_ARCHITECT_REQUEST',
SVG_ARCHITECT_PROGRESS = 'SVG_ARCHITECT_PROGRESS',
SVG_ARCHITECT_PNG_READY = 'SVG_ARCHITECT_PNG_READY',
SVG_ARCHITECT_RESUME = 'SVG_ARCHITECT_RESUME',
SVG_ARCHITECT_RESULT = 'SVG_ARCHITECT_RESULT',
SVG_ARCHITECT_CANCEL = 'SVG_ARCHITECT_CANCEL',
```

#### 2.2 SVGArchitectHandler

**File**: `src/application/handlers/domain/SVGArchitectHandler.ts`

```typescript
export class SVGArchitectHandler {
  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly orchestrator: SVGArchitectOrchestrator,
    private readonly logger: LoggingService,
    private readonly applyTokenUsageCallback?: (usage: TokenUsage) => void
  ) {}

  async handleGenerationRequest(message: MessageEnvelope<SVGArchitectRequestPayload>): Promise<void> {
    const { prompt, referencePng, existingSvg, blueprintModel, renderModel, aspectRatio, maxIterations } = message.payload;

    // Progress callback sends updates to webview
    const onProgress = (progress: SVGArchitectProgress) => {
      this.postMessage(createEnvelope<SVGArchitectProgressPayload>(
        MessageType.SVG_ARCHITECT_PROGRESS,
        'extension.svgArchitect',
        progress,
        message.correlationId
      ));
    };

    try {
      const result = await this.orchestrator.startGeneration(
        { prompt, referencePng, existingSvg },
        { blueprintModel, renderModel, aspectRatio, maxIterations },
        onProgress
      );

      // Final result
      this.postMessage(createEnvelope<SVGArchitectResultPayload>(
        MessageType.SVG_ARCHITECT_RESULT,
        'extension.svgArchitect',
        result,
        message.correlationId
      ));

      if (result.usage) {
        this.applyTokenUsageCallback?.(result.usage);
      }
    } catch (error) {
      this.logger.error('SVG Architect generation failed', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.svgArchitect',
        { message: error.message },
        message.correlationId
      ));
    }
  }

  // Handle PNG from webview (validation loop)
  async handlePngReady(message: MessageEnvelope<SVGArchitectPngPayload>): Promise<void> {
    const { conversationId, renderedPng } = message.payload;

    const progress = await this.orchestrator.continueWithRenderedPng(conversationId, renderedPng);

    this.postMessage(createEnvelope<SVGArchitectProgressPayload>(
      MessageType.SVG_ARCHITECT_PROGRESS,
      'extension.svgArchitect',
      progress,
      message.correlationId
    ));
  }

  // Handle user resume with notes
  async handleResume(message: MessageEnvelope<SVGArchitectResumePayload>): Promise<void> {
    const { conversationId, userNotes } = message.payload;

    const progress = await this.orchestrator.resumeWithUserNotes(conversationId, userNotes);

    this.postMessage(createEnvelope<SVGArchitectProgressPayload>(
      MessageType.SVG_ARCHITECT_PROGRESS,
      'extension.svgArchitect',
      progress,
      message.correlationId
    ));
  }
}
```

#### 2.3 Wire Up in MessageHandler.ts

```typescript
// Create SVG Architect orchestrator with two clients
const svgArchitectOrchestrator = new SVGArchitectOrchestrator(logger);
svgArchitectOrchestrator.setBlueprintClient(new OpenRouterDynamicTextClient(secretStorage, logger));
svgArchitectOrchestrator.setRenderClient(new OpenRouterDynamicTextClient(secretStorage, logger));

this.svgArchitectHandler = new SVGArchitectHandler(
  postMessage,
  svgArchitectOrchestrator,
  logger,
  (usage) => this.applyTokenUsage(usage)
);

// Register routes
this.router.register(MessageType.SVG_ARCHITECT_REQUEST, (msg) => this.svgArchitectHandler.handleGenerationRequest(msg));
this.router.register(MessageType.SVG_ARCHITECT_PNG_READY, (msg) => this.svgArchitectHandler.handlePngReady(msg));
this.router.register(MessageType.SVG_ARCHITECT_RESUME, (msg) => this.svgArchitectHandler.handleResume(msg));
```

---

### Phase 3: Presentation Layer

#### 3.1 useSvgArchitect Hook

**File**: `src/presentation/webview/hooks/domain/useSvgArchitect.ts`

```typescript
export interface SvgArchitectState {
  isEnabled: boolean;              // Toggle state
  isGenerating: boolean;
  conversationId: string | null;

  // Progress tracking
  status: 'idle' | 'analyzing' | 'rendering' | 'validating' | 'awaiting-user' | 'complete';
  currentIteration: number;
  maxIterations: number;
  statusMessage: string;

  // Results
  description: string | null;
  blueprint: string | null;
  svgCode: string | null;
  confidenceScore: number | null;

  // User feedback
  userNotes: string;

  error: string | null;
}

export interface SvgArchitectActions {
  setEnabled: (enabled: boolean) => void;
  generate: (input: SvgArchitectInput) => void;
  submitUserNotes: () => void;
  cancel: () => void;
  reset: () => void;
}

export interface SvgArchitectHandlers {
  handleProgress: (message: MessageEnvelope<SVGArchitectProgressPayload>) => void;
  handleResult: (message: MessageEnvelope<SVGArchitectResultPayload>) => void;
  handleError: (message: MessageEnvelope) => void;
}

// Internal: renders SVG and sends PNG back to extension
const renderSvgToPng = useCallback(async (svgCode: string): Promise<string> => {
  // Create hidden SVG element
  // Draw to canvas
  // Return canvas.toDataURL('image/png')
}, []);

// When status is 'validating' and we have svgCode, auto-render and send PNG
useEffect(() => {
  if (status === 'validating' && svgCode) {
    renderSvgToPng(svgCode).then(pngDataUrl => {
      postMessage(createEnvelope(
        MessageType.SVG_ARCHITECT_PNG_READY,
        'webview.svgArchitect',
        { conversationId, renderedPng: pngDataUrl }
      ));
    });
  }
}, [status, svgCode, conversationId]);
```

#### 3.2 SVG→PNG Rendering Utility

**File**: `src/presentation/webview/utils/svgToPng.ts`

```typescript
export async function renderSvgToPng(
  svgCode: string,
  width: number = 512,
  height: number = 512
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create blob URL from SVG
    const blob = new Blob([svgCode], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    // Load into image
    const img = new Image();
    img.onload = () => {
      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      // Get PNG data URL
      const pngDataUrl = canvas.toDataURL('image/png');

      // Cleanup
      URL.revokeObjectURL(url);

      resolve(pngDataUrl);
    };
    img.onerror = reject;
    img.src = url;
  });
}
```

#### 3.3 Toggle Component

**File**: `src/presentation/webview/components/common/ToggleSwitch.tsx`

```typescript
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
}) => {
  return (
    <label className="toggle-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-slider"></span>
      <span className="toggle-label">{label}</span>
    </label>
  );
};
```

#### 3.4 Output Section Sub-Tabs

The output section will have 3 sub-tabs for different viewing modes:

```
┌──────────────────────────────────────────────────────────────────────┐
│  OUTPUT SECTION                                                       │
│  ════════════════════════════════════════════════════════════════════│
│                                                                       │
│  [content area - switches based on active sub-tab]                   │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│                               [SVG] [Dashboard] [Conversation]  ◄─── │
├──────────────────────────────────────────────────────────────────────┤
│  INPUT SECTION                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

**Sub-tab behavior:**
- Small tab buttons anchored to the right
- No well/border around tab buttons (sits between output and input)
- **Dashboard** and **Conversation** tabs are **disabled** when Architect mode toggle is off
- Auto-switch to Dashboard when Architect generation starts

**File**: `src/presentation/webview/components/svg/OutputSubTabs.tsx`

```typescript
type OutputSubTab = 'svg' | 'dashboard' | 'conversation';

interface OutputSubTabsProps {
  activeTab: OutputSubTab;
  onTabChange: (tab: OutputSubTab) => void;
  architectEnabled: boolean;
}

export const OutputSubTabs: React.FC<OutputSubTabsProps> = ({
  activeTab,
  onTabChange,
  architectEnabled,
}) => {
  return (
    <div className="output-sub-tabs">
      <button
        className={`sub-tab ${activeTab === 'svg' ? 'active' : ''}`}
        onClick={() => onTabChange('svg')}
      >
        SVG
      </button>
      <button
        className={`sub-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onTabChange('dashboard')}
        disabled={!architectEnabled}
      >
        Dashboard
      </button>
      <button
        className={`sub-tab ${activeTab === 'conversation' ? 'active' : ''}`}
        onClick={() => onTabChange('conversation')}
        disabled={!architectEnabled}
      >
        Conversation
      </button>
    </div>
  );
};
```

**CSS**: `src/presentation/webview/styles/components/output-sub-tabs.css`

```css
.output-sub-tabs {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  padding: 4px 0;
}

.sub-tab {
  background: transparent;
  border: 1px solid var(--vscode-panel-border);
  color: var(--vscode-foreground);
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
}

.sub-tab:hover:not(:disabled) {
  background: var(--vscode-list-hoverBackground);
}

.sub-tab.active {
  background: var(--vscode-button-secondaryBackground);
  border-color: var(--vscode-focusBorder);
}

.sub-tab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

#### 3.5 SVG Tab Content (Existing)

The existing zero-shot SVG view - single result display with conversation hidden in background.

#### 3.6 Architect Dashboard Component

**File**: `src/presentation/webview/components/svg/ArchitectDashboard.tsx`

Static boxes that refresh in place - shows current/latest state only (no scrolling history).

```
┌─────────────────────────────────────────────────────────────┐
│ SVG Architect                           Iteration 2/5       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔵 Blueprint Agent                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ **Status**: Analyzing image...                       │   │
│  │                                                      │   │
│  │ **Description**: A logo featuring a red circle...   │   │
│  │                                                      │   │
│  │ **Blueprint**:                                       │   │
│  │ <svg viewBox="0 0 512 512">                         │   │
│  │   <!-- Main Circle: 200px, centered, #FF0000 -->    │   │
│  │ </svg>                                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🟢 Rendering LLM                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ **Status**: Rendering...                             │   │
│  │                                                      │   │
│  │ [SVG Preview]     [PNG Preview]                      │   │
│  │ ┌──────────┐      ┌──────────┐                      │   │
│  │ │  (svg)   │      │  (png)   │                      │   │
│  │ └──────────┘      └──────────┘                      │   │
│  │                                                      │   │
│  │ **Confidence**: 72%                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```typescript
interface ArchitectDashboardProps {
  state: SvgArchitectState;
  onSubmitNotes: () => void;
  onNotesChange: (notes: string) => void;
}

export const ArchitectDashboard: React.FC<ArchitectDashboardProps> = ({
  state,
  onSubmitNotes,
  onNotesChange,
}) => {
  const { status, currentIteration, maxIterations, statusMessage, description, blueprint, svgCode, renderedPng, confidenceScore, userNotes } = state;

  return (
    <div className="architect-dashboard">
      {/* Header with iteration */}
      <div className="dashboard-header">
        <span className="dashboard-title">SVG Architect</span>
        <span className="dashboard-iteration">
          Iteration {currentIteration}/{maxIterations}
        </span>
      </div>

      {/* Blueprint Agent Box */}
      <div className="agent-box blueprint-agent">
        <div className="agent-header">
          <span className="agent-icon">🔵</span>
          <span className="agent-name">Blueprint Agent</span>
        </div>
        <div className="agent-content">
          <div className="agent-status">{statusMessage}</div>
          {description && (
            <div className="agent-field">
              <strong>Description:</strong>
              <p>{description}</p>
            </div>
          )}
          {blueprint && (
            <div className="agent-field">
              <strong>Blueprint:</strong>
              <pre><code>{blueprint}</code></pre>
            </div>
          )}
        </div>
      </div>

      {/* Rendering LLM Box */}
      <div className="agent-box rendering-llm">
        <div className="agent-header">
          <span className="agent-icon">🟢</span>
          <span className="agent-name">Rendering LLM</span>
        </div>
        <div className="agent-content">
          <div className="preview-row">
            {svgCode && (
              <div className="preview-box">
                <label>SVG</label>
                <div className="svg-preview" dangerouslySetInnerHTML={{ __html: svgCode }} />
              </div>
            )}
            {renderedPng && (
              <div className="preview-box">
                <label>PNG</label>
                <img src={renderedPng} alt="Rendered PNG" />
              </div>
            )}
          </div>
          {confidenceScore !== null && (
            <div className="confidence-display">
              Confidence: <strong>{confidenceScore}%</strong>
            </div>
          )}
        </div>
      </div>

      {/* User notes input (when awaiting-user) */}
      {status === 'awaiting-user' && (
        <div className="user-notes-section">
          <textarea
            value={userNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add notes for the next iteration..."
          />
          <button onClick={onSubmitNotes}>Continue with notes</button>
        </div>
      )}
    </div>
  );
};
```

#### 3.7 Architect Conversation Component

**File**: `src/presentation/webview/components/svg/ArchitectConversation.tsx`

Scrolling history showing full agent conversation with auto-scroll as new entries appear.

```
┌─────────────────────────────────────────────────────────────┐
│ SVG Architect                           Iteration 2/5       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔵 Blueprint Agent                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ **Analyzing image...**                               │   │
│  │ **Description**: A logo featuring a red circle...   │   │
│  │ **Blueprint**: <svg><!-- ... --></svg>              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🟢 Rendering LLM                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [SVG Preview]  [PNG Preview]                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🔵 Blueprint Agent (Validation)                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ **Confidence**: 72%                                  │   │
│  │ **Issues Found**:                                    │   │
│  │ - Circle is 150px, should be 200px                  │   │
│  │ **Annotated Blueprint**: <!-- FIX: ... -->          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🟢 Rendering LLM                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [SVG Preview v2]  [PNG Preview v2]                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⏳ Blueprint Agent (Validating...)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```typescript
interface ConversationEntry {
  id: string;
  agent: 'blueprint' | 'renderer';
  type: 'analysis' | 'render' | 'validation';
  timestamp: Date;
  content: {
    status?: string;
    description?: string;
    blueprint?: string;
    svgCode?: string;
    renderedPng?: string;
    confidenceScore?: number;
    issues?: string[];
    annotations?: string;
  };
}

interface ArchitectConversationProps {
  entries: ConversationEntry[];
  currentStatus: string;
  iteration: number;
  maxIterations: number;
}

export const ArchitectConversation: React.FC<ArchitectConversationProps> = ({
  entries,
  currentStatus,
  iteration,
  maxIterations,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className="architect-conversation">
      {/* Header */}
      <div className="conversation-header">
        <span>SVG Architect</span>
        <span>Iteration {iteration}/{maxIterations}</span>
      </div>

      {/* Scrolling conversation */}
      <div className="conversation-scroll" ref={scrollRef}>
        {entries.map((entry) => (
          <ConversationEntry key={entry.id} entry={entry} />
        ))}

        {/* Current working indicator */}
        {currentStatus && (
          <div className="working-indicator">
            <span className="spinner">⏳</span>
            <span>{currentStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const ConversationEntry: React.FC<{ entry: ConversationEntry }> = ({ entry }) => {
  const icon = entry.agent === 'blueprint' ? '🔵' : '🟢';
  const name = entry.agent === 'blueprint' ? 'Blueprint Agent' : 'Rendering LLM';
  const suffix = entry.type === 'validation' ? ' (Validation)' : '';

  return (
    <div className={`conversation-entry ${entry.agent}`}>
      <div className="entry-header">
        <span className="entry-icon">{icon}</span>
        <span className="entry-name">{name}{suffix}</span>
      </div>
      <div className="entry-content">
        {entry.content.description && <p><strong>Description:</strong> {entry.content.description}</p>}
        {entry.content.blueprint && <pre><code>{entry.content.blueprint}</code></pre>}
        {entry.content.svgCode && (
          <div className="preview-row">
            <div className="svg-preview" dangerouslySetInnerHTML={{ __html: entry.content.svgCode }} />
            {entry.content.renderedPng && <img src={entry.content.renderedPng} alt="PNG" />}
          </div>
        )}
        {entry.content.confidenceScore !== undefined && (
          <p><strong>Confidence:</strong> {entry.content.confidenceScore}%</p>
        )}
        {entry.content.issues && (
          <div className="issues-list">
            <strong>Issues:</strong>
            <ul>{entry.content.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
};
```

#### 3.8 Integrate into SVGGenerationView

```typescript
// In SVGGenerationView.tsx
const svgArchitect = useSvgArchitect(postMessage);
const [outputSubTab, setOutputSubTab] = useState<OutputSubTab>('svg');

// Auto-switch to dashboard when architect starts
useEffect(() => {
  if (svgArchitect.isGenerating && svgArchitect.isEnabled) {
    setOutputSubTab('dashboard');
  }
}, [svgArchitect.isGenerating, svgArchitect.isEnabled]);

// In the UI
<div className="output-section">
  {/* Content based on active sub-tab */}
  {outputSubTab === 'svg' && (
    <ExistingSVGOutput svgCode={svgGeneration.svgCode} />
  )}
  {outputSubTab === 'dashboard' && (
    <ArchitectDashboard state={svgArchitect} ... />
  )}
  {outputSubTab === 'conversation' && (
    <ArchitectConversation entries={svgArchitect.conversationEntries} ... />
  )}
</div>

{/* Sub-tabs between output and input - no well */}
<OutputSubTabs
  activeTab={outputSubTab}
  onTabChange={setOutputSubTab}
  architectEnabled={svgArchitect.isEnabled}
/>

<div className="input-section">
  {/* Toggle in input section */}
  <ToggleSwitch
    checked={svgArchitect.isEnabled}
    onChange={svgArchitect.setEnabled}
    label="Experimental: High quality mode"
  />
  {/* ... rest of input controls */}
</div>
```

---

### Phase 4: Settings Integration

#### 4.1 Update SettingsHandler

Add SVG Architect settings to the settings response:

```typescript
// In SettingsHandler.ts
svgBlueprintModel: config.get('svgBlueprintModel', DEFAULT_SVG_BLUEPRINT_MODEL),
svgArchitectMaxIterations: config.get('svgArchitectMaxIterations', 5),
svgArchitectEnabled: config.get('svgArchitectEnabled', false),
```

#### 4.2 Update useSettings Hook

Add fields and update handlers for new settings.

#### 4.3 Add Model Selector for Blueprint Agent

When high-quality mode is enabled, show a second model dropdown for the Blueprint Agent.

---

## File Summary

### New Files

| File | Purpose |
|------|---------|
| `src/infrastructure/ai/orchestration/SVGArchitectOrchestrator.ts` | Main orchestrator |
| `src/infrastructure/ai/orchestration/SVGArchitectConversationManager.ts` | State management |
| `src/infrastructure/ai/prompts/svgArchitectPrompts.ts` | System prompts |
| `src/application/handlers/domain/SVGArchitectHandler.ts` | Message handler |
| `src/shared/types/messages/svgArchitect.ts` | Message payloads |
| `src/presentation/webview/hooks/domain/useSvgArchitect.ts` | UI hook |
| `src/presentation/webview/utils/svgToPng.ts` | SVG rendering utility |
| `src/presentation/webview/components/common/ToggleSwitch.tsx` | Toggle component |
| `src/presentation/webview/components/svg/OutputSubTabs.tsx` | Sub-tab selector |
| `src/presentation/webview/components/svg/ArchitectDashboard.tsx` | Dashboard view |
| `src/presentation/webview/components/svg/ArchitectConversation.tsx` | Conversation view |
| `src/presentation/webview/styles/components/toggle-switch.css` | Toggle styles |
| `src/presentation/webview/styles/components/output-sub-tabs.css` | Sub-tab styles |
| `src/presentation/webview/styles/components/architect-dashboard.css` | Dashboard styles |
| `src/presentation/webview/styles/components/architect-conversation.css` | Conversation styles |

### Modified Files

| File | Changes |
|------|---------|
| `package.json` | Add 3 new settings |
| `src/shared/types/providers.ts` | Add `svgBlueprint` generation type |
| `src/shared/types/messages/base.ts` | Add 6 new message types |
| `src/shared/types/messages/index.ts` | Export new payloads |
| `src/infrastructure/ai/providers/OpenRouterProvider.ts` | Add blueprint model list |
| `src/application/handlers/MessageHandler.ts` | Wire up handler |
| `src/presentation/webview/hooks/domain/index.ts` | Export new hook |
| `src/presentation/webview/components/views/SVGGenerationView.tsx` | Add toggle + conditional flow |
| `src/presentation/webview/App.tsx` | Register message handlers |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| High token usage from iterations | Keep only first + latest PNG in context; default to 5 max iterations |
| Browser SVG rendering inconsistencies | Use standard SVG features; test across common SVGs |
| User confusion about experimental mode | Clear "Experimental" label; preserve existing flow as default |
| Long generation times | Show detailed progress; allow cancel |

---

## Future Enhancements

1. **Jimp integration** - Add resize/crop/effects to generated SVGs
2. **Batch generation** - Generate multiple variants in parallel
3. **Template library** - Save successful blueprints as templates
4. **Confidence threshold setting** - User-configurable auto-approve threshold

---

## Appendix A: JSON Blueprint Format (Future Option)

For future consideration - a structured JSON format for Blueprint Agent output that may improve parsing reliability.

### Schema

```typescript
interface BlueprintOutput {
  description: string;              // Technical description for SVG recreation
  elements: BlueprintElement[];     // Structured element list
  svgBlueprint: string;             // Commented XML structure
  confidence?: number;              // 0-100, only on validation
  fixes?: BlueprintFix[];           // Only on validation with issues
}

interface BlueprintElement {
  name: string;                     // "Main Circle", "Background"
  type: 'rect' | 'circle' | 'ellipse' | 'line' | 'polyline' | 'polygon' | 'path' | 'text' | 'group';
  specs: string;                    // "200px diameter, centered, fill #FF0000"
  layer?: number;                   // Z-order (optional)
}

interface BlueprintFix {
  elementName: string;              // Which element needs fixing
  issue: string;                    // What's wrong
  correction: string;               // What to change
}
```

### Example Output

```json
{
  "description": "A logo featuring a red circle with a centered blue square rotated 45 degrees. The background is white. The circle is the dominant element with the square providing visual interest.",
  "elements": [
    {
      "name": "Background",
      "type": "rect",
      "specs": "Full viewport (512x512), fill #FFFFFF",
      "layer": 0
    },
    {
      "name": "Main Circle",
      "type": "circle",
      "specs": "200px diameter, centered at (256, 256), fill #FF0000, no stroke",
      "layer": 1
    },
    {
      "name": "Inner Square",
      "type": "rect",
      "specs": "80px square, centered, rotated 45deg, fill #0000FF, no stroke",
      "layer": 2
    }
  ],
  "svgBlueprint": "<svg viewBox=\"0 0 512 512\">\n  <!-- Background: rect 512x512, fill #FFFFFF -->\n  <!-- Main Circle: circle r=100 cx=256 cy=256, fill #FF0000 -->\n  <!-- Inner Square: rect 80x80 centered, transform rotate(45), fill #0000FF -->\n</svg>"
}
```

### Validation Response Example

```json
{
  "description": "...",
  "elements": [...],
  "svgBlueprint": "...",
  "confidence": 72,
  "fixes": [
    {
      "elementName": "Main Circle",
      "issue": "Circle diameter is 150px instead of 200px",
      "correction": "Increase radius from 75 to 100"
    },
    {
      "elementName": "Inner Square",
      "issue": "Square is missing",
      "correction": "Add 80px blue square centered at (256, 256) with 45deg rotation"
    }
  ]
}
```

### Benefits

- **Structured parsing**: No regex needed to extract fields
- **UI integration**: `elements[]` can render as a checklist
- **Validation clarity**: `fixes[]` maps directly to specific elements
- **Consistency**: Schema validation ensures complete output

### Drawbacks

- **LLM reliability**: Models sometimes produce invalid JSON
- **Verbosity**: More tokens than markdown format
- **Escaping**: Multi-line SVG in JSON strings requires escaping

### Migration Path

1. Keep current markdown format as default
2. Add JSON mode as opt-in setting
3. Implement JSON parsing with markdown fallback
4. Evaluate reliability over time
5. Switch default if JSON proves more reliable


