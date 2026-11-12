// Ported from frame-minion@40e7949 packages/core/src/presentation/webview/hooks/domain/imageHistoryPersistence.ts; keep in sync
/**
 * Bounds what the Image tab saves through `vscode.setState`, without touching
 * the live session: every generated image stays on screen, but the saved
 * snapshot keeps at most MAX_IMAGE_HISTORY_STORAGE_BYTES (measured as
 * conservative UTF-16 bytes, base64 expansion included). Older images go
 * first; prompts, turn counts and thread identity always survive, so a
 * Conversation can still recover its host transcript after a reload.
 *
 * Pixel deltas from Frame: no desktop budget override (Pixel is VS Code only,
 * so the 48 MiB extension default always applies), and no earlier-thread
 * archives yet (roadmap P4 adds them, with Frame's five-archive cap).
 *
 * Warnings describe the snapshot they come with and nothing else (a Pixel
 * fix, to flag upstream): `boundedImageHistory` never carries a warning it is
 * given (one read back from an earlier snapshot would otherwise stick
 * forever), and the shortened-draft note is its own field, `draftWarning`,
 * so it can't be appended to the history warning again on every keystroke.
 * The hook never restores either; it recomputes them from live state.
 */
import type { ConversationTurn } from '@messages';
import type { ImageGenerationPersistence } from './useImageGeneration';

// Count conservative UTF-16 bytes, including base64 expansion.
export const MAX_IMAGE_HISTORY_STORAGE_BYTES = 48 * 1024 * 1024;
export const IMAGE_HISTORY_DRAFT_RESERVE_BYTES = 64 * 1024;
type ImageHistoryDraft = Pick<ImageGenerationPersistence, 'model' | 'aspectRatio' | 'resolution' | 'prompt'>;

/** This snapshot leaves out image data the live session still shows. */
export const IMAGE_HISTORY_STORAGE_WARNING = 'Local history keeps a limited amount of image data. Some images will not survive reload. Save images you want to keep.';
/** The restored thread has turns an earlier snapshot saved without their previews (`imagesOmitted`). */
export const IMAGE_HISTORY_RESTORED_WARNING = 'Some image previews from an earlier session were not kept in local history. Use your saved image files.';
/** This snapshot holds a shortened copy of the draft controls. */
export const IMAGE_HISTORY_DRAFT_WARNING = 'The saved draft was shortened to fit local storage. The full draft remains available until reload.';

/** Merge cheap controls without serializing the memoized image payload again. */
export function mergeImageHistoryDraft(history: ImageGenerationPersistence, draft: ImageHistoryDraft): ImageGenerationPersistence {
  if (JSON.stringify(draft).length * 2 <= IMAGE_HISTORY_DRAFT_RESERVE_BYTES) return { ...history, ...draft };
  // Even JSON-escaped control characters fit the reserve at these lengths.
  return {
    ...history, ...draft,
    model: draft.model.slice(0, 1024), prompt: draft.prompt.slice(0, 4096),
    draftWarning: IMAGE_HISTORY_DRAFT_WARNING,
  };
}

/** Bound the saved snapshot without removing images from the live session. */
export function boundedImageHistory(state: ImageGenerationPersistence, budgetBytes = MAX_IMAGE_HISTORY_STORAGE_BYTES): ImageGenerationPersistence {
  const snapshot: ImageGenerationPersistence = {
    ...state,
    // Only this bounding decides what this snapshot warns about.
    persistenceWarning: undefined,
    draftWarning: undefined,
    // The latest images already occur in conversationHistory; do not store twice.
    generatedImages: state.conversationHistory.length ? [] : state.generatedImages,
    conversationHistory: [...state.conversationHistory],
  };
  let size = JSON.stringify(snapshot).length * 2;
  if (size <= budgetBytes) return snapshot;
  snapshot.persistenceWarning = IMAGE_HISTORY_STORAGE_WARNING;
  size = JSON.stringify(snapshot).length * 2;
  // Old images go first. Preserve turn counts and prompts so Conversation can
  // still recover its opaque host transcript.
  const turns = snapshot.conversationHistory;
  for (let index = 0; index < turns.length; index++) {
    if (turns[index].images.length) {
      const oldSize = JSON.stringify(turns[index]).length * 2;
      turns[index] = { ...turns[index], images: [], imagesOmitted: true } satisfies ConversationTurn;
      size += JSON.stringify(turns[index]).length * 2 - oldSize;
    }
    if (size <= budgetBytes) return snapshot;
  }
  snapshot.generatedImages = [];
  if (JSON.stringify(snapshot).length * 2 <= budgetBytes) return snapshot;
  // Pathological text/SVG histories can also exceed the storage budget. Never
  // let that prevent unrelated settings from persisting or pretend it recovered.
  return {
    model: state.model.slice(0, 1024), aspectRatio: state.aspectRatio,
    resolution: state.resolution, prompt: state.prompt.slice(0, 8192),
    threadSettings: null, conversationId: null,
    conversationHistory: [], generatedImages: [], persistenceWarning: IMAGE_HISTORY_STORAGE_WARNING,
  };
}
