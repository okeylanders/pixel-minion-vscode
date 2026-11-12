/**
 * Where the save handlers write when a workspace is open: the configured
 * output folder, which must resolve inside the first workspace folder.
 */
import * as path from 'path';
import * as vscode from 'vscode';
import { outputDirectorySegments } from './saveFileName';

export function workspaceOutputDirectory(workspaceRoot: vscode.Uri, setting: string | undefined): vscode.Uri {
  const segments = outputDirectorySegments(setting);
  const directory = segments.length > 0 ? vscode.Uri.joinPath(workspaceRoot, ...segments) : workspaceRoot;
  // The segments are already plain folder names; this is the proof, against
  // whatever joining did, that the result is still inside the workspace.
  const relative = path.posix.relative(workspaceRoot.path, directory.path);
  if (relative === '..' || relative.startsWith('../') || path.posix.isAbsolute(relative)) {
    throw new Error("Can't save: the output folder resolves outside the workspace.");
  }
  return directory;
}
