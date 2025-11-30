# VSCode Extension Template

A well-architected VSCode extension template with AI integration, following Clean Architecture principles.

## Features

- **Clean Architecture** - Organized layers: presentation, application, domain, infrastructure
- **Message Envelope Pattern** - Type-safe communication between extension and webview
- **AI Integration** - Client-agnostic AI orchestration with OpenRouter support
- **Token Tracking** - Real-time token usage accumulation and display
- **Secure API Key Storage** - Uses VSCode's SecretStorage (OS-level encryption)
- **LoggingService** - Centralized logging to VSCode Output channel
- **System Prompts** - PromptLoader for loading prompts from resources
- **Tabbed Webview UI** - React-based UI with VSCode theming
- **State Persistence** - Webview state survives panel hide/show
- **Comprehensive Tests** - 82 tests covering application and infrastructure layers

## Quick Start

```bash
# Install dependencies
npm install

# Start development mode (watches for changes)
npm run watch

# Press F5 in VSCode to launch Extension Development Host
```

## Project Structure

```
src/
├── extension.ts                    # Extension entry point
├── shared/
│   └── types/
│       └── messages/               # Message envelope types
├── application/
│   ├── providers/                  # WebviewViewProvider
│   └── handlers/                   # Message handlers
│       └── domain/                 # Domain-specific handlers
├── domain/
│   └── models/                     # Domain entities
├── infrastructure/
│   ├── ai/
│   │   ├── clients/               # AI client abstraction
│   │   ├── orchestration/         # Conversation management
│   │   └── tools/                 # Tool providers
│   ├── logging/                    # LoggingService (OutputChannel)
│   ├── resources/                  # PromptLoader for system prompts
│   └── secrets/                    # Secure storage
├── presentation/
│   └── webview/
│       ├── components/             # React components
│       ├── hooks/                  # React hooks (tripartite pattern)
│       └── styles/                 # CSS with VSCode theming
└── __tests__/                      # Jest tests (mirrors src structure)
```

## Architecture

### Clean Architecture Layers

1. **Presentation** - React components, hooks, styles
2. **Application** - Message handlers, view providers
3. **Domain** - Business logic, entities
4. **Infrastructure** - External services (AI, secrets, logging, resources)

Dependencies flow inward: Presentation → Application → Domain ← Infrastructure

### Message Envelope Pattern

All extension ↔ webview communication uses typed envelopes:

```typescript
interface MessageEnvelope<TPayload> {
  type: MessageType;        // Enum value
  source: MessageSource;    // 'extension.domain' or 'webview.domain'
  payload: TPayload;        // Type-safe payload
  timestamp: number;
  correlationId?: string;
}
```

### Tripartite Hook Pattern

Domain hooks export three interfaces:

```typescript
// State (read-only)
interface HelloWorldState {
  text: string;
  renderedMarkdown: string;
  isLoading: boolean;
}

// Actions (write operations)
interface HelloWorldActions {
  setText: (text: string) => void;
  submitText: () => void;
}

// Persistence (what gets saved)
interface HelloWorldPersistence {
  text: string;
  renderedMarkdown: string;
}
```

## How-To Guides

### Add a New View/Tab

1. **Create message types** in `src/shared/types/messages/`:
   ```typescript
   // newFeature.ts
   export interface NewFeaturePayload { ... }
   export type NewFeatureMessage = MessageEnvelope<NewFeaturePayload>;
   ```

2. **Add MessageType enum values** in `base.ts`:
   ```typescript
   NEW_FEATURE_REQUEST = 'NEW_FEATURE_REQUEST',
   NEW_FEATURE_RESULT = 'NEW_FEATURE_RESULT',
   ```

3. **Create domain handler** in `src/application/handlers/domain/`:
   ```typescript
   export class NewFeatureHandler {
     constructor(private postMessage: (msg: MessageEnvelope) => void) {}
     async handleRequest(message: MessageEnvelope<NewFeaturePayload>) { ... }
   }
   ```

4. **Register handler** in `MessageHandler.ts`:
   ```typescript
   this.router.register(MessageType.NEW_FEATURE_REQUEST,
     (msg) => this.newFeatureHandler.handleRequest(msg));
   ```

5. **Create domain hook** in `src/presentation/webview/hooks/domain/`:
   ```typescript
   export function useNewFeature(): UseNewFeatureReturn { ... }
   ```

6. **Create view component** in `src/presentation/webview/components/views/`:
   ```typescript
   export function NewFeatureView({ newFeature }: Props) { ... }
   ```

7. **Add tab** in `App.tsx`:
   ```typescript
   const TABS: Tab[] = [
     ...existing,
     { id: 'newFeature', label: 'New Feature' },
   ];
   ```

### Add a New Setting

1. **Add to package.json** `contributes.configuration`:
   ```json
  "pixelMinion.newSetting": {
     "type": "string",
     "default": "value",
     "description": "Description of the setting"
   }
   ```

2. **Update SettingsPayload** in messages:
   ```typescript
   interface SettingsPayload {
     ...existing,
     newSetting: string;
   }
   ```

3. **Update SettingsHandler** to read/write the setting

4. **Update useSettings hook** with state and actions

5. **Update SettingsView** with UI control

### Extend the AI Layer

**Add a new AI client:**

```typescript
// src/infrastructure/ai/clients/AnthropicClient.ts
export class AnthropicClient implements AIClient {
  async createChatCompletion(messages, options) { ... }
}
```

**Add new tools:**

```typescript
// src/infrastructure/ai/tools/SearchToolProvider.ts
export class SearchToolProvider implements ToolProvider {
  listAvailableTools() { return [...]; }
  executeTool(name, params) { ... }
}
```

## API Key Security

API keys are stored using VSCode's SecretStorage API:
- **macOS**: Keychain
- **Windows**: Credential Manager
- **Linux**: libsecret

Keys are **never**:
- Stored in settings.json
- Synced to cloud
- Sent back to the webview (only boolean status)

## Logging

All extension code uses `LoggingService` instead of `console.log`:

```typescript
// Inject via constructor
constructor(private readonly logger: LoggingService) {}

// Use log levels
this.logger.debug('Detailed info for development');
this.logger.info('General operational events');
this.logger.warn('Potential issues');
this.logger.error('Failures', error);
```

Logs appear in VSCode's Output panel under "Extension Template".

## Scripts

| Script | Description |
|--------|-------------|
| `npm run watch` | Development mode with auto-rebuild |
| `npm run build` | Production build |
| `npm test` | Run Jest tests |
| `npm run lint` | Run ESLint |
| `npm run package` | Create .vsix package |

## Testing

The template includes 82 tests across 8 test suites:

| Layer | Tests | Coverage |
|-------|-------|----------|
| MessageRouter | 9 | Strategy pattern routing |
| MessageHandler | 8 | Message dispatch, token accumulation |
| HelloWorldHandler | 5 | Markdown rendering |
| SettingsHandler | 9 | Settings and API key management |
| AIHandler | 8 | Conversation handling |
| SecretStorageService | 10 | Secure storage operations |
| LoggingService | 12 | OutputChannel logging |
| PromptLoader | 11 | Resource loading |

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## VSCode Theming

All components use VSCode CSS variables for automatic theme support:

```css
.my-component {
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-editorWidget-border);
}
```

See `src/presentation/webview/styles/variables.css` for available variables.

## License

MIT
