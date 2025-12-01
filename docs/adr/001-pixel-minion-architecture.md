# ADR-001: Pixel Minion Architecture

## Status
Accepted

## Context

We are converting this VSCode extension template into "Pixel Minion" - an AI-powered image generation extension. The extension will allow users to:

1. Generate images from text prompts using various AI models via OpenRouter
2. Perform image-to-image transformations (upload reference images + prompt)
3. Generate SVG code using text models capable of producing vector graphics
4. Iterate on generations via chat continuation
5. Save generated assets to the workspace

The existing template provides:
- OpenRouter client infrastructure (`AIOrchestrator`, `OpenRouterClient`)
- Tab-based webview UI with React
- Message envelope system with strategy-pattern routing
- Secure API key storage via VSCode SecretStorage
- Settings management via VSCode configuration

## Decision

### 1. Two-Tab Architecture

Replace existing tabs with two specialized tabs:

| Tab | Purpose | Models | Output |
|-----|---------|--------|--------|
| **Image Generation** | Text-to-image, image-to-image | OpenRouter image models | PNG/JPG binary |
| **SVG Generation** | Generate vector graphics as code | Text models (Gemini, Opus) | SVG text file |

### 2. Model Configuration

#### Image Generation Tab Models
| Display Name | Model ID | Notes |
|--------------|----------|-------|
| Gemini 2.5 Flash Image | `google/gemini-2.5-flash-image` | Budget option ($0.30/2.50) |
| Gemini 2.5 Flash Preview | `google/gemini-2.5-flash-image-preview` | Budget preview |
| Gemini 3 Pro Image | `google/gemini-3-pro-image-preview` | Mid-tier ($2/12) |
| GPT-5 Image Mini | `openai/gpt-5-image-mini` | OpenAI budget ($2.50/2) |
| GPT-5 Image | `openai/gpt-5-image` | OpenAI premium ($10/10) |
| FLUX.2 Pro | `black-forest-labs/flux.2-pro` | FLUX standard ($3.66) |
| FLUX.2 Flex | `black-forest-labs/flux.2-flex` | FLUX premium ($14.64) |

#### SVG Generation Tab Models
| Display Name | Model ID | Notes |
|--------------|----------|-------|
| Gemini Pro 3.0 | `google/gemini-3-pro-preview` | Best for structured output |
| Claude Opus 4.5 | `anthropic/claude-opus-4` | Best reasoning |

### 3. Aspect Ratio Options (Both Tabs)

```typescript
type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3';

const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
  '3:2': { width: 1024, height: 683 },
  '2:3': { width: 683, height: 1024 },
};
```

### 4. Provider Interface & Model Enumeration

Each provider implements a common interface that includes curated model lists per generation type. This powers the dropdowns and enables future provider extensibility.

```typescript
// src/shared/types/providers.ts

export type GenerationType = 'image' | 'svg';

export interface ModelDefinition {
  id: string;           // e.g., 'google/gemini-2.5-flash-image'
  displayName: string;  // e.g., 'Gemini 2.5 Flash Image'
  description?: string;
  inputCost?: number;   // $ per 1M tokens
  outputCost?: number;
}

export interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  models: Record<GenerationType, ModelDefinition[]>;
  supportsImageInput: boolean;
  supportsImageOutput: boolean;
}

// Provider implementations return their config
export interface AIProvider {
  getConfig(): ProviderConfig;
  createClient(apiKey: string, model: string): AIClient;
}
```

#### OpenRouter Provider Implementation

```typescript
// src/infrastructure/ai/providers/OpenRouterProvider.ts

export const OPENROUTER_CONFIG: ProviderConfig = {
  id: 'openrouter',
  displayName: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  supportsImageInput: true,
  supportsImageOutput: true,
  models: {
    image: [
      { id: 'google/gemini-2.5-flash-image', displayName: 'Gemini 2.5 Flash Image', inputCost: 0.30, outputCost: 2.50 },
      { id: 'google/gemini-2.5-flash-image-preview', displayName: 'Gemini 2.5 Flash Preview', inputCost: 0.30, outputCost: 2.50 },
      { id: 'google/gemini-3-pro-image-preview', displayName: 'Gemini 3 Pro Image', inputCost: 2.00, outputCost: 12.00 },
      { id: 'openai/gpt-5-image-mini', displayName: 'GPT-5 Image Mini', inputCost: 2.50, outputCost: 2.00 },
      { id: 'openai/gpt-5-image', displayName: 'GPT-5 Image', inputCost: 10.00, outputCost: 10.00 },
      { id: 'black-forest-labs/flux.2-pro', displayName: 'FLUX.2 Pro', inputCost: 3.66, outputCost: 3.66 },
      { id: 'black-forest-labs/flux.2-flex', displayName: 'FLUX.2 Flex', inputCost: 14.64, outputCost: 14.64 },
    ],
    svg: [
      { id: 'google/gemini-3-pro-preview', displayName: 'Gemini Pro 3.0', inputCost: 1.25, outputCost: 10.00 },
      { id: 'anthropic/claude-opus-4', displayName: 'Claude Opus 4.5', inputCost: 15.00, outputCost: 75.00 },
    ],
  },
};
```

#### Usage in Components

```typescript
// In ModelSelector.tsx
import { OPENROUTER_CONFIG } from '@providers/OpenRouterProvider';

const imageModels = OPENROUTER_CONFIG.models.image;  // For Image Generation tab dropdown
const svgModels = OPENROUTER_CONFIG.models.svg;      // For SVG Generation tab dropdown
```

#### Future Extensibility

When adding new providers (e.g., custom endpoint):

```typescript
// Future: CustomProvider - allows user to point to arbitrary URL + auth
const CUSTOM_CONFIG: ProviderConfig = {
  id: 'custom',
  displayName: 'Custom Endpoint',
  baseUrl: '', // User-configured via settings
  models: {
    image: [], // User-configured or discovered via API
    svg: [],
  },
  supportsImageInput: true,  // User-configured
  supportsImageOutput: true,
};
```

### 5. OpenRouter API Patterns

#### Image Input (for image-to-image / reference images)

Send images via content array with `image_url` type:

```typescript
const messages = [{
  role: 'user',
  content: [
    { type: 'text', text: 'Transform this image into a watercolor painting' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,{base64_data}' } }
  ]
}];
```

#### Image Generation Output

Request image generation using `modalities` parameter:

```typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash-image',
    messages: [{ role: 'user', content: 'A sunset over mountains' }],
    modalities: ['image', 'text'],
    image_config: { aspect_ratio: '16:9' }  // For Gemini models
  }),
});
```

#### Response Format

Images returned as base64 in the response:

```typescript
interface ImageGenerationResponse {
  choices: [{
    message: {
      role: 'assistant';
      content: string;  // Text response (may be empty)
      images?: [{
        type: 'image_url';
        image_url: { url: string };  // data:image/png;base64,...
      }];
    };
  }];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### 6. UI Layout

#### Image Generation Tab
```
┌─────────────────────────────────────────────────────────┐
│ [Model Dropdown ▼]              [Aspect Ratio ▼] 1:1   │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Prompt: Describe the image you want to generate...  │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│ [+ Add Reference Images]  [Generate ▶]                  │
│ ┌──────┐ ┌──────┐                                       │
│ │ img1 │ │ img2 │  (uploaded reference thumbnails)     │
│ └──────┘ └──────┘                                       │
├─────────────────────────────────────────────────────────┤
│ Generated Images:                                       │
│ ┌────────────────────────────┐                          │
│ │                            │                          │
│ │      [Generated Image]     │  [💾 Save]               │
│ │                            │                          │
│ └────────────────────────────┘                          │
│ ┌────────────────────────────┐                          │
│ │      [Previous Image]      │  [💾 Save]               │
│ └────────────────────────────┘                          │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Continue: Make it more vibrant...          [Send ▶] │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### SVG Generation Tab
```
┌─────────────────────────────────────────────────────────┐
│ [Model Dropdown ▼]              [Aspect Ratio ▼] 1:1   │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Prompt: Describe the SVG you want...                │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│ [+ Add Reference Image (optional)]  [Generate ▶]        │
│ ┌──────┐                                                │
│ │ ref  │  (single reference image)                     │
│ └──────┘                                                │
├─────────────────────────────────────────────────────────┤
│ Generated SVG:                                          │
│ ┌────────────────────────────┐                          │
│ │                            │                          │
│ │    [SVG Preview Render]    │  [💾 Save] [📋 Copy]     │
│ │                            │                          │
│ └────────────────────────────┘                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ <svg viewBox="0 0 100 100">                         │ │
│ │   <circle cx="50" cy="50" r="40"/>                  │ │
│ │ </svg>                          (collapsible code)  │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Refine: Add a gradient fill...             [Send ▶] │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 7. Message Types

New message types to add to `MessageType` enum:

```typescript
// Image Generation
IMAGE_GENERATION_REQUEST = 'IMAGE_GENERATION_REQUEST',
IMAGE_GENERATION_RESPONSE = 'IMAGE_GENERATION_RESPONSE',
IMAGE_GENERATION_CONTINUE = 'IMAGE_GENERATION_CONTINUE',
IMAGE_GENERATION_CLEAR = 'IMAGE_GENERATION_CLEAR',
IMAGE_SAVE_REQUEST = 'IMAGE_SAVE_REQUEST',
IMAGE_SAVE_RESULT = 'IMAGE_SAVE_RESULT',

// SVG Generation
SVG_GENERATION_REQUEST = 'SVG_GENERATION_REQUEST',
SVG_GENERATION_RESPONSE = 'SVG_GENERATION_RESPONSE',
SVG_GENERATION_CONTINUE = 'SVG_GENERATION_CONTINUE',
SVG_GENERATION_CLEAR = 'SVG_GENERATION_CLEAR',
SVG_SAVE_REQUEST = 'SVG_SAVE_REQUEST',
SVG_SAVE_RESULT = 'SVG_SAVE_RESULT',
```

### 8. Payload Interfaces

```typescript
// Image Generation
interface ImageGenerationRequestPayload {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImages?: string[];  // base64 encoded
  conversationId?: string;     // for continuation
}

interface ImageGenerationResponsePayload {
  conversationId: string;
  images: GeneratedImage[];
  turnNumber: number;
}

interface GeneratedImage {
  id: string;
  data: string;          // base64
  mimeType: string;      // 'image/png' | 'image/jpeg'
  prompt: string;        // prompt that generated it
  timestamp: number;
}

// SVG Generation
interface SVGGenerationRequestPayload {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImage?: string;     // base64 encoded
  conversationId?: string;
}

interface SVGGenerationResponsePayload {
  conversationId: string;
  svgCode: string;
  turnNumber: number;
}

// Save
interface SaveRequestPayload {
  type: 'image' | 'svg';
  data: string;              // base64 for image, raw text for svg
  suggestedFilename: string;
}

interface SaveResultPayload {
  success: boolean;
  filePath?: string;
  error?: string;
}
```

### 9. Handler Structure

Create two domain handlers:

```
src/application/handlers/domain/
├── ImageGenerationHandler.ts   # Handles image gen requests, uses OpenRouterClient
└── SVGGenerationHandler.ts     # Handles SVG gen requests, uses AIOrchestrator
```

**ImageGenerationHandler**: Calls OpenRouter image generation endpoints, manages image conversation state, handles save requests.

**SVGGenerationHandler**: Uses existing `AIOrchestrator` with SVG-focused system prompt, parses SVG from response, handles save requests.

### 10. Component Structure

```
src/presentation/webview/components/
├── views/
│   ├── ImageGenerationView.tsx    # Main image gen tab
│   └── SVGGenerationView.tsx      # Main SVG gen tab
├── image/
│   ├── ImagePromptInput.tsx       # Prompt textarea + generate button
│   ├── ImageUploader.tsx          # Reference image upload (multi)
│   ├── ImageGallery.tsx           # Generated images display
│   ├── ImageCard.tsx              # Single image with save button
│   ├── ModelSelector.tsx          # Dropdown for model selection
│   └── AspectRatioSelector.tsx    # Aspect ratio dropdown
├── svg/
│   ├── SVGPromptInput.tsx         # Prompt textarea + generate button
│   ├── SVGPreview.tsx             # Rendered SVG preview
│   ├── SVGCodeView.tsx            # Collapsible code display
│   └── SingleImageUploader.tsx    # Single reference image
└── shared/
    ├── ContinueChatInput.tsx      # Bottom chat continuation input
    └── SaveButton.tsx             # Reusable save button
```

### 11. Hook Structure

```
src/presentation/webview/hooks/domain/
├── useImageGeneration.ts    # State + actions for image tab
└── useSVGGeneration.ts      # State + actions for SVG tab
```

Following tripartite pattern:
- **State**: prompt, model, aspectRatio, referenceImages, generatedImages, conversationId, isLoading
- **Actions**: setPrompt, setModel, setAspectRatio, addReferenceImage, removeReferenceImage, generate, continueChat, clearConversation, saveImage
- **Persistence**: Last used model, aspect ratio preferences

### 12. Settings

Add to `package.json` contributes.configuration:

```json
{
  "pixelMinion.outputDirectory": {
    "type": "string",
    "default": "pixel-minion",
    "description": "Directory (relative to workspace root) where generated images and SVGs are saved"
  },
  "pixelMinion.defaultImageModel": {
    "type": "string",
    "default": "google/gemini-2.5-flash-image",
    "description": "Default model for image generation"
  },
  "pixelMinion.defaultSVGModel": {
    "type": "string",
    "default": "google/gemini-3-pro-preview",
    "description": "Default model for SVG generation"
  },
  "pixelMinion.defaultAspectRatio": {
    "type": "string",
    "default": "1:1",
    "enum": ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"],
    "description": "Default aspect ratio for generated images"
  }
}
```

### 13. SVG System Prompt

```
You are an expert SVG artist. Generate clean, well-structured SVG code based on user descriptions.

Rules:
1. Output ONLY valid SVG code - no explanations unless asked
2. Use viewBox for scalability
3. Prefer semantic grouping with <g> elements
4. Use meaningful id attributes for key elements
5. Keep code clean and readable with proper indentation
6. For the requested aspect ratio, set appropriate viewBox dimensions
7. If a reference image is provided, use it as inspiration for style/composition

When user asks for refinements, output the complete updated SVG (not just changes).
```

### 14. Conversation State Management

**Image Tab:**
- New prompt via top input: Clears conversation, starts fresh
- Continue input at bottom: Appends to existing conversation
- `conversationId` tracks which conversation images belong to

**SVG Tab:**
- Same pattern as Image Tab
- Uses existing `AIOrchestrator` conversation management

**Persistence (webview globalState):**

- Persist the last rendered thread (conversation + generated outputs) for each tab
- On webview reload, restore the last thread so user doesn't lose work
- Only stores ONE thread per tab (not full history)
- Cleared when user starts a new generation via top prompt

### 15. Token Usage Tracking

Leverage existing token tracking infrastructure:

- `ChatCompletionResult.usage` returns `{ promptTokens, completionTokens, totalTokens }`
- `MessageHandler` already accumulates and broadcasts via `TOKEN_USAGE_UPDATE`
- Image generation responses also include token usage - accumulate same way
- Display in status bar or settings view (existing pattern)

### 16. File Save Logic

```typescript
async function saveGeneratedFile(type: 'image' | 'svg', data: string, filename: string): Promise<string> {
  const config = vscode.workspace.getConfiguration('pixelMinion');
  const outputDir = config.get<string>('outputDirectory', 'pixel-minion');

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!workspaceRoot) throw new Error('No workspace folder open');

  const targetDir = vscode.Uri.joinPath(workspaceRoot, outputDir);

  // Ensure directory exists
  await vscode.workspace.fs.createDirectory(targetDir);

  const filePath = vscode.Uri.joinPath(targetDir, filename);

  if (type === 'image') {
    const buffer = Buffer.from(data, 'base64');
    await vscode.workspace.fs.writeFile(filePath, buffer);
  } else {
    await vscode.workspace.fs.writeFile(filePath, Buffer.from(data, 'utf8'));
  }

  return filePath.fsPath;
}
```

### 17. Implementation Phases

#### Phase 1: Foundation
- [ ] Rename extension from template to "Pixel Minion"
- [ ] Update package.json (name, displayName, settings)
- [ ] Create provider interface types (`src/shared/types/providers.ts`)
- [ ] Create OpenRouter provider config with curated model lists
- [ ] Add new message types and payload interfaces
- [ ] Add `@providers` path alias to tsconfig

#### Phase 2: Image Generation Tab
- [ ] Create ImageGenerationHandler
- [ ] Create useImageGeneration hook
- [ ] Build UI components (ModelSelector, AspectRatioSelector, ImageUploader, ImageGallery)
- [ ] Build ImageGenerationView
- [ ] Implement save functionality
- [ ] Wire up message routing

#### Phase 3: SVG Generation Tab
- [ ] Create SVGGenerationHandler
- [ ] Create useSVGGeneration hook
- [ ] Build UI components (SVGPreview, SVGCodeView, SingleImageUploader)
- [ ] Build SVGGenerationView
- [ ] Implement save functionality
- [ ] Wire up message routing

#### Phase 4: Polish
- [ ] Add loading states and error handling
- [ ] Implement conversation continuation
- [ ] Add settings UI integration
- [ ] Testing
- [ ] Documentation update

## Consequences

### Easier
- Users can generate images and SVGs directly in VSCode
- Single API key (OpenRouter) for multiple model providers
- Tab separation keeps UX clean for different use cases
- Existing infrastructure (messages, handlers, settings) accelerates development

### More Difficult
- Managing two different output types (binary images vs text SVG)
- Image conversation state more complex than text-only chat
- OpenRouter image API may differ from chat completion API (needs investigation)
- Large base64 images may impact webview performance

### Risks
- OpenRouter image generation API format needs verification
- Some models may not support image-to-image well
- SVG parsing from model output may need robust error handling
