# Tech Debt: Move TokenUsage to Shared Types

**ID:** 011
**Priority:** Low
**Location:** `src/infrastructure/ai/clients/TextClient.ts`

## Problem

`TokenUsage` interface is defined in `TextClient.ts` but it's used across multiple AI clients:
- `TextClient` / `OpenRouterTextClient`
- `OpenRouterDynamicTextClient`
- `OpenRouterImageClient`

This is a shared concern that should live in `src/shared/types/`.

## Current State

```typescript
// src/infrastructure/ai/clients/TextClient.ts
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
}
```

## Proposed Solution

Move to shared types:

```typescript
// src/shared/types/ai.ts (new file)
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
}
```

Update imports in:
- `TextClient.ts` - re-export from shared for backwards compat
- `OpenRouterImageClient.ts`
- `OpenRouterDynamicTextClient.ts`
- Any other consumers

## Impact

- Cleaner architecture (shared concerns in shared location)
- Easier to extend with additional fields later
- Single source of truth for usage tracking

## Effort

Low - straightforward file move and import updates.
