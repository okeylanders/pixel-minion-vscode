/**
 * PromptLoader - Centralized system prompt management
 *
 * Loads system prompts from resources/system-prompts/ directory.
 * Provides caching to avoid repeated file reads.
 *
 * Pattern: Follows example-repo/src/tools/shared/prompts.ts
 * Prompts are stored as markdown files in resources/system-prompts/
 */
import * as vscode from 'vscode';
import { LoggingService } from '@logging';

export class PromptLoader {
  private readonly cache: Map<string, string> = new Map();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly logger: LoggingService
  ) {}

  /**
   * Load a prompt by category and name
   * @param category The prompt category (e.g., 'svg', 'image', 'svg-architect')
   * @param name The prompt name without extension (e.g., 'generation', 'enhance')
   * @returns The prompt content
   * @throws Error if prompt file not found
   */
  async load(category: string, name: string): Promise<string> {
    const cacheKey = `${category}/${name}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      this.logger.debug(`PromptLoader: Cache hit for ${cacheKey}`);
      return this.cache.get(cacheKey)!;
    }

    // Load from file using loadPrompt (for consistency)
    const promptPath = `${category}/${name}.md`;
    try {
      const content = await this.loadPrompt(promptPath);

      // Cache the result
      this.cache.set(cacheKey, content);
      this.logger.debug(`PromptLoader: Loaded and cached ${cacheKey}`);

      return content;
    } catch (error) {
      this.logger.error(`PromptLoader: Failed to load prompt ${cacheKey}`, error);
      throw new Error(`System prompt not found: ${category}/${name}`);
    }
  }

  /**
   * Load a single prompt file (legacy API - kept for compatibility)
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
   * Check if a prompt exists by category and name
   */
  async exists(category: string, name: string): Promise<boolean> {
    const promptPath = `${category}/${name}.md`;
    return this.promptExists(promptPath);
  }

  /**
   * Check if a prompt file exists (legacy API - kept for compatibility)
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

  /**
   * Clear the prompt cache (useful for development/testing)
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('PromptLoader: Cache cleared');
  }
}
