/**
 * useSvgArchitect - SVG Architect domain hook
 *
 * Pattern: Tripartite Interface (State, Actions, Handlers)
 * Sprint 6.2 - Webview Hook for SVG Architect multi-agent pipeline
 */
import { useState, useCallback, useEffect } from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  AspectRatio,
  SVGArchitectStatusType,
  SVGArchitectRequestPayload,
  SVGArchitectProgressPayload,
  SVGArchitectPngPayload,
  SVGArchitectResumePayload,
  SVGArchitectResultPayload,
  SVGArchitectCancelPayload,
} from '@messages';
import { renderSvgToPng } from '../../utils/svgToPng';

// Conversation entry for tracking pipeline progress
export interface SvgArchitectConversationEntry {
  timestamp: number;
  type: 'analysis' | 'render' | 'validation' | 'user_notes' | 'result';
  message: string;
  svgCode?: string;
  confidenceScore?: number;
}

// 1. State Interface (read-only)
export interface SvgArchitectState {
  isEnabled: boolean;              // High-quality mode toggle
  status: SVGArchitectStatusType;  // Pipeline status
  iteration: number;
  maxIterations: number;
  svgCode: string | null;
  blueprint: string | null;
  confidenceScore: number | null;
  conversationId: string | null;
  userNotes: string;
  error: string | null;
  conversationEntries: SvgArchitectConversationEntry[];
}

// Generate options
export interface SvgArchitectGenerateOptions {
  blueprintModel: string;
  renderModel: string;
  aspectRatio: AspectRatio;
  maxIterations: number;
  referenceImage?: string;
  referenceSvgText?: string;
}

// 2. Actions Interface (write operations)
export interface SvgArchitectActions {
  setEnabled: (enabled: boolean) => void;
  generate: (prompt: string, options: SvgArchitectGenerateOptions) => void;
  submitUserNotes: (notes: string) => void;
  cancel: () => void;
  reset: () => void;
  setUserNotes: (notes: string) => void;
}

// 2b. Message Handlers Interface (for App-level routing)
export interface SvgArchitectHandlers {
  handleProgress: (message: MessageEnvelope) => void;
  handleResult: (message: MessageEnvelope) => void;
  handleError: (message: MessageEnvelope) => void;
}

// 3. Persistence Interface (what gets saved)
export interface SvgArchitectPersistence {
  isEnabled: boolean;
  conversationId: string | null;
  svgCode: string | null;
  conversationEntries: SvgArchitectConversationEntry[];
}

// Composed return type
export type UseSvgArchitectReturn = SvgArchitectState & SvgArchitectActions & SvgArchitectHandlers & {
  persistedState: SvgArchitectPersistence;
};

export interface SvgArchitectSync {
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
}

export function useSvgArchitect(
  initialState?: Partial<SvgArchitectPersistence>,
  sync?: SvgArchitectSync
): UseSvgArchitectReturn {
  const vscode = useVSCodeApi();

  // State - sync enabled with settings
  const [isEnabled, setIsEnabledState] = useState(
    sync?.enabled ?? initialState?.isEnabled ?? false
  );

  // Sync enabled state with settings
  const setIsEnabled = useCallback((enabled: boolean) => {
    setIsEnabledState(enabled);
    sync?.onEnabledChange?.(enabled);
  }, [sync]);

  // Update from settings when sync changes
  useEffect(() => {
    if (sync?.enabled !== undefined) {
      setIsEnabledState(sync.enabled);
    }
  }, [sync?.enabled]);
  const [status, setStatus] = useState<SVGArchitectStatusType>('idle');
  const [iteration, setIteration] = useState(0);
  const [maxIterations, setMaxIterations] = useState(3);
  const [svgCode, setSvgCode] = useState<string | null>(initialState?.svgCode ?? null);
  const [blueprint, setBlueprint] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(
    initialState?.conversationId ?? null
  );
  const [userNotes, setUserNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conversationEntries, setConversationEntries] = useState<SvgArchitectConversationEntry[]>(
    initialState?.conversationEntries ?? []
  );

  // Auto-render effect: When status is 'validating' and svgCode exists, render to PNG
  useEffect(() => {
    if (status === 'validating' && svgCode && conversationId) {
      const renderAndSend = async () => {
        try {
          // Use standard dimensions for validation (1024x1024)
          const pngBase64 = await renderSvgToPng(svgCode, 1024, 1024);

          vscode.postMessage(
            createEnvelope<SVGArchitectPngPayload>(
              MessageType.SVG_ARCHITECT_PNG_READY,
              'webview.svgArchitect',
              {
                conversationId,
                pngBase64,
              }
            )
          );
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to render SVG to PNG';
          setError(errorMessage);
        }
      };

      renderAndSend();
    }
  }, [status, svgCode, conversationId, vscode]);

  // Message handlers (exposed for App-level routing)
  const handleProgress = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as SVGArchitectProgressPayload;

    setConversationId(payload.conversationId);
    setStatus(payload.status);
    setIteration(payload.iteration);
    setMaxIterations(payload.maxIterations);

    if (payload.svgCode !== undefined) {
      setSvgCode(payload.svgCode);
    }

    if (payload.confidenceScore !== undefined) {
      setConfidenceScore(payload.confidenceScore);
    }

    if (payload.blueprint !== undefined) {
      setBlueprint(payload.blueprint);
    }

    // Add conversation entry based on status
    const entry: SvgArchitectConversationEntry = {
      timestamp: Date.now(),
      type: mapStatusToEntryType(payload.status),
      message: payload.message,
      svgCode: payload.svgCode,
      confidenceScore: payload.confidenceScore,
    };

    setConversationEntries((prev) => [...prev, entry]);
    setError(null);
  }, []);

  const handleResult = useCallback((message: MessageEnvelope) => {
    const payload = message.payload as SVGArchitectResultPayload;

    setConversationId(payload.conversationId);
    setStatus(payload.status);
    setSvgCode(payload.svgCode);
    setConfidenceScore(payload.finalConfidence);
    setIteration(payload.iterations);

    // Add final result entry
    const entry: SvgArchitectConversationEntry = {
      timestamp: Date.now(),
      type: 'result',
      message: payload.status === 'complete'
        ? `Generation complete with confidence ${payload.finalConfidence ?? 'unknown'}%`
        : 'Generation completed',
      svgCode: payload.svgCode ?? undefined,
      confidenceScore: payload.finalConfidence ?? undefined,
    };

    setConversationEntries((prev) => [...prev, entry]);
    setError(null);
  }, []);

  const handleError = useCallback((message: MessageEnvelope) => {
    const errorMessage = (message.payload as { message: string }).message;
    setStatus('error');
    setError(errorMessage);

    // Add error entry
    const entry: SvgArchitectConversationEntry = {
      timestamp: Date.now(),
      type: 'result',
      message: `Error: ${errorMessage}`,
    };

    setConversationEntries((prev) => [...prev, entry]);
  }, []);

  // Actions
  const generate = useCallback((prompt: string, options: SvgArchitectGenerateOptions) => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    // Reset state for new generation
    setStatus('analyzing');
    setIteration(0);
    setMaxIterations(options.maxIterations);
    setSvgCode(null);
    setBlueprint(null);
    setConfidenceScore(null);
    setConversationId(null);
    setUserNotes('');
    setError(null);
    setConversationEntries([]);

    vscode.postMessage(
      createEnvelope<SVGArchitectRequestPayload>(
        MessageType.SVG_ARCHITECT_REQUEST,
        'webview.svgArchitect',
        {
          prompt,
          blueprintModel: options.blueprintModel,
          renderModel: options.renderModel,
          aspectRatio: options.aspectRatio,
          maxIterations: options.maxIterations,
          referenceImage: options.referenceImage,
          referenceSvgText: options.referenceSvgText,
        }
      )
    );
  }, [vscode]);

  const submitUserNotes = useCallback((notes: string) => {
    if (!notes.trim()) {
      setError('Please enter feedback notes');
      return;
    }

    if (!conversationId) {
      setError('No active conversation to resume');
      return;
    }

    // Add user notes entry
    const entry: SvgArchitectConversationEntry = {
      timestamp: Date.now(),
      type: 'user_notes',
      message: notes,
    };

    setConversationEntries((prev) => [...prev, entry]);
    setUserNotes('');
    setError(null);

    vscode.postMessage(
      createEnvelope<SVGArchitectResumePayload>(
        MessageType.SVG_ARCHITECT_RESUME,
        'webview.svgArchitect',
        {
          conversationId,
          userNotes: notes,
        }
      )
    );
  }, [conversationId, vscode]);

  const cancel = useCallback(() => {
    if (!conversationId) {
      return;
    }

    vscode.postMessage(
      createEnvelope<SVGArchitectCancelPayload>(
        MessageType.SVG_ARCHITECT_CANCEL,
        'webview.svgArchitect',
        {
          conversationId,
        }
      )
    );

    setStatus('idle');
  }, [conversationId, vscode]);

  const reset = useCallback(() => {
    setStatus('idle');
    setIteration(0);
    setSvgCode(null);
    setBlueprint(null);
    setConfidenceScore(null);
    setConversationId(null);
    setUserNotes('');
    setError(null);
    setConversationEntries([]);
  }, []);

  // Persistence object
  const persistedState: SvgArchitectPersistence = {
    isEnabled,
    conversationId,
    svgCode,
    conversationEntries,
  };

  return {
    // State
    isEnabled,
    status,
    iteration,
    maxIterations,
    svgCode,
    blueprint,
    confidenceScore,
    conversationId,
    userNotes,
    error,
    conversationEntries,
    // Actions
    setEnabled: setIsEnabled,  // Uses synced callback
    generate,
    submitUserNotes,
    cancel,
    reset,
    setUserNotes,
    // Message Handlers (for App-level routing)
    handleProgress,
    handleResult,
    handleError,
    // Persistence
    persistedState,
  };
}

/**
 * Map status to conversation entry type
 */
function mapStatusToEntryType(status: SVGArchitectStatusType): SvgArchitectConversationEntry['type'] {
  switch (status) {
    case 'analyzing':
      return 'analysis';
    case 'rendering':
      return 'render';
    case 'validating':
    case 'refining':
      return 'validation';
    case 'complete':
    case 'error':
      return 'result';
    default:
      return 'analysis';
  }
}
