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
 * kind, save tracking, enhance answers dropped by Generate and Clear).
 *
 * The mode (Conversation | Single Shot) is the user's choice for the next
 * thread; a new installation starts with Frame's default rule (Conversation
 * when the model has a verified route, otherwise Single Shot). Switching
 * modes, Generate and "start from this image" keep the current thread under
 * Earlier threads, which are for browsing, saving and starting again; they
 * don't continue. Pixel delta: archiving also releases the thread on the
 * host (memory and any saved transcript), since nothing can continue it.
 * Generate's archive is provisional: the replaced thread is released (and
 * stays archived) only once the new thread exists; if the request fails it
 * comes back as the current, continuable thread.
 *
 * Pixel fixes not yet upstream (flag them when syncing): snapshot warnings
 * are recomputed from live state, never restored; thread settings are saved
 * only with a conversation id; Generate releases the thread it replaces only
 * after the new one succeeds (and puts it back if it fails); request-size
 * warnings and requirement wording come from catalog fields, not id prefixes.
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
import type { ImageRouteCapabilities } from '@shared/models';
import { imageExtensionForMime } from '../../../../shared/media/imageFormats';
import { newRequestId } from '../../utils/requestId';
import { restoredImageState } from './restoredImageState';
import {
  boundedImageHistory,
  mergeImageHistoryDraft,
  MAX_IMAGE_HISTORY_STORAGE_BYTES,
  IMAGE_HISTORY_DRAFT_RESERVE_BYTES,
  IMAGE_HISTORY_RESTORED_WARNING,
} from './imageHistoryPersistence';

/**
 * The ratio to keep when the model (or mode) changes: the current one if the
 * route lists it. The mode is required: what a model takes depends on the
 * route (imageRouteCapabilities), never on its catalog row alone.
 */
export function normalizeAspectRatioForModel(modelId: string, current: AspectRatio, mode: ImageGenerationMode): AspectRatio {
  const supported = imageRouteCapabilities(modelId, mode)?.supportedAspectRatios;
  return !supported || supported.includes(current) ? current : supported[0];
}

/** The resolution to keep when the model (or mode) changes; anything the route doesn't list falls back to Auto. */
export function normalizeResolutionForModel(modelId: string, current: ImageResolution, mode: ImageGenerationMode): ImageResolution {
  const supported = imageRouteCapabilities(modelId, mode)?.supportedResolutions;
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

/** "exactly 1 reference image", "0–3 reference images": how many a route takes. */
function referenceCountText(limits: { min: number; max: number }, noun = 'reference image'): string {
  const count = limits.min === limits.max ? `exactly ${limits.min}` : `${limits.min}–${limits.max}`;
  return `${count} ${noun}${limits.min === 1 && limits.max === 1 ? '' : 's'}`;
}

const MIME_LABELS: Record<string, string> = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP' };

/** "PNG", "PNG or JPEG", "PNG, JPEG, or WebP". */
function formatList(words: readonly string[]): string {
  if (words.length < 3) return words.join(' or ');
  return `${words.slice(0, -1).join(', ')}, or ${words[words.length - 1]}`;
}

/**
 * The note under the uploader for a route that requires references, or null.
 * Its wording comes from catalog fields only: the count bounds, the format
 * list, and `referenceRole` for what the model does with them.
 */
export function referenceRequirementNote(capabilities: ImageRouteCapabilities | undefined): string | null {
  const limits = capabilities?.referenceImages;
  if (!limits || limits.min === 0) return null;
  const formats = capabilities?.referenceMimeTypes?.length
    ? `${formatList(capabilities.referenceMimeTypes.map(mime => MIME_LABELS[mime] ?? mime))} `
    : '';
  switch (capabilities?.referenceRole) {
    case 'style':
      return `Requires ${referenceCountText(limits, `${formats}style reference`)}: this model makes a new image in their style.`;
    case 'edit':
      return `Requires ${referenceCountText(limits, `${formats}reference image`)}: this model edits the images you attach.`;
    default:
      return `Requires ${referenceCountText(limits, `${formats}reference image`)}.`;
  }
}

/** Megabytes with one decimal, for size warnings. */
function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * How far the images one request carries exceed the route's request-size
 * limit (`maxRequestBytes`, a catalog field), or null when they fit or the
 * route states no limit. Pass only what the request sends as images: an SVG
 * attachment goes as text.
 */
export function imagesOverRequestLimit(
  modelId: string,
  mode: ImageGenerationMode,
  images: readonly string[]
): { totalBytes: number; limitBytes: number } | null {
  const limitBytes = imageRouteCapabilities(modelId, mode)?.maxRequestBytes;
  if (!limitBytes || images.length === 0) return null;
  const totalBytes = calculateBase64Size([...images]);
  return totalBytes > limitBytes ? { totalBytes, limitBytes } : null;
}

function modelName(modelId: string): string {
  return OPENROUTER_IMAGE_MODELS.find(entry => entry.id === modelId)?.displayName ?? modelId;
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
      return `This model accepts ${referenceCountText(limits)}; ${count} attached. Remove ${count - limits.max} to generate.`;
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
 * The thread a Generate replaces. It stays alive on the host until the new
 * thread exists: released when the new one succeeds, put back on screen when
 * it fails.
 */
interface ReplacedThread {
  conversationId: string;
  threadSettings: ImageThreadSettings | null;
  generatedImages: GeneratedImage[];
  conversationHistory: ConversationTurn[];
  recoveryWarning?: string;
}

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
  /** Generate only: the thread it replaces, if one was on screen. */
  replaces?: ReplacedThread;
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
 * The saved thread's settings. A thread exists only once the host has named
 * it: settings saved without a conversation id belong to a first Generate
 * that never answered (the webview reloaded while it ran), so they restore
 * nothing. State saved before modes existed has no `mode` (or no thread
 * settings at all): it opens as Single Shot, because there is no host
 * transcript to continue a conversation from. Its ratio is moved onto one the
 * model's Single Shot route lists (the old picker offered seven fixed ratios
 * to every model; providers clamped the ones they didn't support).
 */
function restoredThreadSettings(
  initialState: Partial<ImageGenerationPersistence> | undefined,
  fallbackModel: string
): ImageThreadSettings | null {
  if (!initialState?.conversationId) return null;
  const saved = initialState.threadSettings as Partial<ImageThreadSettings> | null | undefined;
  if (saved?.mode && saved.model && saved.aspectRatio) {
    return { mode: saved.mode, model: saved.model, aspectRatio: saved.aspectRatio, resolution: saved.resolution ?? 'auto' };
  }
  const model = saved?.model ?? initialState.model ?? fallbackModel;
  return {
    mode: 'edit',
    model,
    aspectRatio: normalizeAspectRatioForModel(model, saved?.aspectRatio ?? initialState.aspectRatio ?? '1:1', 'edit'),
    resolution: 'auto',
  };
}

/**
 * A thread kept for browsing after a new one started. It doesn't continue,
 * and the host has released it, so it carries no recovery note: that note
 * is about continuing after a restart.
 */
export interface ArchivedImageThread {
  id: string;
  settings: ImageThreadSettings;
  turns: ConversationTurn[];
}

/** A thread as Earlier threads keep it, or null when it has nothing to show. */
function toArchivedThread(
  id: string,
  settings: ImageThreadSettings | null,
  turns: ConversationTurn[]
): ArchivedImageThread | null {
  return settings && turns.length ? { id, settings, turns } : null;
}

/** Earlier threads (oldest first) with `thread` as the newest, never twice. */
function withArchivedThread(threads: ArchivedImageThread[], thread: ArchivedImageThread): ArchivedImageThread[] {
  return [...threads.filter(entry => entry.id !== thread.id), thread];
}

// 1. State Interface (read-only)
export interface ImageGenerationState {
  /** The mode the next new thread starts in (the Conversation | Single Shot toggle). */
  mode: ImageGenerationMode;
  /** Earlier threads, oldest first. */
  archivedThreads: ArchivedImageThread[];
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  referenceImages: string[];  // base64 data URLs
  referenceSvgText: string | null; // raw SVG text attachment
  /** Index in `referenceImages` of the SVG attachment's preview (sent as text, not as an image), or null. */
  referenceSvgIndex: number | null;
  referenceSvgWarning: string | null;
  /** The references Generate would send exceed the model's request-size limit (a warning; Generate stays enabled). */
  referenceImageSizeWarning: string | null;
  /** A Single Shot follow-up re-sends the latest output, which exceeds the thread model's request-size limit. */
  followUpSizeWarning: string | null;
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
  /** Switch the mode for the next thread; keeps the current thread under Earlier threads. Ignored while a request runs. */
  setMode: (mode: ImageGenerationMode) => void;
  /** Keep the current thread and start a new one with this image as its reference. */
  startFromImage: (image: GeneratedImage) => void;
  /** Delete an earlier thread (and the host's saved transcript, if any). */
  removeArchivedThread: (id: string) => void;
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
  /**
   * The toggle, once the user has committed to a mode (absent before: the
   * mode then follows the default model). Absent in state saved before the
   * toggle, too.
   */
  mode?: ImageGenerationMode;
  /** Absent in state saved before Earlier threads. */
  archivedThreads?: ArchivedImageThread[];
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

  // Saved state is read once, and only what the tab can render: a malformed
  // value would otherwise crash every reload (restoredImageState).
  const [restored] = useState(() => restoredImageState(initialState));
  const saved = restored.state;

  // State
  const [prompt, setPrompt] = useState(saved.prompt ?? '');
  const [model, setModelState] = useState(saved.model ?? (sync?.selectedModel ?? DEFAULT_IMAGE_MODEL));
  const [threadSettings, setThreadSettings] = useState<ImageThreadSettings | null>(
    () => restoredThreadSettings(saved, model)
  );
  // The saved toggle wins. State from before the toggle keeps the restored
  // thread's mode; an untagged history opens as Single Shot (no transcript to
  // continue a conversation from); otherwise the mode follows the model.
  const [mode, setModeState] = useState<ImageGenerationMode>(() =>
    saved.mode
    ?? threadSettings?.mode
    ?? (saved.conversationHistory?.length ? 'edit' : defaultImageMode(model)));
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Until the user commits to a mode, it follows the selected model by
  // Frame's default rule, including the configured default that arrives
  // with the first SETTINGS_DATA (before it, `model` is useSettings'
  // placeholder). Choosing the mode, picking a model in this tab, Generate,
  // or a restored thread commits it. Only a committed mode is saved, so a
  // reload before the settings arrive still follows them.
  const [modeChosen, setModeChosen] = useState(
    () => saved.mode !== undefined || threadSettings !== null || !!saved.conversationHistory?.length
  );
  const modeChosenRef = useRef(modeChosen);
  modeChosenRef.current = modeChosen;
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    () => normalizeAspectRatioForModel(model, saved.aspectRatio ?? '1:1', mode)
  );
  const [resolution, setResolution] = useState<ImageResolution>(
    () => normalizeResolutionForModel(model, saved.resolution ?? 'auto', mode)
  );
  const [archivedThreads, setArchivedThreads] = useState<ArchivedImageThread[]>(saved.archivedThreads ?? []);
  // Reference images are NOT persisted - they're per-request context
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceSvgText, setReferenceSvgText] = useState<string | null>(null);
  const [referenceSvgWarning, setReferenceSvgWarning] = useState<string | null>(null);
  const [referenceSvgIndex, setReferenceSvgIndex] = useState<number | null>(null);
  const [seedInput, setSeedInput] = useState('');
  // The bounded snapshot stores the latest images once, in the history.
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>(
    () => saved.conversationHistory?.slice(-1)[0]?.images ?? saved.generatedImages ?? []
  );
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>(
    saved.conversationHistory ?? []
  );
  const [conversationId, setConversationId] = useState<string | null>(
    saved.conversationId ?? null
  );
  const [recoveryWarning, setRecoveryWarning] = useState<string | undefined>(saved.recoveryWarning);
  const [savingImageIds, setSavingImageIds] = useState<ReadonlySet<string>>(() => new Set());
  const [savedImageIds, setSavedImageIds] = useState<ReadonlySet<string>>(() => new Set());
  // Outstanding requests, matched by correlation id. Refs, not state: the
  // App-level message handlers must see the latest value synchronously.
  const pending = useRef<PendingGeneration | null>(null);
  // The same replaced thread, as state, so the snapshot can keep it while
  // the Generate that replaces it runs.
  const [replacedThread, setReplacedThread] = useState<ReplacedThread | null>(null);
  // A release (clear) error that arrived while a generation ran: that
  // generation's success would hide it, so it is shown once it settles.
  const heldReleaseError = useRef<string | null>(null);
  // The outstanding enhance and the prompt text it was asked to improve.
  const pendingEnhance = useRef<PendingEnhance | null>(null);
  /** Outstanding saves: correlation id → image id. */
  const pendingSaves = useRef(new Map<string, string>());
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Select a model in a mode, and keep only the ratio and resolution its route lists there. */
  const applyModel = useCallback((newModel: string, newMode: ImageGenerationMode) => {
    setModelState(newModel);
    setModeState(newMode);
    setAspectRatio(current => normalizeAspectRatioForModel(newModel, current, newMode));
    setResolution(current => normalizeResolutionForModel(newModel, current, newMode));
  }, []);
  const setModel = useCallback((newModel: string) => {
    // Picked from this mode's list: keep the mode it was picked in.
    setModeChosen(true);
    applyModel(newModel, modeRef.current);
    sync?.onModelChange?.(newModel);
  }, [sync, applyModel]);
  // Reset defaults when settings change (only when idle)
  const selectedModel = sync?.selectedModel;
  useEffect(() => {
    if (selectedModel && !pending.current) {
      applyModel(selectedModel, modeChosenRef.current ? modeRef.current : defaultImageMode(selectedModel));
    }
  }, [selectedModel, applyModel]);

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
  // Request-size limits (Sourceful's 4.5 MB) come from the catalog, and are
  // checked against what each request actually sends as images.
  const referenceImageSizeWarning = useMemo(() => {
    const over = imagesOverRequestLimit(model, mode, imagesForApi);
    return over
      ? `Reference images total ${megabytes(over.totalBytes)} MB, over ${modelName(model)}’s ${megabytes(over.limitBytes)} MB request limit. Generation may fail.`
      : null;
  }, [model, mode, imagesForApi]);
  const followUpSizeWarning = useMemo(() => {
    // Only a Single Shot follow-up re-sends images: the latest output.
    if (!conversationId || threadSettings?.mode !== 'edit') return null;
    const latest = conversationHistory[conversationHistory.length - 1]?.images.map(image => image.data) ?? [];
    const over = imagesOverRequestLimit(threadSettings.model, 'edit', latest);
    return over
      ? `The latest image is ${megabytes(over.totalBytes)} MB, over ${modelName(threadSettings.model)}’s ${megabytes(over.limitBytes)} MB request limit. A follow-up sends it again, so it may fail.`
      : null;
  }, [conversationId, threadSettings, conversationHistory]);

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

  // A saved thread that couldn't be restored can't be reached again:
  // release it rather than leave its transcript orphaned. Once.
  const releasedUnrestored = useRef(false);
  useEffect(() => {
    if (releasedUnrestored.current || !restored.unrestoredThreadId) return;
    releasedUnrestored.current = true;
    releaseThread(restored.unrestoredThreadId);
  }, [restored, releaseThread]);

  /** Put a replaced thread back on screen (its Generate failed; the host still holds it). */
  const restoreThread = useCallback((thread: ReplacedThread) => {
    setConversationId(thread.conversationId);
    setThreadSettings(thread.threadSettings);
    setGeneratedImages(thread.generatedImages);
    setConversationHistory(thread.conversationHistory);
    setRecoveryWarning(thread.recoveryWarning);
  }, []);

  /** A release error held while a generation ran, once; null when there is none. */
  const takeHeldReleaseError = useCallback((): string | null => {
    const held = heldReleaseError.current;
    heldReleaseError.current = null;
    return held;
  }, []);

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
    // The new thread exists, so the one it replaced becomes an Earlier
    // thread for good, and the host can let go of it: an Earlier thread
    // never continues. A failed release reports an error after this
    // response, which stays shown.
    const replaced = dispatch.replaces;
    if (replaced && replaced.conversationId !== payload.conversationId) {
      const archived = toArchivedThread(replaced.conversationId, replaced.threadSettings, replaced.conversationHistory);
      if (archived) setArchivedThreads(prev => withArchivedThread(prev, archived));
      releaseThread(replaced.conversationId);
    }
    setReplacedThread(null);
    setError(takeHeldReleaseError());
  }, [releaseThread, takeHeldReleaseError]);

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
    let text = (message.payload as { message?: string } | undefined)?.message ?? 'Something went wrong';
    if (pending.current && message.correlationId === pending.current.correlationId) {
      const { isNewThread, replaces } = pending.current;
      // A failed new thread never existed: the thread it was replacing
      // (never released) comes back; with none, its optimistic settings go.
      if (replaces) restoreThread(replaces);
      else if (isNewThread) setThreadSettings(null);
      pending.current = null;
      setReplacedThread(null);
      setIsLoading(false);
      const held = takeHeldReleaseError();
      if (held) text = `${text} ${held}`;
    } else if (message.correlationId?.startsWith(`${CLEAR_REQUEST_PREFIX}-`) && pending.current) {
      // A generation is running: its success would clear this at once.
      heldReleaseError.current = text;
      return true;
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
  }, [restoreThread, takeHeldReleaseError]);

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

  /**
   * Keep the current thread under Earlier threads and start with an empty
   * one. Earlier threads don't continue, so the host releases it too. For a
   * path that sends no generation (mode switch, start from an image), so
   * nothing can fail and bring the thread back. Generate archives
   * provisionally instead (see `generate`).
   */
  const archiveCurrentThread = useCallback(() => {
    const archived = conversationId ? toArchivedThread(conversationId, threadSettings, conversationHistory) : null;
    if (archived) setArchivedThreads(prev => withArchivedThread(prev, archived));
    if (conversationId) releaseThread(conversationId);
    setConversationId(null);
    setThreadSettings(null);
    setGeneratedImages([]);
    setConversationHistory([]);
    setRecoveryWarning(undefined);
  }, [conversationId, conversationHistory, threadSettings, recoveryWarning, releaseThread]);

  const setMode = useCallback((nextMode: ImageGenerationMode) => {
    if (pending.current || pendingEnhance.current || nextMode === mode) return;
    archiveCurrentThread();
    setModeChosen(true);
    setModeState(nextMode);
    setAspectRatio(current => normalizeAspectRatioForModel(model, current, nextMode));
    setResolution(current => normalizeResolutionForModel(model, current, nextMode));
    setError(null);
  }, [mode, model, archiveCurrentThread]);

  const startFromImage = useCallback((image: GeneratedImage) => {
    if (pending.current || pendingEnhance.current) return;
    archiveCurrentThread();
    clearReferenceImages();
    setReferenceImages([image.data]);
    setPrompt('');
    setError(null);
  }, [archiveCurrentThread, clearReferenceImages]);

  const removeArchivedThread = useCallback((id: string) => {
    // While a Generate runs, the thread it replaces is shown under Earlier
    // threads but still belongs to that request (it comes back on failure).
    if (pending.current) return;
    setArchivedThreads(prev => prev.filter(thread => thread.id !== id));
    releaseThread(id);
  }, [releaseThread]);

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
    // The thread on screen is replaced, but released only once the new one
    // succeeds: if this request fails, it comes back.
    const replaces: ReplacedThread | undefined = conversationId
      ? { conversationId, threadSettings, generatedImages, conversationHistory, recoveryWarning }
      : undefined;
    pending.current = {
      correlationId: message.correlationId!,
      prompt,
      settings,
      isNewThread: true,
      replaces,
      referenceSvgText: referenceSvgText ?? undefined,
    };
    setReplacedThread(replaces ?? null);

    // The replaced thread shows under Earlier threads while this runs (see
    // `visibleArchivedThreads`), but it is archived and released only once
    // the new thread exists.
    // Generate takes the prompt on screen. An enhance still running is
    // dropped, so its answer can't rewrite the box under this request.
    dropPendingEnhance();
    setModeChosen(true);
    setIsLoading(true);
    setError(null);
    setConversationId(null);  // Clear conversation for new generation
    setThreadSettings(settings);
    setRecoveryWarning(undefined);
    setGeneratedImages([]);    // Clear previous images
    setConversationHistory([]); // Clear history for new conversation
    vscode.postMessage(message);
  }, [prompt, mode, model, aspectRatio, resolution, imagesForApi, referenceIssue, referenceSvgText, seedInput, conversationId, threadSettings, generatedImages, conversationHistory, recoveryWarning, vscode, dropPendingEnhance]);

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

      // Single Shot follow-ups use only the latest images, which also let the
      // host restart the thread after a restart.
      const latestImages: ConversationHistoryTurn['images'] | undefined = threadSettings.mode === 'edit'
        ? conversationHistory[conversationHistory.length - 1].images.map(img => ({ data: img.data, seed: img.seed }))
        : undefined;

      // The thread's settings, not the draft controls, own a continuation, and
      // draft attachments are not part of the thread: they apply to the next
      // Generate only. Single Shot carries only its last result; Conversation
      // obtains its transcript from the host and sends only its turn count.
      const message = createEnvelope<ImageGenerationContinuePayload>(
        MessageType.IMAGE_GENERATION_CONTINUE,
        'webview.imageGeneration',
        {
          prompt: chatPrompt,
          conversationId,
          turnCount: conversationHistory.length,
          ...(latestImages ? { latestImages } : {}),
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
  // its warnings described an older snapshot. A first Generate's optimistic
  // settings stay out until the host names the thread: a reload while it runs
  // must not restore a thread that doesn't exist. While a Generate replaces a
  // thread, the snapshot keeps the replaced one: the host still holds it, so
  // a reload meanwhile brings it back instead of leaving it unreachable.
  const persistedHistory = useMemo(() => boundedImageHistory({
    mode: 'edit', model: '', prompt: '', aspectRatio: 'auto', resolution: 'auto',
    archivedThreads,
    ...(replacedThread ?? {
      threadSettings: conversationId ? threadSettings : null, recoveryWarning, conversationId,
      generatedImages, conversationHistory,
    }),
  }, MAX_IMAGE_HISTORY_STORAGE_BYTES - IMAGE_HISTORY_DRAFT_RESERVE_BYTES),
  [replacedThread, archivedThreads, threadSettings, recoveryWarning, conversationId, generatedImages, conversationHistory]);
  const persistedState = useMemo<ImageGenerationPersistence>(() => mergeImageHistoryDraft(persistedHistory, {
    mode: modeChosen ? mode : undefined, model, prompt, aspectRatio, resolution,
  }), [persistedHistory, modeChosen, mode, model, prompt, aspectRatio, resolution]);
  // What Earlier threads show: the kept ones, plus, while a Generate runs,
  // the thread it replaces (provisionally: it comes back if that fails).
  const visibleArchivedThreads = useMemo(() => {
    const provisional = replacedThread && toArchivedThread(
      replacedThread.conversationId, replacedThread.threadSettings, replacedThread.conversationHistory
    );
    return provisional ? withArchivedThread(archivedThreads, provisional) : archivedThreads;
  }, [archivedThreads, replacedThread]);
  // Live turns never carry `imagesOmitted` (only snapshot copies do), so a
  // flagged turn is one restored from an earlier session, on screen or under
  // Earlier threads. The note goes once those turns are gone.
  const restoredPreviewsOmitted = useMemo(
    () => [conversationHistory, replacedThread?.conversationHistory ?? [], ...archivedThreads.map(thread => thread.turns)]
      .some(turns => turns.some(turn => turn.imagesOmitted)),
    [conversationHistory, replacedThread, archivedThreads]
  );
  const persistenceWarning = persistedHistory.persistenceWarning
    ?? (restoredPreviewsOmitted ? IMAGE_HISTORY_RESTORED_WARNING : undefined);

  return {
    // State
    mode,
    archivedThreads: visibleArchivedThreads,
    prompt,
    model,
    aspectRatio,
    resolution,
    referenceImages,
    referenceSvgText,
    referenceSvgIndex,
    referenceSvgWarning,
    referenceImageSizeWarning,
    followUpSizeWarning,
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
    setMode,
    startFromImage,
    removeArchivedThread,
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
