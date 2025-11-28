# CLAUDE.md - AI Agent Guidelines

This file provides guidance for AI agents working on this VSCode extension codebase.

## Project Overview

This is a VSCode extension template using:
- **TypeScript** for type safety
- **React 18** for webview UI
- **Webpack** for bundling (dual entry: extension + webview)
- **Jest** for testing
- **Clean Architecture** with layered organization

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
import { AIOrchestrator } from '@ai';              // AI infrastructure
import { LoggingService } from '@logging';         // Logging service
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
- All logs appear in VSCode's Output panel under "Extension Template"

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

## Architecture Decision Records

See `docs/adr/` for architectural decisions. When making significant changes, consider documenting the decision in a new ADR.

## Resources

- [VSCode Extension API](https://code.visualstudio.com/api)
- [VSCode Webview Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [VSCode Theme Colors](https://code.visualstudio.com/api/references/theme-color)
