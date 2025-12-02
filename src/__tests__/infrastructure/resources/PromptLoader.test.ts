/**
 * PromptLoader tests
 *
 * Tests system prompt loading from resources
 */
import { PromptLoader } from '../../../infrastructure/resources/PromptLoader';
import * as vscode from 'vscode';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('PromptLoader', () => {
  let mockExtensionUri: vscode.Uri;
  let loader: PromptLoader;

  beforeEach(() => {
    jest.clearAllMocks();

    mockExtensionUri = {
      fsPath: '/extension/path',
      path: '/extension/path',
    } as vscode.Uri;

    loader = new PromptLoader(mockExtensionUri, mockLogger as never);

    // Mock Uri.joinPath
    (vscode.Uri.joinPath as jest.Mock).mockImplementation(
      (base: vscode.Uri, ...segments: string[]) => ({
        fsPath: [base.fsPath, ...segments].join('/'),
        path: [base.path, ...segments].join('/'),
      })
    );
  });

  describe('loadPrompt', () => {
    it('should load a prompt file successfully', async () => {
      const mockContent = 'You are a helpful assistant.';
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(mockContent)
      );

      const result = await loader.loadPrompt('assistant.md');

      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
        mockExtensionUri,
        'resources',
        'system-prompts',
        'assistant.md'
      );
      expect(result).toBe(mockContent);
    });

    it('should handle nested paths', async () => {
      const mockContent = 'Nested prompt content';
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(mockContent)
      );

      await loader.loadPrompt('category/specific.md');

      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
        mockExtensionUri,
        'resources',
        'system-prompts',
        'category/specific.md'
      );
    });

    it('should throw on file read error and log error', async () => {
      const fileError = new Error('File not found');
      (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(fileError);

      await expect(loader.loadPrompt('missing.md')).rejects.toThrow(
        'Failed to load prompt: missing.md'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load prompt: missing.md',
        fileError
      );
    });

    it('should handle UTF-8 content correctly', async () => {
      const unicodeContent = 'Prompt with émojis 🚀 and ünïcödé';
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(unicodeContent, 'utf-8')
      );

      const result = await loader.loadPrompt('unicode.md');

      expect(result).toBe(unicodeContent);
    });
  });

  describe('loadPrompts', () => {
    it('should load and concatenate multiple prompts', async () => {
      (vscode.workspace.fs.readFile as jest.Mock)
        .mockResolvedValueOnce(Buffer.from('Prompt 1'))
        .mockResolvedValueOnce(Buffer.from('Prompt 2'))
        .mockResolvedValueOnce(Buffer.from('Prompt 3'));

      const result = await loader.loadPrompts([
        'first.md',
        'second.md',
        'third.md',
      ]);

      expect(result).toBe('Prompt 1\n\n---\n\nPrompt 2\n\n---\n\nPrompt 3');
    });

    it('should use custom separator', async () => {
      (vscode.workspace.fs.readFile as jest.Mock)
        .mockResolvedValueOnce(Buffer.from('Part A'))
        .mockResolvedValueOnce(Buffer.from('Part B'));

      const result = await loader.loadPrompts(['a.md', 'b.md'], '\n\n');

      expect(result).toBe('Part A\n\nPart B');
    });

    it('should return single prompt without separator', async () => {
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from('Only prompt')
      );

      const result = await loader.loadPrompts(['single.md']);

      expect(result).toBe('Only prompt');
    });

    it('should throw if any prompt fails to load', async () => {
      (vscode.workspace.fs.readFile as jest.Mock)
        .mockResolvedValueOnce(Buffer.from('Good prompt'))
        .mockRejectedValueOnce(new Error('File not found'));

      await expect(
        loader.loadPrompts(['good.md', 'bad.md'])
      ).rejects.toThrow('Failed to load prompt: bad.md');
    });

    it('should load prompts in parallel', async () => {
      const startTime = Date.now();

      (vscode.workspace.fs.readFile as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(Buffer.from('content')), 10)
          )
      );

      await loader.loadPrompts(['a.md', 'b.md', 'c.md']);

      const elapsed = Date.now() - startTime;
      // Should take ~10ms (parallel) not ~30ms (sequential)
      expect(elapsed).toBeLessThan(25);
    });
  });

  describe('promptExists', () => {
    it('should return true when prompt exists', async () => {
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
        type: 1, // FileType.File
      });

      const result = await loader.promptExists('existing.md');

      expect(result).toBe(true);
    });

    it('should return false when prompt does not exist', async () => {
      (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(
        new Error('File not found')
      );

      const result = await loader.promptExists('missing.md');

      expect(result).toBe(false);
    });

    it('should check correct path', async () => {
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({});

      await loader.promptExists('check.md');

      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
        mockExtensionUri,
        'resources',
        'system-prompts',
        'check.md'
      );
    });
  });

  describe('load (category/name API)', () => {
    it('should load a prompt by category and name', async () => {
      const mockContent = 'SVG generation prompt';
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(mockContent)
      );

      const result = await loader.load('svg', 'generation');

      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
        mockExtensionUri,
        'resources',
        'system-prompts',
        'svg/generation.md'
      );
      expect(result).toBe(mockContent);
    });

    it('should cache prompt after first load', async () => {
      const mockContent = 'Cached prompt';
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(mockContent)
      );

      // First load - should hit file system
      const result1 = await loader.load('svg', 'generation');
      expect(vscode.workspace.fs.readFile).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PromptLoader: Loaded and cached svg/generation'
      );

      // Second load - should hit cache
      const result2 = await loader.load('svg', 'generation');
      expect(vscode.workspace.fs.readFile).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PromptLoader: Cache hit for svg/generation'
      );
      expect(result1).toBe(result2);
    });

    it('should throw error with proper message when prompt not found', async () => {
      (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(
        new Error('File not found')
      );

      await expect(loader.load('missing', 'prompt')).rejects.toThrow(
        'System prompt not found: missing/prompt'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'PromptLoader: Failed to load prompt missing/prompt',
        expect.any(Error)
      );
    });

    it('should handle nested categories correctly', async () => {
      const mockContent = 'Blueprint analysis prompt';
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(mockContent)
      );

      await loader.load('svg-architect', 'blueprint-analysis');

      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
        mockExtensionUri,
        'resources',
        'system-prompts',
        'svg-architect/blueprint-analysis.md'
      );
    });
  });

  describe('exists (category/name API)', () => {
    it('should return true when prompt exists', async () => {
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
        type: 1, // FileType.File
      });

      const result = await loader.exists('svg', 'generation');

      expect(result).toBe(true);
      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
        mockExtensionUri,
        'resources',
        'system-prompts',
        'svg/generation.md'
      );
    });

    it('should return false when prompt does not exist', async () => {
      (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(
        new Error('File not found')
      );

      const result = await loader.exists('missing', 'prompt');

      expect(result).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      const mockContent = 'Cached content';
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(mockContent)
      );

      // Load and cache
      await loader.load('svg', 'generation');
      expect(vscode.workspace.fs.readFile).toHaveBeenCalledTimes(1);

      // Verify cache hit
      await loader.load('svg', 'generation');
      expect(vscode.workspace.fs.readFile).toHaveBeenCalledTimes(1);

      // Clear cache
      loader.clearCache();
      expect(mockLogger.debug).toHaveBeenCalledWith('PromptLoader: Cache cleared');

      // Load again - should hit file system again
      await loader.load('svg', 'generation');
      expect(vscode.workspace.fs.readFile).toHaveBeenCalledTimes(2);
    });
  });
});
