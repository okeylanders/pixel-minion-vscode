# Chat Thread Example - Design Document

**Purpose**: A reusable, generic chat thread pattern that can be copied into the template repository to demonstrate multi-turn conversation UI with message handlers, persistence, and loading states.

**Current Status**: Tab 2 currently contains `SVGGenerationView`, which uses a simple single-output pattern with optional continuation. This design proposes a generic chat thread example that showcases the full conversation pattern seen in Tab 1 (Image Generation).

---

## Overview

This design creates a generic "AI Chat" example for Tab 2 that demonstrates:

1. **Multi-turn conversation state** - Full conversation history with user/assistant bubbles
2. **Message handlers at hook level** - Exposed for App-level routing (prose-minion pattern)
3. **Persistence** - Conversation history persisted across sessions
4. **Loading states** - Proper placement below content to avoid layout shift
5. **Reusable chat UI components** - Generic components that work for any chat-style interface

The pattern is designed to be easily copied into template repositories as a reference implementation.

---

## Architecture Analysis

### Current Tab 2 (SVG Generation)

**Location**: `/src/presentation/webview/components/views/SVGGenerationView.tsx`

**Pattern**:
- Simple single-output view (one SVG result at a time)
- Continuation support via `ContinueChatInput`
- No conversation history display
- Result overwrites previous result

**Hook**: `/src/presentation/webview/hooks/domain/useSVGGeneration.ts`
- State: `svgCode` (single result), `conversationId`, `isLoading`
- Actions: `generate()`, `continueChat()`, `clearConversation()`
- No conversation history tracking

### Reference Implementation (Tab 1)

**Location**: `/src/presentation/webview/components/views/ImageGenerationView.tsx`

**Pattern**:
- Full conversation thread display
- ConversationThread component shows all turns
- Conversation header with title, date, clear button
- Loading indicator at bottom (proper placement)
- ContinueChatInput for refinement

**Hook**: `/src/presentation/webview/hooks/domain/useImageGeneration.ts`
- State: `conversationHistory: ConversationTurn[]`, `conversationId`, `isLoading`
- Actions: `generate()`, `continueChat()`, `clearConversation()`
- Handlers: `handleGenerationResponse()`, `handleSaveResult()`, `handleError()`
- Full conversation tracking in `ConversationTurn[]`

---

## Design: Generic Chat Thread Example

### Use Case

A simple AI chat interface where:
- User sends text prompts
- AI responds with text messages
- Full conversation history is displayed in chat bubbles
- Conversations are persisted across sessions
- Multiple conversations can be created (with clear/new buttons)

This is simpler than image generation (no images/seeds) but demonstrates the same architectural patterns.

---

## Data Structures

### Message Types

**Location**: `/src/shared/types/messages/chat.ts` (new file)

```typescript
/**
 * Chat Message Payloads - Generic text-based chat
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatTurn {
  id: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  turnNumber: number;
  timestamp: number;
}

export interface ChatRequestPayload {
  prompt: string;
  model?: string;
  conversationId?: string;  // For continuation
}

export interface ChatResponsePayload {
  conversationId: string;
  message: ChatMessage;
  turnNumber: number;
}

export interface ChatSaveRequestPayload {
  conversationId: string;
  format: 'markdown' | 'json';
  suggestedFilename: string;
}

export interface ChatSaveResultPayload {
  success: boolean;
  conversationId: string;
  filePath?: string;
  error?: string;
}
```

### Message Type Enum

**Location**: `/src/shared/types/messages/base.ts` (add to existing)

```typescript
export enum MessageType {
  // ... existing types ...

  // Generic Chat
  CHAT_REQUEST = 'CHAT_REQUEST',
  CHAT_RESPONSE = 'CHAT_RESPONSE',
  CHAT_CLEAR = 'CHAT_CLEAR',
  CHAT_SAVE_REQUEST = 'CHAT_SAVE_REQUEST',
  CHAT_SAVE_RESULT = 'CHAT_SAVE_RESULT',
}
```

---

## Hook Design

### Interface: useChat

**Location**: `/src/presentation/webview/hooks/domain/useChat.ts`

```typescript
// 1. State Interface (read-only)
export interface ChatState {
  prompt: string;
  model: string;
  conversationHistory: ChatTurn[];
  conversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

// 2. Actions Interface (write operations)
export interface ChatActions {
  setPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  sendMessage: () => void;           // New message (clears conversation)
  continueChat: (prompt: string) => void;  // Continue existing conversation
  clearConversation: () => void;
  saveConversation: () => void;
}

// 2b. Message Handlers Interface (for App-level routing)
export interface ChatHandlers {
  handleChatResponse: (message: MessageEnvelope) => void;
  handleSaveResult: (message: MessageEnvelope) => void;
  handleError: (message: MessageEnvelope) => void;
}

// 3. Persistence Interface (what gets saved)
export interface ChatPersistence {
  prompt: string;
  model: string;
  conversationId: string | null;
  conversationHistory: ChatTurn[];
}

// Composed return type
export type UseChatReturn = ChatState & ChatActions & ChatHandlers & {
  persistedState: ChatPersistence;
};
```

### Hook Implementation

```typescript
export function useChat(
  initialState?: Partial<ChatPersistence>
): UseChatReturn {
  const vscode = useVSCodeApi();

  // State
  const [prompt, setPrompt] = useState(initialState?.prompt ?? '');
  const [model, setModel] = useState(initialState?.model ?? 'anthropic/claude-3.5-sonnet');
  const [conversationHistory, setConversationHistory] = useState<ChatTurn[]>(
    initialState?.conversationHistory ?? []
  );
  const [conversationId, setConversationId] = useState<string | null>(
    initialState?.conversationId ?? null
  );
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Message handlers (exposed for App-level routing)
  const handleChatResponse = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as ChatResponsePayload;
    setConversationId(payload.conversationId);

    // Build turn from pending prompt + response
    setPendingPrompt((currentPending) => {
      if (currentPending) {
        const userMessage: ChatMessage = {
          id: `user-${payload.turnNumber}`,
          role: 'user',
          content: currentPending,
          timestamp: Date.now() - 1000, // Slight offset before assistant
        };

        const turn: ChatTurn = {
          id: `turn-${payload.turnNumber}`,
          userMessage,
          assistantMessage: payload.message,
          turnNumber: payload.turnNumber,
          timestamp: payload.message.timestamp,
        };

        setConversationHistory((prev) => [...prev, turn]);
      }
      return null; // Clear pending
    });

    setIsLoading(false);
    setError(null);
  }, []);

  const handleSaveResult = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as ChatSaveResultPayload;
    if (!payload.success) {
      setError(payload.error ?? 'Failed to save conversation');
    }
  }, []);

  const handleError = useCallback((message: MessageEnvelope) => {
    setIsLoading(false);
    setError((message.payload as { message: string }).message);
  }, []);

  // Actions
  const sendMessage = useCallback(() => {
    if (!prompt.trim()) {
      setError('Please enter a message');
      return;
    }

    setIsLoading(true);
    setError(null);
    setConversationId(null);       // Clear conversation for new chat
    setConversationHistory([]);     // Clear history
    setPendingPrompt(prompt);       // Track for history building

    vscode.postMessage(
      createEnvelope(
        MessageType.CHAT_REQUEST,
        'webview.chat',
        { prompt, model }
      )
    );
  }, [prompt, model, vscode]);

  const continueChat = useCallback(
    (chatPrompt: string) => {
      if (!chatPrompt.trim()) {
        setError('Please enter a message');
        return;
      }

      if (!conversationId) {
        setError('No active conversation to continue');
        return;
      }

      setIsLoading(true);
      setError(null);
      setPendingPrompt(chatPrompt);

      // Include full history for re-hydration after extension restart
      // Handler uses existing conversation if available, rebuilds from history if lost
      const history = conversationHistory.map(turn => ({
        prompt: turn.prompt,
        response: turn.response,
      }));

      vscode.postMessage(
        createEnvelope(
          MessageType.CHAT_REQUEST,
          'webview.chat',
          {
            prompt: chatPrompt,
            conversationId,
            history,  // Self-contained request enables re-hydration
            model,
          }
        )
      );
    },
    [conversationId, conversationHistory, model, vscode]
  );

  const clearConversation = useCallback(() => {
    setConversationId(null);
    setConversationHistory([]);
    setPrompt('');
    setError(null);
  }, []);

  const saveConversation = useCallback(() => {
    if (!conversationId || conversationHistory.length === 0) {
      setError('No conversation to save');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suggestedFilename = `chat-${timestamp}.md`;

    vscode.postMessage(
      createEnvelope(
        MessageType.CHAT_SAVE_REQUEST,
        'webview.chat',
        {
          conversationId,
          format: 'markdown',
          suggestedFilename,
        }
      )
    );
  }, [conversationId, conversationHistory, vscode]);

  // Persistence object
  const persistedState: ChatPersistence = {
    prompt,
    model,
    conversationId,
    conversationHistory,
  };

  return {
    // State
    prompt,
    model,
    conversationHistory,
    conversationId,
    isLoading,
    error,
    // Actions
    setPrompt,
    setModel,
    sendMessage,
    continueChat,
    clearConversation,
    saveConversation,
    // Message Handlers
    handleChatResponse,
    handleSaveResult,
    handleError,
    // Persistence
    persistedState,
  };
}
```

---

## Component Hierarchy

```
ChatView (domain view)
├── ChatHeader
│   ├── ModelSelector (reusable)
│   └── PromptSection
│       ├── Textarea (reusable)
│       └── Button (reusable)
├── ErrorDisplay (conditional)
├── Divider
├── ConversationHeader (conditional - when history exists)
│   ├── ConversationTitle
│   ├── ConversationDate
│   └── ClearButton
├── ChatScrollArea
│   ├── ChatThread (new - generic chat bubbles)
│   │   └── ChatTurn[] (new - user + assistant bubbles)
│   │       ├── ChatBubble (user)
│   │       └── ChatBubble (assistant)
│   └── LoadingIndicator (at bottom)
└── ContinueChatInput (conditional - when conversation exists)
```

### New Components

#### ChatThread

**Location**: `/src/presentation/webview/components/chat/ChatThread.tsx`

```typescript
/**
 * ChatThread - Generic chat-style conversation display
 *
 * Displays conversation history as user/assistant chat bubbles.
 * Reusable for any text-based chat interface.
 */
import React from 'react';
import { ChatTurn } from '@messages';
import { ChatBubble } from './ChatBubble';
import '../../styles/components/chat-thread.css';

export interface ChatThreadProps {
  turns: ChatTurn[];
}

export const ChatThread: React.FC<ChatThreadProps> = ({ turns }) => {
  if (turns.length === 0) {
    return null;
  }

  return (
    <div className="chat-thread">
      {turns.map((turn) => (
        <div key={turn.id} className="chat-turn">
          <ChatBubble
            message={turn.userMessage}
            variant="user"
          />
          <ChatBubble
            message={turn.assistantMessage}
            variant="assistant"
          />
        </div>
      ))}
    </div>
  );
};
```

#### ChatBubble

**Location**: `/src/presentation/webview/components/chat/ChatBubble.tsx`

```typescript
/**
 * ChatBubble - Individual message bubble in chat thread
 *
 * Variants:
 * - user: Right-aligned, accent background
 * - assistant: Left-aligned, neutral background
 */
import React from 'react';
import { ChatMessage } from '@messages';
import '../../styles/components/chat-bubble.css';

export interface ChatBubbleProps {
  message: ChatMessage;
  variant: 'user' | 'assistant';
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, variant }) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className={`chat-bubble chat-bubble--${variant}`}>
      <div className="chat-bubble-header">
        <span className="chat-bubble-role">
          {variant === 'user' ? 'You' : 'AI'}
        </span>
        <span className="chat-bubble-time">{formatTime(message.timestamp)}</span>
      </div>
      <div className="chat-bubble-content">{message.content}</div>
    </div>
  );
};
```

#### ChatView

**Location**: `/src/presentation/webview/components/views/ChatView.tsx`

```typescript
/**
 * ChatView - Generic AI chat interface
 *
 * Pattern: Composition of chat components
 * Responsibilities:
 * - Compose ModelSelector, ChatThread, ContinueChatInput
 * - Receive hook instance as prop (prose-minion pattern)
 * - Display conversation header with metadata
 */
import React from 'react';
import { UseChatReturn } from '../../hooks/domain/useChat';
import { ModelSelector } from '../image/ModelSelector';
import { ChatThread } from '../chat/ChatThread';
import { ContinueChatInput } from '../shared/ContinueChatInput';
import { LoadingIndicator } from '../shared/LoadingIndicator';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import '../../styles/components/chat-view.css';

// Example models for chat
const CHAT_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', displayName: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4', displayName: 'GPT-4' },
  { id: 'google/gemini-pro', displayName: 'Gemini Pro' },
];

export interface ChatViewProps {
  chat: UseChatReturn;
}

export const ChatView: React.FC<ChatViewProps> = ({ chat }) => {
  const {
    prompt,
    setPrompt,
    model,
    setModel,
    conversationHistory,
    conversationId,
    isLoading,
    error,
    sendMessage,
    continueChat,
    clearConversation,
    saveConversation,
  } = chat;

  // Format conversation metadata
  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getConversationTitle = () => {
    if (conversationHistory.length === 0) return '';
    const firstPrompt = conversationHistory[0].userMessage.content;
    return firstPrompt.length > 30 ? `${firstPrompt.slice(0, 30)}...` : firstPrompt;
  };

  return (
    <div className="chat-view">
      {/* Header: Model selector */}
      <div className="chat-header">
        <ModelSelector
          models={CHAT_MODELS}
          selectedModel={model}
          onModelChange={setModel}
          disabled={isLoading}
        />
      </div>

      {/* Prompt input */}
      <div className="chat-prompt-section">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything..."
          disabled={isLoading}
          rows={3}
        />

        <div className="chat-button-row">
          <Button
            onClick={sendMessage}
            disabled={isLoading || !prompt.trim()}
            variant="primary"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
          {conversationHistory.length > 0 && (
            <Button
              onClick={saveConversation}
              disabled={isLoading}
              variant="secondary"
            >
              Save Chat
            </Button>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="chat-error">
          {error}
        </div>
      )}

      {/* Divider */}
      <hr className="chat-divider" />

      {/* Conversation header - only show when we have a conversation */}
      {conversationHistory.length > 0 && (
        <div className="conversation-header">
          <div className="conversation-header-info">
            <span className="conversation-header-title">{getConversationTitle()}</span>
            <span className="conversation-header-date">
              {formatDateTime(conversationHistory[0].timestamp)}
            </span>
          </div>
          <button
            type="button"
            className="conversation-header-clear"
            onClick={clearConversation}
            title="Clear conversation"
            disabled={isLoading}
          >
            <span aria-hidden="true">&#128465;</span>
          </button>
        </div>
      )}

      {/* Scrollable chat area */}
      <div className="chat-scroll-area">
        {/* Chat thread - all conversation turns */}
        <ChatThread turns={conversationHistory} />

        {/* Loading indicator - appears at bottom where new content will show */}
        <LoadingIndicator
          isLoading={isLoading}
          defaultMessage="Thinking..."
        />
      </div>

      {/* Continue chat input - fixed at bottom (only show when conversation exists) */}
      {conversationId && conversationHistory.length > 0 && (
        <ContinueChatInput
          onSubmit={continueChat}
          disabled={isLoading}
          isLoading={isLoading}
          placeholder="Continue the conversation..."
        />
      )}
    </div>
  );
};
```

---

## Styles

### chat-thread.css

**Location**: `/src/presentation/webview/styles/components/chat-thread.css`

```css
/**
 * ChatThread styles - Generic chat conversation display
 */

.chat-thread {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-turn {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Divider between turns (subtle) */
.chat-turn:not(:last-child)::after {
  content: '';
  display: block;
  height: 1px;
  background: var(--vscode-panel-border);
  margin-top: 8px;
  opacity: 0.3;
}
```

### chat-bubble.css

**Location**: `/src/presentation/webview/styles/components/chat-bubble.css`

```css
/**
 * ChatBubble styles - Individual message bubbles
 */

.chat-bubble {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  max-width: 85%;
}

/* User variant - right-aligned, accent color */
.chat-bubble--user {
  align-self: flex-end;
  background: var(--vscode-textLink-foreground);
  color: var(--vscode-editor-background);
  border-bottom-right-radius: 2px;
}

/* Assistant variant - left-aligned, neutral color */
.chat-bubble--assistant {
  align-self: flex-start;
  background: var(--vscode-editor-selectionBackground);
  border: 1px solid var(--vscode-panel-border);
  border-bottom-left-radius: 2px;
}

.chat-bubble-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.8;
}

.chat-bubble-role {
  /* Inherits color from parent */
}

.chat-bubble-time {
  font-weight: 400;
  opacity: 0.7;
}

.chat-bubble-content {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Override text color for user bubble content */
.chat-bubble--user .chat-bubble-content {
  color: var(--vscode-editor-background);
}

.chat-bubble--assistant .chat-bubble-content {
  color: var(--vscode-foreground);
}
```

### chat-view.css

**Location**: `/src/presentation/webview/styles/components/chat-view.css`

```css
/**
 * ChatView styles - Main chat interface layout
 */

.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
  padding: 16px;
}

.chat-header {
  display: flex;
  gap: 12px;
  align-items: center;
}

.chat-prompt-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-button-row {
  display: flex;
  gap: 8px;
}

.chat-error {
  padding: 10px 12px;
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  border-radius: 4px;
  color: var(--vscode-inputValidation-errorForeground);
  font-size: 13px;
}

.chat-divider {
  border: none;
  border-top: 1px solid var(--vscode-panel-border);
  margin: 4px 0;
  opacity: 0.5;
}

/* Scrollable area for conversation */
.chat-scroll-area {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-right: 4px; /* Space for scrollbar */
}

/* Conversation header (reuse styles from image-generation-view.css) */
.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--vscode-editor-selectionBackground);
  border-radius: 4px;
  border-left: 3px solid var(--vscode-textLink-foreground);
}

.conversation-header-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.conversation-header-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.conversation-header-date {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.conversation-header-clear {
  background: none;
  border: none;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 16px;
  transition: background 0.2s;
}

.conversation-header-clear:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.conversation-header-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Message Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MESSAGE FLOW                                 │
└─────────────────────────────────────────────────────────────────────┘

INITIAL MESSAGE (New Conversation)
───────────────────────────────────

┌──────────────┐
│   ChatView   │
│              │
│  [User types │
│   "Hello"]   │
└──────┬───────┘
       │ onClick={sendMessage}
       ▼
┌──────────────┐
│   useChat    │
│              │
│ setPending   │
│ ("Hello")    │
│ setLoading   │
│ (true)       │
└──────┬───────┘
       │ vscode.postMessage()
       ▼
┌────────────────────────────┐
│  CHAT_REQUEST              │
│  {                         │
│    prompt: "Hello",        │
│    model: "claude-3.5"     │
│  }                         │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│   MessageRouter (App)      │
│   Routes to handler        │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│   ChatHandler (Extension)  │
│                            │
│ 1. Get API key             │
│ 2. Create conversation     │
│ 3. Call AI API             │
│ 4. Build response          │
└────────┬───────────────────┘
         │ postMessage()
         ▼
┌────────────────────────────┐
│  CHAT_RESPONSE             │
│  {                         │
│    conversationId: "abc",  │
│    message: {              │
│      id: "asst-1",         │
│      role: "assistant",    │
│      content: "Hi!",       │
│      timestamp: 123        │
│    },                      │
│    turnNumber: 1           │
│  }                         │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│   MessageRouter (App)      │
│   Routes to hook handler   │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│   useChat                  │
│   handleChatResponse()     │
│                            │
│ 1. Get pending ("Hello")   │
│ 2. Create user message     │
│ 3. Create turn object      │
│ 4. Add to history          │
│ 5. Clear pending           │
│ 6. Set conversationId      │
│ 7. setLoading(false)       │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│   ChatView (re-render)     │
│                            │
│ - Show conversation header │
│ - Display ChatThread       │
│ - Show ContinueChatInput   │
│ - Hide LoadingIndicator    │
└────────────────────────────┘


CONTINUATION MESSAGE (Existing Conversation)
────────────────────────────────────────────

┌──────────────┐
│   ChatView   │
│              │
│ Continue     │
│ Input        │
└──────┬───────┘
       │ onSubmit("Tell me more")
       ▼
┌──────────────┐
│   useChat    │
│              │
│ setPending   │
│ ("Tell...")  │
│ setLoading   │
│ (true)       │
└──────┬───────┘
       │ vscode.postMessage()
       ▼
┌────────────────────────────┐
│  CHAT_REQUEST              │
│  {                         │
│    prompt: "Tell me more", │
│    conversationId: "abc"   │◄─── Includes ID
│  }                         │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│   ChatHandler (Extension)  │
│                            │
│ 1. Get conversation by ID  │
│ 2. Add user message        │
│ 3. Call AI API             │
│ 4. Add assistant message   │
│ 5. Increment turn number   │
└────────┬───────────────────┘
         │ postMessage()
         ▼
┌────────────────────────────┐
│  CHAT_RESPONSE             │
│  {                         │
│    conversationId: "abc",  │
│    message: { ... },       │
│    turnNumber: 2           │◄─── Incremented
│  }                         │
└────────┬───────────────────┘
         │
         ▼
   [Same flow as above]


ERROR HANDLING
──────────────

┌────────────────────────────┐
│   ChatHandler (Extension)  │
│                            │
│   API call fails           │
└────────┬───────────────────┘
         │ postMessage()
         ▼
┌────────────────────────────┐
│  ERROR                     │
│  {                         │
│    message: "API error",   │
│    code: "CHAT_ERROR"      │
│  }                         │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│   MessageRouter (App)      │
│   Check message.source     │
│   Route to chat handler    │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│   useChat                  │
│   handleError()            │
│                            │
│ 1. setLoading(false)       │
│ 2. setError(msg)           │
│ 3. Keep pending prompt     │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│   ChatView (re-render)     │
│                            │
│ - Show error message       │
│ - Hide LoadingIndicator    │
│ - Keep form enabled        │
└────────────────────────────┘
```

---

## Key Patterns Demonstrated

### 1. Multi-turn Conversation State

**Hook maintains**:
- `conversationHistory: ChatTurn[]` - Full history of all turns
- `conversationId: string | null` - Server-side conversation tracking
- `pendingPrompt: string | null` - Track user's message until response arrives

**View displays**:
- ChatThread component renders all turns
- Conversation header shows metadata (title from first prompt, timestamp)
- Clear button to start fresh

### 2. Message Handlers at Hook Level

**Tripartite interface**:
```typescript
export type UseChatReturn =
  ChatState &           // Read-only state
  ChatActions &         // User actions
  ChatHandlers &        // Message handlers (App-level routing)
  { persistedState };   // What gets saved
```

**Handlers exposed**:
- `handleChatResponse()` - Process AI response, build turn, update history
- `handleSaveResult()` - Handle save confirmation
- `handleError()` - Clear loading, show error

**Registered at App level**:
```typescript
useMessageRouter({
  [MessageType.CHAT_RESPONSE]: chat.handleChatResponse,
  [MessageType.CHAT_SAVE_RESULT]: chat.handleSaveResult,
  [MessageType.ERROR]: (msg) => {
    if (msg.source?.includes('chat')) {
      chat.handleError(msg);
    }
  },
});
```

### 3. Persistence

**What gets persisted**:
```typescript
interface ChatPersistence {
  prompt: string;              // Current prompt input
  model: string;               // Selected model
  conversationId: string | null;  // Active conversation
  conversationHistory: ChatTurn[];  // Full history
}
```

**How it's saved**:
```typescript
// In App.tsx
useEffect(() => {
  saveState({
    activeTab,
    settings: settings.persistedState,
    imageGeneration: imageGeneration.persistedState,
    chat: chat.persistedState,  // ← Persisted here
  });
}, [chat.persistedState]);
```

**How it's restored**:
```typescript
// In App.tsx
const persistedState = loadState();
const chat = useChat(persistedState.chat);  // ← Restored here
```

### 4. Loading States

**Proper placement**:
- LoadingIndicator rendered **at bottom** of scroll area
- Appears where new content will show (below existing messages)
- Prevents layout shift during loading

**Implementation**:
```typescript
<div className="chat-scroll-area">
  <ChatThread turns={conversationHistory} />

  {/* Loading indicator at bottom */}
  <LoadingIndicator
    isLoading={isLoading}
    defaultMessage="Thinking..."
  />
</div>
```

### 5. Chat UI Components

**Reusable components**:

- **ChatThread** - Generic conversation display (takes `ChatTurn[]`)
- **ChatBubble** - Individual message bubble (user/assistant variants)
- **ContinueChatInput** - Already exists, reused from image generation
- **LoadingIndicator** - Already exists, reused

**Composition pattern**:
```
ChatView (domain-specific)
  ├── ChatThread (generic, reusable)
  │   └── ChatBubble (generic, reusable)
  └── ContinueChatInput (generic, reusable)
```

---

## Implementation Steps

### Phase 1: Data Structures

1. **Create message types**
   - [ ] Create `/src/shared/types/messages/chat.ts`
   - [ ] Define `ChatMessage`, `ChatTurn`, request/response payloads
   - [ ] Add message types to `MessageType` enum in `base.ts`
   - [ ] Add message source `'webview.chat'` and `'extension.chat'` to `MessageSource`
   - [ ] Export from `/src/shared/types/messages/index.ts`

### Phase 2: Hook Implementation

2. **Create useChat hook**
   - [ ] Create `/src/presentation/webview/hooks/domain/useChat.ts`
   - [ ] Define tripartite interfaces (State, Actions, Handlers, Persistence)
   - [ ] Implement state management with `useState`
   - [ ] Implement message handlers (`handleChatResponse`, etc.)
   - [ ] Implement actions (`sendMessage`, `continueChat`, etc.)
   - [ ] Build persistence object
   - [ ] Export from `/src/presentation/webview/hooks/index.ts`

### Phase 3: Chat Components

3. **Create ChatBubble component**
   - [ ] Create `/src/presentation/webview/components/chat/ChatBubble.tsx`
   - [ ] Implement user/assistant variants
   - [ ] Add timestamp formatting
   - [ ] Create `/src/presentation/webview/styles/components/chat-bubble.css`

4. **Create ChatThread component**
   - [ ] Create `/src/presentation/webview/components/chat/ChatThread.tsx`
   - [ ] Map over `ChatTurn[]` and render bubbles
   - [ ] Create `/src/presentation/webview/styles/components/chat-thread.css`

5. **Export chat components**
   - [ ] Create `/src/presentation/webview/components/chat/index.ts` barrel file
   - [ ] Export `ChatBubble` and `ChatThread`
   - [ ] Add to main components barrel

### Phase 4: View Implementation

6. **Create ChatView**
   - [ ] Create `/src/presentation/webview/components/views/ChatView.tsx`
   - [ ] Compose all components (header, thread, input)
   - [ ] Add conversation header (title, date, clear)
   - [ ] Create `/src/presentation/webview/styles/components/chat-view.css`
   - [ ] Export from `/src/presentation/webview/components/views/index.ts`

### Phase 5: App Integration

7. **Update App.tsx**
   - [ ] Import `useChat` hook
   - [ ] Initialize hook with persisted state: `const chat = useChat(persistedState.chat)`
   - [ ] Register message handlers in `useMessageRouter`
   - [ ] Add `chat.persistedState` to persistence `useEffect`
   - [ ] Update Tab 2 to render `<ChatView chat={chat} />`

8. **Update TabId type**
   - [ ] Change Tab 2 from `'svg'` to `'chat'` in `/src/shared/types/messages/ui.ts`
   - [ ] Update `TABS` array in `App.tsx`

### Phase 6: Extension Handler

9. **Create ChatHandler**
   - [ ] Create `/src/application/handlers/domain/ChatHandler.ts`
   - [ ] Implement conversation state management (Map)
   - [ ] Implement `handleChatRequest` (call AI API)
   - [ ] Implement `handleClearConversation`
   - [ ] Implement `handleSaveRequest` (export as markdown/JSON)
   - [ ] Add logging throughout

10. **Register ChatHandler**
    - [ ] Import in `/src/application/handlers/MessageHandler.ts`
    - [ ] Instantiate in constructor
    - [ ] Register routes for `CHAT_REQUEST`, `CHAT_CLEAR`, `CHAT_SAVE_REQUEST`

### Phase 7: Testing & Polish

11. **Manual testing**
    - [ ] Test new conversation creation
    - [ ] Test conversation continuation
    - [ ] Test persistence (reload extension)
    - [ ] Test clear conversation
    - [ ] Test error handling
    - [ ] Test save conversation

12. **UI polish**
    - [ ] Verify loading states (no layout shift)
    - [ ] Verify chat bubbles render correctly
    - [ ] Verify conversation header formatting
    - [ ] Test with long messages (scrolling)
    - [ ] Test with many turns (performance)

### Phase 8: Documentation

13. **Update CLAUDE.md**
    - [ ] Add chat patterns to "Common Tasks" section
    - [ ] Update architecture diagram if needed
    - [ ] Document new message types

14. **Create migration guide**
    - [ ] Document how to copy chat example to template
    - [ ] List all files to copy
    - [ ] Note dependencies (model list, API key setup)

---

## Files to Create

### Shared Types
- `/src/shared/types/messages/chat.ts`

### Hooks
- `/src/presentation/webview/hooks/domain/useChat.ts`

### Components
- `/src/presentation/webview/components/chat/ChatBubble.tsx`
- `/src/presentation/webview/components/chat/ChatThread.tsx`
- `/src/presentation/webview/components/chat/index.ts`
- `/src/presentation/webview/components/views/ChatView.tsx`

### Styles
- `/src/presentation/webview/styles/components/chat-bubble.css`
- `/src/presentation/webview/styles/components/chat-thread.css`
- `/src/presentation/webview/styles/components/chat-view.css`

### Handlers
- `/src/application/handlers/domain/ChatHandler.ts`

### Tests
- `/src/__tests__/application/handlers/domain/ChatHandler.test.ts`
- `/src/__tests__/presentation/webview/hooks/domain/useChat.test.ts`

---

## Files to Modify

### Message Types
- `/src/shared/types/messages/base.ts` (add `MessageType` enums, `MessageSource`)
- `/src/shared/types/messages/index.ts` (export chat types)

### UI Types
- `/src/shared/types/messages/ui.ts` (change Tab 2 from 'svg' to 'chat')

### Hooks
- `/src/presentation/webview/hooks/index.ts` (export `useChat`)
- `/src/presentation/webview/hooks/domain/index.ts` (export `useChat`)

### Components
- `/src/presentation/webview/components/index.ts` (export `ChatView`, chat components)
- `/src/presentation/webview/components/views/index.ts` (export `ChatView`)

### App
- `/src/presentation/webview/App.tsx` (initialize hook, register handlers, render view)

### Handlers
- `/src/application/handlers/MessageHandler.ts` (register `ChatHandler` routes)

### Documentation
- `/docs/CLAUDE.md` (add chat patterns)

---

## Template Migration

When copying this pattern to the template repository:

### Required Files (Copy As-Is)
1. Chat message types (`chat.ts`)
2. Chat hook (`useChat.ts`)
3. Chat components (`ChatBubble.tsx`, `ChatThread.tsx`, `ChatView.tsx`)
4. Chat styles (all 3 CSS files)
5. Chat handler (`ChatHandler.ts`)

### Required Modifications
1. Update `MessageType` enum with chat types
2. Update `MessageSource` with `'webview.chat'` / `'extension.chat'`
3. Add chat hook to `App.tsx` initialization
4. Register chat message handlers in `useMessageRouter`
5. Add chat persistence to App's `useEffect`
6. Register `ChatHandler` routes in `MessageHandler.ts`

### Optional Customizations
1. Model list (update `CHAT_MODELS` in `ChatView.tsx`)
2. Default model (update in `useChat.ts`)
3. Placeholder text (update in `ChatView.tsx`)
4. Conversation title length (update in `getConversationTitle()`)

### Dependencies
- OpenRouter API key (already exists in settings)
- `LoggingService` (already exists)
- `SecretStorageService` (already exists)
- Reusable components: `ModelSelector`, `Textarea`, `Button`, `LoadingIndicator`, `ContinueChatInput`

---

## Comparison: Chat vs Image Generation

| Aspect | Image Generation | Generic Chat |
|--------|------------------|--------------|
| **Output Type** | Images (multiple per turn) | Text (one message per turn) |
| **Turn Structure** | `{ prompt, images[] }` | `{ userMessage, assistantMessage }` |
| **History Display** | ImageCard grid | Chat bubbles (left/right) |
| **Actions per Turn** | Save image, copy seed | None (just display) |
| **Complexity** | High (images, seeds, aspect ratios) | Low (just text) |
| **Reference Images** | Yes (multiple) | No |
| **Persistence** | Images + history | Just text history |
| **Save Action** | Per-image save | Whole conversation export |

**Why Chat is Simpler**:
- No image handling/display
- No per-item actions (save/copy)
- No complex form inputs (aspect ratio, seed)
- Simpler data structure (`ChatMessage` vs `GeneratedImage`)

**Why Chat is Better for Templates**:
- Easier to understand
- Fewer dependencies
- Faster to implement
- Generic pattern (works for many use cases)
- Clear demonstration of core patterns without domain complexity

---

## Summary

This design provides a **complete, reusable chat thread pattern** that demonstrates:

1. **Architecture**: Clean separation (hook → view → components)
2. **State Management**: Tripartite interface with persistence
3. **Message Flow**: Request → Handler → Response → Hook → View
4. **UI Patterns**: Reusable chat components, proper loading states
5. **User Experience**: Conversation history, continuation, clear/save actions

The pattern is **simpler than image generation** (no images/seeds/aspects) while demonstrating the **same architectural patterns**, making it ideal for template repositories and learning.

All components are **generic and reusable** - the `ChatBubble` and `ChatThread` components can be used for any text-based chat interface, not just AI chat.

The implementation is **ready to build** with clear steps and file structure.
