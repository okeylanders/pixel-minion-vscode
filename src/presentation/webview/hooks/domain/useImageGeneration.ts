/**
 * useImageGeneration - Image Generation domain hook
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 * Message handlers are exposed for App-level registration (prose-minion pattern).
 */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  AspectRatio,
  GeneratedImage,
  ConversationTurn,
  ConversationHistoryTurn,
  ImageThreadSettings,
  ImageGenerationRequestPayload,
  ImageGenerationContinuePayload,
  ImageGenerationResponsePayload,
  ImageSaveRequestPayload,
  ImageSaveResultPayload,
  EnhancePromptRequestPayload,
  EnhancePromptResponsePayload,
} from '@messages';
import { DEFAULT_IMAGE_MODEL } from '@shared/models';
import { imageExtensionForMime } from '../../../../shared/media/imageFormats';
import { newRequestId } from '../../utils/requestId';

// Sourceful models have a 4.5MB request size limit for reference images
const SOURCEFUL_SIZE_LIMIT_BYTES = 4.5 * 1024 * 1024; // 4.5MB

/** Check if a model ID belongs to Sourceful provider */
export function isSourcefulModel(modelId: string): boolean {
  return modelId.startsWith('sourceful/');
}

/** Calculate approximate byte size of base64 data URLs */
export function calculateBase64Size(dataUrls: string[]): number {
  return dataUrls.reduce((total, dataUrl) => {
    // Extract base64 portion after the comma
    const base64 = dataUrl.split(',')[1] || '';
    // Base64 decodes to approximately 75% of the encoded string length
    return total + Math.ceil(base64.length * 0.75);
  }, 0);
}

/** Correlation-id prefix of clear requests; their errors are always ours. */
const CLEAR_REQUEST_PREFIX = 'image-clear';

/**
 * What the hook dispatched for the outstanding generate or refine. The
 * response is matched against `correlationId` and builds its turn from this
 * snapshot, never from state that may have changed while the request ran.
 */
interface PendingGeneration {
  correlationId: string;
  prompt: string;
  settings: ImageThreadSettings;
  referenceSvgText?: string;
}

/**
 * The outstanding prompt enhancement. Its answer replaces the prompt only
 * while the box still holds the text that was sent: Generate and Clear drop
 * it, and an edit made while it ran wins over it.
 */
interface PendingEnhance {
  correlationId: string;
  prompt: string;
}

// 1. State Interface (read-only)
export interface ImageGenerationState {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImages: string[];  // base64 data URLs
  referenceSvgText: string | null; // raw SVG text attachment
  referenceSvgWarning: string | null;
  referenceImageSizeWarning: string | null; // Warning for Sourceful 4.5MB limit
  seedInput: string;          // seed input field (empty = auto-generate)
  generatedImages: GeneratedImage[];
  conversationHistory: ConversationTurn[];  // Full conversation thread
  conversationId: string | null;
  /** Settings the current conversation was created with (null: no conversation). */
  threadSettings: ImageThreadSettings | null;
  /** Images with a save request outstanding. */
  savingImageIds: ReadonlySet<string>;
  /** Images whose save the host confirmed. Cancelled or failed saves never appear here. */
  savedImageIds: ReadonlySet<string>;
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
  /** Show an error that belongs to no request of this tab, without settling any. */
  showError: (message: string) => void;
}

// 2b. Message Handlers Interface (for App-level routing)
export interface ImageGenerationHandlers {
  handleGenerationResponse: (message: MessageEnvelope) => void;
  handleSaveResult: (message: MessageEnvelope) => void;
  handleEnhanceResponse: (message: MessageEnvelope) => void;
  /**
   * Settles the request the error belongs to. Returns false, changing
   * nothing, when the error answers no request this hook is waiting on.
   */
  handleError: (message: MessageEnvelope) => boolean;
}

// 3. Persistence Interface (what gets saved)
// Note: referenceSvgText and referenceImages are NOT persisted - they're per-request context
// The conversation history stores referenceSvgText per turn for context
export interface ImageGenerationPersistence {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  conversationId: string | null;
  /** Absent in state saved before thread settings existed. */
  threadSettings?: ImageThreadSettings | null;
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
  const [referenceImageSizeWarning, setReferenceImageSizeWarning] = useState<string | null>(null);
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
  // State saved before thread settings existed: the old code continued with
  // the persisted controls, so they are the best record of the thread.
  const [threadSettings, setThreadSettings] = useState<ImageThreadSettings | null>(
    initialState?.threadSettings ?? (initialState?.conversationId
      ? { model: initialState.model ?? model, aspectRatio: initialState.aspectRatio ?? '1:1' }
      : null)
  );
  const [savingImageIds, setSavingImageIds] = useState<ReadonlySet<string>>(() => new Set());
  const [savedImageIds, setSavedImageIds] = useState<ReadonlySet<string>>(() => new Set());
  // Outstanding requests, matched by correlation id. Refs, not state: the
  // App-level message handlers must see the latest value synchronously.
  const pending = useRef<PendingGeneration | null>(null);
  // The outstanding enhance and the prompt text it was asked to improve.
  const pendingEnhance = useRef<PendingEnhance | null>(null);
  /** Outstanding saves: correlation id → image id. */
  const pendingSaves = useRef(new Map<string, string>());
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setModel = useCallback((newModel: string) => {
    setModelState(newModel);
    sync?.onModelChange?.(newModel);
  }, [sync]);
  // Reset defaults when settings change (only when idle)
  const selectedModel = sync?.selectedModel;
  useEffect(() => {
    if (selectedModel && !pending.current) {
      setModelState(selectedModel);
    }
  }, [selectedModel]);

  // Check reference image size for Sourceful models (4.5MB limit)
  useEffect(() => {
    if (!isSourcefulModel(model) || referenceImages.length === 0) {
      setReferenceImageSizeWarning(null);
      return;
    }

    const totalBytes = calculateBase64Size(referenceImages);
    if (totalBytes > SOURCEFUL_SIZE_LIMIT_BYTES) {
      const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1);
      setReferenceImageSizeWarning(
        `Reference images total ${sizeMB}MB, exceeding Sourceful's 4.5MB limit. Generation may fail.`
      );
    } else {
      setReferenceImageSizeWarning(null);
    }
  }, [model, referenceImages]);

  // Message handlers (exposed for App-level routing)
  const handleGenerationResponse = useCallback((message: MessageEnvelope) => {
    const dispatch = pending.current;
    // Late or stale: not the request we are waiting on.
    if (!dispatch || message.correlationId !== dispatch.correlationId) return;
    pending.current = null;

    const payload = message.payload as ImageGenerationResponsePayload;
    setConversationId(payload.conversationId);
    setThreadSettings(dispatch.settings);
    setGeneratedImages(payload.images);
    setConversationHistory((prev) => [...prev, {
      id: `turn-${payload.turnNumber}`,
      prompt: dispatch.prompt,
      images: payload.images,
      turnNumber: payload.turnNumber,
      timestamp: Date.now(),
      usage: payload.usage,
      referenceSvgText: dispatch.referenceSvgText,
    }]);
    setIsLoading(false);
    setError(null);
  }, []);

  const handleSaveResult = useCallback((message: MessageEnvelope) => {
    const imageId = message.correlationId ? pendingSaves.current.get(message.correlationId) : undefined;
    if (!message.correlationId || imageId === undefined) return; // Not a save we are waiting on.
    pendingSaves.current.delete(message.correlationId);
    setSavingImageIds(new Set(pendingSaves.current.values()));

    // Only the host's confirmation of a written file shows "Saved".
    const payload = message.payload as ImageSaveResultPayload;
    if (payload.success) {
      setSavedImageIds((prev) => new Set(prev).add(imageId));
    } else if (!payload.cancelled) {
      setError(payload.error ?? 'Failed to save image');
    }
  }, []);

  const handleEnhanceResponse = useCallback((message: MessageEnvelope) => {
    const enhance = pendingEnhance.current;
    if (!enhance || message.correlationId !== enhance.correlationId) return;
    pendingEnhance.current = null;
    const payload = message.payload as EnhancePromptResponsePayload;
    // Typed over while it ran: the user's edit wins.
    setPrompt((current) => (current.trim() === enhance.prompt ? payload.enhancedPrompt : current));
    setIsEnhancing(false);
  }, []);

  /** Forget the outstanding enhance; its answer, if it still comes, is ignored. */
  const dropPendingEnhance = useCallback(() => {
    if (!pendingEnhance.current) return;
    pendingEnhance.current = null;
    setIsEnhancing(false);
  }, []);

  const handleError = useCallback((message: MessageEnvelope): boolean => {
    const text = (message.payload as { message?: string } | undefined)?.message ?? 'Something went wrong';
    if (pending.current && message.correlationId === pending.current.correlationId) {
      pending.current = null;
      setIsLoading(false);
    } else if (pendingEnhance.current && message.correlationId === pendingEnhance.current.correlationId) {
      pendingEnhance.current = null;
      setIsEnhancing(false);
    } else if (message.correlationId && pendingSaves.current.has(message.correlationId)) {
      // The host couldn't handle the save at all (the router's fallback), so
      // no IMAGE_SAVE_RESULT will follow: settle only that save.
      pendingSaves.current.delete(message.correlationId);
      setSavingImageIds(new Set(pendingSaves.current.values()));
    } else if (!message.correlationId?.startsWith(`${CLEAR_REQUEST_PREFIX}-`)) {
      return false;
    }
    setError(text);
    return true;
  }, []);

  const showError = useCallback((text: string) => setError(text), []);

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
    if (pending.current) return;
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    // Parse seed input - if valid number use it, otherwise let handler auto-generate
    const parsedSeed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    const seed = parsedSeed !== undefined && !isNaN(parsedSeed) ? parsedSeed : undefined;
    // The SVG attachment's preview is not sent as an image: its markup goes
    // as `referenceSvgText`, which the host appends to the prompt once.
    const imagesForApi = referenceImages.filter((_, i) => i !== referenceSvgIndex);
    const settings: ImageThreadSettings = { model, aspectRatio };

    const message = createEnvelope<ImageGenerationRequestPayload>(
      MessageType.IMAGE_GENERATION_REQUEST,
      'webview.imageGeneration',
      {
        prompt,
        ...settings,
        referenceImages: imagesForApi.length > 0 ? imagesForApi : undefined,
        referenceSvgText: referenceSvgText ?? undefined,
        seed,
      },
      newRequestId('image-generate')
    );
    pending.current = {
      correlationId: message.correlationId!,
      prompt,
      settings,
      referenceSvgText: referenceSvgText ?? undefined,
    };

    // Generate takes the prompt on screen. An enhance still running is
    // dropped, so its answer can't rewrite the box under this request.
    dropPendingEnhance();
    setIsLoading(true);
    setError(null);
    setConversationId(null);  // Clear conversation for new generation
    setThreadSettings(null);
    setGeneratedImages([]);    // Clear previous images
    setConversationHistory([]); // Clear history for new conversation
    vscode.postMessage(message);
  }, [prompt, model, aspectRatio, referenceImages, referenceSvgText, referenceSvgIndex, seedInput, vscode, dropPendingEnhance]);

  const continueChat = useCallback(
    (chatPrompt: string) => {
      if (pending.current) return;
      if (!chatPrompt.trim()) {
        setError('Please enter a prompt');
        return;
      }

      if (!conversationId || !threadSettings) {
        setError('No active conversation to continue');
        return;
      }

      // Build history for self-contained request (enables re-hydration after extension restart)
      const history: ConversationHistoryTurn[] = conversationHistory.map(turn => ({
        prompt: turn.prompt,
        images: turn.images.map(img => ({
          data: img.data,
          seed: img.seed,
        })),
        referenceSvgText: turn.referenceSvgText,
      }));

      // The thread's settings, not the draft controls, own a continuation, and
      // draft attachments are not part of the thread: they apply to the next
      // Generate only.
      const message = createEnvelope<ImageGenerationContinuePayload>(
        MessageType.IMAGE_GENERATION_CONTINUE,
        'webview.imageGeneration',
        {
          prompt: chatPrompt,
          conversationId,
          history,
          ...threadSettings,
        },
        newRequestId('image-continue')
      );
      pending.current = { correlationId: message.correlationId!, prompt: chatPrompt, settings: threadSettings };

      setIsLoading(true);
      setError(null);
      vscode.postMessage(message);
    },
    [conversationId, threadSettings, conversationHistory, vscode]
  );

  const clearConversation = useCallback(() => {
    if (pending.current) return;
    if (conversationId) {
      // Release the host's copy too. Its only possible answer is an error
      // (e.g. still generating), recognised by the prefix.
      vscode.postMessage(createEnvelope(
        MessageType.IMAGE_GENERATION_CLEAR,
        'webview.imageGeneration',
        { conversationId },
        newRequestId(CLEAR_REQUEST_PREFIX)
      ));
    }
    setConversationId(null);
    setThreadSettings(null);
    setGeneratedImages([]);
    setConversationHistory([]);
    setPrompt('');
    // Clear starts over: an enhance still running must not refill the box.
    dropPendingEnhance();
    setError(null);
  }, [conversationId, dropPendingEnhance, vscode]);

  const saveImage = useCallback(
    (image: GeneratedImage) => {
      const extension = imageExtensionForMime(image.mimeType);
      if (!extension) {
        setError(`Can't save this image: its format (${image.mimeType || 'unknown'}) isn't PNG, JPEG, WebP or GIF.`);
        return;
      }
      const timestamp = new Date(image.timestamp).toISOString().replace(/[:.]/g, '-');
      const suggestedFilename = `pixel-minion-${timestamp}.${extension}`;

      const message = createEnvelope<ImageSaveRequestPayload>(
        MessageType.IMAGE_SAVE_REQUEST,
        'webview.imageGeneration',
        {
          imageId: image.id,
          data: image.data,
          mimeType: image.mimeType,
          suggestedFilename,
        },
        newRequestId('image-save')
      );
      pendingSaves.current.set(message.correlationId!, image.id);
      setSavingImageIds(new Set(pendingSaves.current.values()));
      vscode.postMessage(message);
    },
    [vscode]
  );

  const enhancePrompt = useCallback(() => {
    if (pending.current || pendingEnhance.current) return;
    if (!prompt.trim()) {
      setError('Please enter a prompt to enhance');
      return;
    }

    const message = createEnvelope<EnhancePromptRequestPayload>(
      MessageType.ENHANCE_PROMPT_REQUEST,
      'webview.enhance',
      {
        prompt: prompt.trim(),
        type: 'image',
      },
      newRequestId('image-enhance')
    );
    pendingEnhance.current = { correlationId: message.correlationId!, prompt: prompt.trim() };
    setIsEnhancing(true);
    setError(null);
    vscode.postMessage(message);
  }, [prompt, vscode]);

  // Persistence object (reference images excluded - they're per-request
  // context). Memoized: App writes webview state whenever this identity
  // changes, and it carries every generated image as base64.
  const persistedState = useMemo<ImageGenerationPersistence>(() => ({
    prompt,
    model,
    aspectRatio,
    conversationId,
    threadSettings,
    generatedImages,
    conversationHistory,
  }), [prompt, model, aspectRatio, conversationId, threadSettings, generatedImages, conversationHistory]);

  return {
    // State
    prompt,
    model,
    aspectRatio,
    referenceImages,
    referenceSvgText,
    referenceSvgWarning,
    referenceImageSizeWarning,
    seedInput,
    generatedImages,
    conversationHistory,
    conversationId,
    threadSettings,
    savingImageIds,
    savedImageIds,
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
    showError,
    // Message Handlers (for App-level routing)
    handleGenerationResponse,
    handleSaveResult,
    handleEnhanceResponse,
    handleError,
    // Persistence
    persistedState,
  };
}
