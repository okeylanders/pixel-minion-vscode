/**
 * FileToolProvider - Tools for file operations
 *
 * Example implementation showing the ToolProvider pattern.
 * Provides basic file listing and reading capabilities.
 */
import * as vscode from 'vscode';
import { ToolProvider, ToolDefinition, ToolExecutionResult } from './ToolProvider';

export class FileToolProvider implements ToolProvider {
  getName(): string {
    return 'file-tools';
  }

  listAvailableTools(): ToolDefinition[] {
    return [
      {
        name: 'list_files',
        description: 'List files in the workspace matching a glob pattern',
        parameters: {
          pattern: {
            type: 'string',
            description: 'Glob pattern to match files (e.g., "**/*.ts")',
            required: true,
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results to return',
            required: false,
          },
        },
      },
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        parameters: {
          path: {
            type: 'string',
            description: 'Path to the file to read',
            required: true,
          },
        },
      },
      {
        name: 'get_workspace_info',
        description: 'Get information about the current workspace',
        parameters: {},
      },
    ];
  }

  hasTool(name: string): boolean {
    return ['list_files', 'read_file', 'get_workspace_info'].includes(name);
  }

  async executeTool(name: string, params: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      switch (name) {
        case 'list_files':
          return await this.listFiles(params);
        case 'read_file':
          return await this.readFile(params);
        case 'get_workspace_info':
          return await this.getWorkspaceInfo();
        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async listFiles(params: Record<string, unknown>): Promise<ToolExecutionResult> {
    const pattern = params.pattern as string;
    const maxResults = (params.maxResults as number) ?? 100;

    if (!pattern) {
      return { success: false, error: 'Pattern parameter is required' };
    }

    const files = await vscode.workspace.findFiles(pattern, undefined, maxResults);
    const paths = files.map(f => vscode.workspace.asRelativePath(f));

    return {
      success: true,
      result: {
        files: paths,
        count: paths.length,
        truncated: paths.length >= maxResults,
      },
    };
  }

  private async readFile(params: Record<string, unknown>): Promise<ToolExecutionResult> {
    const path = params.path as string;

    if (!path) {
      return { success: false, error: 'Path parameter is required' };
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return { success: false, error: 'No workspace folder open' };
    }

    const uri = vscode.Uri.joinPath(workspaceFolder.uri, path);

    try {
      const content = await vscode.workspace.fs.readFile(uri);
      const text = new TextDecoder().decode(content);

      return {
        success: true,
        result: {
          path,
          content: text,
          length: text.length,
        },
      };
    } catch {
      return { success: false, error: `Failed to read file: ${path}` };
    }
  }

  private async getWorkspaceInfo(): Promise<ToolExecutionResult> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];

    return {
      success: true,
      result: {
        folders: workspaceFolders.map(f => ({
          name: f.name,
          path: f.uri.fsPath,
        })),
        name: vscode.workspace.name,
      },
    };
  }
}
