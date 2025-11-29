/**
 * useImageGeneration - Image Generation domain hook
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 * Message handlers are exposed for App-level registration (prose-minion pattern).
 */
import { useState, useCallback } from 'react';
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
} from '@messages';
import { DEFAULT_IMAGE_MODEL } from '../../../../infrastructure/ai/providers/OpenRouterProvider';

// 1. State Interface (read-only)
export interface ImageGenerationState {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImages: string[];  // base64 data URLs
  seedInput: string;          // seed input field (empty = auto-generate)
  generatedImages: GeneratedImage[];
  conversationHistory: ConversationTurn[];  // Full conversation thread
  conversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

// 2. Actions Interface (write operations)
export interface ImageGenerationActions {
  setPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setSeedInput: (seed: string) => void;
  addReferenceImage: (dataUrl: string) => void;
  removeReferenceImage: (index: number) => void;
  clearReferenceImages: () => void;
  generate: () => void;           // New generation (clears conversation)
  continueChat: (prompt: string) => void;  // Continue existing conversation
  clearConversation: () => void;
  saveImage: (image: GeneratedImage) => void;
}

// 2b. Message Handlers Interface (for App-level routing)
export interface ImageGenerationHandlers {
  handleGenerationResponse: (message: MessageEnvelope) => void;
  handleSaveResult: (message: MessageEnvelope) => void;
  handleError: (message: MessageEnvelope) => void;
}

// 3. Persistence Interface (what gets saved)
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
  initialState?: Partial<ImageGenerationPersistence>
): UseImageGenerationReturn {
  const vscode = useVSCodeApi();

  // State
  const [prompt, setPrompt] = useState(initialState?.prompt ?? '');
  const [model, setModel] = useState(initialState?.model ?? DEFAULT_IMAGE_MODEL);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    initialState?.aspectRatio ?? '1:1'
  );
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
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
  const [error, setError] = useState<string | null>(null);

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

  const handleError = useCallback((message: MessageEnvelope) => {
    setIsLoading(false);
    setError((message.payload as { message: string }).message);
  }, []);

  // Actions
  const addReferenceImage = useCallback((dataUrl: string) => {
    setReferenceImages((prev) => [...prev, dataUrl]);
  }, []);

  const removeReferenceImage = useCallback((index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearReferenceImages = useCallback(() => {
    setReferenceImages([]);
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

    vscode.postMessage(
      createEnvelope(
        MessageType.IMAGE_GENERATION_REQUEST,
        'webview.imageGeneration',
        {
          prompt,
          model,
          aspectRatio,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          seed,
        }
      )
    );
  }, [prompt, model, aspectRatio, referenceImages, seedInput, vscode]);

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
      }));

      vscode.postMessage(
        createEnvelope(
          MessageType.IMAGE_GENERATION_CONTINUE,
          'webview.imageGeneration',
          {
            prompt: chatPrompt,
            conversationId,
            history,
            model,
            aspectRatio,
          }
        )
      );
    },
    [conversationId, conversationHistory, model, aspectRatio, vscode]
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

  // Persistence object
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
    seedInput,
    generatedImages,
    conversationHistory,
    conversationId,
    isLoading,
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
    // Message Handlers (for App-level routing)
    handleGenerationResponse,
    handleSaveResult,
    handleError,
    // Persistence
    persistedState,
  };
}
