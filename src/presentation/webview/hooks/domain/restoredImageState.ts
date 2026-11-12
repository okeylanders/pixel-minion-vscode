/**
 * What the Image tab may restore from webview state (review P4-n4).
 *
 * `vscode.getState()` returns whatever an earlier build, or a bug, saved.
 * The tab renders it before anything can save over it, so a malformed
 * value (a non-array `archivedThreads`, a turn whose `images` isn't an
 * array, a prompt that isn't a string) would crash the render on every
 * reload, and with it the tab, for good. This keeps only values the tab
 * can render and continue, field by field:
 *
 * - draft fields (prompt, model, ratio, resolution, recovery note): kept
 *   when they are strings;
 * - `mode`: kept when it is a known mode; otherwise absent, so the mode
 *   follows the default rule;
 * - the current thread: kept only whole (its turn count must match the
 *   host transcript). A malformed history drops the thread, and its id is
 *   returned so the hook can release it on the host instead of orphaning
 *   its transcript. Thread settings with an unknown mode are dropped, and
 *   the thread opens as Single Shot, like state saved before modes;
 * - Earlier threads: kept one by one; a malformed entry is dropped.
 *
 * Nothing is repaired in place: a turn is kept as saved or not at all.
 */
import type { ConversationTurn, GeneratedImage, ImageThreadSettings } from '@messages';
import type { ArchivedImageThread, ImageGenerationPersistence } from './useImageGeneration';

const MODES: readonly string[] = ['conversation', 'edit'];

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const optionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** What ImageCard renders: ids, data, a prompt it measures, and a ratio it splits. */
function isRenderableImage(value: unknown): value is GeneratedImage {
  return isObject(value)
    && typeof value.id === 'string'
    && typeof value.data === 'string'
    && typeof value.prompt === 'string'
    && (value.aspectRatio === undefined || typeof value.aspectRatio === 'string');
}

/** What ConversationThread renders, including the usage line it formats. */
function isRenderableTurn(value: unknown): value is ConversationTurn {
  if (!isObject(value)) return false;
  const usage = value.usage;
  return typeof value.id === 'string'
    && typeof value.prompt === 'string'
    && Array.isArray(value.images) && value.images.every(isRenderableImage)
    && (usage === undefined || (isObject(usage) && typeof usage.totalTokens === 'number'
      && (usage.costUsd === undefined || typeof usage.costUsd === 'number')));
}

function isTurnList(value: unknown): value is ConversationTurn[] {
  return Array.isArray(value) && value.every(isRenderableTurn);
}

/** Settings a thread can be shown and continued with, or undefined. */
function threadSettingsFrom(value: unknown): ImageThreadSettings | undefined {
  if (!isObject(value) || typeof value.mode !== 'string' || !MODES.includes(value.mode)) return undefined;
  if (typeof value.model !== 'string' || typeof value.aspectRatio !== 'string') return undefined;
  if (value.resolution !== undefined && typeof value.resolution !== 'string') return undefined;
  return value as unknown as ImageThreadSettings;
}

function archivedThreadFrom(value: unknown): ArchivedImageThread | undefined {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id) return undefined;
  const settings = threadSettingsFrom(value.settings);
  if (!settings || !isTurnList(value.turns) || !value.turns.length) return undefined;
  return { id: value.id, settings: { ...settings, resolution: settings.resolution ?? 'auto' }, turns: value.turns };
}

export interface RestoredImageState {
  /** The fields safe to restore; anything else is left out. */
  state: Partial<ImageGenerationPersistence>;
  /** A saved thread that couldn't be restored: release it on the host. */
  unrestoredThreadId?: string;
}

export function restoredImageState(saved: unknown): RestoredImageState {
  if (!isObject(saved)) return { state: {} };
  const state: Partial<ImageGenerationPersistence> = {
    prompt: optionalString(saved.prompt),
    model: optionalString(saved.model),
    aspectRatio: optionalString(saved.aspectRatio) as ImageGenerationPersistence['aspectRatio'] | undefined,
    resolution: optionalString(saved.resolution) as ImageGenerationPersistence['resolution'],
    mode: typeof saved.mode === 'string' && MODES.includes(saved.mode) ? saved.mode as ImageGenerationPersistence['mode'] : undefined,
    archivedThreads: Array.isArray(saved.archivedThreads)
      ? saved.archivedThreads.map(archivedThreadFrom).filter((thread): thread is ArchivedImageThread => !!thread)
      : [],
  };
  // Drop keys left undefined, so `??` defaults in the hook apply as before.
  for (const key of Object.keys(state) as (keyof typeof state)[]) {
    if (state[key] === undefined) delete state[key];
  }

  const conversationId = optionalString(saved.conversationId) || null;
  const history = saved.conversationHistory ?? [];
  if (!isTurnList(history)) {
    return { state: { ...state, conversationId: null, conversationHistory: [], generatedImages: [] },
      ...(conversationId ? { unrestoredThreadId: conversationId } : {}) };
  }
  // Settings with an unknown mode (or malformed) keep only what the
  // pre-modes migration reads, so the thread opens as Single Shot.
  const savedSettings = saved.threadSettings;
  const threadSettings: Partial<ImageThreadSettings> | null = threadSettingsFrom(savedSettings) ?? (isObject(savedSettings)
    ? { model: optionalString(savedSettings.model), aspectRatio: optionalString(savedSettings.aspectRatio) as ImageThreadSettings['aspectRatio'] | undefined }
    : null);
  return {
    state: {
      ...state,
      conversationId,
      conversationHistory: history,
      generatedImages: Array.isArray(saved.generatedImages) && saved.generatedImages.every(isRenderableImage)
        ? saved.generatedImages : [],
      // ImageGenerationPersistence documents settings saved without a mode.
      threadSettings: threadSettings as ImageThreadSettings | null,
      recoveryWarning: optionalString(saved.recoveryWarning),
    },
  };
}
