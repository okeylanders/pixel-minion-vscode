/**
 * GlobalStorage - the slice of a file system the host-owned stores need.
 *
 * Pixel has no platform ports (Frame has `FileSystem` / `Workspace`); this is
 * the smallest seam that keeps a store testable without VS Code. Paths are
 * relative to the storage folder the adapter was built on (see
 * `workspaceStorageRoot`) and '/'-separated; the store decides them, never
 * the webview.
 */
import * as vscode from 'vscode';

export interface GlobalStorage {
  /** Size in bytes, or undefined when nothing is stored at the path. */
  size(path: string): Promise<number | undefined>;
  read(path: string): Promise<Uint8Array>;
  /** Writes the file, creating missing parent folders first. */
  write(path: string, bytes: Uint8Array): Promise<void>;
  /**
   * Moves a file onto another path, replacing what is there. Callers replace
   * a file whole by writing a sibling and renaming it over the original, so
   * a crash mid-write leaves the previous file intact (VS Code's disk
   * provider renames a file over a file with Node's `fs.rename`).
   */
  rename(from: string, to: string): Promise<void>;
}

/** A missing file, as `vscode.workspace.fs` (or Node, under it) reports it. */
function isNotFound(error: unknown): boolean {
  const { code, name } = (error ?? {}) as { code?: unknown; name?: unknown };
  return code === 'FileNotFound' || code === 'ENOENT' || name === 'EntryNotFound (FileSystemError)';
}

/**
 * Where workspace-scoped host data lives: VS Code's storage folder for this
 * workspace (`context.storageUri`, stable when folders are added, removed or
 * reordered), or, in a window with no workspace, one fixed folder under
 * global storage shared by every empty window. VS Code doesn't create either
 * folder; the first write does.
 */
export function workspaceStorageRoot(context: Pick<vscode.ExtensionContext, 'storageUri' | 'globalStorageUri'>): vscode.Uri {
  return context.storageUri ?? vscode.Uri.joinPath(context.globalStorageUri, 'empty-window');
}

/**
 * A storage folder (see `workspaceStorageRoot`) through `vscode.workspace.fs`,
 * which works for any URI scheme (remote and web hosts included), unlike
 * Node's `fs`. A write creates the whole folder chain, the root included.
 */
export class VsCodeGlobalStorage implements GlobalStorage {
  constructor(private readonly root: vscode.Uri) {}

  private uri(path: string): vscode.Uri {
    return vscode.Uri.joinPath(this.root, ...path.split('/'));
  }

  async size(path: string): Promise<number | undefined> {
    try {
      return (await vscode.workspace.fs.stat(this.uri(path))).size;
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  async read(path: string): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(this.uri(path));
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    const segments = path.split('/');
    // workspace.fs.writeFile fails when the parent folder is missing;
    // createDirectory makes the whole chain (mkdir -p).
    if (segments.length > 1) {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(this.root, ...segments.slice(0, -1)));
    }
    await vscode.workspace.fs.writeFile(this.uri(path), bytes);
  }

  async rename(from: string, to: string): Promise<void> {
    await vscode.workspace.fs.rename(this.uri(from), this.uri(to), { overwrite: true });
  }
}
