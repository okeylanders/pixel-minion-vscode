/**
 * useImageGeneration - Image Generation domain hook
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 */
import { useState, useCallback, useEffect } from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { useMessageRouter } from '../useMessageRouter';
import {
  MessageType,
  createEnvelope,
  AspectRatio,
  GeneratedImage,
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
  generatedImages: GeneratedImage[];
  conversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

// 2. Actions Interface (write operations)
export interface ImageGenerationActions {
  setPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  addReferenceImage: (dataUrl: string) => void;
  removeReferenceImage: (index: number) => void;
  clearReferenceImages: () => void;
  generate: () => void;           // New generation (clears conversation)
  continueChat: (prompt: string) => void;  // Continue existing conversation
  clearConversation: () => void;
  saveImage: (image: GeneratedImage) => void;
}

// 3. Persistence Interface (what gets saved)
export interface ImageGenerationPersistence {
  model: string;
  aspectRatio: AspectRatio;
  conversationId: string | null;
  generatedImages: GeneratedImage[];
}

// Composed return type
export type UseImageGenerationReturn = ImageGenerationState & ImageGenerationActions & {
  persistedState: ImageGenerationPersistence;
};

export function useImageGeneration(
  initialState?: Partial<ImageGenerationPersistence>
): UseImageGenerationReturn {
  const vscode = useVSCodeApi();
  const { register } = useMessageRouter();

  // State
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(initialState?.model ?? DEFAULT_IMAGE_MODEL);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    initialState?.aspectRatio ?? '1:1'
  );
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>(
    initialState?.generatedImages ?? []
  );
  const [conversationId, setConversationId] = useState<string | null>(
    initialState?.conversationId ?? null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Register message handlers
  useEffect(() => {
    register(MessageType.IMAGE_GENERATION_RESPONSE, (message) => {
      const payload = message.payload as ImageGenerationResponsePayload;
      setConversationId(payload.conversationId);
      setGeneratedImages(payload.images);
      setIsLoading(false);
      setError(null);
    });

    register(MessageType.IMAGE_SAVE_RESULT, (message) => {
      const payload = message.payload as ImageSaveResultPayload;
      if (!payload.success) {
        setError(payload.error ?? 'Failed to save image');
      }
    });

    register(MessageType.ERROR, (message) => {
      setIsLoading(false);
      setError((message.payload as { message: string }).message);
    });
  }, [register]);

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

    vscode.postMessage(
      createEnvelope(
        MessageType.IMAGE_GENERATION_REQUEST,
        'webview.imageGeneration',
        {
          prompt,
          model,
          aspectRatio,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        }
      )
    );
  }, [prompt, model, aspectRatio, referenceImages, vscode]);

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

      vscode.postMessage(
        createEnvelope(
          MessageType.IMAGE_GENERATION_CONTINUE,
          'webview.imageGeneration',
          {
            prompt: chatPrompt,
            conversationId,
          }
        )
      );
    },
    [conversationId, vscode]
  );

  const clearConversation = useCallback(() => {
    setConversationId(null);
    setGeneratedImages([]);
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
    model,
    aspectRatio,
    conversationId,
    generatedImages,
  };

  return {
    // State
    prompt,
    model,
    aspectRatio,
    referenceImages,
    generatedImages,
    conversationId,
    isLoading,
    error,
    // Actions
    setPrompt,
    setModel,
    setAspectRatio,
    addReferenceImage,
    removeReferenceImage,
    clearReferenceImages,
    generate,
    continueChat,
    clearConversation,
    saveImage,
    // Persistence
    persistedState,
  };
}
