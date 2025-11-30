<p align="center">
  <img src="../assets/pixel-minion-logo-animated-bw.svg" alt="Pixel Minion" width="128"/>
</p>

# Changelog (Detailed)

All notable changes to the Pixel Minion VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-11-30

### Overview

First release of Pixel Minion - AI-powered image and SVG generation inside VS Code. This release establishes the core architecture and provides full-featured image and SVG generation capabilities.

**Key Highlights:**
- Image generation with multi-turn conversations
- SVG generation with code preview
- Token usage tracking with cost display
- Secure API key storage
- Clean Architecture foundation

**Statistics:**
- 30+ commits
- Core feature set complete
- PR #2 for final polish

---

### Features

#### Image Generation Tab

**What It Does:**
Generate images from text prompts with iterative refinement through multi-turn conversations.

**Key Features:**
- **Text-to-Image** - Enter a prompt, get an image
- **Image-to-Image** - Upload reference images for context
- **SVG Context** - Attach SVG files sent as text context (not image)
- **Aspect Ratio** - 1:1, 16:9, 9:16, 4:3, 3:4
- **Seed Control** - Set seed for reproducibility
- **Enhance Prompt** - AI-powered prompt improvement button
- **Multi-Turn** - Refine with follow-up prompts
- **Token Display** - Per-turn tokens and cost

**Files:**
- `src/presentation/webview/components/views/ImageGenerationView.tsx`
- `src/presentation/webview/hooks/domain/useImageGeneration.ts`
- `src/application/handlers/domain/ImageGenerationHandler.ts`
- `src/infrastructure/ai/orchestration/ImageOrchestrator.ts`
- `src/infrastructure/ai/orchestration/ImageConversationManager.ts`
- `src/infrastructure/ai/clients/OpenRouterImageClient.ts`

---

#### SVG Generation Tab

**What It Does:**
Generate vector graphics as code using text models, with multi-size preview.

**Key Features:**
- **Text-to-SVG** - Describe the vector graphic
- **Reference Image** - Upload image for AI reference
- **Multi-Size Preview** - 32px, 64px, 128px thumbnails
- **Code View** - View and copy raw SVG code
- **Multi-Turn** - Refine through iteration
- **Token Display** - Per-turn tokens and cost

**Files:**
- `src/presentation/webview/components/views/SVGGenerationView.tsx`
- `src/presentation/webview/hooks/domain/useSVGGeneration.ts`
- `src/application/handlers/domain/SVGGenerationHandler.ts`
- `src/infrastructure/ai/orchestration/SVGOrchestrator.ts`
- `src/infrastructure/ai/orchestration/SVGConversationManager.ts`
- `src/infrastructure/ai/clients/OpenRouterDynamicTextClient.ts`

---

#### Token Usage Tracking (PR #1)

**What It Does:**
Display per-turn token usage and cost for both Image and SVG generation.

**Implementation:**
- Enable OpenRouter usage accounting with `usage: { include: true }`
- Parse native token counts (`native_tokens_prompt`, `native_tokens_completion`)
- Parse cost data (`cost`, `total_cost`) from responses
- Wire through orchestrators to handlers to webview

**Files Modified:**
- `src/infrastructure/ai/clients/TextClient.ts` - Added `costUsd` to `TokenUsage`
- `src/infrastructure/ai/clients/OpenRouterImageClient.ts` - Enable usage accounting
- `src/infrastructure/ai/clients/OpenRouterDynamicTextClient.ts` - Enable usage accounting
- `src/infrastructure/ai/orchestration/ImageOrchestrator.ts` - Pass through `costUsd`
- `src/infrastructure/ai/orchestration/SVGOrchestrator.ts` - Pass through `costUsd`
- `src/presentation/webview/components/image/ConversationThread.tsx` - Display usage
- `src/presentation/webview/components/views/SVGGenerationView.tsx` - Display usage

---

#### Enhance Prompt Feature (PR #2)

**What It Does:**
AI-powered prompt enhancement button for Image generation.

**Implementation:**
- New message types: `ENHANCE_PROMPT_REQUEST`, `ENHANCE_PROMPT_RESPONSE`
- EnhanceHandler calls text model to improve prompts
- UI button in Image generation header

**Files Added/Modified:**
- `src/shared/types/messages/enhance.ts` - New message types
- `src/application/handlers/domain/EnhanceHandler.ts` - New handler
- `src/presentation/webview/hooks/domain/useImageGeneration.ts` - Enhance action
- `src/presentation/webview/components/views/ImageGenerationView.tsx` - Button UI

---

#### SVG Attachment Support

**What It Does:**
Allow SVG files to be attached as text context (not as image) for reference.

**Implementation:**
- Detect SVG MIME type on upload
- Convert SVG to text and include in prompt
- Show warning for large SVGs (>16KB)

**Files Modified:**
- `src/presentation/webview/hooks/domain/useImageGeneration.ts` - SVG detection
- `src/presentation/webview/components/views/ImageGenerationView.tsx` - Warning display
- `src/presentation/webview/components/svg/SingleImageUploader.tsx` - SVG handling

---

#### Multi-Size SVG Preview

**What It Does:**
Display generated SVGs at 32px, 64px, and 128px to verify scalability.

**Files Modified:**
- `src/presentation/webview/components/views/SVGGenerationView.tsx` - Preview grid
- `src/presentation/webview/styles/components/svg-generation-view.css` - Styles

---

### Model Configuration

#### Image Models

**File:** `src/infrastructure/ai/providers/OpenRouterProvider.ts`

```typescript
export const OPENROUTER_IMAGE_MODELS: ModelDefinition[] = [
  { id: 'google/gemini-2.5-flash-image', displayName: '⭐ Nano Banana 10/25 - Recommended' },
  { id: 'google/gemini-2.5-flash-image-preview', displayName: 'Nano Banana 8/25' },
  { id: 'google/gemini-3-pro-image-preview', displayName: 'Nano Banana Pro' },
  { id: 'openai/gpt-5-image-mini', displayName: 'GPT-5 Image Mini' },
  { id: 'openai/gpt-5-image', displayName: 'GPT-5 Image' },
  { id: 'black-forest-labs/flux.2-pro', displayName: 'FLUX.2 Pro' },
  { id: 'black-forest-labs/flux.2-flex', displayName: 'FLUX.2 Flex' },
];

export const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image';
```

#### SVG Models

```typescript
export const OPENROUTER_SVG_MODELS: ModelDefinition[] = [
  { id: 'google/gemini-3-pro-preview', displayName: 'Gemini Pro 3.0' },
  { id: 'anthropic/claude-opus-4', displayName: 'Claude Opus 4.5' },
  { id: 'openai/gpt-5.1-codex', displayName: 'OpenAI: GPT-5.1 Codex' },
];

export const DEFAULT_SVG_MODEL = 'openai/gpt-5.1-codex';
```

---

### Architecture

#### Three-Suite AI Infrastructure

The extension uses three parallel AI generation suites:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Three Parallel Suites                         │
├─────────────────────────────────────────────────────────────────┤
│  TEXT SUITE              IMAGE SUITE              SVG SUITE      │
│  ───────────             ────────────             ─────────      │
│  TextOrchestrator        ImageOrchestrator        SVGOrchestrator│
│       │                        │                        │        │
│       ├── TextClient           ├── ImageClient          ├── DynamicTextClient
│       │                        │                        │        │
│       └── TextConversation     └── ImageConversation    └── SVGConversation
│           Manager                  Manager                  Manager
└─────────────────────────────────────────────────────────────────┘
```

**Pattern:**
- Orchestrator coordinates client + conversation manager
- Client handles API communication
- ConversationManager maintains state and history
- Re-hydration pattern restores state after extension restart

**Files:**
- `src/infrastructure/ai/orchestration/` - Orchestrators and managers
- `src/infrastructure/ai/clients/` - API clients

---

#### Message Envelope Pattern

All extension ↔ webview communication uses typed envelopes:

```typescript
interface MessageEnvelope<TPayload> {
  type: MessageType;
  source: MessageSource;
  payload: TPayload;
  timestamp: number;
  correlationId?: string;
}
```

**Files:**
- `src/shared/types/messages/` - Message type definitions
- `src/application/handlers/MessageHandler.ts` - Strategy pattern routing

---

#### Tripartite Hook Pattern

Domain hooks export three interfaces:

```typescript
// State (read-only)
interface ImageGenerationState { ... }

// Actions (write operations)
interface ImageGenerationActions { ... }

// Persistence (what gets saved)
interface ImageGenerationPersistence { ... }
```

**Files:**
- `src/presentation/webview/hooks/domain/useImageGeneration.ts`
- `src/presentation/webview/hooks/domain/useSVGGeneration.ts`
- `src/presentation/webview/hooks/domain/useSettings.ts`

---

### Fixed

#### Reference Image Persistence Bug (PR #2)

**Issue:** SVG reference text persisted incorrectly across sessions, causing stale SVG to be attached to new generations.

**Root Cause:** `referenceSvgText` and `referenceImages` were included in persistence, but `referenceSvgIndex` was not, creating inconsistent state after reload.

**Fix:** Removed reference images from persistence - they're now per-request context only.

**Files Modified:**
- `src/presentation/webview/hooks/domain/useImageGeneration.ts`

```typescript
// Before (bug)
export interface ImageGenerationPersistence {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImages: string[];     // BUG: persisted
  referenceSvgText: string | null; // BUG: persisted
  ...
}

// After (fix)
export interface ImageGenerationPersistence {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  // Reference images NOT persisted - per-request context only
  ...
}
```

---

### Security

#### Secure API Key Storage

**Implementation:**
- API keys stored using VS Code SecretStorage API
- macOS: Keychain Access
- Windows: Credential Manager
- Linux: libsecret

**Files:**
- `src/infrastructure/secrets/SecretStorageService.ts`
- `src/application/handlers/domain/SettingsHandler.ts`

---

### Developer Notes

#### Build Commands

```bash
npm run watch    # Development with hot reload
npm run build    # Production build
npm test         # Run tests
npm run lint     # Check code style
```

#### Testing

82 tests across 8 test suites:

| Suite | Tests | Coverage |
|-------|-------|----------|
| MessageRouter | 9 | Strategy pattern routing |
| MessageHandler | 8 | Message dispatch |
| HelloWorldHandler | 5 | Markdown rendering |
| SettingsHandler | 9 | Settings management |
| AIHandler | 8 | Conversation handling |
| SecretStorageService | 10 | Secure storage |
| LoggingService | 12 | Output channel |
| PromptLoader | 11 | Resource loading |

---

### References

- CLAUDE.md - Developer guidance and architecture documentation
- ADR files in `docs/adr/` for architectural decisions

---

### Links

- [GitHub Repository](https://github.com/okeylanders/pixel-minion-vscode)
- [OpenRouter API](https://openrouter.ai/)
- [Buy Me a Coffee](https://buymeacoffee.com/okeylanders)

---

**Thank you for using Pixel Minion! Happy creating!**
