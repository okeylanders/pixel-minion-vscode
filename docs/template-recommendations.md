# VSCode Extension Template Recommendations

**Date**: 2025-11-29
**Last Updated**: 2025-11-29 (post settings/model sync + runtime/activation fixes)
**Based on**: Pixel Minion codebase evolution analysis
**Audience**: Template maintainers and extension developers
**Status**: ✅ Most recommendations implemented in Pixel Minion, documented for template backport

### Latest Additions (2025-11-29)
- Bidirectional settings sync: settings as the source of truth for selected models (`imageModel`, `svgModel`, `openRouterModel`, `maxConversationTurns`) flowing VS Code ↔ webview.
- Runtime/activation: target VS Code `^1.93.0` (Node 18) and declare view/command activation events.
- Rehydration coverage: image/SVG wired; text suite infrastructure supports rehydration when history is sent (no UI yet).

## Executive Summary

This document analyzes architectural improvements made during the evolution of the Pixel Minion VSCode extension (originally built from a template) and provides recommendations for enhancing the base template. The recommendations focus on patterns that proved valuable across multiple feature implementations and would benefit all template-based extensions.

### What the Template Does Well

1. **Clean Architecture Foundation** - Clear separation between layers (presentation, application, domain, infrastructure)
2. **TypeScript Strictness** - Strong typing throughout with path aliases
3. **React + Webpack Setup** - Solid bundling configuration for webview
4. **Message Passing Infrastructure** - Basic extension-to-webview communication
5. **Build Tooling** - Watch mode, production builds, packaging scripts

### What Needs Improvement (Original Assessment)

The template provides basic infrastructure but lacks patterns for:

| # | Gap | Status | Notes |
|---|-----|--------|-------|
| 1 | **Message Routing** - Relies on switch statements instead of Strategy pattern | ✅ Implemented | `MessageRouter` with Strategy pattern |
| 2 | **State Management** - No guidance on organizing React hooks by domain | ✅ Implemented | Tripartite pattern (State, Actions, Persistence + Handlers) |
| 3 | **Message Architecture** - No envelope pattern, source tracking, or echo prevention | ✅ Implemented | `MessageEnvelope<TPayload>` with source |
| 4 | **Conversation Patterns** - No examples of multi-turn chat or state threads | ✅ Implemented | Image & SVG conversation threading |
| 5 | **Loading States** - No consistent pattern for async operation feedback | ✅ Implemented | Three-zone layout pattern |
| 6 | **Persistence** - No clear boundary pattern for what gets saved vs ephemeral | ✅ Implemented | Two-store history + `persistedState` |
| 7 | **Error Boundaries** - Missing React error boundary components | ⚠️ Partial | Error handling, no React boundary |
| 8 | **Tab 2 Placeholder** - Empty tab with no example implementation | ✅ Implemented | SVG Generation tab |
| 9 | **AI Infrastructure** - No pattern for AI client integration | ✅ Implemented | Three-Suite Architecture (NEW) |
| 10 | **Thin Handlers** - Business logic mixed with message routing | ✅ Implemented | Orchestrator pattern (NEW) |
| 11 | **Re-hydration** - No pattern for state recovery after restart | ✅ Implemented | Self-contained requests (NEW, image/SVG wired; text infra-ready) |
| 12 | **Settings Sync** - Settings not reflected in UI selections | ✅ Implemented | Bidirectional VS Code settings ↔ webview hook sync for selected models |
| 13 | **Runtime/Activation** - Template targets older VS Code, missing activation events | ✅ Implemented | VS Code ^1.93.0, explicit view/command activations |

**Impact**: Developers starting from the template immediately face architectural decisions without guidance, leading to anti-patterns (god components, switch statement proliferation, scattered state management).

### New Patterns Discovered (Post-Implementation)

During Pixel Minion development, several additional patterns emerged that weren't in the original assessment:

1. **Three-Suite Architecture** - Parallel infrastructure for Text, Image, and SVG generation
2. **Thin Handler Pattern** - Handlers only route messages, orchestrators contain business logic
3. **Two-Store History Pattern** - Presentation stores UI-focused state, Infrastructure stores API-focused state
4. **Re-hydration Pattern** - Infrastructure rebuilds state from webview history after extension restart
5. **Dynamic vs Static Client Pattern** - `OpenRouterDynamicTextClient` vs `OpenRouterTextClient`

These patterns are now documented in:

- [CLAUDE.md](../CLAUDE.md) - Three-Suite AI Infrastructure section
- [ADR-002](adr/002-three-suite-infrastructure.md) - Architectural decision record

---

## Architecture Improvements

### 1. Message Routing Lift Pattern

**Problem**: The template encourages component-level message registration/unregistration, leading to:
- Message handlers registered/unregistered on every mount/unmount
- Lost messages when components are unmounted
- Difficult debugging (which component handles what?)

**Solution**: Centralized App-level message routing with Strategy pattern

#### Before (Template Pattern)

```typescript
// Component-level registration (anti-pattern)
function MyComponent() {
  useEffect(() => {
    const handler = (event) => {
      const message = event.data;
      if (message.type === 'MY_MESSAGE') {
        handleMyMessage(message);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []); // Re-registers on every mount
}
```

**Issues**:
- Handlers live and die with component lifecycle
- No central registry of what messages are handled
- Difficult to trace message flows
- Leads to duplicate handlers or missed messages

#### After (Recommended Pattern)

```typescript
// src/presentation/webview/hooks/useMessageRouter.ts
import { useEffect, useRef } from 'react';
import { MessageType, MessageEnvelope } from '@messages';

export type MessageHandler = (message: MessageEnvelope) => void;
export type MessageHandlerMap = Partial<Record<MessageType, MessageHandler>>;

/**
 * App-level message router using Strategy pattern
 * Handlers stay registered even when views unmount
 */
export function useMessageRouter(handlers: MessageHandlerMap): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const messageHandler = (event: MessageEvent<MessageEnvelope>) => {
      const message = event.data;

      // Echo prevention - ignore messages from webview
      if (message.source?.startsWith('webview.')) {
        return;
      }

      const handler = handlersRef.current[message.type];
      if (handler) {
        handler(message);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []); // Stable listener, handlers via ref
}
```

```typescript
// src/presentation/webview/App.tsx
export function App() {
  const imageGeneration = useImageGeneration();
  const svgGeneration = useSVGGeneration();
  const settings = useSettings();

  // Centralized routing - handlers stay registered
  useMessageRouter({
    [MessageType.IMAGE_GENERATION_RESPONSE]: imageGeneration.handleGenerationResponse,
    [MessageType.SVG_GENERATION_RESPONSE]: svgGeneration.handleGenerationResponse,
    [MessageType.SETTINGS_DATA]: settings.handleSettingsData,
    [MessageType.ERROR]: (msg) => {
      // Route errors to appropriate handler based on source
      const source = msg.source ?? '';
      if (source.includes('image')) {
        imageGeneration.handleError(msg);
      } else if (source.includes('svg')) {
        svgGeneration.handleError(msg);
      }
    },
  });

  return (/* ... */);
}
```

**Benefits**:
- Handlers registered once at App level
- Declarative routing (map-based, not switch-based)
- Stable event listener (no re-registration)
- Clear registry of all message types
- Echo prevention built-in
- Easy to trace message flows

**Template Recommendation**: Replace component-level registration example with `useMessageRouter` hook in template's `App.tsx`.

### 1b. Settings Sync Pattern (NEW)

**Problem**: Template settings were one-way and not reflected in UI selections; defaults drift from actual selections.

**Solution**:
- Use settings keys for the selected models (`imageModel`, `svgModel`, `openRouterModel`, `maxConversationTurns`).
- Webview hooks send `UPDATE_SETTING` on dropdown changes.
- Extension listens for configuration changes and rebroadcasts `SETTINGS_DATA` so UI stays in sync with VS Code settings (including external edits).
- Text client resets on model change; image/SVG keep their model/aspect per conversation (start new convo to change).

**Template Recommendation**: Ship a bidirectional settings example (config-change listener + hook wiring). Avoid “default model” settings; use “selected model” as the single source of truth.

### 1c. Runtime/Activation Pattern (NEW)

**Problem**: Template targeted older VS Code runtimes and missed activation events for the webview.

**Solution**:
- Require VS Code `^1.93.0` (Node 18 fetch).
- Declare activation events (`onView:<viewId>`, commands) and keep IDs consistent across container/view/commands.

**Template Recommendation**: Update `engines.vscode`, `activationEvents`, and naming in the template starter.

---

### 2. Tripartite Hook Pattern with Handlers

**Problem**: Template has no guidance on organizing domain hooks, leading to:
- Monolithic hooks with unclear responsibilities
- Mixed concerns (UI state + domain logic + persistence)
- No clear contract for what hooks expose
- Handlers buried inside hooks (can't route at App level)

**Solution**: Tripartite Interface Pattern - State, Actions, Handlers, Persistence

#### Pattern Structure

```typescript
// src/presentation/webview/hooks/domain/useImageGeneration.ts

// 1. State Interface (read-only)
export interface ImageGenerationState {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  generatedImages: GeneratedImage[];
  conversationHistory: ConversationTurn[];
  isLoading: boolean;
  error: string | null;
}

// 2. Actions Interface (user operations)
export interface ImageGenerationActions {
  setPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  generate: () => void;
  continueChat: (prompt: string) => void;
  clearConversation: () => void;
  saveImage: (image: GeneratedImage) => void;
}

// 3. Message Handlers Interface (for App-level routing)
export interface ImageGenerationHandlers {
  handleGenerationResponse: (message: MessageEnvelope) => void;
  handleSaveResult: (message: MessageEnvelope) => void;
  handleError: (message: MessageEnvelope) => void;
}

// 4. Persistence Interface (what gets saved)
export interface ImageGenerationPersistence {
  prompt: string;
  model: string;
  conversationHistory: ConversationTurn[];
  generatedImages: GeneratedImage[];
}

// Composed return type
export type UseImageGenerationReturn =
  ImageGenerationState &
  ImageGenerationActions &
  ImageGenerationHandlers &
  { persistedState: ImageGenerationPersistence };
```

```typescript
export function useImageGeneration(
  initialState?: Partial<ImageGenerationPersistence>
): UseImageGenerationReturn {
  const vscode = useVSCodeApi();

  // State
  const [prompt, setPrompt] = useState(initialState?.prompt ?? '');
  const [model, setModel] = useState(initialState?.model ?? DEFAULT_MODEL);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>(
    initialState?.generatedImages ?? []
  );
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>(
    initialState?.conversationHistory ?? []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Message handlers (exposed for App-level routing)
  const handleGenerationResponse = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as ImageGenerationResponsePayload;
    setGeneratedImages(payload.images);

    // Build conversation history
    const turn: ConversationTurn = {
      id: `turn-${payload.turnNumber}`,
      prompt: pendingPrompt,
      images: payload.images,
      turnNumber: payload.turnNumber,
      timestamp: Date.now(),
    };
    setConversationHistory((prev) => [...prev, turn]);
    setIsLoading(false);
  }, []);

  // Actions
  const generate = useCallback(() => {
    setIsLoading(true);
    setConversationHistory([]); // Clear for new conversation
    vscode.postMessage(
      createEnvelope(MessageType.IMAGE_GENERATION_REQUEST, 'webview.imageGeneration', {
        prompt,
        model,
      })
    );
  }, [prompt, model, vscode]);

  // Persistence object
  const persistedState: ImageGenerationPersistence = {
    prompt,
    model,
    conversationHistory,
    generatedImages,
  };

  return {
    // State
    prompt,
    model,
    generatedImages,
    conversationHistory,
    isLoading,
    error,
    // Actions
    setPrompt,
    setModel,
    generate,
    continueChat,
    clearConversation,
    saveImage,
    // Message Handlers (for App-level routing)
    handleGenerationResponse,
    handleSaveResult,
    handleError,
    // Persistence
    persistedState,
  };
}
```

**Benefits**:
- Clear separation of concerns (State, Actions, Handlers, Persistence)
- Handlers exposed for App-level message routing
- Type-safe contracts for hook consumers
- Explicit persistence boundary
- Easy to test each interface independently

**Template Recommendation**:
1. Replace example hook with tripartite pattern
2. Add documentation explaining each interface's purpose
3. Show how handlers wire to `useMessageRouter` in `App.tsx`

---

### 3. Persistence Boundaries Pattern

**Problem**: Template has no guidance on what to persist vs what's ephemeral, leading to:
- Over-persistence (saving transient UI state)
- Under-persistence (losing important user work)
- Unclear persistence boundaries
- No consistent pattern across hooks

**Solution**: Explicit `persistedState` property pattern

#### Pattern

```typescript
// Each hook declares explicit persistence interface
export interface ImageGenerationPersistence {
  prompt: string;           // User's work - persist
  model: string;            // User preference - persist
  conversationHistory: ConversationTurn[];  // User's results - persist
  // Note: isLoading, error NOT persisted (ephemeral UI state)
}

export function useImageGeneration(
  initialState?: Partial<ImageGenerationPersistence>
): UseImageGenerationReturn {
  // ... hook implementation ...

  // Explicitly declare what persists
  const persistedState: ImageGenerationPersistence = {
    prompt,
    model,
    conversationHistory,
    generatedImages,
  };

  return {
    // ... state, actions, handlers ...
    persistedState, // Explicit persistence boundary
  };
}
```

```typescript
// App.tsx composes all persistence
export function App() {
  const { saveState, loadState } = usePersistence();
  const persistedState = loadState();

  const imageGeneration = useImageGeneration(persistedState.imageGeneration);
  const svgGeneration = useSVGGeneration(persistedState.svgGeneration);
  const settings = useSettings(persistedState.settings);

  // Compose domain persistence
  useEffect(() => {
    saveState({
      activeTab,
      imageGeneration: imageGeneration.persistedState,
      svgGeneration: svgGeneration.persistedState,
      settings: settings.persistedState,
    });
  }, [
    activeTab,
    imageGeneration.persistedState,
    svgGeneration.persistedState,
    settings.persistedState,
    saveState,
  ]);

  return (/* ... */);
}
```

```typescript
// src/presentation/webview/hooks/usePersistence.ts
export interface PersistenceState {
  imageGeneration?: ImageGenerationPersistence;
  svgGeneration?: SVGGenerationPersistence;
  settings?: SettingsPersistence;
  activeTab?: string;
}

export function usePersistence() {
  const vscode = useVSCodeApi();

  const saveState = useCallback((state: PersistenceState) => {
    vscode.setState(state);
  }, [vscode]);

  const loadState = useCallback((): PersistenceState => {
    return (vscode.getState() as PersistenceState) || {};
  }, [vscode]);

  return { saveState, loadState };
}
```

**Benefits**:
- Clear persistence boundary (explicit interface)
- Declarative (hooks own their persistence contract)
- Type-safe (TypeScript validates shape)
- Centralized (one place to manage all persistence)
- Easy to debug (inspect `persistedState` object)

**Template Recommendation**:
1. Add `usePersistence` hook to template
2. Show `persistedState` pattern in example domain hook
3. Document what to persist (user work, preferences) vs not persist (loading, errors)

---

### 4. Loading State Wiring

**Problem**: Template has no loading state examples, leading to:
- Inconsistent loading indicators
- Layout shift (content jumps when loading indicator appears)
- Loading state scattered across components
- No clear pattern for placement

**Solution**: Conditional rendering with strategic placement

#### Anti-Pattern (Causes Layout Shift)

```typescript
// Loading indicator at top - causes content to jump
function MyView() {
  return (
    <div>
      {isLoading && <LoadingIndicator />}  {/* Pushes content down */}
      <Content />
    </div>
  );
}
```

#### Recommended Pattern

```typescript
// src/presentation/webview/components/shared/LoadingIndicator.tsx
export interface LoadingIndicatorProps {
  isLoading: boolean;
  defaultMessage?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isLoading,
  defaultMessage = 'Loading...',
}) => {
  if (!isLoading) return null;

  return (
    <div className="loading-indicator">
      <div className="loading-spinner" />
      <span>{defaultMessage}</span>
    </div>
  );
};
```

```typescript
// Three-zone layout prevents shift
function ImageGenerationView({ imageGeneration }) {
  return (
    <div className="image-generation-view">
      {/* Zone 1: Fixed top - input controls */}
      <div className="image-generation-header">
        <ModelSelector />
        <PromptInput />
        <Button onClick={generate} disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate'}
        </Button>
      </div>

      {/* Zone 2: Scrollable middle - content */}
      <div className="image-generation-scroll-area">
        <ConversationThread turns={conversationHistory} />

        {/* Loading indicator at BOTTOM where new content will appear */}
        <LoadingIndicator
          isLoading={isLoading}
          defaultMessage="Generating image..."
        />
      </div>

      {/* Zone 3: Fixed bottom - continue chat input */}
      {conversationId && (
        <ContinueChatInput onSubmit={continueChat} disabled={isLoading} />
      )}
    </div>
  );
}
```

```css
/* Three-zone layout CSS */
.image-generation-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.image-generation-header {
  flex-shrink: 0;  /* Fixed top */
  padding: 1rem;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.image-generation-scroll-area {
  flex: 1;         /* Scrollable middle */
  overflow-y: auto;
  padding: 1rem;
}

.continue-chat-input {
  flex-shrink: 0;  /* Fixed bottom */
  padding: 1rem;
  border-top: 1px solid var(--vscode-panel-border);
}
```

**Benefits**:
- No layout shift (loading indicator appears where content will be)
- Three-zone layout (fixed top, scrolling middle, fixed bottom)
- Consistent pattern across all views
- Accessible (button disabled states)

**Template Recommendation**:

1. Add `LoadingIndicator` component to template
2. Show three-zone layout in example tab
3. Document placement strategy (bottom of scroll area)

---

### 5. Three-Suite AI Infrastructure Pattern (NEW)

**Problem**: Template has no guidance on AI client integration, leading to:

- Business logic mixed with API calls in handlers
- No consistent pattern for conversation state management
- No recovery mechanism after extension restarts
- Tight coupling between handlers and specific AI providers

**Solution**: Three-Suite Architecture with Orchestrator pattern

#### Pattern Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                    Three Parallel Suites                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  TEXT SUITE              IMAGE SUITE              SVG SUITE      │
│  ───────────             ────────────             ─────────      │
│  TextOrchestrator        ImageOrchestrator        SVGOrchestrator│
│       │                        │                        │         │
│       ├── TextClient           ├── ImageClient          ├── TextClient │
│       │   (static model)       │                        │   (dynamic) │
│       │                        │                        │         │
│       └── TextConversation     └── ImageConversation    └── SVGConversation │
│           Manager                  Manager                  Manager │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

Each suite consists of three layers:

1. **Orchestrator** - Coordinates between client and conversation manager
   - Provides clean interface for handlers
   - Handles conversation lifecycle
   - Manages state transitions
   - Supports re-hydration after extension restart

2. **Client** - Communicates with AI service provider
   - Implements provider-specific API calls
   - Handles authentication via SecretStorageService
   - Returns structured results

3. **ConversationManager** - Maintains conversation state
   - Tracks message history
   - Formats messages for API calls
   - Rebuilds state from history (re-hydration)

#### Thin Handler Pattern

Handlers are THIN - they only route messages to orchestrators:

```typescript
// Handler receives orchestrator, doesn't create clients
export class ImageGenerationHandler {
  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly orchestrator: ImageOrchestrator,  // Injected!
    private readonly logger: LoggingService
  ) {}

  // Handler only routes messages - NO business logic
  async handleGenerationRequest(message: MessageEnvelope<...>): Promise<void> {
    const result = await this.orchestrator.generateImage(...);
    this.postMessage(createEnvelope(..., result));
  }
}
```

#### Dependency Injection Pattern

Orchestrators receive clients via `setClient()` method:

```typescript
// In MessageHandler.ts
const imageOrchestrator = new ImageOrchestrator(logger);
imageOrchestrator.setClient(new OpenRouterImageClient(secretStorage, logger));

const svgOrchestrator = new SVGOrchestrator(logger);
svgOrchestrator.setClient(new OpenRouterDynamicTextClient(secretStorage, logger));

// Handlers receive orchestrators
this.imageGenerationHandler = new ImageGenerationHandler(
  postMessage,
  imageOrchestrator,  // Injected!
  logger
);
```

#### Two-Store History Pattern

The extension maintains conversation history in two separate stores:

1. **Presentation Layer** (webview): `ConversationTurn[]`
   - UI-focused structure
   - Persists across webview reloads via `vscode.setState()`
   - Contains user prompts, assistant responses, metadata

2. **Infrastructure Layer** (extension): `TextMessage[]` or `ImageConversationMessage[]`
   - API-focused structure
   - Ephemeral (in-memory `Map`)
   - Lost when extension restarts
   - Rebuilt via re-hydration when needed

#### Re-hydration Pattern

Extension restarts lose infrastructure state, but webview state persists. Re-hydration rebuilds infrastructure state from webview history:

```typescript
// Webview sends history with continuation requests
const continueChat = useCallback((prompt: string) => {
  const history = conversationHistory.map(turn => ({
    prompt: turn.prompt,
    images: turn.images,
  }));

  postMessage({
    type: MessageType.CONTINUE_CONVERSATION,
    payload: {
      prompt,
      conversationId,
      history,  // Self-contained request enables re-hydration
      model,
      aspectRatio,
    }
  });
}, [conversationId, conversationHistory, model, aspectRatio]);

// Handler re-hydrates if conversation lost
async handleContinueRequest(message) {
  let conversation = this.orchestrator.getConversation(conversationId);

  // If conversation not found but history provided, re-hydrate
  if (!conversation && history?.length) {
    conversation = await this.orchestrator.continueConversation(
      conversationId,
      prompt,
      history,  // Orchestrator rebuilds state
      model,
      aspectRatio
    );
  }
}
```

**Benefits**:

- Webview doesn't need to know if extension restarted
- Handler uses existing conversation if available (ignores history)
- Handler rebuilds from history if conversation lost
- AI model gets full context even after restart

#### Static vs Dynamic Client Pattern

Two client types for different use cases:

1. **OpenRouterTextClient** (Static Model)
   - Model set at construction time
   - Used when model never changes (Text Suite)

2. **OpenRouterDynamicTextClient** (Dynamic Model)
   - Model changed via `setModel()` per request
   - Used when UI allows model selection (SVG Suite)

```typescript
// Static - model fixed at construction
const textClient = new OpenRouterTextClient(apiKey, 'anthropic/claude-sonnet-4');

// Dynamic - model can change
const svgClient = new OpenRouterDynamicTextClient(secretStorage, logger);
svgClient.setModel('google/gemini-3-pro-preview'); // Change per request
```

**Template Recommendation**:

1. Add orchestrator pattern to template infrastructure layer
2. Show thin handler example
3. Document two-store history and re-hydration patterns
4. Include both static and dynamic client patterns

---

## Missing Examples

### 1. Chat Thread / Conversation Pattern

**Problem**: Template's Tab 2 is empty placeholder with comment "TODO: Implement second tab". No example of multi-turn conversation state management.

**Impact**: Developers building chat-like features (image refinement, AI conversations) have no reference implementation.

**Recommendation**: Use Tab 2 to demonstrate conversation pattern

#### Conversation Data Structure

```typescript
// src/shared/types/messages/conversation.ts

/**
 * A single turn in a conversation thread
 */
export interface ConversationTurn {
  id: string;
  prompt: string;              // User's input
  response: string | GeneratedImage[];  // AI's response
  turnNumber: number;
  timestamp: number;
}

export interface ConversationThreadPayload {
  conversationId: string;
  turns: ConversationTurn[];
}

export interface ContinueConversationPayload {
  conversationId: string;
  prompt: string;
  /**
   * Full conversation history for re-hydration after extension restart.
   * Handler uses existing conversation if available, rebuilds from history if lost.
   */
  history?: Array<{ prompt: string; response: string | GeneratedImage[] }>;
}
```

#### Hook Implementation

```typescript
// src/presentation/webview/hooks/domain/useConversation.ts

export interface ConversationState {
  conversationHistory: ConversationTurn[];
  conversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface ConversationActions {
  startConversation: (prompt: string) => void;
  continueConversation: (prompt: string) => void;
  clearConversation: () => void;
}

export interface ConversationHandlers {
  handleConversationResponse: (message: MessageEnvelope) => void;
  handleError: (message: MessageEnvelope) => void;
}

export interface ConversationPersistence {
  conversationHistory: ConversationTurn[];
  conversationId: string | null;
}

export function useConversation(
  initialState?: Partial<ConversationPersistence>
): UseConversationReturn {
  const vscode = useVSCodeApi();

  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>(
    initialState?.conversationHistory ?? []
  );
  const [conversationId, setConversationId] = useState<string | null>(
    initialState?.conversationId ?? null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track pending prompt to build history
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const handleConversationResponse = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as ConversationResponsePayload;
    setConversationId(payload.conversationId);

    // Add turn to history
    setPendingPrompt((currentPending) => {
      if (currentPending) {
        const turn: ConversationTurn = {
          id: `turn-${payload.turnNumber}`,
          prompt: currentPending,
          response: payload.response,
          turnNumber: payload.turnNumber,
          timestamp: Date.now(),
        };
        setConversationHistory((prev) => [...prev, turn]);
      }
      return null; // Clear pending
    });

    setIsLoading(false);
  }, []);

  const startConversation = useCallback((prompt: string) => {
    setIsLoading(true);
    setError(null);
    setConversationId(null);
    setConversationHistory([]); // Clear for new conversation
    setPendingPrompt(prompt);

    vscode.postMessage(
      createEnvelope(MessageType.START_CONVERSATION, 'webview.conversation', {
        prompt,
      })
    );
  }, [vscode]);

  const continueConversation = useCallback((prompt: string) => {
    if (!conversationId) return;

    setIsLoading(true);
    setError(null);
    setPendingPrompt(prompt);

    // Include full history for re-hydration after extension restart
    // Handler uses existing conversation if available, rebuilds from history if lost
    const history = conversationHistory.map(turn => ({
      prompt: turn.prompt,
      response: turn.response,
    }));

    vscode.postMessage(
      createEnvelope(MessageType.CONTINUE_CONVERSATION, 'webview.conversation', {
        conversationId,
        prompt,
        history,  // Self-contained request enables re-hydration
      })
    );
  }, [conversationId, conversationHistory, vscode]);

  const persistedState: ConversationPersistence = {
    conversationHistory,
    conversationId,
  };

  return {
    conversationHistory,
    conversationId,
    isLoading,
    error,
    startConversation,
    continueConversation,
    clearConversation,
    handleConversationResponse,
    handleError,
    persistedState,
  };
}
```

#### UI Component

```typescript
// src/presentation/webview/components/conversation/ConversationThread.tsx

export interface ConversationThreadProps {
  turns: ConversationTurn[];
  onSaveResponse?: (turn: ConversationTurn) => void;
}

export const ConversationThread: React.FC<ConversationThreadProps> = ({
  turns,
  onSaveResponse,
}) => {
  if (turns.length === 0) return null;

  return (
    <div className="conversation-thread">
      {turns.map((turn) => (
        <div key={turn.id} className="conversation-turn">
          {/* User prompt bubble */}
          <div className="conversation-prompt">
            <div className="conversation-prompt-label">You</div>
            <div className="conversation-prompt-text">{turn.prompt}</div>
          </div>

          {/* AI response */}
          <div className="conversation-response">
            <div className="conversation-response-label">AI</div>
            <div className="conversation-response-content">
              {turn.response}
            </div>
            {onSaveResponse && (
              <button onClick={() => onSaveResponse(turn)}>
                Save
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
```

```typescript
// src/presentation/webview/components/shared/ContinueChatInput.tsx

export interface ContinueChatInputProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
}

export const ContinueChatInput: React.FC<ContinueChatInputProps> = ({
  onSubmit,
  disabled = false,
  isLoading = false,
  placeholder = 'Continue conversation...',
}) => {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim()) {
      onSubmit(input);
      setInput('');
    }
  };

  return (
    <div className="continue-chat-input">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button onClick={handleSubmit} disabled={disabled || !input.trim()}>
        {isLoading ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
};
```

**Template Recommendation**:
1. Replace Tab 2 empty placeholder with conversation example
2. Add `useConversation` hook
3. Add `ConversationThread` and `ContinueChatInput` components
4. Show persistence of conversation history

---

### 2. Multi-Turn State Management

**Problem**: Template shows single request/response pattern only. No guidance on tracking multi-turn state.

**Key Patterns Needed**:

1. **Pending Prompt Pattern** - Track user's prompt until response arrives

```typescript
const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

// Set when sending request
const generate = () => {
  setPendingPrompt(prompt);
  vscode.postMessage(/* ... */);
};

// Use when building history
const handleResponse = (message) => {
  setPendingPrompt((currentPending) => {
    if (currentPending) {
      // Build conversation turn with pending prompt + response
      const turn = { prompt: currentPending, response: message.payload };
      setHistory((prev) => [...prev, turn]);
    }
    return null; // Clear pending
  });
};
```

2. **Conversation ID Pattern** - Track conversation for continuation

```typescript
const [conversationId, setConversationId] = useState<string | null>(null);

// Clear on new conversation
const startNew = () => {
  setConversationId(null);
  setHistory([]);
};

// Reuse for continuation
const continueChat = (prompt: string) => {
  vscode.postMessage({
    type: MessageType.CONTINUE,
    payload: { conversationId, prompt },
  });
};
```

3. **Correlation ID Pattern** - Link requests to responses

```typescript
// Extension side
const correlationId = crypto.randomUUID();
postMessage(
  createEnvelope(MessageType.RESPONSE, 'extension.handler', payload, correlationId)
);

// Webview side
const handleResponse = (message: MessageEnvelope) => {
  if (message.correlationId === expectedCorrelationId) {
    // Handle response
  }
};
```

**Template Recommendation**: Add conversation example to Tab 2 demonstrating these patterns.

---

### 3. Error Boundaries

**Problem**: Template has no React error boundary components. Errors crash entire webview.

**Solution**: Add error boundary component

```typescript
// src/presentation/webview/components/common/ErrorBoundary.tsx

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, errorInfo: React.ErrorInfo) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.state.errorInfo!);
      }

      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.toString()}</pre>
            <pre>{this.state.errorInfo?.componentStack}</pre>
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

```typescript
// Usage in App.tsx
export function App() {
  return (
    <ErrorBoundary>
      <TabBar />
      <ViewContainer>
        <ErrorBoundary fallback={(error) => <TabErrorFallback error={error} />}>
          <TabPanel id="tab1" activeTab={activeTab}>
            <Tab1View />
          </TabPanel>
        </ErrorBoundary>

        <ErrorBoundary fallback={(error) => <TabErrorFallback error={error} />}>
          <TabPanel id="tab2" activeTab={activeTab}>
            <Tab2View />
          </TabPanel>
        </ErrorBoundary>
      </ViewContainer>
    </ErrorBoundary>
  );
}
```

**Template Recommendation**:
1. Add `ErrorBoundary` component
2. Wrap entire app and individual tabs
3. Provide default fallback UI
4. Document when to use error boundaries

---

## Documentation Gaps

### 1. Standard Procedures Missing from CLAUDE.md

The template's `CLAUDE.md` should include step-by-step procedures for common tasks:

#### Adding a New Tab

```markdown
### Adding a New Tab

1. **Define tab ID and metadata**:
   ```typescript
   // src/shared/types/messages/ui.ts
   export type TabId = 'tab1' | 'tab2' | 'newTab';

   // src/presentation/webview/App.tsx
   const TABS: Tab[] = [
     { id: 'tab1', label: 'Tab 1' },
     { id: 'tab2', label: 'Tab 2' },
     { id: 'newTab', label: 'New Tab' },
   ];
   ```

2. **Create domain hook** (if needed):
   ```typescript
   // src/presentation/webview/hooks/domain/useNewTab.ts
   // Follow Tripartite Interface pattern (State, Actions, Handlers, Persistence)
   ```

3. **Create view component**:
   ```typescript
   // src/presentation/webview/components/views/NewTabView.tsx
   export interface NewTabViewProps {
     newTab: UseNewTabReturn;
   }

   export const NewTabView: React.FC<NewTabViewProps> = ({ newTab }) => {
     return (/* ... */);
   };
   ```

4. **Wire into App.tsx**:
   ```typescript
   export function App() {
     const newTab = useNewTab(persistedState.newTab);

     useMessageRouter({
       [MessageType.NEW_TAB_MESSAGE]: newTab.handleMessage,
     });

     usePersistence({
       activeTab,
       newTab: newTab.persistedState,
     });

     return (
       <ViewContainer>
         <TabPanel id="newTab" activeTab={activeTab}>
           <NewTabView newTab={newTab} />
         </TabPanel>
       </ViewContainer>
     );
   }
   ```

5. **Add backend handler** (if needed):
   ```typescript
   // src/application/handlers/domain/NewTabHandler.ts
   // Follow existing handler pattern
   ```
```

#### Adding a New Message Type

```markdown
### Adding a New Message Type

1. **Add to MessageType enum**:
   ```typescript
   // src/shared/types/messages/base.ts
   export enum MessageType {
     // ... existing types ...
     NEW_MESSAGE = 'NEW_MESSAGE',
   }
   ```

2. **Define payload interface**:
   ```typescript
   // src/shared/types/messages/newDomain.ts (or existing domain file)
   export interface NewMessagePayload {
     field1: string;
     field2: number;
   }
   ```

3. **Export from barrel**:
   ```typescript
   // src/shared/types/messages/index.ts
   export * from './newDomain';
   ```

4. **Add handler in hook**:
   ```typescript
   // src/presentation/webview/hooks/domain/useNewTab.ts
   const handleNewMessage = useCallback((message: MessageEnvelope) => {
     const payload = message.payload as NewMessagePayload;
     // Handle message
   }, []);

   return {
     // ...
     handleNewMessage, // Expose for App-level routing
   };
   ```

5. **Register in App.tsx**:
   ```typescript
   useMessageRouter({
     [MessageType.NEW_MESSAGE]: newTab.handleNewMessage,
   });
   ```

6. **Add backend route** (if needed):
   ```typescript
   // src/application/handlers/MessageHandler.ts
   this.router.register(
     MessageType.NEW_MESSAGE,
     (msg) => this.newTabHandler.handleNewMessage(msg)
   );
   ```
```

#### Adding a New Setting

```markdown
### Adding a New Setting

1. **Add to package.json**:
   ```json
   {
     "contributes": {
       "configuration": {
         "properties": {
           "myExtension.newSetting": {
             "type": "string",
             "default": "default value",
             "description": "Description of new setting"
           }
         }
       }
     }
   }
   ```

2. **Add to settings interface**:
   ```typescript
   // src/shared/types/messages/settings.ts
   export interface SettingsPayload {
     // ... existing settings ...
     newSetting: string;
   }
   ```

3. **Update useSettings hook**:
   ```typescript
   // src/presentation/webview/hooks/domain/useSettings.ts
   const [newSetting, setNewSetting] = useState(
     initialState?.newSetting ?? 'default value'
   );

   const persistedState: SettingsPersistence = {
     // ... existing fields ...
     newSetting,
   };
   ```

4. **Add UI control**:
   ```typescript
   // src/presentation/webview/components/settings/SettingsView.tsx
   <Input
     label="New Setting"
     value={settings.newSetting}
     onChange={(e) => settings.updateSetting('newSetting', e.target.value)}
   />
   ```

5. **Add backend getter** (if needed):
   ```typescript
   // src/application/handlers/domain/SettingsHandler.ts
   private getNewSetting(): string {
     return this.config.get('myExtension.newSetting', 'default value');
   }
   ```
```

**Template Recommendation**: Add "Common Tasks" section to `CLAUDE.md` with these procedures.

---

### 2. Loading State Patterns

```markdown
### Loading State Patterns

#### Three-Zone Layout
Use this layout to prevent content shift when loading indicators appear:

```typescript
<div className="view-container">
  {/* Zone 1: Fixed top - controls */}
  <div className="view-header">
    <Input />
    <Button disabled={isLoading}>Submit</Button>
  </div>

  {/* Zone 2: Scrollable middle - content */}
  <div className="view-scroll-area">
    <Content />
    <LoadingIndicator isLoading={isLoading} />
  </div>

  {/* Zone 3: Fixed bottom - actions */}
  <div className="view-footer">
    <ContinueInput />
  </div>
</div>
```

#### Loading Indicator Placement
- ✅ Place at **bottom** of scroll area (where new content will appear)
- ❌ Don't place at top (causes layout shift)
- ✅ Use conditional rendering (`{isLoading && <LoadingIndicator />}`)
- ✅ Disable submit buttons during loading

#### Button Loading States
```typescript
<Button disabled={isLoading}>
  {isLoading ? 'Processing...' : 'Submit'}
</Button>
```
```

**Template Recommendation**: Add "Loading State Patterns" section to `CLAUDE.md`.

---

### 3. Conversation Patterns

```markdown
### Conversation Patterns

#### Multi-Turn State Management

Use this pattern for chat-like features (image refinement, AI conversations):

**Data Structure**:
```typescript
export interface ConversationTurn {
  id: string;
  prompt: string;
  response: any; // Image, text, etc.
  turnNumber: number;
  timestamp: number;
}
```

**Hook Pattern**:
```typescript
export function useConversation() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const startConversation = (prompt: string) => {
    setConversationId(null); // Clear previous
    setConversationHistory([]);
    setPendingPrompt(prompt);
    // Send message...
  };

  const continueConversation = (prompt: string) => {
    setPendingPrompt(prompt);
    // Send message with conversationId...
  };

  const handleResponse = (message: MessageEnvelope) => {
    setPendingPrompt((currentPending) => {
      if (currentPending) {
        const turn = {
          id: `turn-${turnNumber}`,
          prompt: currentPending,
          response: message.payload,
          turnNumber,
          timestamp: Date.now(),
        };
        setConversationHistory((prev) => [...prev, turn]);
      }
      return null; // Clear pending
    });
  };

  return {
    conversationHistory,
    conversationId,
    startConversation,
    continueConversation,
    handleResponse,
  };
}
```

**Persistence**:
```typescript
const persistedState: ConversationPersistence = {
  conversationHistory,
  conversationId,
};
```

#### Conversation UI
See `ConversationThread.tsx` component for chat-style display.
```

**Template Recommendation**: Add "Conversation Patterns" section to `CLAUDE.md`.

---

## Tab 2 Recommendation

**Current State**: Tab 2 is empty placeholder with comment "TODO: Implement second tab"

**Recommendation**: Use Tab 2 as **Conversation Example** demonstrating:

1. **Multi-turn chat pattern**
   - Start conversation
   - Continue conversation
   - Clear conversation
   - Conversation history display

2. **State management patterns**
   - Pending prompt tracking
   - Conversation ID for continuation
   - Persisted conversation history
   - Loading states

3. **UI patterns**
   - ConversationThread component (chat bubbles)
   - ContinueChatInput component (send message)
   - Three-zone layout (fixed top, scrolling middle, fixed bottom)
   - Loading indicator placement

4. **Message patterns**
   - START_CONVERSATION
   - CONTINUE_CONVERSATION
   - CONVERSATION_RESPONSE
   - Correlation IDs

**Implementation**:

```typescript
// src/presentation/webview/hooks/domain/useConversation.ts
export function useConversation(
  initialState?: Partial<ConversationPersistence>
): UseConversationReturn {
  // ... implementation from "Missing Examples" section above
}
```

```typescript
// src/presentation/webview/components/views/ConversationView.tsx
export const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
}) => {
  const {
    conversationHistory,
    conversationId,
    isLoading,
    error,
    startConversation,
    continueConversation,
    clearConversation,
  } = conversation;

  const [prompt, setPrompt] = useState('');

  const handleSubmit = () => {
    if (conversationId) {
      continueConversation(prompt);
    } else {
      startConversation(prompt);
    }
    setPrompt('');
  };

  return (
    <div className="conversation-view">
      {/* Zone 1: Fixed top - header */}
      <div className="conversation-header">
        <h3>Conversation Example</h3>
        {conversationId && (
          <button onClick={clearConversation}>Clear</button>
        )}
      </div>

      {/* Zone 2: Scrollable middle - conversation thread */}
      <div className="conversation-scroll-area">
        {conversationHistory.length === 0 ? (
          <div className="conversation-empty">
            <p>Start a conversation by typing a message below.</p>
          </div>
        ) : (
          <ConversationThread turns={conversationHistory} />
        )}

        <LoadingIndicator
          isLoading={isLoading}
          defaultMessage="Thinking..."
        />
      </div>

      {/* Zone 3: Fixed bottom - input */}
      <div className="conversation-input">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={conversationId ? 'Continue conversation...' : 'Start a conversation...'}
          disabled={isLoading}
        />
        <button onClick={handleSubmit} disabled={isLoading || !prompt.trim()}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {error && <div className="conversation-error">{error}</div>}
    </div>
  );
};
```

```typescript
// src/presentation/webview/App.tsx
export function App() {
  const conversation = useConversation(persistedState.conversation);

  useMessageRouter({
    [MessageType.CONVERSATION_RESPONSE]: conversation.handleResponse,
    [MessageType.ERROR]: conversation.handleError,
  });

  usePersistence({
    activeTab,
    conversation: conversation.persistedState,
  });

  return (
    <ViewContainer>
      <TabPanel id="tab2" activeTab={activeTab}>
        <ConversationView conversation={conversation} />
      </TabPanel>
    </ViewContainer>
  );
}
```

**Benefits of This Approach**:
- Developers see complete conversation example immediately
- Demonstrates all key patterns (multi-turn state, persistence, loading states)
- Shows proper component composition
- Provides copy-paste starting point for chat-like features
- No need to read docs - example is right there in Tab 2

---

## Summary of Recommendations

### High Priority (Essential)

| # | Recommendation | Status |
|---|----------------|--------|
| 1 | **Message Routing Lift** - Replace component-level registration with `useMessageRouter` hook | ✅ Done |
| 2 | **Tripartite Hook Pattern** - Show State, Actions, Handlers, Persistence interfaces | ✅ Done |
| 3 | **Persistence Boundaries** - Add `usePersistence` hook with `persistedState` pattern | ✅ Done |
| 4 | **Tab 2 Conversation Example** - Replace empty placeholder with working conversation demo | ✅ Done (SVG) |
| 5 | **Loading State Patterns** - Add `LoadingIndicator` and three-zone layout examples | ✅ Done |
| 6 | **Error Boundaries** - Add `ErrorBoundary` component | ⚠️ Partial |

### Medium Priority (Recommended)

| # | Recommendation | Status |
|---|----------------|--------|
| 7 | **Standard Procedures in CLAUDE.md** - Add step-by-step guides for common tasks | ✅ Done |
| 8 | **Message Envelope Pattern** - Add source tracking and echo prevention to base template | ✅ Done |
| 9 | **Correlation IDs** - Show pattern for linking requests to responses | ✅ Done |
| 10 | **ConversationThread Component** - Add chat-style UI component | ✅ Done |

### Infrastructure Priority (NEW - AI Integration)

| # | Recommendation | Status |
|---|----------------|--------|
| 11 | **Three-Suite Architecture** - Orchestrator + Client + ConversationManager pattern | ✅ Done |
| 12 | **Thin Handler Pattern** - Handlers only route, orchestrators contain logic | ✅ Done |
| 13 | **Two-Store History** - Presentation vs Infrastructure state separation | ✅ Done |
| 14 | **Re-hydration Pattern** - Self-contained requests for state recovery | ✅ Done |
| 15 | **Dynamic Client Pattern** - `setModel()` for UI-selected models | ✅ Done |

### Low Priority (Nice to Have)

| # | Recommendation | Status |
|---|----------------|--------|
| 16 | **More ADR Examples** - Show how to document architectural decisions | ✅ Done (ADR-001, ADR-002) |
| 17 | **Testing Examples** - Add Jest tests for hooks and components | ✅ Done |
| 18 | **Performance Patterns** - Document useCallback/useMemo usage | ⚠️ Partial |
| 19 | **VSCode Integration Patterns** - Show file opening, command palette, etc. | ✅ Done |

---

## Before/After Summary

### Message Routing

**Before** (Component-level registration):
- 20+ components each with useEffect for message handling
- Handlers registered/unregistered on every mount/unmount
- Lost messages when components unmounted
- Difficult to debug (which component handles what?)

**After** (App-level routing with Strategy pattern):
- 1 centralized `useMessageRouter` in App.tsx
- Declarative map-based routing
- Handlers stay registered even when views unmount
- Clear registry of all message types

### Hook Organization

**Before** (Monolithic hooks):
- Mixed concerns (UI state + domain logic + persistence)
- No clear contract for what hooks expose
- Handlers buried inside hooks

**After** (Tripartite Interface):
- Clear separation: State, Actions, Handlers, Persistence
- Type-safe contracts for hook consumers
- Handlers exposed for App-level routing
- Explicit persistence boundaries

### State Management

**Before** (Scattered state):
- Persistence logic duplicated in 42 places
- Unclear what persists vs ephemeral
- No consistent pattern

**After** (Composed persistence):
- `usePersistence` hook composes all domain state
- Explicit `persistedState` interfaces
- Centralized persistence in App.tsx
- Type-safe composition

### Loading States

**Before** (Inconsistent):
- Loading indicators cause layout shift
- No standard placement pattern
- Each component implements differently

**After** (Three-zone layout):
- No layout shift (indicator at bottom)
- Consistent pattern across all views
- Standard component (`LoadingIndicator`)

### Tab 2

**Before**:

- Empty placeholder with "TODO" comment
- No guidance on multi-turn features

**After**:

- Working conversation example
- Demonstrates all key patterns
- Copy-paste starting point for developers

### AI Infrastructure (NEW)

**Before** (Fat handlers):

- Business logic mixed with API calls in handlers
- No conversation state management
- No recovery after extension restart
- Tight coupling to AI providers

**After** (Three-Suite Architecture):

- Thin handlers only route messages
- Orchestrators contain all business logic
- ConversationManagers track state
- Re-hydration pattern for state recovery
- Client injection for testability

### State Management (NEW)

**Before** (Single store):

- All state in webview `vscode.setState()`
- No clear boundary between UI and API state
- Lost context after extension restart

**After** (Two-store history):

- Presentation: `ConversationTurn[]` (UI-focused, persisted)
- Infrastructure: `TextMessage[]` (API-focused, ephemeral)
- Re-hydration rebuilds infrastructure from presentation

---

## Conclusion

The template provides a solid foundation but lacks patterns for real-world extension development. Adding these patterns would dramatically improve the developer experience and prevent common anti-patterns:

**Presentation Layer Patterns**:

- Message routing lift with Strategy pattern
- Tripartite hooks (State, Actions, Persistence)
- Three-zone layout for loading states
- Error boundaries

**Infrastructure Layer Patterns (NEW)**:

- Three-Suite Architecture (Orchestrator + Client + ConversationManager)
- Thin Handler pattern (handlers only route, orchestrators contain logic)
- Two-Store History (presentation vs infrastructure state)
- Re-hydration pattern (self-contained requests for state recovery)
- Static vs Dynamic client pattern

The recommendations are based on proven patterns from the Pixel Minion codebase evolution, which went from:

- **App.tsx**: 697 lines → 394 lines (43% reduction)
- **MessageHandler**: 1,091 lines → 495 lines (54% reduction)
- **Architecture Score**: 4/10 → 9.8/10 (from comprehensive review)
- **SVGGenerationHandler**: 388 lines → 242 lines (38% reduction) via thin handler pattern

These improvements weren't theoretical - they were battle-tested through rapid AI-driven development and architectural reviews. Incorporating them into the template would save every developer the pain of discovering these patterns themselves.

---

## References

### Pixel Minion Codebase

- **Repository**: /Users/okeylanders/Documents/GitHub/pixel-minion-vscode

**Presentation Layer**:

- [App.tsx](../src/presentation/webview/App.tsx) - Message routing lift example
- [useMessageRouter.ts](../src/presentation/webview/hooks/useMessageRouter.ts) - Strategy pattern implementation
- [useImageGeneration.ts](../src/presentation/webview/hooks/domain/useImageGeneration.ts) - Tripartite hook example
- [usePersistence.ts](../src/presentation/webview/hooks/usePersistence.ts) - Persistence pattern
- [ConversationThread.tsx](../src/presentation/webview/components/image/ConversationThread.tsx) - Conversation UI

**Infrastructure Layer (AI Suites)**:

- [ImageOrchestrator.ts](../src/infrastructure/ai/orchestration/ImageOrchestrator.ts) - Image suite orchestrator
- [SVGOrchestrator.ts](../src/infrastructure/ai/orchestration/SVGOrchestrator.ts) - SVG suite orchestrator
- [TextOrchestrator.ts](../src/infrastructure/ai/orchestration/TextOrchestrator.ts) - Text suite orchestrator
- [OpenRouterTextClient.ts](../src/infrastructure/ai/clients/OpenRouterTextClient.ts) - Static model client
- [OpenRouterDynamicTextClient.ts](../src/infrastructure/ai/clients/OpenRouterDynamicTextClient.ts) - Dynamic model client
- [OpenRouterImageClient.ts](../src/infrastructure/ai/clients/OpenRouterImageClient.ts) - Image generation client

**Application Layer (Thin Handlers)**:

- [ImageGenerationHandler.ts](../src/application/handlers/domain/ImageGenerationHandler.ts) - Image thin handler
- [SVGGenerationHandler.ts](../src/application/handlers/domain/SVGGenerationHandler.ts) - SVG thin handler
- [MessageHandler.ts](../src/application/handlers/MessageHandler.ts) - Orchestrator wiring

### Architecture Decision Records

- [ADR-001: Pixel Minion Architecture](adr/001-pixel-minion-architecture.md) - Two-tab design, provider interface
- [ADR-002: Three-Suite AI Infrastructure](adr/002-three-suite-infrastructure.md) - Orchestrator pattern, thin handlers, re-hydration

### Documentation

- [CLAUDE.md](../CLAUDE.md) - Full developer guide with all patterns
- [Conversation Architecture](conversation-architecture.md) - Detailed re-hydration documentation

---

**Document Version**: 2.0
**Last Updated**: 2025-11-29
**Authors**: Analysis based on Pixel Minion codebase evolution
**Changes in v2.0**: Added Three-Suite AI Infrastructure pattern, Thin Handler pattern, Two-Store History, Re-hydration pattern, updated status tracking
