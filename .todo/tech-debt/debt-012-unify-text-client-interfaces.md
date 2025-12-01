# Tech Debt: Unify TextClient and DynamicTextClient

**ID:** 012
**Priority:** Low
**Location:** `src/infrastructure/ai/clients/`

## Problem

We have two text client implementations with almost identical code:

1. **`OpenRouterTextClient`** - Model fixed at construction, takes raw API key
2. **`OpenRouterDynamicTextClient`** - Has `setModel()`, uses SecretStorageService

The only interface difference is `setModel()` - the rest is 95% duplicated code.

## Current State

```typescript
// TextClient interface
interface TextClient {
  getModel(): string;
  createCompletion(...): Promise<TextCompletionResult>;
  isConfigured(): Promise<boolean>;
}

// OpenRouterTextClient - static model, raw API key
class OpenRouterTextClient implements TextClient {
  constructor(apiKey: string, model: string) {}
  // No setModel()
}

// OpenRouterDynamicTextClient - adds setModel()
class OpenRouterDynamicTextClient implements TextClient {
  constructor(secretStorage: SecretStorageService, logger: LoggingService, defaultModel: string) {}
  setModel(model: string): void {}  // Extra method not in interface
}
```

## Proposed Solutions

### Option A: Add `setModel()` to TextClient interface (Recommended)

Add optional `setModel()` to the base interface:

```typescript
interface TextClient {
  getModel(): string;
  setModel?(model: string): void;  // Optional - static clients can omit
  createCompletion(...): Promise<TextCompletionResult>;
  isConfigured(): Promise<boolean>;
}
```

- Remove `OpenRouterTextClient` (or keep as legacy)
- Use `OpenRouterDynamicTextClient` everywhere
- Callers that need dynamic model use `setModel()`
- Callers that don't need it just ignore it

### Option B: Create DynamicTextClient interface

Create a new interface for clients that support dynamic model selection:

```typescript
interface DynamicTextClient extends TextClient {
  setModel(model: string): void;
}

// Type guard for runtime checking
function isDynamicTextClient(client: TextClient): client is DynamicTextClient {
  return 'setModel' in client && typeof client.setModel === 'function';
}
```

### Option C: Unify implementations, keep interface simple

Keep `TextClient` interface unchanged but:
1. Merge implementations into single `OpenRouterTextClient`
2. Always use SecretStorageService (more secure)
3. Support both static and dynamic model via constructor options

```typescript
class OpenRouterTextClient implements TextClient {
  constructor(
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService,
    options: { model: string; allowModelChange?: boolean }
  ) {}

  setModel(model: string): void {
    if (!this.options.allowModelChange) {
      throw new Error('Model change not allowed for this client instance');
    }
    this.currentModel = model;
  }
}
```

## Recommendation

**Option A** is simplest - just add `setModel()` to the interface. Most modern clients support model switching anyway.

## Duplicated Code to Consolidate

Both clients share:
- `baseUrl` constant
- `createCompletion()` logic (identical except model source)
- Response parsing with `native_tokens_prompt` fallback
- Error handling
- Headers construction

## Impact

- Reduces code duplication
- Single point of maintenance for OpenRouter integration
- Cleaner interface hierarchy

## Effort

Medium - need to update interface, consolidate implementations, update consumers.
