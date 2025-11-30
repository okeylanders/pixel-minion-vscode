# ADR-002: Three-Suite AI Infrastructure

## Status

Accepted

## Context

The original VSCode extension template had a single `AIOrchestrator` and `OpenRouterClient` for general-purpose AI operations. As Pixel Minion evolved to support three distinct AI generation types (text chat, image generation, and SVG code generation), we needed a scalable architecture that:

1. **Separates Concerns** - Each generation type has fundamentally different:
   - Request formats (text messages vs multimodal image requests)
   - Response formats (text content vs image arrays vs SVG code)
   - State management needs (turn counting vs seed tracking vs code extraction)
   - Client requirements (static models vs dynamic models)

2. **Supports Re-hydration** - Extension restarts lose in-memory state, but webview state persists via `vscode.setState()`. We needed infrastructure that could rebuild conversation context from webview history.

3. **Maintains Thin Handlers** - Handlers should only route messages, not contain business logic. This keeps them testable and focused on message translation.

4. **Enables Dependency Injection** - Clients should be swappable (OpenRouter, OpenAI, local models) without changing orchestrators or handlers.

## Decision

We created three parallel AI generation suites, each following the same architectural pattern:

### Pattern: Orchestrator + ConversationManager + Client

Each suite consists of three layers:

```
Suite
├── Orchestrator (coordinates client + conversation manager)
├── ConversationManager (manages state, formats messages for API)
└── Client (implements provider-specific API calls)
```

### Three Suites

#### 1. Text Suite

- **Purpose**: Chat/conversation functionality
- **Orchestrator**: `TextOrchestrator`
- **Client**: `OpenRouterTextClient` (static model at construction)
- **ConversationManager**: `TextConversationManager`
- **Messages**: `TextMessage[]` with `role` ('system' | 'user' | 'assistant')
- **State**: Tracks turn count, enforces max turns limit
- **Default**: `max_tokens: 48000`

#### 2. Image Suite

- **Purpose**: Image generation (text-to-image, image-to-image)
- **Orchestrator**: `ImageOrchestrator`
- **Client**: `OpenRouterImageClient`
- **ConversationManager**: `ImageConversationManager`
- **Messages**: `ImageConversationMessage[]` with multimodal content
- **State**: Tracks prompts, generated images, seeds, aspect ratio
- **Special**: Re-hydration support from webview history

#### 3. SVG Suite

- **Purpose**: SVG code generation using text models
- **Orchestrator**: `SVGOrchestrator`
- **Client**: `OpenRouterDynamicTextClient` (model set via `setModel()`)
- **ConversationManager**: `SVGConversationManager`
- **Messages**: `TextMessage[]` with multimodal content (optional images)
- **State**: Tracks prompts, SVG code, aspect ratio
- **Special**: Extracts SVG code from markdown responses

### Client Types

#### OpenRouterTextClient (Static Model)

- Model is fixed at construction time
- Used for text chat where model rarely changes
- Simple constructor: `new OpenRouterTextClient(apiKey, model)`

#### OpenRouterDynamicTextClient (Dynamic Model)

- Model can be changed via `setModel(model)` before each request
- Used for SVG generation where users select different models per request
- Uses `SecretStorageService` for API key (not constructor parameter)
- Constructor: `new OpenRouterDynamicTextClient(secretStorage, logger, defaultModel)`

#### OpenRouterImageClient

- Specialized for image generation API format
- Uses `modalities: ['image', 'text']` and `image_config: { aspect_ratio }`
- Returns base64 data URLs in response
- Constructor: `new OpenRouterImageClient(secretStorage, logger)`

### Dependency Injection Pattern

Orchestrators receive clients via `setClient()` method (not constructor):

```typescript
// In MessageHandler.ts
const imageOrchestrator = new ImageOrchestrator(logger);
imageOrchestrator.setClient(new OpenRouterImageClient(secretStorage, logger));

const svgOrchestrator = new SVGOrchestrator(logger);
svgOrchestrator.setClient(new OpenRouterDynamicTextClient(secretStorage, logger));

// Handlers receive orchestrators (NOT clients)
this.imageGenerationHandler = new ImageGenerationHandler(
  postMessage,
  imageOrchestrator,  // Injected orchestrator
  logger
);
```

**Why `setClient()` instead of constructor injection?**

- Orchestrators can be created without an immediate client dependency
- Enables lazy client initialization (e.g., wait for API key)
- Allows client swapping at runtime if needed
- Clearer separation: orchestrator owns conversation logic, client is pluggable

### Thin Handler Pattern

Handlers ONLY route messages to orchestrators - NO business logic:

```typescript
export class ImageGenerationHandler {
  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly orchestrator: ImageOrchestrator,  // Injected!
    private readonly logger: LoggingService
  ) {}

  async handleGenerationRequest(message: MessageEnvelope<...>): Promise<void> {
    // Extract payload
    const { prompt, model, aspectRatio, ... } = message.payload;

    try {
      // Delegate to orchestrator (all business logic there)
      const result = await this.orchestrator.generateImage(prompt, options);

      // Transform response for presentation layer
      const images = this.transformToGeneratedImages(result);

      // Send response
      this.postMessage(createEnvelope(..., images, message.correlationId));
    } catch (error) {
      this.sendError(error, message.correlationId);
    }
  }
}
```

**What handlers DO**:
- Extract payloads from messages
- Route to orchestrators
- Transform orchestrator results for presentation
- Send responses via `postMessage`
- Handle VSCode-specific operations (file saving, opening)

**What handlers DO NOT do**:
- Create AI clients
- Build API requests
- Manage conversation state
- Format messages for AI
- Parse AI responses

### Two-Store History Pattern

Conversation history exists in two separate stores:

1. **Presentation Layer** (webview): `ConversationTurn[]`
   - UI-focused structure
   - Persists across webview reloads via `vscode.setState()`
   - Contains: user prompts, assistant responses, metadata (timestamps, seeds, etc.)

2. **Infrastructure Layer** (extension): `TextMessage[]` or `ImageConversationMessage[]`
   - API-focused structure
   - Ephemeral (in-memory `Map` in ConversationManagers)
   - Lost when extension restarts
   - Contains: formatted messages ready for API calls

### Re-hydration Pattern

When extension restarts, infrastructure state is lost but webview state persists. Re-hydration rebuilds infrastructure state from webview history:

**Webview Side** (always sends history):

```typescript
const continueConversation = useCallback((prompt: string) => {
  // Build history for re-hydration (sent every time)
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
```

**Extension Side** (re-hydrates if needed):

```typescript
async handleContinueRequest(message) {
  let conversation = this.orchestrator.getConversation(conversationId);

  // If conversation not found but history provided, re-hydrate
  if (!conversation && history?.length) {
    this.logger.info(`Re-hydrating conversation ${conversationId}`);
    conversation = await this.orchestrator.continueConversation(
      conversationId,
      prompt,
      history,  // Orchestrator rebuilds state from this
      model,
      aspectRatio
    );
  }

  // Continue with existing or re-hydrated conversation
}
```

**Benefits**:
- Webview doesn't need to know if extension restarted
- Handler uses existing conversation if available (ignores history)
- Handler rebuilds from history if conversation lost
- AI model gets full context even after restart

### Default Parameters

- **Text clients**: `max_tokens: 48000` (expanded headroom for chat/SVG responses)
- **Image clients**: Uses OpenRouter model defaults
- **Temperature**: `0.7` (balanced creativity/consistency)

## Consequences

### Easier

- **Adding new generation types**: Follow the same three-layer pattern (orchestrator + conversation manager + client)
- **Testing**: Each layer can be tested independently with mocks
- **Swapping providers**: Implement new client, inject into existing orchestrator
- **Understanding codebase**: Consistent pattern across all AI operations
- **Debugging**: Clear separation between routing (handler), coordination (orchestrator), and API calls (client)

### More Difficult

- **More files**: Three suites means 3 orchestrators + 3 conversation managers + 3 clients (vs 1 orchestrator + 1 client)
- **Boilerplate**: Each suite requires similar setup code in `MessageHandler.ts`
- **Learning curve**: New developers must understand the three-layer pattern

### Risks

- **Over-engineering for simple cases**: If you only need one-off AI calls without conversation state, this pattern might feel heavy
  - Mitigation: Use `textOrchestrator.sendSingleMessage()` for simple cases
- **Re-hydration complexity**: Webview must always send history with continuation requests
  - Mitigation: Pattern is documented and enforced by TypeScript interfaces
- **Client interface divergence**: Text vs Image clients have different signatures
  - Mitigation: Separate interfaces (`TextClient` vs `ImageGenerationClient`) acknowledge these are fundamentally different operations

## Alternatives Considered

### Single AIOrchestrator with Generation Type Parameter

```typescript
// NOT CHOSEN
const result = await orchestrator.generate({
  type: 'image' | 'text' | 'svg',
  prompt,
  ...
});
```

**Rejected because**:
- Conflates fundamentally different operations
- Forces single client interface despite different API formats
- Makes conversation management complex (mixed message types)

### Handlers Create Clients Directly

```typescript
// NOT CHOSEN
export class ImageGenerationHandler {
  async handleRequest(message) {
    const client = new OpenRouterImageClient(apiKey);
    const result = await client.generate(...);
  }
}
```

**Rejected because**:
- Handlers become fat (contain business logic)
- Hard to test (client creation inside handler)
- No conversation state management
- No re-hydration support

### ConversationManager Inside Handlers

```typescript
// NOT CHOSEN
export class ImageGenerationHandler {
  private conversations = new Map();

  async handleRequest(message) {
    const conversation = this.conversations.get(id);
    // ... manage state in handler
  }
}
```

**Rejected because**:
- Handlers become stateful (harder to test)
- State management logic mixed with message routing
- Re-hydration logic split between handler and conversation manager

## References

- Implementation: `src/infrastructure/ai/orchestration/`
- Clients: `src/infrastructure/ai/clients/`
- Handlers: `src/application/handlers/domain/ImageGenerationHandler.ts`, `SVGGenerationHandler.ts`
- Wiring: `src/application/handlers/MessageHandler.ts`
