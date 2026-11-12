/**
 * The resolved output folder is checked against the workspace folder after
 * joining, independently of the setting validation.
 */
import * as vscode from 'vscode';
import { workspaceOutputDirectory } from '../../../application/handlers/outputDirectory';

const root = { fsPath: '/w', path: '/w' } as vscode.Uri;
const joinPath = vscode.Uri.joinPath as unknown as jest.Mock;

describe('workspaceOutputDirectory', () => {
  it('resolves the setting under the workspace folder', () => {
    expect(workspaceOutputDirectory(root, 'assets/generated').path).toBe('/w/assets/generated');
    expect(workspaceOutputDirectory(root, '')).toBe(root);
  });

  it('refuses a result outside the workspace, whatever joining returned', () => {
    joinPath.mockReturnValueOnce({ fsPath: '/elsewhere', path: '/elsewhere' });
    expect(() => workspaceOutputDirectory(root, 'pixel-minion')).toThrow('resolves outside the workspace');

    joinPath.mockReturnValueOnce({ fsPath: '/w/../x', path: '/w/../x' });
    expect(() => workspaceOutputDirectory(root, 'pixel-minion')).toThrow('resolves outside the workspace');
  });

  it('refuses a setting that is not a folder inside the workspace before joining', () => {
    joinPath.mockClear();
    expect(() => workspaceOutputDirectory(root, '../outside')).toThrow('must be a folder inside the workspace');
    expect(joinPath).not.toHaveBeenCalled();
  });
});
