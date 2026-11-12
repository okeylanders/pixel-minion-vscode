/**
 * useImageGeneration - Image Generation domain hook
 *
 * Pattern: Tripartite Interface (State, Actions, Persistence)
 * Message handlers are exposed for App-level registration (prose-minion pattern).
 *
 * Modes, thread-owned settings, capability normalization and the bounded
 * snapshot follow frame-minion@40e7949
 * packages/core/src/presentation/webview/hooks/domain/useImageGeneration.ts.
 * Pixel keeps its own request ownership (P2: correlation ids per request
 * kind, save tracking, enhance answers dropped by Generate and Clear). Until
 * the mode toggle lands (roadmap P4), each new thread's mode is chosen by
 * Frame's default rule: Conversation when the model has a verified route,
 * otherwise Single Shot.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  AspectRatio,
  ImageResolution,
  ImageGenerationMode,
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
import {
  DEFAULT_IMAGE_MODEL,
  OPENROUTER_IMAGE_MODELS,
  defaultImageMode,
  imageModeLabel,
  imageRouteCapabilities,
} from '@shared/models';
import { imageExtensionForMime } from '../../../../shared/media/imageFormats';
import { newRequestId } from '../../utils/requestId';
import {
  boundedImageHistory,
  mergeImageHistoryDraft,
  MAX_IMAGE_HISTORY_STORAGE_BYTES,
  IMAGE_HISTORY_DRAFT_RESERVE_BYTES,
  IMAGE_HISTORY_RESTORED_WARNING,
} from './imageHistoryPersistence';

// Sourceful models have a 4.5MB request size limit for reference images
const SOURCEFUL_SIZE_LIMIT_BYTES = 4.5 * 1024 * 1024; // 4.5MB

/** Check if a model ID belongs to Sourceful provider */
export function isSourcefulModel(modelId: string): boolean {
  return modelId.startsWith('sourceful/');
}

/** The ratio to keep when the model (or mode) changes: the current one if the route lists it. */
export function normalizeAspectRatioForModel(modelId: string, current: AspectRatio, mode?: ImageGenerationMode): AspectRatio {
  const supported = mode ? imageRouteCapabilities(modelId, mode)?.supportedAspectRatios : OPENROUTER_IMAGE_MODELS.find(entry => entry.id === modelId)?.supportedAspectRatios;
  return !supported || supported.includes(current) ? current : supported[0];
}

/** The resolution to keep when the model (or mode) changes; anything unlisted falls back to Auto. */
export function normalizeResolutionForModel(modelId: string, current: ImageResolution, mode?: ImageGenerationMode): ImageResolution {
  const supported = mode ? imageRouteCapabilities(modelId, mode)?.supportedResolutions : OPENROUTER_IMAGE_MODELS.find(entry => entry.id === modelId)?.supportedResolutions;
  if (!supported) return 'auto';
  return current === 'auto' || supported.includes(current) ? current : 'auto';
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

function referenceCountText(limits: { min: number; max: number }): string {
  return limits.min === limits.max ? `${limits.min}` : `${limits.min}–${limits.max}`;
}

/**
 * Why the attached references can't go to this model in this mode, or null.
 * The host refuses the same mismatches before calling the provider; this
 * lets the tab say so before the user presses Generate.
 */
export function referenceImageIssue(
  modelId: string,
  mode: ImageGenerationMode,
  referenceImages: readonly string[]
): string | null {
  const capabilities = imageRouteCapabilities(modelId, mode);
  const limits = capabilities?.referenceImages;
  if (limits) {
    const count = referenceImages.length;
    if (limits.max === 0 && count > 0) {
      return 'This model accepts text prompts only. Remove the reference images to generate.';
    }
    if (count < limits.min) {
      return `This model needs at least ${limits.min} reference ${limits.min === 1 ? 'image' : 'images'}. Add one to generate.`;
    }
    if (count > limits.max) {
      return `This model accepts ${referenceCountText(limits)} reference images; ${count} attached. Remove ${count - limits.max} to generate.`;
    }
  }
  const mimeTypes = capabilities?.referenceMimeTypes;
  if (mimeTypes) {
    const unsupported = referenceImages.some((dataUrl) => {
      const mime = /^data:(image\/[^;,]+)[;,]/i.exec(dataUrl)?.[1]?.toLowerCase();
      const normalized = mime === 'image/jpg' ? 'image/jpeg' : mime;
      return !normalized || !mimeTypes.includes(normalized as typeof mimeTypes[number]);
    });
    if (unsupported) return 'This model requires PNG, JPEG, or WebP reference images.';
  }
  return null;
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
  /** A failed new thread clears its optimistic settings; a failed follow-up keeps them. */
  isNewThread: boolean;
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

/**
 * The saved thread's settings. State saved before modes existed has no `mode`
 * (or no thread settings at all): it opens as Single Shot, because there is
 * no host transcript to continue a conversation from. Its ratio is moved onto
 * one the model's Single Shot route lists (the old picker offered seven fixed
 * ratios to every model; providers clamped the ones they didn't support).
 */
function restoredThreadSettings(
  initialState: Partial<ImageGenerationPersistence> | undefined,
  fallbackModel: string
): ImageThreadSettings | null {
  const saved = initialState?.threadSettings as Partial<ImageThreadSettings> | null | undefined;
  if (saved?.mode && saved.model && saved.aspectRatio) {
    return { mode: saved.mode, model: saved.model, aspectRatio: saved.aspectRatio, resolution: saved.resolution ?? 'auto' };
  }
  if (!initialState?.conversationId) return null;
  const model = saved?.model ?? initialState.model ?? fallbackModel;
  return {
    mode: 'edit',
    model,
    aspectRatio: normalizeAspectRatioForModel(model, saved?.aspectRatio ?? initialState.aspectRatio ?? '1:1', 'edit'),
    resolution: 'auto',
  };
}

// 1. State Interface (read-only)
export interface ImageGenerationState {
  /**
   * The mode a new thread starts in for the selected model. Until the mode
   * toggle (roadmap P4) it is chosen for the model, never by the user.
   */
  mode: ImageGenerationMode;
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  referenceImages: string[];  // base64 data URLs
  referenceSvgText: string | null; // raw SVG text attachment
  referenceSvgWarning: string | null;
  referenceImageSizeWarning: string | null; // Warning for Sourceful 4.5MB limit
  /** Why the attached references can't go to the selected model (Generate is blocked), or null. */
  referenceIssue: string | null;
  seedInput: string;          // seed input field (empty = auto-generate)
  generatedImages: GeneratedImage[];
  conversationHistory: ConversationTurn[];  // Full conversation thread
  conversationId: string | null;
  /** Settings the current thread was created with (null: no thread). */
  threadSettings: ImageThreadSettings | null;
  /** The thread's last turn was generated, but its transcript could not be saved for restart recovery. */
  recoveryWarning?: string;
  /**
   * Local history can't hold this thread: the current snapshot leaves out
   * images (they won't survive a reload), or the restored thread has turns
   * whose previews an earlier snapshot left out. Recomputed from live state.
   */
  persistenceWarning?: string;
  /** The current snapshot holds a shortened copy of the draft (prompt or model id). */
  draftWarning?: string;
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
  setResolution: (resolution: ImageResolution) => void;
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
  /** Absent in state saved before resolution tiers existed (treated as Auto). */
  resolution?: ImageResolution;
  conversationId: string | null;
  /** Absent in state saved before thread settings existed; may lack `mode` from before modes. */
  threadSettings?: ImageThreadSettings | null;
  recoveryWarning?: string;
  /**
   * What this snapshot left out, and whether its draft was shortened. Saved
   * for reference only: they are never restored, because a restored warning
   * would describe an older snapshot than the next one written.
   */
  persistenceWarning?: string;
  draftWarning?: string;
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
  // Until the P4 toggle, a new thread's mode follows the selected model.
  const mode = defaultImageMode(model);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    () => normalizeAspectRatioForModel(model, initialState?.aspectRatio ?? '1:1', defaultImageMode(model))
  );
  const [resolution, setResolution] = useState<ImageResolution>(
    () => normalizeResolutionForModel(model, initialState?.resolution ?? 'auto', defaultImageMode(model))
  );
  // Reference images are NOT persisted - they're per-request context
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceSvgText, setReferenceSvgText] = useState<string | null>(null);
  const [referenceSvgWarning, setReferenceSvgWarning] = useState<string | null>(null);
  const [referenceSvgIndex, setReferenceSvgIndex] = useState<number | null>(null);
  const [referenceImageSizeWarning, setReferenceImageSizeWarning] = useState<string | null>(null);
  const [seedInput, setSeedInput] = useState('');
  // The bounded snapshot stores the latest images once, in the history.
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>(
    () => initialState?.conversationHistory?.slice(-1)[0]?.images ?? initialState?.generatedImages ?? []
  );
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>(
    initialState?.conversationHistory ?? []
  );
  const [conversationId, setConversationId] = useState<string | null>(
    initialState?.conversationId ?? null
  );
  const [threadSettings, setThreadSettings] = useState<ImageThreadSettings | null>(
    () => restoredThreadSettings(initialState, model)
  );
  const [recoveryWarning, setRecoveryWarning] = useState<string | undefined>(initialState?.recoveryWarning);
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

  /** Select a model and keep only the ratio and resolution its route lists. */
  const applyModel = useCallback((newModel: string) => {
    const newMode = defaultImageMode(newModel);
    setModelState(newModel);
    setAspectRatio(current => normalizeAspectRatioForModel(newModel, current, newMode));
    setResolution(current => normalizeResolutionForModel(newModel, current, newMode));
  }, []);
  const setModel = useCallback((newModel: string) => {
    applyModel(newModel);
    sync?.onModelChange?.(newModel);
  }, [sync, applyModel]);
  // Reset defaults when settings change (only when idle)
  const selectedModel = sync?.selectedModel;
  useEffect(() => {
    if (selectedModel && !pending.current) {
      applyModel(selectedModel);
    }
  }, [selectedModel, applyModel]);

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

  // The SVG attachment's preview is not sent as an image: its markup goes
  // as `referenceSvgText`, which the host appends to the prompt once.
  const imagesForApi = useMemo(
    () => referenceImages.filter((_, i) => i !== referenceSvgIndex),
    [referenceImages, referenceSvgIndex]
  );
  const referenceIssue = useMemo(
    () => referenceImageIssue(model, mode, imagesForApi),
    [model, mode, imagesForApi]
  );

  // Message handlers (exposed for App-level routing)
  const handleGenerationResponse = useCallback((message: MessageEnvelope) => {
    const dispatch = pending.current;
    // Late or stale: not the request we are waiting on.
    if (!dispatch || message.correlationId !== dispatch.correlationId) return;
    pending.current = null;

    const payload = message.payload as ImageGenerationResponsePayload;
    setConversationId(payload.conversationId);
    // The host reports the settings it holds the thread to.
    setThreadSettings(payload.settings ?? dispatch.settings);
    setGeneratedImages(payload.images);
    setRecoveryWarning(payload.recoveryWarning);
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
      // A failed new thread never existed: drop its optimistic settings.
      if (pending.current.isNewThread) setThreadSettings(null);
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

  /** Release a thread the user can no longer reach: host memory and its saved transcript. */
  const releaseThread = useCallback((id: string) => {
    // Its only possible answer is an error (e.g. still generating),
    // recognised by the prefix.
    vscode.postMessage(createEnvelope(
      MessageType.IMAGE_GENERATION_CLEAR,
      'webview.imageGeneration',
      { conversationId: id },
      newRequestId(CLEAR_REQUEST_PREFIX)
    ));
  }, [vscode]);

  const generate = useCallback(() => {
    if (pending.current) return;
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }
    if (!imageRouteCapabilities(model, mode)) {
      setError(`Choose a model that supports ${imageModeLabel(mode)}.`);
      return;
    }
    if (referenceIssue) {
      setError(referenceIssue);
      return;
    }

    // Parse seed input - if valid number use it, otherwise let handler auto-generate
    const parsedSeed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    const seed = parsedSeed !== undefined && !isNaN(parsedSeed) ? parsedSeed : undefined;
    const settings: ImageThreadSettings = { mode, model, aspectRatio, resolution };

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
      isNewThread: true,
      referenceSvgText: referenceSvgText ?? undefined,
    };

    // The thread being replaced can't be reached again (earlier-thread
    // archives arrive with P4), so the host can let go of it too.
    if (conversationId) releaseThread(conversationId);
    // Generate takes the prompt on screen. An enhance still running is
    // dropped, so its answer can't rewrite the box under this request.
    dropPendingEnhance();
    setIsLoading(true);
    setError(null);
    setConversationId(null);  // Clear conversation for new generation
    setThreadSettings(settings);
    setRecoveryWarning(undefined);
    setGeneratedImages([]);    // Clear previous images
    setConversationHistory([]); // Clear history for new conversation
    vscode.postMessage(message);
  }, [prompt, mode, model, aspectRatio, resolution, imagesForApi, referenceIssue, referenceSvgText, seedInput, conversationId, vscode, dropPendingEnhance, releaseThread]);

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
      if (threadSettings.mode === 'edit') {
        // A Single Shot follow-up sends the latest image as its reference.
        if (imageRouteCapabilities(threadSettings.model, 'edit')?.referenceImages?.max === 0) {
          setError('This model generates from text only, so it can’t follow up on an image. Use Generate to make a new image.');
          return;
        }
        if (!conversationHistory.slice(-1)[0]?.images.length) {
          setError('The latest image was not retained after reload. Add a saved image as a reference and generate a new image.');
          return;
        }
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
      // Generate only. Single Shot carries only its last result; Conversation
      // obtains its transcript from the host.
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
      pending.current = { correlationId: message.correlationId!, prompt: chatPrompt, settings: threadSettings, isNewThread: false };

      setIsLoading(true);
      setError(null);
      vscode.postMessage(message);
    },
    [conversationId, threadSettings, conversationHistory, vscode]
  );

  const clearConversation = useCallback(() => {
    if (pending.current) return;
    // Release the host's copy (and a Conversation's saved transcript) too.
    if (conversationId) releaseThread(conversationId);
    setConversationId(null);
    setThreadSettings(null);
    setRecoveryWarning(undefined);
    setGeneratedImages([]);
    setConversationHistory([]);
    setPrompt('');
    // Clear starts over: an enhance still running must not refill the box.
    dropPendingEnhance();
    setError(null);
  }, [conversationId, dropPendingEnhance, releaseThread]);

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

  // Persistence (reference images excluded - they're per-request context).
  // App writes webview state whenever this identity changes, and it carries
  // every generated image as base64, so the bounded history is memoized on
  // its own and the cheap draft controls are merged afterwards: typing never
  // re-serializes image history. Nothing read from `initialState` takes part:
  // its warnings described an older snapshot.
  const persistedHistory = useMemo(() => boundedImageHistory({
    model: '', prompt: '', aspectRatio: 'auto', resolution: 'auto',
    threadSettings, recoveryWarning, conversationId,
    generatedImages, conversationHistory,
  }, MAX_IMAGE_HISTORY_STORAGE_BYTES - IMAGE_HISTORY_DRAFT_RESERVE_BYTES),
  [threadSettings, recoveryWarning, conversationId, generatedImages, conversationHistory]);
  const persistedState = useMemo<ImageGenerationPersistence>(() => mergeImageHistoryDraft(persistedHistory, {
    model, prompt, aspectRatio, resolution,
  }), [persistedHistory, model, prompt, aspectRatio, resolution]);
  // Live turns never carry `imagesOmitted` (only snapshot copies do), so a
  // flagged turn is one restored from an earlier session. The note goes when
  // Clear or Generate replaces those turns.
  const restoredPreviewsOmitted = useMemo(
    () => conversationHistory.some(turn => turn.imagesOmitted),
    [conversationHistory]
  );
  const persistenceWarning = persistedHistory.persistenceWarning
    ?? (restoredPreviewsOmitted ? IMAGE_HISTORY_RESTORED_WARNING : undefined);

  return {
    // State
    mode,
    prompt,
    model,
    aspectRatio,
    resolution,
    referenceImages,
    referenceSvgText,
    referenceSvgWarning,
    referenceImageSizeWarning,
    referenceIssue,
    seedInput,
    generatedImages,
    conversationHistory,
    conversationId,
    threadSettings,
    recoveryWarning,
    persistenceWarning,
    draftWarning: persistedState.draftWarning,
    savingImageIds,
    savedImageIds,
    isLoading,
    isEnhancing,
    error,
    // Actions
    setPrompt,
    setModel,
    setAspectRatio,
    setResolution,
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
