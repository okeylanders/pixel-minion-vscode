/**
 * PromptLoader - Loads system prompts from the resources folder
 *
 * Pattern: Follows example-repo/src/tools/shared/prompts.ts
 * Prompts are stored as markdown files in resources/system-prompts/
 */
import * as vscode from 'vscode';
import { LoggingService } from '@logging';

export class PromptLoader {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly logger: LoggingService
  ) {}

  /**
   * Load a single prompt file
   * @param promptPath - Relative path within resources/system-prompts/
   */
  async loadPrompt(promptPath: string): Promise<string> {
    const fullPath = vscode.Uri.joinPath(
      this.extensionUri,
      'resources',
      'system-prompts',
      promptPath
    );

    try {
      const content = await vscode.workspace.fs.readFile(fullPath);
      return Buffer.from(content).toString('utf-8');
    } catch (error) {
      this.logger.error(`Failed to load prompt: ${promptPath}`, error);
      throw new Error(`Failed to load prompt: ${promptPath}`);
    }
  }

  /**
   * Load multiple prompts and concatenate them
   * @param promptPaths - Array of relative paths
   * @param separator - Separator between prompts (default: double newline with divider)
   */
  async loadPrompts(
    promptPaths: string[],
    separator: string = '\n\n---\n\n'
  ): Promise<string> {
    const prompts = await Promise.all(
      promptPaths.map((path) => this.loadPrompt(path))
    );
    return prompts.join(separator);
  }

  /**
   * Check if a prompt file exists
   */
  async promptExists(promptPath: string): Promise<boolean> {
    const fullPath = vscode.Uri.joinPath(
      this.extensionUri,
      'resources',
      'system-prompts',
      promptPath
    );

    try {
      await vscode.workspace.fs.stat(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
