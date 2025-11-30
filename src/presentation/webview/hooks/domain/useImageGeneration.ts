/**
 * useImageGeneration - Image Generation domain hook
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
  GeneratedImage,
  ConversationTurn,
  ConversationHistoryTurn,
  ImageGenerationResponsePayload,
  ImageSaveResultPayload,
  EnhancePromptResponsePayload,
} from '@messages';
import { DEFAULT_IMAGE_MODEL } from '../../../../infrastructure/ai/providers/OpenRouterProvider';

// 1. State Interface (read-only)
export interface ImageGenerationState {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImages: string[];  // base64 data URLs
  referenceSvgText: string | null; // raw SVG text attachment
  referenceSvgWarning: string | null;
  seedInput: string;          // seed input field (empty = auto-generate)
  generatedImages: GeneratedImage[];
  conversationHistory: ConversationTurn[];  // Full conversation thread
  conversationId: string | null;
  isLoading: boolean;
  isEnhancing: boolean;
  error: string | null;
}

// 2. Actions Interface (write operations)
export interface ImageGenerationActions {
  setPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setSeedInput: (seed: string) => void;
  addReferenceImage: (dataUrl: string, svgText?: string | null) => void;
  removeReferenceImage: (index: number) => void;
  clearReferenceImages: () => void;
  generate: () => void;           // New generation (clears conversation)
  continueChat: (prompt: string) => void;  // Continue existing conversation
  clearConversation: () => void;
  saveImage: (image: GeneratedImage) => void;
  enhancePrompt: () => void;      // Enhance current prompt using AI
}

// 2b. Message Handlers Interface (for App-level routing)
export interface ImageGenerationHandlers {
  handleGenerationResponse: (message: MessageEnvelope) => void;
  handleSaveResult: (message: MessageEnvelope) => void;
  handleEnhanceResponse: (message: MessageEnvelope) => void;
  handleError: (message: MessageEnvelope) => void;
}

// 3. Persistence Interface (what gets saved)
// Note: referenceSvgText and referenceImages are NOT persisted - they're per-request context
// The conversation history stores referenceSvgText per turn for context
export interface ImageGenerationPersistence {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  conversationId: string | null;
  generatedImages: GeneratedImage[];
  conversationHistory: ConversationTurn[];
}

// Composed return type
export type UseImageGenerationReturn = ImageGenerationState & ImageGenerationActions & ImageGenerationHandlers & {
  persistedState: ImageGenerationPersistence;
};

export function useImageGeneration(
  initialState?: Partial<ImageGenerationPersistence>,
  sync?: {
    selectedModel?: string;
    onModelChange?: (model: string) => void;
  }
): UseImageGenerationReturn {
  const vscode = useVSCodeApi();

  // State
  const [prompt, setPrompt] = useState(initialState?.prompt ?? '');
  const [model, setModelState] = useState(initialState?.model ?? (sync?.selectedModel ?? DEFAULT_IMAGE_MODEL));
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    initialState?.aspectRatio ?? '1:1'
  );
  // Reference images are NOT persisted - they're per-request context
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceSvgText, setReferenceSvgText] = useState<string | null>(null);
  const [referenceSvgWarning, setReferenceSvgWarning] = useState<string | null>(null);
  const [referenceSvgIndex, setReferenceSvgIndex] = useState<number | null>(null);
  const [seedInput, setSeedInput] = useState('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>(
    initialState?.generatedImages ?? []
  );
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>(
    initialState?.conversationHistory ?? []
  );
  const [conversationId, setConversationId] = useState<string | null>(
    initialState?.conversationId ?? null
  );
  // Track the pending prompt for the current generation (to build history)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setModel = useCallback((newModel: string) => {
    setModelState(newModel);
    sync?.onModelChange?.(newModel);
  }, [sync]);
  // Reset defaults when settings change (only when idle)
  useEffect(() => {
    if (sync?.selectedModel && !isLoading) {
      setModelState(sync.selectedModel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync?.selectedModel]);

  // Message handlers (exposed for App-level routing)
  const handleGenerationResponse = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as ImageGenerationResponsePayload;
    setConversationId(payload.conversationId);
    setGeneratedImages(payload.images);

    // Add to conversation history
    setPendingPrompt((currentPendingPrompt) => {
      if (currentPendingPrompt) {
        const turn: ConversationTurn = {
          id: `turn-${payload.turnNumber}`,
          prompt: currentPendingPrompt,
          images: payload.images,
          turnNumber: payload.turnNumber,
          timestamp: Date.now(),
          usage: payload.usage,
          referenceSvgText: referenceSvgText ?? undefined,
        };
        setConversationHistory((prev) => [...prev, turn]);
      }
      return null; // Clear pending prompt
    });

    setIsLoading(false);
    setError(null);
  }, []);

  const handleSaveResult = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as ImageSaveResultPayload;
    if (!payload.success) {
      setError(payload.error ?? 'Failed to save image');
    }
  }, []);

  const handleEnhanceResponse = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as EnhancePromptResponsePayload;
    setPrompt(payload.enhancedPrompt);
    setIsEnhancing(false);
  }, []);

  const handleError = useCallback((message: MessageEnvelope) => {
    setIsLoading(false);
    setIsEnhancing(false);
    setError((message.payload as { message: string }).message);
  }, []);

  // Actions
  const addReferenceImage = useCallback((dataUrl: string, svgText?: string | null) => {
    if (svgText) {
      setReferenceImages((prev) => {
        const withoutOldSvg = referenceSvgIndex !== null ? prev.filter((_, i) => i !== referenceSvgIndex) : prev;
        const next = [...withoutOldSvg, dataUrl];
        setReferenceSvgIndex(next.length - 1);
        return next;
      });
      setReferenceSvgText(svgText);
      const sizeBytes = new Blob([svgText]).size;
      setReferenceSvgWarning(
        sizeBytes > 16 * 1024
          ? 'Reference SVG is large (>16KB). Responses may truncate.'
          : 'SVG will be sent as text context (not as image).'
      );
    } else {
      setReferenceImages((prev) => [...prev, dataUrl]);
    }
  }, [referenceSvgIndex]);

  const removeReferenceImage = useCallback((index: number) => {
    setReferenceImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (referenceSvgIndex !== null) {
        if (index === referenceSvgIndex) {
          setReferenceSvgIndex(null);
          setReferenceSvgText(null);
          setReferenceSvgWarning(null);
        } else if (index < referenceSvgIndex) {
          setReferenceSvgIndex(referenceSvgIndex - 1);
        }
      }
      return next;
    });
  }, [referenceSvgIndex]);

  const clearReferenceImages = useCallback(() => {
    setReferenceImages([]);
    setReferenceSvgText(null);
    setReferenceSvgWarning(null);
    setReferenceSvgIndex(null);
  }, []);

  const generate = useCallback(() => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);
    setConversationId(null);  // Clear conversation for new generation
    setGeneratedImages([]);    // Clear previous images
    setConversationHistory([]); // Clear history for new conversation
    setPendingPrompt(prompt);   // Track prompt for history

    // Parse seed input - if valid number use it, otherwise let handler auto-generate
    const parsedSeed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    const seed = parsedSeed !== undefined && !isNaN(parsedSeed) ? parsedSeed : undefined;
    const promptForApi = referenceSvgText
      ? `${prompt}\n\nReference SVG:\n${referenceSvgText}`
      : prompt;
    const imagesForApi = referenceImages.filter((_, i) => i !== referenceSvgIndex);

    vscode.postMessage(
      createEnvelope(
        MessageType.IMAGE_GENERATION_REQUEST,
        'webview.imageGeneration',
        {
          prompt: promptForApi,
          model,
          aspectRatio,
          referenceImages: imagesForApi.length > 0 && !referenceSvgText ? imagesForApi : (imagesForApi.length > 0 && referenceSvgText ? imagesForApi : undefined),
          referenceSvgText: referenceSvgText ?? undefined,
          seed,
        }
      )
    );
  }, [prompt, model, aspectRatio, referenceImages, referenceSvgText, referenceSvgIndex, seedInput, vscode]);

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
      setPendingPrompt(chatPrompt);  // Track prompt for history

      // Build history for self-contained request (enables re-hydration after extension restart)
      const history: ConversationHistoryTurn[] = conversationHistory.map(turn => ({
        prompt: turn.prompt,
        images: turn.images.map(img => ({
          data: img.data,
          seed: img.seed,
        })),
        referenceSvgText: turn.referenceSvgText,
      }));

      const promptForApi = referenceSvgText
        ? `${chatPrompt}\n\nReference SVG:\n${referenceSvgText}`
        : chatPrompt;
      const imagesForApi = referenceImages.filter((_, i) => i !== referenceSvgIndex);

      vscode.postMessage(
        createEnvelope(
          MessageType.IMAGE_GENERATION_CONTINUE,
          'webview.imageGeneration',
          {
            prompt: promptForApi,
            conversationId,
            history,
            model,
            aspectRatio,
            referenceImages: imagesForApi.length > 0 && !referenceSvgText ? imagesForApi : (imagesForApi.length > 0 && referenceSvgText ? imagesForApi : undefined),
            referenceSvgText: referenceSvgText ?? undefined,
          }
        )
      );
    },
    [conversationId, conversationHistory, model, aspectRatio, referenceImages, referenceSvgText, referenceSvgIndex, vscode]
  );

  const clearConversation = useCallback(() => {
    setConversationId(null);
    setGeneratedImages([]);
    setConversationHistory([]);
    setPrompt('');
    setError(null);
  }, []);

  const saveImage = useCallback(
    (image: GeneratedImage) => {
      const timestamp = new Date(image.timestamp).toISOString().replace(/[:.]/g, '-');
      const extension = image.mimeType === 'image/png' ? 'png' : 'jpg';
      const suggestedFilename = `pixel-minion-${timestamp}.${extension}`;

      vscode.postMessage(
        createEnvelope(
          MessageType.IMAGE_SAVE_REQUEST,
          'webview.imageGeneration',
          {
            imageId: image.id,
            data: image.data,
            mimeType: image.mimeType,
            suggestedFilename,
          }
        )
      );
    },
    [vscode]
  );

  const enhancePrompt = useCallback(() => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to enhance');
      return;
    }

    setIsEnhancing(true);
    setError(null);

    vscode.postMessage(
      createEnvelope(
        MessageType.ENHANCE_PROMPT_REQUEST,
        'webview.enhance',
        {
          prompt: prompt.trim(),
          type: 'image',
        }
      )
    );
  }, [prompt, vscode]);

  // Persistence object (reference images excluded - they're per-request context)
  const persistedState: ImageGenerationPersistence = {
    prompt,
    model,
    aspectRatio,
    conversationId,
    generatedImages,
    conversationHistory,
  };

  return {
    // State
    prompt,
    model,
    aspectRatio,
    referenceImages,
    referenceSvgText,
    referenceSvgWarning,
    seedInput,
    generatedImages,
    conversationHistory,
    conversationId,
    isLoading,
    isEnhancing,
    error,
    // Actions
    setPrompt,
    setModel,
    setAspectRatio,
    setSeedInput,
    addReferenceImage,
    removeReferenceImage,
    clearReferenceImages,
    generate,
    continueChat,
    clearConversation,
    saveImage,
    enhancePrompt,
    // Message Handlers (for App-level routing)
    handleGenerationResponse,
    handleSaveResult,
    handleEnhanceResponse,
    handleError,
    // Persistence
    persistedState,
  };
}
