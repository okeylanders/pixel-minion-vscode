// Ported from frame-minion@40e7949 packages/core/src/infrastructure/ai/orchestration/ImageConversationStore.ts; keep in sync
/**
 * Host-owned transcripts for Conversation threads, so a conversation can
 * continue after the extension host restarts. The webview's display history
 * can't rebuild one: it never sees the provider's opaque assistant messages
 * (Gemini thought signatures, reasoning details), and replaying a
 * conversation without them is rejected or degrades.
 *
 * Records live under `<workspace storage>/image-conversations/` (an empty
 * window uses one folder under global storage instead; see
 * `workspaceStorageRoot`), one JSON file per `img-…` thread, at most 64 MiB
 * each. Every write
 * replaces a file whole (a temp file renamed over it), so a crash mid-write
 * leaves the previous record. Clearing a thread overwrites its record with a
 * tombstone, and a write never replaces a tombstone, so a cleared thread
 * can't come back. Clearing a thread with no record writes nothing. A turn
 * that takes the transcript past the limit retires it with a `too-large`
 * tombstone: the old record would otherwise resume a stale thread after a
 * restart. Missing, oversized, corrupt or mismatched records produce an
 * explicit error, never a silent rebuild.
 *
 * Pixel delta: the store writes through `GlobalStorage` (relative paths under
 * the workspace's storage folder) instead of Frame's `FileSystem` +
 * `Workspace` ports. Frame scopes records by a hash of the open folders,
 * which changes when a folder is added, removed or reordered; VS Code's
 * per-workspace storage folder doesn't.
 */
import type { GlobalStorage } from '../../storage/GlobalStorage';
import type { ImageConversationState } from './ImageConversationManager';

export interface ImageConversationStore {
  read(id: string): Promise<ImageConversationState | undefined>;
  write(state: ImageConversationState): Promise<void>;
  clear(id: string): Promise<void>;
}

export function isImageConversationId(id: string): boolean {
  return /^img-[a-zA-Z0-9-]{1,100}$/.test(id);
}

/** Product bound per thread (each turn rewrites the whole transcript, image bytes included). */
export const MAX_IMAGE_TRANSCRIPT_BYTES = 64 * 1024 * 1024;

const INVALID_TRANSCRIPT = 'Saved image conversation is invalid. Start a new conversation from an image.';
const CLEARED = 'This image conversation was cleared; its transcript is not saved again.';
const TOMBSTONE = Buffer.from(JSON.stringify({ version: 1, deleted: true }), 'utf8');
const TOO_LARGE_TOMBSTONE = Buffer.from(JSON.stringify({ version: 1, deleted: true, reason: 'too-large' }), 'utf8');
/** A live record is far larger than this; only files this small are read to look for a tombstone. */
const TOMBSTONE_MAX_BYTES = 256;

/**
 * The transcript is (or would be) over the recovery limit, so a restart can't
 * resume this conversation. The message is the guidance shown after a restart.
 */
export class ImageTranscriptTooLargeError extends Error {
  constructor() {
    super('This conversation is too large to recover after a restart. Start a new conversation from an image.');
    this.name = 'ImageTranscriptTooLargeError';
  }
}

/** Host-owned transcripts. Opaque signatures never travel through display history. */
export class FileImageConversationStore implements ImageConversationStore {
  private readonly directory = 'image-conversations';

  /**
   * @param storage This workspace's storage folder, so another workspace
   *   can't read these records.
   * @param maxBytes The recovery limit per thread (tests lower it).
   */
  constructor(
    private readonly storage: GlobalStorage,
    private readonly maxBytes = MAX_IMAGE_TRANSCRIPT_BYTES
  ) {}

  private file(id: string): string {
    if (!isImageConversationId(id)) throw new Error('Invalid image conversation identifier');
    return `${this.directory}/${id}.json`;
  }

  async read(id: string): Promise<ImageConversationState | undefined> {
    const file = this.file(id);
    const size = await this.storage.size(file);
    if (size === undefined) return undefined;
    if (size > this.maxBytes) throw new ImageTranscriptTooLargeError();
    const bytes = await this.storage.read(file);
    if (bytes.byteLength > this.maxBytes) throw new ImageTranscriptTooLargeError();
    let saved;
    try { saved = JSON.parse(Buffer.from(bytes).toString('utf8')); }
    catch { throw new Error(INVALID_TRANSCRIPT); }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error(INVALID_TRANSCRIPT);
    if (saved.deleted === true) {
      if (saved.reason === 'too-large') throw new ImageTranscriptTooLargeError();
      return undefined;
    }
    const state = saved.state as ImageConversationState | undefined;
    if (saved.version !== 1 || state?.id !== id || state.mode !== 'conversation' ||
        typeof state.model !== 'string' || typeof state.aspectRatio !== 'string' ||
        !Number.isInteger(state.turnNumber) || state.turnNumber < 1 || !Array.isArray(state.messages) ||
        !state.messages.every(message => message && (message.role === 'user' || message.role === 'assistant')) ||
        !Array.isArray(state.lastImages) || !state.lastImages.every(image => typeof image === 'string')) {
      throw new Error(INVALID_TRANSCRIPT);
    }
    return state;
  }

  /**
   * @throws ImageTranscriptTooLargeError when the transcript is over the
   *   limit; the thread is then retired, since the previous record is stale.
   */
  async write(state: ImageConversationState): Promise<void> {
    const file = this.file(state.id);
    // A late write must not bring a cleared thread back, and a transcript
    // only grows, so one retired as too large stays retired.
    const stored = await this.stored(file);
    if (stored === 'cleared') throw new Error(CLEARED);
    if (stored === 'too-large') throw new ImageTranscriptTooLargeError();
    const bytes = Buffer.from(JSON.stringify({ version: 1, state }), 'utf8');
    if (bytes.byteLength > this.maxBytes) {
      await this.replace(file, TOO_LARGE_TOMBSTONE);
      throw new ImageTranscriptTooLargeError();
    }
    await this.replace(file, bytes);
  }

  async clear(id: string): Promise<void> {
    const file = this.file(id);
    // Only a record needs retiring: with nothing stored there is nothing a
    // restarted host could resume, and a tombstone is already final.
    if (await this.stored(file) !== 'record') return;
    await this.replace(file, TOMBSTONE);
  }

  /**
   * Replace the file whole: write a sibling, then rename it over the file. A
   * crash during the write leaves the previous file (and at worst a stale
   * `.tmp` that the next write replaces).
   */
  private async replace(file: string, bytes: Uint8Array): Promise<void> {
    const temp = `${file}.tmp`;
    await this.storage.write(temp, bytes);
    await this.storage.rename(temp, file);
  }

  /** What the thread's file holds. A small file that isn't a tombstone counts as a record. */
  private async stored(file: string): Promise<'none' | 'record' | 'cleared' | 'too-large'> {
    const size = await this.storage.size(file);
    if (size === undefined) return 'none';
    if (size > TOMBSTONE_MAX_BYTES) return 'record';
    try {
      const saved = JSON.parse(Buffer.from(await this.storage.read(file)).toString('utf8'));
      if (!saved || typeof saved !== 'object' || saved.deleted !== true) return 'record';
      return saved.reason === 'too-large' ? 'too-large' : 'cleared';
    } catch {
      return 'record';
    }
  }
}
