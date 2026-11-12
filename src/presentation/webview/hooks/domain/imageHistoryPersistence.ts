// Ported from frame-minion@40e7949 packages/core/src/presentation/webview/hooks/domain/imageHistoryPersistence.ts; keep in sync
/**
 * Bounds what the Image tab saves through `vscode.setState`, without touching
 * the live session: every generated image stays on screen, but the saved
 * snapshot keeps at most MAX_IMAGE_HISTORY_STORAGE_BYTES (measured as
 * conservative UTF-16 bytes, base64 expansion included). Older images go
 * first; prompts, turn counts and thread identity always survive, so a
 * Conversation can still recover its host transcript after a reload.
 *
 * The snapshot keeps at most the newest five Earlier threads, and says so
 * only while it is leaving older ones out.
 *
 * Pixel delta from Frame: no desktop budget override (Pixel is VS Code only,
 * so the 48 MiB extension default always applies).
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

export const MAX_PERSISTED_IMAGE_ARCHIVES = 5;
// Count conservative UTF-16 bytes, including base64 expansion.
export const MAX_IMAGE_HISTORY_STORAGE_BYTES = 48 * 1024 * 1024;
export const IMAGE_HISTORY_DRAFT_RESERVE_BYTES = 64 * 1024;
type ImageHistoryDraft = Pick<ImageGenerationPersistence, 'mode' | 'model' | 'aspectRatio' | 'resolution' | 'prompt'>;

/** This snapshot leaves out image data the live session still shows. */
export const IMAGE_HISTORY_STORAGE_WARNING = 'Local history keeps a limited amount of image data. Some images will not survive reload. Save images you want to keep.';
/** This snapshot leaves out Earlier threads beyond the newest five. */
export const IMAGE_HISTORY_ARCHIVE_WARNING = 'Local history keeps the five newest earlier threads. Older ones will not survive reload. Save images you want to keep.';
/** This snapshot leaves out both. */
export const IMAGE_HISTORY_ARCHIVE_AND_STORAGE_WARNING = 'Local history keeps the five newest earlier threads and a limited amount of image data. Older threads and some images will not survive reload. Save images you want to keep.';

/** The note for what this snapshot left out, or undefined when it left out nothing. */
function storageWarning(dropped: { archives: boolean; images: boolean }): string | undefined {
  if (dropped.archives && dropped.images) return IMAGE_HISTORY_ARCHIVE_AND_STORAGE_WARNING;
  if (dropped.archives) return IMAGE_HISTORY_ARCHIVE_WARNING;
  return dropped.images ? IMAGE_HISTORY_STORAGE_WARNING : undefined;
}
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
  const archives = state.archivedThreads ?? [];
  const snapshot: ImageGenerationPersistence & Required<Pick<ImageGenerationPersistence, 'archivedThreads'>> = {
    ...state,
    // Only this bounding decides what this snapshot warns about.
    persistenceWarning: undefined,
    draftWarning: undefined,
    // The latest images already occur in conversationHistory; do not store twice.
    generatedImages: state.conversationHistory.length ? [] : state.generatedImages,
    archivedThreads: archives.slice(-MAX_PERSISTED_IMAGE_ARCHIVES).map(thread => ({ ...thread, turns: [...thread.turns] })),
    conversationHistory: [...state.conversationHistory],
  };
  const archivesDropped = snapshot.archivedThreads.length !== archives.length;
  snapshot.persistenceWarning = storageWarning({ archives: archivesDropped, images: false });
  let size = JSON.stringify(snapshot).length * 2;
  if (size <= budgetBytes) return snapshot;
  snapshot.persistenceWarning = storageWarning({ archives: archivesDropped, images: true });
  size = JSON.stringify(snapshot).length * 2;
  // Old archive images go first, then old active images. Preserve turn counts
  // and prompts so Conversation can still recover its opaque host transcript.
  const histories = [...snapshot.archivedThreads.map(thread => thread.turns), snapshot.conversationHistory];
  for (const turns of histories) {
    for (let index = 0; index < turns.length; index++) {
      if (turns[index].images.length) {
        const oldSize = JSON.stringify(turns[index]).length * 2;
        turns[index] = { ...turns[index], images: [], imagesOmitted: true } satisfies ConversationTurn;
        size += JSON.stringify(turns[index]).length * 2 - oldSize;
      }
      if (size <= budgetBytes) return snapshot;
    }
  }
  snapshot.generatedImages = [];
  if (JSON.stringify(snapshot).length * 2 <= budgetBytes) return snapshot;
  // Pathological text/SVG histories can also exceed the storage budget. Never
  // let that prevent unrelated settings from persisting or pretend it recovered.
  return {
    mode: state.mode, model: state.model.slice(0, 1024), aspectRatio: state.aspectRatio,
    resolution: state.resolution, prompt: state.prompt.slice(0, 8192),
    threadSettings: null, conversationId: null, archivedThreads: [],
    conversationHistory: [], generatedImages: [],
    persistenceWarning: storageWarning({ archives: archives.length > 0, images: true }),
  };
}
