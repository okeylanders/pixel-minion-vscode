// Ported from frame-minion@40e7949 packages/core/src/infrastructure/ai/orchestration/ImageConversationStore.ts; keep in sync
/**
 * Host-owned transcripts for Conversation threads, so a conversation can
 * continue after the extension host restarts. The webview's display history
 * can't rebuild one: it never sees the provider's opaque assistant messages
 * (Gemini thought signatures, reasoning details), and replaying a
 * conversation without them is rejected or degrades.
 *
 * Records live under `<globalStorage>/image-conversations/<workspace hash>/`,
 * one JSON file per `img-…` thread, at most 64 MiB each. Clearing a thread
 * overwrites its record with a tombstone. Missing, oversized, corrupt or
 * mismatched records produce an explicit error, never a silent rebuild.
 *
 * Pixel delta: the store writes through `GlobalStorage` (relative paths under
 * `context.globalStorageUri`) instead of Frame's `FileSystem` + `Workspace`
 * ports, and takes the workspace folder URIs that scope it directly.
 */
import { createHash } from 'crypto';
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
const TOO_LARGE = 'Image transcript exceeds the recovery size limit';

/** Host-owned transcripts. Opaque signatures never travel through display history. */
export class FileImageConversationStore implements ImageConversationStore {
  private readonly maxBytes = MAX_IMAGE_TRANSCRIPT_BYTES;
  private readonly directory: string;

  /**
   * @param workspaceFolders URIs of the open workspace folders; a different
   *   workspace gets a different directory, so it can't read these records.
   */
  constructor(private readonly storage: GlobalStorage, workspaceFolders: readonly string[]) {
    const scope = createHash('sha256').update(JSON.stringify(workspaceFolders)).digest('hex');
    this.directory = `image-conversations/${scope}`;
  }

  private file(id: string): string {
    if (!isImageConversationId(id)) throw new Error('Invalid image conversation identifier');
    return `${this.directory}/${id}.json`;
  }

  async read(id: string): Promise<ImageConversationState | undefined> {
    const file = this.file(id);
    const size = await this.storage.size(file);
    if (size === undefined) return undefined;
    if (size > this.maxBytes) throw new Error(TOO_LARGE);
    const bytes = await this.storage.read(file);
    if (bytes.byteLength > this.maxBytes) throw new Error(TOO_LARGE);
    let saved;
    try { saved = JSON.parse(Buffer.from(bytes).toString('utf8')); }
    catch { throw new Error(INVALID_TRANSCRIPT); }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error(INVALID_TRANSCRIPT);
    if (saved.deleted === true) return undefined;
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

  async write(state: ImageConversationState): Promise<void> {
    const bytes = Buffer.from(JSON.stringify({ version: 1, state }), 'utf8');
    if (bytes.byteLength > this.maxBytes) throw new Error(TOO_LARGE);
    await this.storage.write(this.file(state.id), bytes);
  }

  async clear(id: string): Promise<void> {
    await this.storage.write(this.file(id), Buffer.from(JSON.stringify({ version: 1, deleted: true })));
  }
}
