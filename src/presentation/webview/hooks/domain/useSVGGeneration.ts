/**
 * useSVGGeneration - SVG Generation domain hook
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
  SVGThreadSettings,
  SVGGenerationRequestPayload,
  SVGGenerationContinuePayload,
  SVGGenerationResponsePayload,
  SVGSaveRequestPayload,
  SVGSaveResultPayload,
  SVGConversationHistoryTurn,
  EnhancePromptRequestPayload,
  EnhancePromptResponsePayload,
} from '@messages';
import { DEFAULT_SVG_MODEL } from '@shared/models';
import { newRequestId } from '../../utils/requestId';
import { inspectSvgDocument } from '../../../../shared/svg/SVGDocumentPolicy';
import { svgModelSupportsRefinement } from '../../../../shared/svg/svgRoutes';

/** Correlation-id prefix of clear requests; their errors are always ours. */
const CLEAR_REQUEST_PREFIX = 'svg-clear';

/**
 * What the hook dispatched for the outstanding generate or refine. The
 * response is matched against `correlationId` and builds its turn from this
 * snapshot, never from state that may have changed while the request ran.
 */
interface PendingGeneration {
  correlationId: string;
  prompt: string;
  settings: SVGThreadSettings;
  referenceSvgText?: string;
  referenceImage?: string;
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

/** The SVG a save was requested for, and how that save is going. */
interface SaveState {
  svgCode: string;
  status: 'saving' | 'saved';
}

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
  /** Settings the current conversation was created with (null: no conversation). */
  threadSettings: SVGThreadSettings | null;
  /** A save of the SVG on screen is outstanding. */
  isSaving: boolean;
  /** The host confirmed it wrote the SVG on screen. Never true after a cancel or failure. */
  isSaved: boolean;
  isLoading: boolean;
  isEnhancing: boolean;
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
  enhancePrompt: () => void;
  /** Show an error that belongs to no request of this tab, without settling any. */
  showError: (message: string) => void;
}

// 2b. Message Handlers Interface (for App-level routing)
export interface SVGGenerationHandlers {
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
export interface SVGGenerationPersistence {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  conversationId: string | null;
  /** Absent in state saved before thread settings existed. */
  threadSettings?: SVGThreadSettings | null;
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
  // State saved before thread settings existed: the old code continued with
  // the persisted controls, so they are the best record of the thread.
  const [threadSettings, setThreadSettings] = useState<SVGThreadSettings | null>(
    initialState?.threadSettings ?? (initialState?.conversationId
      ? { model: initialState.model ?? model, aspectRatio: initialState.aspectRatio ?? '1:1' }
      : null)
  );
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  // Outstanding requests, matched by correlation id. Refs, not state: the
  // App-level message handlers must see the latest value synchronously.
  const pending = useRef<PendingGeneration | null>(null);
  // The outstanding enhance and the prompt text it was asked to improve.
  const pendingEnhance = useRef<PendingEnhance | null>(null);
  const pendingSave = useRef<{ correlationId: string; svgCode: string } | null>(null);
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

  const setReferenceAttachment = useCallback((attachment: { preview: string | null; svgText: string | null }) => {
    setReferenceImage(attachment.preview);
    setReferenceSvgText(attachment.svgText);
  }, []);

  // Message handlers (exposed for App-level routing)
  const handleGenerationResponse = useCallback((message: MessageEnvelope) => {
    const dispatch = pending.current;
    // Late or stale: not the request we are waiting on.
    if (!dispatch || message.correlationId !== dispatch.correlationId) return;
    pending.current = null;

    const payload = message.payload as SVGGenerationResponsePayload;
    setConversationId(payload.conversationId);
    setThreadSettings(dispatch.settings);
    setSvgCode(payload.svgCode);
    setConversationHistory((prev) => [...prev, {
      prompt: dispatch.prompt,
      svgCode: payload.svgCode,
      turnNumber: payload.turnNumber,
      referenceSvgText: dispatch.referenceSvgText,
      referenceImage: dispatch.referenceImage,
      usage: payload.usage,
    }]);
    setIsLoading(false);
    setError(null);
  }, []);

  const handleSaveResult = useCallback((message: MessageEnvelope) => {
    const save = pendingSave.current;
    if (!save || message.correlationId !== save.correlationId) return; // Superseded or unknown.
    pendingSave.current = null;

    // Only the host's confirmation of a written file shows "Saved".
    const payload = message.payload as SVGSaveResultPayload;
    if (payload.success) {
      setSaveState({ svgCode: save.svgCode, status: 'saved' });
      return;
    }
    setSaveState(null);
    if (!payload.cancelled) {
      setError(payload.error ?? 'Failed to save SVG');
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
    } else if (pendingSave.current && message.correlationId === pendingSave.current.correlationId) {
      // The host couldn't handle the save at all (the router's fallback), so
      // no SVG_SAVE_RESULT will follow: settle only that save.
      pendingSave.current = null;
      setSaveState(null);
    } else if (!message.correlationId?.startsWith(`${CLEAR_REQUEST_PREFIX}-`)) {
      return false;
    }
    setError(text);
    return true;
  }, []);

  const showError = useCallback((text: string) => setError(text), []);

  // Actions
  const generate = useCallback(() => {
    if (pending.current) return;
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    const settings: SVGThreadSettings = { model, aspectRatio };
    // An SVG attachment travels as text; its preview image is not sent.
    const sentImage = referenceSvgText ? undefined : (referenceImage ?? undefined);
    const message = createEnvelope<SVGGenerationRequestPayload>(
      MessageType.SVG_GENERATION_REQUEST,
      'webview.svgGeneration',
      {
        prompt,
        ...settings,
        referenceImage: sentImage,
        referenceSvgText: referenceSvgText ?? undefined,
      },
      newRequestId('svg-generate')
    );
    pending.current = {
      correlationId: message.correlationId!,
      prompt,
      settings,
      referenceSvgText: referenceSvgText ?? undefined,
      // Kept with the turn so a re-hydrated conversation replays it.
      referenceImage: sentImage,
    };

    // Generate takes the prompt on screen. An enhance still running is
    // dropped, so its answer can't rewrite the box under this request.
    dropPendingEnhance();
    setIsLoading(true);
    setError(null);
    setConversationId(null);  // Clear conversation for new generation
    setThreadSettings(null);
    setSvgCode(null);          // Clear previous SVG
    setConversationHistory([]); // Clear history
    vscode.postMessage(message);
  }, [prompt, model, aspectRatio, referenceImage, referenceSvgText, vscode, dropPendingEnhance]);

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
      // The thread's model decides, not the picker: a native-vector
      // conversation can't be refined even if a text model is selected now.
      if (!svgModelSupportsRefinement(threadSettings.model)) {
        setError("Refine isn't available for this conversation's model. Start a new generation instead.");
        return;
      }

      const history: SVGConversationHistoryTurn[] = conversationHistory.map((turn) => ({
        prompt: turn.prompt,
        svgCode: turn.svgCode,
        turnNumber: turn.turnNumber,
        referenceSvgText: turn.referenceSvgText,
        referenceImage: turn.referenceImage,
      }));

      // The thread's settings, not the draft controls, own a refinement, and
      // the draft attachment is not part of the thread: it applies to the
      // next Generate only.
      const message = createEnvelope<SVGGenerationContinuePayload>(
        MessageType.SVG_GENERATION_CONTINUE,
        'webview.svgGeneration',
        {
          prompt: chatPrompt,
          conversationId,
          history,
          ...threadSettings,
        },
        newRequestId('svg-continue')
      );
      pending.current = { correlationId: message.correlationId!, prompt: chatPrompt, settings: threadSettings };

      setIsLoading(true);
      setError(null);
      vscode.postMessage(message);
    },
    [conversationHistory, conversationId, threadSettings, vscode]
  );

  const clearConversation = useCallback(() => {
    if (pending.current) return;
    if (conversationId) {
      // Release the host's copy too. Its only possible answer is an error
      // (e.g. still generating), recognised by the prefix.
      vscode.postMessage(createEnvelope(
        MessageType.SVG_GENERATION_CLEAR,
        'webview.svgGeneration',
        { conversationId },
        newRequestId(CLEAR_REQUEST_PREFIX)
      ));
    }
    setConversationId(null);
    setThreadSettings(null);
    setSvgCode(null);
    setConversationHistory([]);
    setPrompt('');
    // Clear starts over: an enhance still running must not refill the box.
    dropPendingEnhance();
    setError(null);
  }, [conversationId, dropPendingEnhance, vscode]);

  const saveSVG = useCallback(() => {
    if (!svgCode) {
      setError('No SVG code to save');
      return;
    }
    // The host enforces this too; checking here keeps a refused save from
    // looking like it is in progress.
    const verdict = inspectSvgDocument(svgCode);
    if (!verdict.accepted) {
      setError(`Not saved: this SVG ${verdict.reason}.`);
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suggestedFilename = `pixel-minion-${timestamp}.svg`;

    // A newer save supersedes an older one still in flight; the older
    // result is then ignored.
    const message = createEnvelope<SVGSaveRequestPayload>(
      MessageType.SVG_SAVE_REQUEST,
      'webview.svgGeneration',
      {
        svgCode,
        suggestedFilename,
      },
      newRequestId('svg-save')
    );
    pendingSave.current = { correlationId: message.correlationId!, svgCode };
    setSaveState({ svgCode, status: 'saving' });
    vscode.postMessage(message);
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
        type: 'svg',
      },
      newRequestId('svg-enhance')
    );
    pendingEnhance.current = { correlationId: message.correlationId!, prompt: prompt.trim() };
    setIsEnhancing(true);
    setError(null);
    vscode.postMessage(message);
  }, [prompt, vscode]);

  // The save indicator describes the SVG on screen: a new result resets it.
  const isSaving = saveState !== null && saveState.status === 'saving' && saveState.svgCode === svgCode;
  const isSaved = saveState !== null && saveState.status === 'saved' && saveState.svgCode === svgCode;

  // Persistence object. Memoized: App writes webview state whenever this
  // identity changes.
  const persistedState = useMemo<SVGGenerationPersistence>(() => ({
    prompt,
    model,
    aspectRatio,
    conversationId,
    threadSettings,
    svgCode,
    conversationHistory,
    referenceSvgText,
    referenceImage,
  }), [prompt, model, aspectRatio, conversationId, threadSettings, svgCode, conversationHistory, referenceSvgText, referenceImage]);

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
    threadSettings,
    isSaving,
    isSaved,
    isLoading,
    isEnhancing,
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
