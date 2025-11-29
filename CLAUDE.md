# CLAUDE.md - AI Agent Guidelines

This file provides guidance for AI agents working on this VSCode extension codebase.

## Project Overview

**Pixel Minion** is a VSCode extension for AI-powered image and SVG generation using OpenRouter:

- **Image Generation Tab** - Text-to-image and image-to-image via OpenRouter image models (Gemini, GPT-5, FLUX)
- **SVG Generation Tab** - Generate vector graphics as code using text models (Gemini Pro, Claude Opus)

Tech stack:
- **TypeScript** for type safety
- **React 18** for webview UI
- **Webpack** for bundling (dual entry: extension + webview)
- **Jest** for testing
- **Clean Architecture** with layered organization
- **OpenRouter API** for AI model access

## Architecture Quick Reference

### Layer Responsibilities

| Layer | Location | Purpose |
|-------|----------|---------|
| Presentation | `src/presentation/webview/` | React components, hooks, styles |
| Application | `src/application/` | Message handlers, view providers |
| Domain | `src/domain/` | Business logic, entities |
| Infrastructure | `src/infrastructure/` | AI clients, secrets, logging, resources |

### Key Patterns

1. **Message Envelope** - All messages use `MessageEnvelope<TPayload>` from `@messages`
2. **Strategy Pattern** - `MessageRouter` routes messages without switch statements
3. **Tripartite Hooks** - Domain hooks export State, Actions, Persistence interfaces
4. **Dependency Injection** - Services injected via constructors from `extension.ts`

## Import Aliases

Use these path aliases (defined in tsconfig.json):

```typescript
import { MessageType } from '@messages';           // Message types
import { SecretStorageService } from '@secrets';   // Secret storage
import { TextOrchestrator } from '@ai';            // Text AI infrastructure
import { LoggingService } from '@logging';         // Logging service
import { OPENROUTER_CONFIG } from '@providers';    // Provider configs
import { HelloWorldHandler } from '@handlers/domain/HelloWorldHandler';
import { Button } from '@components/common';       // React components
import { useSettings } from '@hooks/domain/useSettings';
```

## Common Tasks

### Adding a New Message Type

1. Add enum value to `src/shared/types/messages/base.ts`:
   ```typescript
   export enum MessageType {
     ...existing,
     MY_NEW_TYPE = 'MY_NEW_TYPE',
   }
   ```

2. Create payload interface in appropriate domain file
3. Export from `src/shared/types/messages/index.ts`

### Adding a New Handler

1. Create handler class in `src/application/handlers/domain/`
2. Inject dependencies via constructor (postMessage, LoggingService, etc.)
3. Register routes in `MessageHandler.ts`
4. Add tests in `src/__tests__/application/handlers/domain/`

### Adding a New Hook

Follow tripartite pattern:
```typescript
export interface MyState { ... }
export interface MyActions { ... }
export interface MyPersistence { ... }
export type UseMyReturn = MyState & MyActions & { persistedState: MyPersistence };
```

### Adding a New Component

1. Create in appropriate directory under `src/presentation/webview/components/`
2. Use VSCode CSS variables for theming
3. Export from barrel file (`index.ts`)

## Testing Approach

- Unit tests go in `src/__tests__/` mirroring source structure
- Use the VSCode mocks from `src/__tests__/setup.ts`
- Test handlers independently from VSCode APIs
- Path aliases work in tests via `jest.config.js` moduleNameMapper
- Mock LoggingService with `{ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }`

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `Button.tsx`, `SettingsView.tsx` |
| Hooks | camelCase with `use` prefix | `useSettings.ts` |
| Handlers | PascalCase with `Handler` suffix | `SettingsHandler.ts` |
| Message types | PascalCase | `SettingsPayload` |
| CSS | kebab-case | `button.css` |

## Security Notes

- **API Keys**: Always use `SecretStorageService`, never store in settings
- **Webview CSP**: HTML uses nonce-based Content Security Policy
- **Message Sources**: Check `message.source` to prevent echo loops

## Logging Rules

- **Never use `console.log/error/warn`** in extension code - use `LoggingService` instead
- **Exception**: `console` is only acceptable in `extension.ts` activation before `LoggingService` is created (fallback if extension fails to load)
- **Inject LoggingService** via constructor for all handlers and services
- **Log levels**: Use `debug` for development details, `info` for general events, `warn` for potential issues, `error` for failures
- All logs appear in VSCode's Output panel under "Pixel Minion"

## Build Commands

```bash
npm run watch    # Development with hot reload
npm run build    # Production build
npm test         # Run tests
npm run lint     # Check code style
```

## When Making Changes

1. **Messages**: Update both handler (extension) and hook (webview)
2. **Settings**: Update package.json, handler, hook, and view
3. **Components**: Ensure proper CSS variable usage for theming
4. **Tests**: Add/update tests for new functionality

## Provider Interface Pattern

Model selection uses a provider interface for extensibility:

```typescript
// src/shared/types/providers.ts
interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  models: Record<GenerationType, ModelDefinition[]>;  // 'image' | 'svg'
}

// Usage: OPENROUTER_CONFIG.models.image for Image tab dropdown
// Usage: OPENROUTER_CONFIG.models.svg for SVG tab dropdown
```

## Architecture Decision Records

See `docs/adr/` for architectural decisions. Key ADRs:

- **ADR-001**: Pixel Minion Architecture - Two-tab design, provider interface, message types

## Resources

- [VSCode Extension API](https://code.visualstudio.com/api)
- [VSCode Webview Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [VSCode Theme Colors](https://code.visualstudio.com/api/references/theme-color)

---

# Standard Procedures

This section provides step-by-step procedures for common development tasks based on evolved patterns in the codebase.

## 1. Adding a New Tab

Complete procedure for adding a new tab to the extension UI.

### Step 1: Create Domain Hook

Create a new hook file in `src/presentation/webview/hooks/domain/` following the tripartite pattern:

```typescript
// src/presentation/webview/hooks/domain/useMyFeature.ts
import { useState, useCallback } from 'react';
import { MessageType } from '@messages';

// State interface - all observable state
export interface MyFeatureState {
  data: string | null;
  isLoading: boolean;
}

// Actions interface - all user-triggered actions
export interface MyFeatureActions {
  doSomething: (input: string) => void;
  reset: () => void;
}

// Persistence interface - state to save/restore
export interface MyFeaturePersistence {
  data: string | null;
}

export type UseMyFeatureReturn = MyFeatureState & MyFeatureActions & {
  persistedState: MyFeaturePersistence;
};

export const useMyFeature = (postMessage: (msg: any) => void): UseMyFeatureReturn => {
  const [data, setData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const doSomething = useCallback((input: string) => {
    setIsLoading(true);
    postMessage({
      type: MessageType.MY_FEATURE_REQUEST,
      payload: { input }
    });
  }, [postMessage]);

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
  }, []);

  return {
    // State
    data,
    isLoading,

    // Actions
    doSomething,
    reset,

    // Persistence
    persistedState: {
      data
    }
  };
};
```

Export from barrel file:
```typescript
// src/presentation/webview/hooks/domain/index.ts
export * from './useMyFeature';
```

### Step 2: Create View Component

Create a view component in `src/presentation/webview/components/views/`:

```typescript
// src/presentation/webview/components/views/MyFeatureView.tsx
import React from 'react';
import { UseMyFeatureReturn } from '@hooks/domain';
import { LoadingIndicator } from '@components/shared';
import './my-feature-view.css';

interface MyFeatureViewProps {
  myFeature: UseMyFeatureReturn;
}

export const MyFeatureView: React.FC<MyFeatureViewProps> = ({ myFeature }) => {
  const { data, isLoading, doSomething, reset } = myFeature;

  return (
    <div className="my-feature-view">
      {/* Fixed top section */}
      <div className="my-feature-header">
        <h2>My Feature</h2>
        <button onClick={reset}>Reset</button>
      </div>

      {/* Scrolling content section */}
      <div className="my-feature-content">
        {data && <div className="result">{data}</div>}
      </div>

      {/* Fixed bottom section */}
      <div className="my-feature-controls">
        <button onClick={() => doSomething('test')}>Do Something</button>
        {isLoading && <LoadingIndicator />}
      </div>
    </div>
  );
};
```

Create CSS file:
```css
/* src/presentation/webview/components/views/my-feature-view.css */
.my-feature-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.my-feature-header {
  flex-shrink: 0;
  padding: 8px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.my-feature-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.my-feature-controls {
  flex-shrink: 0;
  padding: 8px;
  border-top: 1px solid var(--vscode-panel-border);
}
```

Export from barrel file:
```typescript
// src/presentation/webview/components/views/index.ts
export * from './MyFeatureView';
```

### Step 3: Add to TabBar

Add tab to `src/presentation/webview/components/layout/TabBar.tsx`:

```typescript
export type TabId = 'image' | 'svg' | 'myfeature';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'image', label: 'Image' },
  { id: 'svg', label: 'SVG' },
  { id: 'myfeature', label: 'My Feature' }
];
```

### Step 4: Register Message Handlers in App.tsx

Update `src/presentation/webview/App.tsx` to handle messages at the app level:

```typescript
// Add hook instance
const myFeature = useMyFeature(postMessage);

// Add message handler
useEffect(() => {
  const handler = (event: MessageEvent) => {
    const message = event.data;

    // Handle my feature responses
    if (message.type === MessageType.MY_FEATURE_RESPONSE) {
      // Update state via setter from hook
      setMyFeatureData(message.payload.data);
      setMyFeatureLoading(false);
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);

// Add to tab rendering
{activeTab === 'myfeature' && <MyFeatureView myFeature={myFeature} />}
```

### Step 5: Add Extension-Side Handler

Create handler in `src/application/handlers/domain/`:

```typescript
// src/application/handlers/domain/MyFeatureHandler.ts
import { MessageHandler } from '@handlers/MessageHandler';
import { MessageEnvelope, MessageType, MyFeatureRequestPayload } from '@messages';
import { LoggingService } from '@logging';

export class MyFeatureHandler extends MessageHandler {
  constructor(
    postMessage: (message: MessageEnvelope<any>) => void,
    private readonly logger: LoggingService
  ) {
    super(postMessage);
  }

  async handle(message: MessageEnvelope<MyFeatureRequestPayload>): Promise<void> {
    this.logger.info('Handling my feature request', { input: message.payload.input });

    try {
      const result = await this.processRequest(message.payload);

      this.postMessage({
        type: MessageType.MY_FEATURE_RESPONSE,
        payload: { data: result },
        correlationId: message.correlationId
      });
    } catch (error) {
      this.logger.error('My feature request failed', error);
      this.postMessage({
        type: MessageType.MY_FEATURE_RESPONSE,
        payload: { error: error.message },
        correlationId: message.correlationId
      });
    }
  }

  private async processRequest(payload: MyFeatureRequestPayload): Promise<string> {
    // Implementation
    return 'result';
  }
}
```

Register in `src/application/handlers/MessageHandler.ts`:
```typescript
this.router.registerRoute(MessageType.MY_FEATURE_REQUEST, this.myFeatureHandler);
```

### Step 6: Add Persistence Support

Update webview state manager to include new tab's state:

```typescript
// In App.tsx
const persistedState = {
  image: imageGeneration.persistedState,
  svg: svgGeneration.persistedState,
  myFeature: myFeature.persistedState
};

// Restore state on mount
useEffect(() => {
  const savedState = vscode.getState();
  if (savedState?.myFeature) {
    // Restore myFeature state
  }
}, []);
```

## 2. Adding a New Message Type (Expanded)

Complete procedure for adding request/response message types with correlation support.

### Step 1: Define Message Type Enum

Add to `src/shared/types/messages/base.ts`:

```typescript
export enum MessageType {
  // Existing types...

  // My Feature
  MY_FEATURE_REQUEST = 'MY_FEATURE_REQUEST',
  MY_FEATURE_RESPONSE = 'MY_FEATURE_RESPONSE',
}
```

### Step 2: Create Payload Interfaces

Create payload interfaces in appropriate domain file (e.g., `src/shared/types/messages/myfeature.ts`):

```typescript
// Request payload
export interface MyFeatureRequestPayload {
  input: string;
  options?: {
    flag: boolean;
  };
}

// Response payload
export interface MyFeatureResponsePayload {
  data?: string;
  error?: string;
}
```

### Step 3: Export from Index

Add to `src/shared/types/messages/index.ts`:

```typescript
export * from './myfeature';
```

### Step 4: Add Correlation ID Support

When sending requests, generate and store correlation ID:

```typescript
// In hook
const doSomething = useCallback((input: string) => {
  const correlationId = crypto.randomUUID();
  setCorrelationId(correlationId);
  setIsLoading(true);

  postMessage({
    type: MessageType.MY_FEATURE_REQUEST,
    payload: { input },
    correlationId
  });
}, [postMessage]);
```

### Step 5: Register Handler in App.tsx

Message handlers should be registered in `App.tsx`, NOT at component level:

```typescript
// In App.tsx
useEffect(() => {
  const handler = (event: MessageEvent) => {
    const message = event.data;

    // Prevent echo
    if (message.source === 'webview') {
      return;
    }

    switch (message.type) {
      case MessageType.MY_FEATURE_RESPONSE:
        handleMyFeatureResponse(message);
        break;
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);
```

### Step 6: Add to MessageHandler Routes

Register in `src/application/handlers/MessageHandler.ts`:

```typescript
this.router.registerRoute(
  MessageType.MY_FEATURE_REQUEST,
  this.myFeatureHandler
);
```

### Step 7: Echo Prevention Pattern

Always check message source to prevent echo loops:

```typescript
// In webview message handler
if (message.source === 'webview') {
  return; // Ignore our own messages
}
```

In extension handler, always set source:
```typescript
this.postMessage({
  type: MessageType.MY_FEATURE_RESPONSE,
  payload: { data: result },
  correlationId: message.correlationId,
  source: 'extension'
});
```

## 3. Adding Settings

Complete procedure for adding new configuration settings.

### Step 1: Add to package.json

Add to `package.json` under `contributes.configuration.properties`:

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "pixelMinion.myFeature.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable my feature"
        },
        "pixelMinion.myFeature.threshold": {
          "type": "number",
          "default": 0.5,
          "minimum": 0,
          "maximum": 1,
          "description": "Threshold for my feature"
        }
      }
    }
  }
}
```

### Step 2: Add to SettingsPayload Interface

Update `src/shared/types/messages/settings.ts`:

```typescript
export interface SettingsPayload {
  // Existing settings...

  // My Feature settings
  myFeatureEnabled?: boolean;
  myFeatureThreshold?: number;
}
```

### Step 3: Handle in SettingsHandler

Update `src/application/handlers/domain/SettingsHandler.ts`:

```typescript
async handle(message: MessageEnvelope<void>): Promise<void> {
  const config = vscode.workspace.getConfiguration('pixelMinion');

  const settings: SettingsPayload = {
    // Existing settings...

    myFeatureEnabled: config.get('myFeature.enabled', true),
    myFeatureThreshold: config.get('myFeature.threshold', 0.5)
  };

  this.postMessage({
    type: MessageType.SETTINGS_RESPONSE,
    payload: settings,
    correlationId: message.correlationId
  });
}
```

### Step 4: Use in useSettings Hook

Update `src/presentation/webview/hooks/domain/useSettings.ts`:

```typescript
export interface SettingsState {
  // Existing state...

  myFeatureEnabled: boolean;
  myFeatureThreshold: number;
}

// In hook
const [myFeatureEnabled, setMyFeatureEnabled] = useState(true);
const [myFeatureThreshold, setMyFeatureThreshold] = useState(0.5);

// In message handler
if (message.type === MessageType.SETTINGS_RESPONSE) {
  setMyFeatureEnabled(message.payload.myFeatureEnabled ?? true);
  setMyFeatureThreshold(message.payload.myFeatureThreshold ?? 0.5);
}
```

### Step 5: For Sensitive Settings - Use SecretStorageService

For API keys and sensitive data, use `SecretStorageService` instead:

```typescript
// In handler
export class MyFeatureHandler extends MessageHandler {
  constructor(
    postMessage: (message: MessageEnvelope<any>) => void,
    private readonly logger: LoggingService,
    private readonly secretStorage: SecretStorageService
  ) {
    super(postMessage);
  }

  async handle(message: MessageEnvelope<SaveApiKeyPayload>): Promise<void> {
    await this.secretStorage.storeSecret('myFeature.apiKey', message.payload.apiKey);
    this.logger.info('API key saved securely');
  }

  async getApiKey(): Promise<string | undefined> {
    return this.secretStorage.getSecret('myFeature.apiKey');
  }
}
```

Never store sensitive data in workspace configuration:
```typescript
// WRONG - Never do this
config.update('myFeature.apiKey', apiKey);

// RIGHT - Use SecretStorageService
await secretStorage.storeSecret('myFeature.apiKey', apiKey);
```

## 4. Adding Components (Expanded)

Complete guide for creating and organizing components.

### Component Organization

Components are organized by purpose:

```
src/presentation/webview/components/
├── common/          # Reusable UI primitives (Button, Input, Dropdown)
├── layout/          # Layout components (TabBar, Container)
├── shared/          # Shared domain-agnostic components (LoadingIndicator, ErrorMessage)
├── image/           # Image-specific components (ImageResult, ImageControls)
├── svg/             # SVG-specific components (SvgPreview, SvgControls)
└── views/           # Top-level tab views (ImageView, SvgView)
```

### Component Patterns

#### 1. Common Components (Primitives)

Low-level reusable UI elements:

```typescript
// src/presentation/webview/components/common/Button.tsx
import React from 'react';
import './button.css';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  variant = 'primary',
  disabled = false
}) => {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
```

CSS using VSCode variables:
```css
/* src/presentation/webview/components/common/button.css */
.btn {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 6px 14px;
  cursor: pointer;
}

.btn:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
```

#### 2. Shared Components (Domain-Agnostic)

Components used across multiple domains:

```typescript
// src/presentation/webview/components/shared/LoadingIndicator.tsx
import React from 'react';
import './loading-indicator.css';

interface LoadingIndicatorProps {
  message?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ message }) => {
  return (
    <div className="loading-indicator">
      <div className="spinner"></div>
      {message && <span className="loading-message">{message}</span>}
    </div>
  );
};
```

#### 3. Domain-Specific Components

Components specific to a feature domain:

```typescript
// src/presentation/webview/components/image/ImageResult.tsx
import React from 'react';
import { ImageGenerationResult } from '@messages';
import './image-result.css';

interface ImageResultProps {
  result: ImageGenerationResult;
  onRefine: () => void;
  onSave: () => void;
}

export const ImageResult: React.FC<ImageResultProps> = ({
  result,
  onRefine,
  onSave
}) => {
  return (
    <div className="image-result">
      <img src={result.imageUrl} alt={result.prompt} />
      <div className="image-actions">
        <button onClick={onRefine}>Refine</button>
        <button onClick={onSave}>Save</button>
      </div>
    </div>
  );
};
```

#### 4. View Components (Top-Level)

Views receive hook instances as props:

```typescript
// src/presentation/webview/components/views/MyFeatureView.tsx
import React from 'react';
import { UseMyFeatureReturn } from '@hooks/domain';

interface MyFeatureViewProps {
  myFeature: UseMyFeatureReturn;  // Receive entire hook instance
}

export const MyFeatureView: React.FC<MyFeatureViewProps> = ({ myFeature }) => {
  // Destructure what you need
  const { data, isLoading, doSomething } = myFeature;

  return (
    <div className="my-feature-view">
      {/* Use hook state and actions */}
    </div>
  );
};
```

### CSS Variable Usage Patterns

Always use VSCode theme variables for consistent theming:

```css
/* Colors */
background-color: var(--vscode-editor-background);
color: var(--vscode-editor-foreground);
border-color: var(--vscode-panel-border);

/* Buttons */
background-color: var(--vscode-button-background);
color: var(--vscode-button-foreground);

/* Inputs */
background-color: var(--vscode-input-background);
color: var(--vscode-input-foreground);
border: 1px solid var(--vscode-input-border);

/* Links */
color: var(--vscode-textLink-foreground);

/* Focus */
outline: 1px solid var(--vscode-focusBorder);

/* Status colors */
color: var(--vscode-errorForeground);
color: var(--vscode-notificationsWarningIcon-foreground);
color: var(--vscode-terminal-ansiGreen);
```

### Props Patterns

**Pattern 1: Receive Hook Instance (Preferred for Views)**

```typescript
interface MyViewProps {
  myFeature: UseMyFeatureReturn;  // Pass entire hook
}

// Usage
<MyView myFeature={myFeature} />
```

**Pattern 2: Receive Individual Props (For Reusable Components)**

```typescript
interface MyComponentProps {
  data: string;
  onAction: () => void;
  isLoading: boolean;
}

// Usage
<MyComponent
  data={myFeature.data}
  onAction={myFeature.doSomething}
  isLoading={myFeature.isLoading}
/>
```

### Exporting Components

Always export from barrel files:

```typescript
// src/presentation/webview/components/common/index.ts
export * from './Button';
export * from './Input';
export * from './Dropdown';

// src/presentation/webview/components/index.ts
export * from './common';
export * from './layout';
export * from './shared';
export * from './views';
```

## 5. Loading State Patterns

Guide for implementing loading states with proper layout to avoid shifts.

### Three-Zone Layout

Use a three-zone flex layout to prevent content jumps:

```tsx
<div className="container">
  {/* Zone 1: Fixed top section */}
  <div className="header">
    <h2>Title</h2>
  </div>

  {/* Zone 2: Scrolling content */}
  <div className="content">
    {/* Main content here */}
  </div>

  {/* Zone 3: Fixed bottom section */}
  <div className="controls">
    <button onClick={generate}>Generate</button>
    {isLoading && <LoadingIndicator />}
  </div>
</div>
```

CSS for three-zone layout:
```css
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  flex-shrink: 0;  /* Don't shrink */
  padding: 8px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.content {
  flex: 1;  /* Take remaining space */
  overflow-y: auto;  /* Scroll independently */
  padding: 8px;
}

.controls {
  flex-shrink: 0;  /* Don't shrink */
  padding: 8px;
  border-top: 1px solid var(--vscode-panel-border);
}
```

### LoadingIndicator Component Usage

Place loading indicator in fixed bottom zone to avoid layout shift:

```tsx
// GOOD - Loading indicator in fixed bottom zone
<div className="controls">
  <button onClick={generate} disabled={isLoading}>
    Generate
  </button>
  {isLoading && <LoadingIndicator message="Generating..." />}
</div>

// BAD - Loading indicator in scrolling content causes shift
<div className="content">
  {isLoading && <LoadingIndicator />}
  {result && <Result data={result} />}
</div>
```

### Loading State Management in Hooks

Pattern for managing loading state:

```typescript
export const useMyFeature = (postMessage: (msg: any) => void) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doSomething = useCallback(async (input: string) => {
    setIsLoading(true);
    setError(null);

    postMessage({
      type: MessageType.MY_FEATURE_REQUEST,
      payload: { input }
    });
  }, [postMessage]);

  // Message handler updates loading state
  const handleResponse = useCallback((message: MessageEnvelope<MyFeatureResponsePayload>) => {
    setIsLoading(false);

    if (message.payload.error) {
      setError(message.payload.error);
    } else {
      setResult(message.payload.data);
    }
  }, []);

  return {
    isLoading,
    result,
    error,
    doSomething,
    handleResponse
  };
};
```

### Multiple Loading States

For features with multiple concurrent operations:

```typescript
interface LoadingStates {
  generating: boolean;
  saving: boolean;
  loading: boolean;
}

const [loadingStates, setLoadingStates] = useState<LoadingStates>({
  generating: false,
  saving: false,
  loading: false
});

// Update individual states
const setGenerating = (value: boolean) => {
  setLoadingStates(prev => ({ ...prev, generating: value }));
};
```

## 6. Conversation/Chat Patterns

Guide for implementing conversational/chat interfaces.

### ConversationTurn Data Structure

Standard structure for conversation turns:

```typescript
// src/shared/types/messages/conversation.ts
export interface ConversationTurn {
  id: string;                    // Unique turn ID
  timestamp: Date;               // When turn was created
  userPrompt: string;            // User's input
  assistantResponse?: string;    // AI response (optional, pending)
  status: 'pending' | 'complete' | 'error';
  error?: string;                // Error message if failed
  metadata?: {
    model?: string;
    tokensUsed?: number;
    imageUrl?: string;           // For image generation
    seed?: number;               // For reproducibility
    [key: string]: any;          // Extensible
  };
}
```

### Multi-Turn State Management

Hook pattern for managing conversation history:

```typescript
// src/presentation/webview/hooks/domain/useConversation.ts
export interface ConversationState {
  turns: ConversationTurn[];
  pendingPrompt: string | null;
  isGenerating: boolean;
}

export interface ConversationActions {
  addTurn: (prompt: string) => void;
  updateTurn: (id: string, updates: Partial<ConversationTurn>) => void;
  clearConversation: () => void;
  setConversationTitle: (title: string) => void;
}

export interface ConversationPersistence {
  turns: ConversationTurn[];
  title?: string;
}

export const useConversation = (postMessage: (msg: any) => void) => {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [title, setTitle] = useState<string>('New Conversation');

  const addTurn = useCallback((prompt: string) => {
    const turn: ConversationTurn = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      userPrompt: prompt,
      status: 'pending'
    };

    setTurns(prev => [...prev, turn]);
    setPendingPrompt(prompt);
    setIsGenerating(true);

    postMessage({
      type: MessageType.GENERATE_RESPONSE,
      payload: {
        prompt,
        conversationHistory: turns
      },
      correlationId: turn.id
    });
  }, [postMessage, turns]);

  const updateTurn = useCallback((id: string, updates: Partial<ConversationTurn>) => {
    setTurns(prev =>
      prev.map(turn =>
        turn.id === id ? { ...turn, ...updates } : turn
      )
    );

    if (updates.status === 'complete' || updates.status === 'error') {
      setIsGenerating(false);
      setPendingPrompt(null);
    }
  }, []);

  const clearConversation = useCallback(() => {
    setTurns([]);
    setPendingPrompt(null);
    setIsGenerating(false);
    setTitle('New Conversation');
  }, []);

  const setConversationTitle = useCallback((newTitle: string) => {
    setTitle(newTitle);
  }, []);

  return {
    turns,
    pendingPrompt,
    isGenerating,
    title,
    addTurn,
    updateTurn,
    clearConversation,
    setConversationTitle,
    persistedState: {
      turns,
      title
    }
  };
};
```

### Pending Prompt Tracking

Track pending prompts to show optimistic UI:

```tsx
// In view component
{conversation.pendingPrompt && (
  <div className="pending-turn">
    <div className="user-message">{conversation.pendingPrompt}</div>
    <div className="assistant-message">
      <LoadingIndicator message="Generating response..." />
    </div>
  </div>
)}

{conversation.turns.map(turn => (
  <div key={turn.id} className="conversation-turn">
    <div className="user-message">{turn.userPrompt}</div>
    {turn.assistantResponse && (
      <div className="assistant-message">{turn.assistantResponse}</div>
    )}
    {turn.status === 'error' && (
      <div className="error-message">{turn.error}</div>
    )}
  </div>
))}
```

### Conversation Persistence

Save and restore conversation state:

```typescript
// In App.tsx
useEffect(() => {
  const persistedState = {
    conversation: conversation.persistedState
  };
  vscode.setState(persistedState);
}, [conversation.persistedState]);

// Restore on mount
useEffect(() => {
  const savedState = vscode.getState();
  if (savedState?.conversation) {
    // Restore turns
    savedState.conversation.turns.forEach((turn: ConversationTurn) => {
      conversation.updateTurn(turn.id, turn);
    });
    // Restore title
    if (savedState.conversation.title) {
      conversation.setConversationTitle(savedState.conversation.title);
    }
  }
}, []);
```

### Chat UI Components

Reference design document:

```tsx
// See docs/chat-thread-example-design.md for complete chat UI design

// Key components:
// - ConversationHeader: Title, date, clear button
// - ConversationThread: Scrolling message list
// - ConversationTurnItem: Individual turn display
// - ConversationInput: Input area with send button
```

Example conversation header:

```tsx
// src/presentation/webview/components/shared/ConversationHeader.tsx
import React from 'react';
import './conversation-header.css';

interface ConversationHeaderProps {
  title: string;
  date: Date;
  onClear: () => void;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  title,
  date,
  onClear
}) => {
  return (
    <div className="conversation-header">
      <div className="conversation-info">
        <h3>{title}</h3>
        <span className="conversation-date">
          {date.toLocaleDateString()}
        </span>
      </div>
      <button className="clear-button" onClick={onClear}>
        Clear
      </button>
    </div>
  );
};
```

### Re-hydration After Extension Restart

Extension-side conversation state is ephemeral (in-memory `Map`). When the extension restarts, the webview's persisted state survives but the handler loses its conversation context.

**Solution**: Self-contained requests with automatic re-hydration.

```typescript
// Webview: Always include history in continuation requests
const continueChat = useCallback((chatPrompt: string) => {
  // Build history for re-hydration (sent every time, handler ignores if not needed)
  const history = conversationHistory.map(turn => ({
    prompt: turn.prompt,
    response: turn.response,  // or images for image generation
  }));

  vscode.postMessage(
    createEnvelope(MessageType.CONTINUE_CONVERSATION, 'webview.chat', {
      prompt: chatPrompt,
      conversationId,
      history,  // Self-contained request enables re-hydration
      model,
    })
  );
}, [conversationId, conversationHistory, model, vscode]);

// Handler: Re-hydrate if conversation lost
async handleContinueRequest(message) {
  let conversation = this.conversations.get(conversationId);

  // If conversation not found but history provided, re-hydrate
  if (!conversation && history?.length) {
    this.logger.info(`Conversation ${conversationId} not found, re-hydrating`);
    conversation = this.rehydrateFromHistory(conversationId, history, model);
  }

  // Continue with conversation (existing or re-hydrated)
  // ...
}
```

**Benefits**:

- Webview doesn't need to know if extension restarted
- Handler uses existing conversation if available (ignores history)
- Handler rebuilds from history if conversation lost
- AI model gets full context even after restart

See `docs/conversation-architecture.md` for detailed architecture.

## 7. AI Client Integration

Guide for integrating AI clients with the extension infrastructure.

### TextClient Interface Implementation

Create a client implementing the `TextClient` interface:

```typescript
// src/infrastructure/ai/clients/MyTextClient.ts
import { TextClient, TextMessage, TextCompletionResult } from '@ai';
import { LoggingService } from '@logging';

export class MyTextClient implements TextClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly logger: LoggingService
  ) {}

  async generateResponse(request: AIRequest): Promise<AIResponse> {
    this.logger.debug('Sending request to AI service', {
      model: request.model,
      promptLength: request.prompt.length
    });

    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          prompt: request.prompt,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          ...request.parameters
        })
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: data.content,
        model: data.model,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        }
      };
    } catch (error) {
      this.logger.error('AI request failed', error);
      throw error;
    }
  }
}
```

### TextOrchestrator Setup

Register clients with the orchestrator:

```typescript
// In extension.ts
import { TextOrchestrator } from '@ai';
import { MyTextClient } from '@ai/clients/MyTextClient';

const secretStorage = new SecretStorageService(context);
const logger = new LoggingService();

const apiKey = await secretStorage.getSecret('myai.apiKey');
if (!apiKey) {
  throw new Error('API key not configured');
}

const myTextClient = new MyTextClient(
  apiKey,
  'https://api.myai.com/v1',
  logger
);

const orchestrator = new TextOrchestrator(logger);
orchestrator.setClient(myTextClient);
```

### TextConversationManager Usage

Use TextConversationManager for multi-turn conversations:

```typescript
// src/infrastructure/ai/orchestration/TextConversationManager.ts
import { TextMessage } from '../clients/TextClient';

export class TextConversationManager {
  private turns: ConversationTurn[] = [];

  addTurn(turn: ConversationTurn): void {
    this.turns.push(turn);
  }

  getTurns(): ConversationTurn[] {
    return [...this.turns];
  }

  clear(): void {
    this.turns = [];
  }

  formatForAI(): string {
    return this.turns
      .map(turn => {
        let formatted = `User: ${turn.userPrompt}\n`;
        if (turn.assistantResponse) {
          formatted += `Assistant: ${turn.assistantResponse}\n`;
        }
        return formatted;
      })
      .join('\n');
  }
}
```

Usage in handler:

```typescript
// In handler
import { ConversationManager } from '@ai/ConversationManager';

export class ChatHandler extends MessageHandler {
  private conversationManager = new ConversationManager();

  async handle(message: MessageEnvelope<ChatRequestPayload>): Promise<void> {
    const { prompt, conversationHistory } = message.payload;

    // Restore conversation history
    if (conversationHistory) {
      conversationHistory.forEach(turn => {
        this.conversationManager.addTurn(turn);
      });
    }

    // Build context
    const context = this.conversationManager.formatForAI();
    const fullPrompt = context + `\nUser: ${prompt}\nAssistant:`;

    // Generate response
    const response = await this.orchestrator.generate({
      model: 'gpt-4',
      prompt: fullPrompt,
      maxTokens: 1000
    });

    // Add turn to history
    const turn: ConversationTurn = {
      id: message.correlationId!,
      timestamp: new Date(),
      userPrompt: prompt,
      assistantResponse: response.content,
      status: 'complete',
      metadata: {
        model: response.model,
        tokensUsed: response.usage.totalTokens
      }
    };

    this.conversationManager.addTurn(turn);

    // Send response
    this.postMessage({
      type: MessageType.CHAT_RESPONSE,
      payload: { turn },
      correlationId: message.correlationId
    });
  }
}
```

### Handler Integration with AI Infrastructure

Complete handler with AI integration:

```typescript
// src/application/handlers/domain/TextGenerationHandler.ts
import { MessageHandler } from '@handlers/MessageHandler';
import { MessageEnvelope, GenerateRequestPayload, GenerateResponsePayload } from '@messages';
import { TextOrchestrator } from '@ai';
import { LoggingService } from '@logging';

export class TextGenerationHandler extends MessageHandler {
  constructor(
    postMessage: (message: MessageEnvelope<any>) => void,
    private readonly orchestrator: TextOrchestrator,
    private readonly logger: LoggingService
  ) {
    super(postMessage);
  }

  async handle(message: MessageEnvelope<GenerateRequestPayload>): Promise<void> {
    const { prompt, model, parameters } = message.payload;

    this.logger.info('Generating AI response', { model, promptLength: prompt.length });

    try {
      const response = await this.orchestrator.generate({
        model,
        prompt,
        maxTokens: parameters?.maxTokens ?? 1000,
        temperature: parameters?.temperature ?? 0.7,
        parameters
      });

      this.logger.info('AI response generated', {
        model: response.model,
        tokensUsed: response.usage.totalTokens
      });

      this.postMessage({
        type: MessageType.GENERATE_RESPONSE,
        payload: {
          content: response.content,
          model: response.model,
          usage: response.usage
        } as GenerateResponsePayload,
        correlationId: message.correlationId
      });
    } catch (error) {
      this.logger.error('AI generation failed', error);

      this.postMessage({
        type: MessageType.GENERATE_RESPONSE,
        payload: {
          error: error instanceof Error ? error.message : 'Unknown error'
        } as GenerateResponsePayload,
        correlationId: message.correlationId
      });
    }
  }
}
```

### Token Usage Tracking Pattern

Track and display token usage:

```typescript
// In hook
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

const [totalTokensUsed, setTotalTokensUsed] = useState(0);

const handleResponse = useCallback((message: MessageEnvelope<GenerateResponsePayload>) => {
  if (message.payload.usage) {
    setTotalTokensUsed(prev => prev + message.payload.usage.totalTokens);
  }
}, []);

// In view
<div className="usage-stats">
  <span>Total tokens used: {totalTokensUsed.toLocaleString()}</span>
</div>
```

Store usage in conversation metadata:

```typescript
const turn: ConversationTurn = {
  id: crypto.randomUUID(),
  timestamp: new Date(),
  userPrompt: prompt,
  assistantResponse: response.content,
  status: 'complete',
  metadata: {
    model: response.model,
    tokensUsed: response.usage.totalTokens,
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens
  }
};
```
