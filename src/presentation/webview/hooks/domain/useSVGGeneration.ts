/**
 * useSVGGeneration - SVG Generation domain hook
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 * Message handlers are exposed for App-level registration (prose-minion pattern).
 */
import { useState, useCallback, useEffect } from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  AspectRatio,
  SVGGenerationResponsePayload,
  SVGSaveResultPayload,
  SVGConversationHistoryTurn,
} from '@messages';
import { DEFAULT_SVG_MODEL } from '../../../../infrastructure/ai/providers/OpenRouterProvider';

// 1. State Interface (read-only)
export interface SVGGenerationState {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImage: string | null;  // Single image preview (data URL)
  referenceSvgText: string | null; // Raw SVG text if attachment is SVG
  svgCode: string | null;
  conversationHistory: SVGConversationHistoryTurn[];
  conversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

// 2. Actions Interface (write operations)
export interface SVGGenerationActions {
  setPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setReferenceAttachment: (attachment: { preview: string | null; svgText: string | null }) => void;
  generate: () => void;
  continueChat: (prompt: string) => void;
  clearConversation: () => void;
  saveSVG: () => void;
  copySVG: () => void;
}

// 2b. Message Handlers Interface (for App-level routing)
export interface SVGGenerationHandlers {
  handleGenerationResponse: (message: MessageEnvelope) => void;
  handleSaveResult: (message: MessageEnvelope) => void;
  handleError: (message: MessageEnvelope) => void;
}

// 3. Persistence Interface (what gets saved)
export interface SVGGenerationPersistence {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  conversationId: string | null;
  svgCode: string | null;
  conversationHistory: SVGConversationHistoryTurn[];
  referenceSvgText: string | null;
  referenceImage: string | null;
}

// Composed return type
export type UseSVGGenerationReturn = SVGGenerationState & SVGGenerationActions & SVGGenerationHandlers & {
  persistedState: SVGGenerationPersistence;
};

export function useSVGGeneration(
  initialState?: Partial<SVGGenerationPersistence>,
  sync?: {
    selectedModel?: string;
    onModelChange?: (model: string) => void;
  }
): UseSVGGenerationReturn {
  const vscode = useVSCodeApi();

  // State
  const [prompt, setPrompt] = useState(initialState?.prompt ?? '');
  const [model, setModelState] = useState(initialState?.model ?? (sync?.selectedModel ?? DEFAULT_SVG_MODEL));
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    initialState?.aspectRatio ?? '1:1'
  );
  const [referenceImage, setReferenceImage] = useState<string | null>(initialState?.referenceImage ?? null);
  const [referenceSvgText, setReferenceSvgText] = useState<string | null>(initialState?.referenceSvgText ?? null);
  const [svgCode, setSvgCode] = useState<string | null>(
    initialState?.svgCode ?? null
  );
  const [conversationHistory, setConversationHistory] = useState<SVGConversationHistoryTurn[]>(
    initialState?.conversationHistory ?? []
  );
  const [conversationId, setConversationId] = useState<string | null>(
    initialState?.conversationId ?? null
  );
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setModel = useCallback((newModel: string) => {
    setModelState(newModel);
    sync?.onModelChange?.(newModel);
  }, [sync]);

  useEffect(() => {
    if (sync?.selectedModel && !isLoading) {
    setModelState(sync.selectedModel);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sync?.selectedModel]);

  const setReferenceAttachment = useCallback((attachment: { preview: string | null; svgText: string | null }) => {
    setReferenceImage(attachment.preview);
    setReferenceSvgText(attachment.svgText);
  }, []);

  // Message handlers (exposed for App-level routing)
  const handleGenerationResponse = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as SVGGenerationResponsePayload;
    setConversationId(payload.conversationId);
    setSvgCode(payload.svgCode);
    setPendingPrompt((currentPrompt) => {
      if (currentPrompt) {
        const turn: SVGConversationHistoryTurn = {
          prompt: currentPrompt,
          svgCode: payload.svgCode,
          turnNumber: payload.turnNumber,
          referenceSvgText: referenceSvgText ?? undefined,
          usage: payload.usage,
        };
        setConversationHistory((prev) => [...prev, turn]);
      }
      return null;
    });
    setIsLoading(false);
    setError(null);
  }, []);

  const handleSaveResult = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as SVGSaveResultPayload;
    if (!payload.success) {
      setError(payload.error ?? 'Failed to save SVG');
    }
  }, []);

  const handleError = useCallback((message: MessageEnvelope) => {
    setIsLoading(false);
    setError((message.payload as { message: string }).message);
  }, []);

  // Actions
  const generate = useCallback(() => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);
    setConversationId(null);  // Clear conversation for new generation
    setSvgCode(null);          // Clear previous SVG
    setConversationHistory([]); // Clear history
    setPendingPrompt(prompt);

    vscode.postMessage(
      createEnvelope(
        MessageType.SVG_GENERATION_REQUEST,
        'webview.svgGeneration',
        {
          prompt,
          model,
          aspectRatio,
          referenceImage: referenceSvgText ? undefined : (referenceImage ?? undefined),
          referenceSvgText: referenceSvgText ?? undefined,
        }
      )
    );
  }, [prompt, model, aspectRatio, referenceImage, referenceSvgText, vscode]);

  const continueChat = useCallback(
    (chatPrompt: string) => {
      if (!chatPrompt.trim()) {
        setError('Please enter a prompt');
        return;
      }

      if (!conversationId) {
        setError('No active conversation to continue');
        return;
      }

      setIsLoading(true);
      setError(null);
      setPendingPrompt(chatPrompt);

      const history: SVGConversationHistoryTurn[] = conversationHistory.map((turn) => ({
        prompt: turn.prompt,
        svgCode: turn.svgCode,
        turnNumber: turn.turnNumber,
        referenceSvgText: turn.referenceSvgText,
      }));

      vscode.postMessage(
        createEnvelope(
          MessageType.SVG_GENERATION_CONTINUE,
          'webview.svgGeneration',
          {
            prompt: chatPrompt,
            conversationId,
            history,
            model,
            aspectRatio,
            referenceSvgText: referenceSvgText ?? undefined,
          }
        )
      );
    },
    [conversationHistory, conversationId, model, aspectRatio, referenceSvgText, vscode]
  );

  const clearConversation = useCallback(() => {
    setConversationId(null);
    setSvgCode(null);
    setPrompt('');
    setError(null);
  }, []);

  const saveSVG = useCallback(() => {
    if (!svgCode) {
      setError('No SVG code to save');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suggestedFilename = `pixel-minion-${timestamp}.svg`;

    vscode.postMessage(
      createEnvelope(
        MessageType.SVG_SAVE_REQUEST,
        'webview.svgGeneration',
        {
          svgCode,
          suggestedFilename,
        }
      )
    );
  }, [svgCode, vscode]);

  const copySVG = useCallback(() => {
    if (!svgCode) {
      setError('No SVG code to copy');
      return;
    }

    navigator.clipboard.writeText(svgCode).catch((err) => {
      setError(`Failed to copy SVG: ${err.message}`);
    });
  }, [svgCode]);

  // Persistence object
  const persistedState: SVGGenerationPersistence = {
    prompt,
    model,
    aspectRatio,
    conversationId,
    svgCode,
    conversationHistory,
    referenceSvgText,
    referenceImage,
  };

  return {
    // State
    prompt,
    model,
    aspectRatio,
    referenceImage,
    referenceSvgText,
    svgCode,
    conversationHistory,
    conversationId,
    isLoading,
    error,
    // Actions
    setPrompt,
    setModel,
    setAspectRatio,
    setReferenceAttachment,
    generate,
    continueChat,
    clearConversation,
    saveSVG,
    copySVG,
    // Message Handlers (for App-level routing)
    handleGenerationResponse,
    handleSaveResult,
    handleError,
    // Persistence
    persistedState,
  };
}
