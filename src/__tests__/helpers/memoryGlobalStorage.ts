/**
 * An in-memory GlobalStorage for host tests: the files a store writes, with
 * jest spies on every call. A missing file reads like VS Code's
 * `FileSystemError.FileNotFound`, and a rename replaces its target.
 */
import type { GlobalStorage } from '../../infrastructure/storage/GlobalStorage';

export function memoryGlobalStorage() {
  const files = new Map<string, Uint8Array>();
  const storage = {
    size: jest.fn(async (path: string) => files.get(path)?.byteLength),
    read: jest.fn(async (path: string) => {
      const bytes = files.get(path);
      if (!bytes) throw Object.assign(new Error('Missing'), { code: 'FileNotFound' });
      return bytes;
    }),
    write: jest.fn(async (path: string, bytes: Uint8Array) => { files.set(path, bytes); }),
    // Replaces the target, like `workspace.fs.rename(…, { overwrite: true })`.
    rename: jest.fn(async (from: string, to: string) => {
      const bytes = files.get(from);
      if (!bytes) throw Object.assign(new Error('Missing'), { code: 'FileNotFound' });
      files.set(to, bytes);
      files.delete(from);
    }),
  } satisfies GlobalStorage;
  return { files, storage };
}
