# Conversation Architecture

This document explains how conversation/chat state flows through the Pixel Minion architecture.

## Key Insight: Two Parallel Conversation States

There are **two separate conversation states** that stay synchronized via messages:

| Location | What It Stores | Purpose |
|----------|---------------|---------|
| **Webview Hook** | `ConversationTurn[]` (prompts + results) | Display history to user |
| **Extension Handler** | `Map<convId, ConversationState>` (API messages) | Send context to AI model |

The webview doesn't know about the AI. The extension doesn't know about the UI.

---

## Layer Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WEBVIEW (React)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  useImageGeneration Hook                                             │   │
│  │  ├─ conversationHistory: ConversationTurn[]  ← UI display state     │   │
│  │  ├─ conversationId: string | null            ← links to extension   │   │
│  │  ├─ persistedState                           ← saved to VSCode      │   │
│  │  └─ handleGenerationResponse()               ← updates on response  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              │ postMessage()                                │
│                              ▼                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                     MessageEnvelope
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTENSION (Node.js)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ImageGenerationHandler                                              │   │
│  │  ├─ conversations: Map<string, ConversationState>  ← API context    │   │
│  │  └─ handleGenerationRequest()                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              │ uses                                         │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  AIOrchestrator                                                      │   │
│  │  ├─ ConversationManager  ← manages turn limits, message history     │   │
│  │  └─ AIClient (interface) ← abstraction for any provider             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              │ implements                                   │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  OpenRouterClient (or any AIClient implementation)                   │   │
│  │  └─ createChatCompletion()  ← actual HTTP to OpenRouter API         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sequence Diagram: New Conversation

```
┌──────────┐     ┌────────────────┐     ┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐     ┌────────────────┐
│   User   │     │ ImageGenView   │     │useImageGenHook  │     │ImageGenerationHandler│     │  AIOrchestrator │     │OpenRouterClient│
└────┬─────┘     └───────┬────────┘     └────────┬────────┘     └──────────┬───────────┘     └────────┬────────┘     └───────┬────────┘
     │                   │                       │                         │                          │                      │
     │ Click "Generate"  │                       │                         │                          │                      │
     │──────────────────>│                       │                         │                          │                      │
     │                   │                       │                         │                          │                      │
     │                   │ generate(prompt)      │                         │                          │                      │
     │                   │──────────────────────>│                         │                          │                      │
     │                   │                       │                         │                          │                      │
     │                   │                       │ setIsLoading(true)      │                          │                      │
     │                   │                       │ setPendingPrompt(prompt)│                          │                      │
     │                   │                       │ clearConversation()     │                          │                      │
     │                   │                       │                         │                          │                      │
     │                   │                       │ postMessage({           │                          │                      │
     │                   │                       │   type: IMAGE_GEN_REQ,  │                          │                      │
     │                   │                       │   payload: {prompt,     │                          │                      │
     │                   │                       │     model, aspectRatio} │                          │                      │
     │                   │                       │ })                      │                          │                      │
     │                   │                       │────────────────────────>│                          │                      │
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │ createConversation()     │                      │
     │                   │                       │                         │ (new Map entry)          │                      │
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │ buildMessages()          │                      │
     │                   │                       │                         │ (system + user prompt)   │                      │
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │ sendMessage(convId,      │                      │
     │                   │                       │                         │   userMessage)           │                      │
     │                   │                       │                         │─────────────────────────>│                      │
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │                          │ conversationManager  │
     │                   │                       │                         │                          │ .addUserMessage()    │
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │                          │ client.createChat    │
     │                   │                       │                         │                          │ Completion(messages) │
     │                   │                       │                         │                          │─────────────────────>│
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │                          │                      │ HTTP POST
     │                   │                       │                         │                          │                      │ openrouter.ai
     │                   │                       │                         │                          │                      │────────────>
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │                          │                      │ <───────────
     │                   │                       │                         │                          │                      │ {images, usage}
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │                          │<─────────────────────│
     │                   │                       │                         │                          │ ChatCompletionResult │
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │                          │ conversationManager  │
     │                   │                       │                         │                          │ .addAssistantMsg()   │
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │<─────────────────────────│                      │
     │                   │                       │                         │ ConversationTurnResult   │                      │
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │ conversation.lastSeed    │                      │
     │                   │                       │                         │   = seed                 │                      │
     │                   │                       │                         │                          │                      │
     │                   │                       │                         │ postMessage({            │                      │
     │                   │                       │                         │   type: IMAGE_GEN_RESP,  │                      │
     │                   │                       │                         │   payload: {convId,      │                      │
     │                   │                       │                         │     images, turnNumber}  │                      │
     │                   │                       │                         │ })                       │                      │
     │                   │                       │<────────────────────────│                          │                      │
     │                   │                       │                         │                          │                      │
     │                   │                       │ handleGenerationResponse│                          │                      │
     │                   │                       │ setConversationId(convId)                          │                      │
     │                   │                       │ addTurnToHistory({      │                          │                      │
     │                   │                       │   prompt: pendingPrompt,│                          │                      │
     │                   │                       │   images, turnNumber    │                          │                      │
     │                   │                       │ })                      │                          │                      │
     │                   │                       │ setIsLoading(false)     │                          │                      │
     │                   │                       │ setPendingPrompt(null)  │                          │                      │
     │                   │                       │                         │                          │                      │
     │                   │<──────────────────────│                         │                          │                      │
     │                   │ re-render with        │                         │                          │                      │
     │                   │ conversationHistory   │                         │                          │                      │
     │<──────────────────│                       │                         │                          │                      │
     │ See conversation  │                       │                         │                          │                      │
     │ thread with images│                       │                         │                          │                      │
     │                   │                       │                         │                          │                      │
```

---

## Sequence Diagram: Continue Conversation (Refinement)

```
┌──────────┐     ┌────────────────┐     ┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   User   │     │ContinueChatInput│    │useImageGenHook  │     │ImageGenerationHandler│     │  AIOrchestrator │
└────┬─────┘     └───────┬────────┘     └────────┬────────┘     └──────────┬───────────┘     └────────┬────────┘
     │                   │                       │                         │                          │
     │ Type "make it     │                       │                         │                          │
     │ more vibrant"     │                       │                         │                          │
     │ Click Send        │                       │                         │                          │
     │──────────────────>│                       │                         │                          │
     │                   │                       │                         │                          │
     │                   │ continueChat(prompt)  │                         │                          │
     │                   │──────────────────────>│                         │                          │
     │                   │                       │                         │                          │
     │                   │                       │ setIsLoading(true)      │                          │
     │                   │                       │ setPendingPrompt(prompt)│                          │
     │                   │                       │                         │                          │
     │                   │                       │ postMessage({           │                          │
     │                   │                       │   type: IMAGE_GEN_REQ,  │                          │
     │                   │                       │   payload: {            │                          │
     │                   │                       │     prompt,             │                          │
     │                   │                       │     conversationId,  ◄──┼── EXISTING convId        │
     │                   │                       │     model, aspectRatio  │                          │
     │                   │                       │   }                     │                          │
     │                   │                       │ })                      │                          │
     │                   │                       │────────────────────────>│                          │
     │                   │                       │                         │                          │
     │                   │                       │                         │ conversation =           │
     │                   │                       │                         │   conversations          │
     │                   │                       │                         │   .get(convId)  ◄────────┼── EXISTING conversation
     │                   │                       │                         │                          │
     │                   │                       │                         │ seed = conversation      │
     │                   │                       │                         │   .lastSeed     ◄────────┼── REUSE seed for consistency
     │                   │                       │                         │                          │
     │                   │                       │                         │ buildMessages()          │
     │                   │                       │                         │ (includes ALL previous   │
     │                   │                       │                         │  turns for context)      │
     │                   │                       │                         │                          │
     │                   │                       │                         │ sendMessage(convId,      │
     │                   │                       │                         │   userMessage)           │
     │                   │                       │                         │─────────────────────────>│
     │                   │                       │                         │                          │
     │                   │                       │                         │                          │ AI receives FULL
     │                   │                       │                         │                          │ conversation history
     │                   │                       │                         │                          │ for context-aware
     │                   │                       │                         │                          │ refinement
     │                   │                       │                         │                          │
     │                   │                       │                         │                          │ ... (API call) ...
     │                   │                       │                         │                          │
     │                   │                       │                         │<─────────────────────────│
     │                   │                       │                         │ result (refined images)  │
     │                   │                       │                         │                          │
     │                   │                       │<────────────────────────│                          │
     │                   │                       │ IMAGE_GEN_RESP with     │                          │
     │                   │                       │ turnNumber: 2           │                          │
     │                   │                       │                         │                          │
     │                   │                       │ addTurnToHistory({      │                          │
     │                   │                       │   prompt: "make it...", │                          │
     │                   │                       │   images, turnNumber: 2 │                          │
     │                   │                       │ })                      │                          │
     │                   │                       │                         │                          │
     │<──────────────────│<──────────────────────│                         │                          │
     │ See turn 2 added  │                       │                         │                          │
     │ to conversation   │                       │                         │                          │
```

---

## Data Structures

### Webview Side (Display State)

```typescript
// What the user sees - stored in hook, persisted to VSCode
interface ConversationTurn {
  id: string;
  prompt: string;              // User's input for this turn
  images: GeneratedImage[];    // Results for this turn
  turnNumber: number;          // 1, 2, 3, ...
  timestamp: number;
}

interface GeneratedImage {
  id: string;
  data: string;                // base64 data URL
  mimeType: string;
  prompt: string;
  timestamp: number;
  seed: number;                // For reproducibility
}

// Hook state
interface ImageGenerationState {
  conversationHistory: ConversationTurn[];  // Full UI history
  conversationId: string | null;            // Links to extension
  pendingPrompt: string | null;             // Tracks in-flight request
  isLoading: boolean;
  // ...
}
```

### Extension Side (API Context)

```typescript
// What the AI needs - stored in handler, NOT persisted
interface ConversationState {
  id: string;
  messages: ChatMessage[];     // Full API message history
  model: string;
  aspectRatio: string;
  lastSeed: number;            // Reused for refinement
  createdAt: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];  // Text or multimodal
}

// Handler maintains map
class ImageGenerationHandler {
  private conversations = new Map<string, ConversationState>();
}
```

---

## Why Two States?

| Concern | Webview Hook | Extension Handler |
|---------|--------------|-------------------|
| **What** | Display turns | API messages |
| **Format** | `ConversationTurn[]` | `ChatMessage[]` |
| **Includes** | Prompt + images | System prompt + user/assistant messages |
| **Persisted** | Yes (VSCode state) | No (in-memory only) |
| **Survives** | Tab switch, webview reload | Only while extension active |
| **Purpose** | Show user their history | Give AI context |

The webview doesn't need to know about system prompts or API message formats.
The extension doesn't need to know about UI components or React state.

---

## Abstraction Boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                               │
│   - React components, hooks                                             │
│   - Knows: ConversationTurn, GeneratedImage, UI state                  │
│   - Doesn't know: AIOrchestrator, ChatMessage, API calls               │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                        MessageEnvelope (contract)
                                  │
┌─────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                                │
│   - Handlers (ImageGenerationHandler)                                   │
│   - Knows: MessageEnvelope, when to call infrastructure                │
│   - Bridges: UI requests ↔ AI infrastructure                           │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                         Internal interfaces
                                  │
┌─────────────────────────────────────────────────────────────────────────┐
│                       INFRASTRUCTURE LAYER                              │
│   - AIOrchestrator, ConversationManager, OpenRouterClient              │
│   - Knows: ChatMessage, API protocols, token limits                    │
│   - Doesn't know: React, UI, MessageEnvelope                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Patterns

### 1. Pending Prompt Tracking
```typescript
// Hook tracks what was sent so it can be added to history on response
const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

const generate = () => {
  setPendingPrompt(prompt);  // Save before sending
  postMessage({ ... });
};

const handleResponse = (msg) => {
  addTurn({
    prompt: pendingPrompt!,  // Use saved prompt
    images: msg.payload.images,
  });
  setPendingPrompt(null);
};
```

### 2. Conversation ID Linking
```typescript
// New conversation: no ID sent, handler creates one
postMessage({ payload: { prompt, model } });  // No conversationId

// Continue: existing ID sent, handler retrieves conversation
postMessage({ payload: { prompt, model, conversationId } });  // Has ID
```

### 3. Seed Reuse for Refinement
```typescript
// Handler stores seed after generation
conversation.lastSeed = responseData.seed;

// On continuation, reuses seed for visual consistency
const seed = payload.seed ?? conversation.lastSeed ?? randomSeed();
```

### 4. Self-Contained Requests with Re-hydration

```typescript
// Webview: Always include history in continuation requests
const continueChat = (newPrompt: string) => {
  const history = conversationHistory.map(turn => ({
    prompt: turn.prompt,
    images: turn.images.map(img => ({ data: img.data, seed: img.seed })),
  }));

  postMessage({
    payload: {
      prompt: newPrompt,
      conversationId,
      history,        // ← Full history for re-hydration
      model,
      aspectRatio,
    }
  });
};

// Handler: Re-hydrate if conversation lost (e.g., extension restart)
let conversation = this.conversations.get(conversationId);
if (!conversation && history?.length) {
  conversation = this.rehydrateConversation(conversationId, model, aspectRatio, history);
  // Rebuilds ChatMessage[] from history, including images for context
}
```

**Why this pattern:**

- Webview always sends history (doesn't need to know if extension restarted)
- Handler uses existing conversation if available (ignores history)
- Handler rebuilds from history if conversation lost
- AI model gets full context including images even after restart

---

## FAQ: Two Separate Stores (Not a Pull Model)

### Q: Is conversation data stored in one place or two?

**Two separate stores** with different data formats, optimized for each layer's needs:

```
┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
│         WEBVIEW HOOK                │     │       EXTENSION HANDLER             │
│                                     │     │                                     │
│  conversationHistory: [             │     │  conversations.get(convId): {       │
│    {                                │     │    messages: [                      │
│      prompt: "sunset landscape",    │     │      { role: "system", content: ... }
│      images: [{ data: "base64..." }]│     │      { role: "user", content: "sunset..." }
│      turnNumber: 1                  │     │      { role: "assistant", content: "..." }
│    },                               │     │      { role: "user", content: "more vibrant" }
│    {                                │     │      { role: "assistant", content: "..." }
│      prompt: "more vibrant",        │     │    ],                               │
│      images: [{ data: "base64..." }]│     │    lastSeed: 12345,                 │
│      turnNumber: 2                  │     │    model: "gemini-2.0-flash"        │
│    }                                │     │  }                                  │
│  ]                                  │     │                                     │
│                                     │     │                                     │
│  conversationId: "conv_abc123" ─────┼─────┼─> Links them, but doesn't pull     │
└─────────────────────────────────────┘     └─────────────────────────────────────┘
         │                                              │
         │                                              │
    What user sees                               What AI needs
    (images, prompts)                         (system prompt, message history)
```

### Q: Does the webview pull data from the extension using `conversationId`?

**No.** The `conversationId` is a **correlation key**, not a data fetch handle.

| Use | Where | Purpose |
|-----|-------|---------|
| **Outbound** | Webview → Extension | "Continue THIS conversation" |
| **Lookup** | Handler | Find the right `ChatMessage[]` to append to |
| **Storage** | Hook | Remember which conversation we're in |

```typescript
// Webview says: "continue conversation conv_abc123"
postMessage({
  payload: {
    prompt: "more vibrant",
    conversationId: "conv_abc123"  // ← "this one please"
  }
});

// Handler looks up, processes, sends back only NEW data
const conversation = this.conversations.get(conversationId);
conversation.messages.push({ role: 'user', content: prompt });
// ... call API with full messages array ...
// ... send back only the NEW result (not the whole history) ...
```

### Q: Why not have a single source of truth?

Three reasons:

1. **Process isolation** - Webview (browser) can't directly access extension (Node.js) memory
2. **Different data shapes** - UI needs images + prompts; API needs `role: user/assistant` format
3. **Different persistence needs** - Webview state persists to survive reload; extension state is ephemeral

### Q: How do they stay synchronized?

**Response messages carry the data needed to update the webview's copy:**

```typescript
// Extension sends back everything the hook needs for THIS turn
postMessage({
  type: IMAGE_GENERATION_RESPONSE,
  payload: {
    conversationId: "conv_abc123",  // So hook can link future requests
    images: [...],                   // So hook can display results
    turnNumber: 2,                   // So hook knows the order
    seed: 12345                      // So hook can show/copy seed
  }
});

// Hook adds to its OWN store (doesn't pull from extension)
const handleResponse = (msg) => {
  setConversationHistory(prev => [...prev, {
    prompt: pendingPrompt,           // Hook tracked this locally
    images: msg.payload.images,      // From response
    turnNumber: msg.payload.turnNumber
  }]);
};
```

### Q: What happens if they get out of sync?

In practice, they stay synchronized through **self-contained requests with automatic re-hydration**:

1. Every request creates/updates extension state
2. Every response updates webview state
3. The flow is always: request → process → response → update

**Extension restart scenario (re-hydration):**

If the extension restarts (losing its `Map`), the webview still has its persisted history. The next "continue" request includes the full conversation history, allowing the handler to **re-hydrate** the conversation:

```typescript
// Webview sends self-contained request with history
postMessage({
  payload: {
    prompt: "add birds",
    conversationId: "conv_abc123",
    history: [                          // ← Full history for re-hydration
      { prompt: "sunset landscape", images: [{data: "...", seed: 123}] },
      { prompt: "more vibrant", images: [{data: "...", seed: 123}] }
    ],
    model: "gemini-2.0-flash",
    aspectRatio: "16:9"
  }
});

// Handler re-hydrates if conversation not found
let conversation = this.conversations.get(conversationId);
if (!conversation && history?.length) {
  conversation = this.rehydrateConversation(conversationId, model, aspectRatio, history);
}
```

**Result**: The AI model receives full context (including previous images) even after extension restart. The conversation continues seamlessly.

### Summary Table

| Aspect | Reality |
|--------|---------|
| Storage | **Duplicated** (parallel stores) |
| Format | **Different** (UI-optimized vs API-optimized) |
| Sync mechanism | Response messages carry new data |
| `conversationId` | Correlation key, not a fetch handle |
| Why duplicated | Process isolation + different data needs |

---

## Summary

1. **Webview hook** manages what the user sees (`ConversationTurn[]`)
2. **Extension handler** manages what the AI needs (`ChatMessage[]`)
3. **Messages** synchronize them (request carries `conversationId`, response carries `turnNumber`)
4. **Infrastructure** (`AIOrchestrator`, `ConversationManager`, `AIClient`) is completely hidden from webview
5. **Persistence**: Only webview state persists; extension state is ephemeral
6. **Not a pull model**: The webview maintains its own display state, updated via response messages
7. **Self-contained requests**: Continuation requests include full history for automatic re-hydration after extension restart
