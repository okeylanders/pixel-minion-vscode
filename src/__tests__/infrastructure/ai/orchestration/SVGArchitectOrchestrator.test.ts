/**
 * Tests for SVGArchitectOrchestrator
 *
 * Coverage:
 * - Configuration state
 * - Start generation workflow (analyze → blueprint → render)
 * - Continue with PNG validation (validate → refine → render)
 * - Max iterations handling
 * - Acceptance criteria (high confidence)
 * - User intervention flow
 * - Progress callbacks
 * - Token usage accumulation
 */

import {
  SVGArchitectOrchestrator,
  SVGArchitectProgress,
  SVGArchitectResult,
  SVGArchitectInput,
  SVGArchitectOptions,
  OpenRouterDynamicTextClient,
  TextCompletionResult
} from '@ai';
import { PromptLoader } from '@resources';
import { LoggingService } from '@logging';

describe('SVGArchitectOrchestrator', () => {
  let orchestrator: SVGArchitectOrchestrator;
  let mockLogger: jest.Mocked<LoggingService>;
  let mockBlueprintClient: jest.Mocked<OpenRouterDynamicTextClient>;
  let mockRenderClient: jest.Mocked<OpenRouterDynamicTextClient>;
  let mockPromptLoader: jest.Mocked<PromptLoader>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockBlueprintClient = {
      createCompletion: jest.fn(),
      isConfigured: jest.fn().mockResolvedValue(true),
      getModel: jest.fn().mockReturnValue('claude-opus-4'),
      setModel: jest.fn(),
    } as any;

    mockRenderClient = {
      createCompletion: jest.fn(),
      isConfigured: jest.fn().mockResolvedValue(true),
      getModel: jest.fn().mockReturnValue('gpt-5.1'),
      setModel: jest.fn(),
    } as any;

    mockPromptLoader = {
      load: jest.fn().mockResolvedValue('system prompt'),
      exists: jest.fn().mockResolvedValue(true),
      clearCache: jest.fn(),
      getDirectory: jest.fn().mockReturnValue('/prompts'),
    } as any;

    orchestrator = new SVGArchitectOrchestrator(mockLogger);
    orchestrator.setBlueprintClient(mockBlueprintClient);
    orchestrator.setRenderClient(mockRenderClient);
    orchestrator.setPromptLoader(mockPromptLoader);
  });

  describe('configuration', () => {
    it('returns true when fully configured', () => {
      expect(orchestrator.isConfigured()).toBe(true);
    });

    it('returns false without blueprint client', () => {
      const unconfigured = new SVGArchitectOrchestrator(mockLogger);
      unconfigured.setRenderClient(mockRenderClient);
      unconfigured.setPromptLoader(mockPromptLoader);

      expect(unconfigured.isConfigured()).toBe(false);
    });

    it('returns false without render client', () => {
      const unconfigured = new SVGArchitectOrchestrator(mockLogger);
      unconfigured.setBlueprintClient(mockBlueprintClient);
      unconfigured.setPromptLoader(mockPromptLoader);

      expect(unconfigured.isConfigured()).toBe(false);
    });

    it('returns false without prompt loader', () => {
      const unconfigured = new SVGArchitectOrchestrator(mockLogger);
      unconfigured.setBlueprintClient(mockBlueprintClient);
      unconfigured.setRenderClient(mockRenderClient);

      expect(unconfigured.isConfigured()).toBe(false);
    });

    it('logs when clients are configured', () => {
      const fresh = new SVGArchitectOrchestrator(mockLogger);

      fresh.setBlueprintClient(mockBlueprintClient);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SVGArchitectOrchestrator blueprint client configured'
      );

      fresh.setRenderClient(mockRenderClient);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SVGArchitectOrchestrator render client configured'
      );

      fresh.setPromptLoader(mockPromptLoader);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SVGArchitectOrchestrator prompt loader configured'
      );
    });
  });

  describe('startGeneration', () => {
    it('throws if not configured', async () => {
      const unconfigured = new SVGArchitectOrchestrator(mockLogger);

      const input: SVGArchitectInput = { prompt: 'test icon' };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude-opus-4',
        renderModel: 'gpt-5.1',
        aspectRatio: '1:1',
        maxIterations: 5
      };

      await expect(
        unconfigured.startGeneration(input, options, () => {})
      ).rejects.toThrow('not fully configured');
    });

    it('creates conversation and starts analysis', async () => {
      // Mock blueprint analysis response
      mockBlueprintClient.createCompletion.mockResolvedValueOnce({
        content: '### Description\nA test icon\n### Blueprint\n{"shapes": []}\n### Confidence\n80',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      // Mock render response
      mockRenderClient.createCompletion.mockResolvedValueOnce({
        content: '<svg viewBox="0 0 100 100"><rect/></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const progressUpdates: SVGArchitectProgress[] = [];
      const input: SVGArchitectInput = { prompt: 'test icon' };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude-opus-4',
        renderModel: 'gpt-5.1',
        aspectRatio: '1:1',
        maxIterations: 5
      };

      const result = await orchestrator.startGeneration(
        input,
        options,
        (progress) => progressUpdates.push(progress)
      );

      expect(result.conversationId).toBeDefined();
      expect(result.status).toBe('validating');
      expect(result.svgCode).toContain('<svg');
      expect(result.iterations).toBe(1);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].status).toBe('analyzing');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting SVG Architect generation')
      );
    });

    it('sends progress updates through all phases', async () => {
      mockBlueprintClient.createCompletion.mockResolvedValue({
        content: '### Description\nTest\n### Blueprint\n{}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValue({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const progressUpdates: SVGArchitectProgress[] = [];
      const input: SVGArchitectInput = { prompt: 'test' };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1',
        maxIterations: 5
      };

      await orchestrator.startGeneration(
        input,
        options,
        (progress) => progressUpdates.push(progress)
      );

      // Check progress phases
      expect(progressUpdates[0].status).toBe('analyzing');
      expect(progressUpdates[0].message).toContain('Analyzing input');

      expect(progressUpdates[1].status).toBe('rendering');
      expect(progressUpdates[1].message).toContain('Rendering SVG');

      expect(progressUpdates[2].status).toBe('validating');
      expect(progressUpdates[2].message).toContain('Waiting for PNG');
      expect(progressUpdates[2].svgCode).toBeDefined();
    });

    it('includes reference image in blueprint analysis', async () => {
      mockBlueprintClient.createCompletion.mockResolvedValue({
        content: '### Description\nTest\n### Blueprint\n{}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValue({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const input: SVGArchitectInput = {
        prompt: 'test',
        referenceImageBase64: 'image-data'
      };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1',
        maxIterations: 5
      };

      await orchestrator.startGeneration(input, options, () => {});

      // Verify blueprint client was called with image
      const callArgs = mockBlueprintClient.createCompletion.mock.calls[0];
      const userMessage = callArgs[0][1];
      expect(userMessage.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'image_url' })
        ])
      );
    });

    it('includes reference SVG text in blueprint analysis', async () => {
      mockBlueprintClient.createCompletion.mockResolvedValue({
        content: '### Description\nTest\n### Blueprint\n{}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValue({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const input: SVGArchitectInput = {
        prompt: 'test',
        referenceSvgText: '<svg><circle r="10"/></svg>'
      };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1',
        maxIterations: 5
      };

      await orchestrator.startGeneration(input, options, () => {});

      // Verify blueprint client was called with SVG text
      const callArgs = mockBlueprintClient.createCompletion.mock.calls[0];
      const userMessage = callArgs[0][1];
      expect(userMessage.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Reference SVG:')
          })
        ])
      );
    });

    it('accumulates token usage', async () => {
      mockBlueprintClient.createCompletion.mockResolvedValue({
        content: '### Description\nTest\n### Blueprint\n{}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, costUsd: 0.01 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValue({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150, costUsd: 0.015 }
      } as TextCompletionResult);

      const input: SVGArchitectInput = { prompt: 'test' };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1',
        maxIterations: 5
      };

      const result = await orchestrator.startGeneration(input, options, () => {});

      expect(result.totalUsage.totalTokens).toBeGreaterThan(0);
      expect(result.totalUsage.costUsd).toBeGreaterThan(0);
    });

    it('updates status to error on failure', async () => {
      mockBlueprintClient.createCompletion.mockRejectedValue(new Error('API failure'));

      const input: SVGArchitectInput = { prompt: 'test' };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1',
        maxIterations: 5
      };

      await expect(
        orchestrator.startGeneration(input, options, () => {})
      ).rejects.toThrow('API failure');
    });
  });

  describe('continueWithRenderedPng', () => {
    let startResult: SVGArchitectResult;

    beforeEach(async () => {
      // Setup: Start a generation first
      mockBlueprintClient.createCompletion.mockResolvedValue({
        content: '### Description\nTest\n### Blueprint\n{}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValue({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const input: SVGArchitectInput = { prompt: 'test' };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1',
        maxIterations: 5
      };

      startResult = await orchestrator.startGeneration(input, options, () => {});

      // Reset mocks for continue phase
      jest.clearAllMocks();
    });

    it('throws if conversation not found', async () => {
      await expect(
        orchestrator.continueWithRenderedPng('non-existent', 'png-data', () => {})
      ).rejects.toThrow('Conversation non-existent not found');
    });

    it('validates and returns complete when confidence high', async () => {
      // Mock validation response with high confidence
      mockBlueprintClient.createCompletion.mockResolvedValueOnce({
        content: '### Confidence Score\n90\n### Issues Found\nNone\n### Recommendation\nACCEPT',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      const progressUpdates: SVGArchitectProgress[] = [];
      const result = await orchestrator.continueWithRenderedPng(
        startResult.conversationId,
        'mock-png-base64',
        (progress) => progressUpdates.push(progress)
      );

      expect(result.status).toBe('complete');
      expect(result.finalConfidence).toBe(90);
      expect(progressUpdates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: 'validating' }),
          expect.objectContaining({ status: 'complete' })
        ])
      );
    });

    it('continues iterating when confidence low', async () => {
      // Mock validation response with low confidence
      mockBlueprintClient.createCompletion
        .mockResolvedValueOnce({
          content: '### Confidence Score\n50\n### Issues Found\n- Issue 1\n### Blueprint Corrections\n- Fix 1\n### Recommendation\nITERATE',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        } as TextCompletionResult)
        .mockResolvedValueOnce({
          content: '### Blueprint\n{"refined": true}\n',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValueOnce({
        content: '<svg><rect/></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const progressUpdates: SVGArchitectProgress[] = [];
      const result = await orchestrator.continueWithRenderedPng(
        startResult.conversationId,
        'mock-png',
        (progress) => progressUpdates.push(progress)
      );

      expect(result.status).toBe('validating');
      expect(result.iterations).toBe(2);
      expect(progressUpdates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: 'validating' }),
          expect.objectContaining({ status: 'refining' }),
          expect.objectContaining({ status: 'rendering' })
        ])
      );
    });

    it('stops at max iterations', async () => {
      // Setup with max 1 iteration
      mockBlueprintClient.createCompletion.mockResolvedValue({
        content: '### Description\nTest\n### Blueprint\n{}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValue({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const input: SVGArchitectInput = { prompt: 'test' };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1',
        maxIterations: 1
      };

      const limited = await orchestrator.startGeneration(input, options, () => {});

      // Mock validation with low confidence
      mockBlueprintClient.createCompletion.mockResolvedValueOnce({
        content: '### Confidence Score\n50\n### Recommendation\nITERATE',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      const result = await orchestrator.continueWithRenderedPng(
        limited.conversationId,
        'mock-png',
        () => {}
      );

      expect(result.status).toBe('max_iterations');
      expect(result.finalConfidence).toBe(50);
    });

    it('handles NEEDS_USER recommendation', async () => {
      mockBlueprintClient.createCompletion.mockResolvedValueOnce({
        content: '### Confidence Score\n40\n### Recommendation\nNEEDS_USER',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      const result = await orchestrator.continueWithRenderedPng(
        startResult.conversationId,
        'mock-png',
        () => {}
      );

      expect(result.status).toBe('needs_user');
      expect(result.finalConfidence).toBe(40);
    });

    it('sends progress updates through refinement cycle', async () => {
      mockBlueprintClient.createCompletion
        .mockResolvedValueOnce({
          content: '### Confidence Score\n50\n### Blueprint Corrections\n- Fix\n### Recommendation\nITERATE',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        } as TextCompletionResult)
        .mockResolvedValueOnce({
          content: '### Blueprint\n{}\n',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValueOnce({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const progressUpdates: SVGArchitectProgress[] = [];
      await orchestrator.continueWithRenderedPng(
        startResult.conversationId,
        'mock-png',
        (progress) => progressUpdates.push(progress)
      );

      expect(progressUpdates.map(p => p.status)).toEqual([
        'validating',
        'refining',
        'rendering',
        'validating'
      ]);
    });

    it('includes context images in validation', async () => {
      mockBlueprintClient.createCompletion.mockResolvedValueOnce({
        content: '### Confidence Score\n90\n### Recommendation\nACCEPT',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      await orchestrator.continueWithRenderedPng(
        startResult.conversationId,
        'mock-png',
        () => {}
      );

      // Verify validation call included images
      const callArgs = mockBlueprintClient.createCompletion.mock.calls[0];
      const userMessage = callArgs[0][1];
      expect(userMessage.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'image_url',
            image_url: expect.objectContaining({
              url: expect.stringContaining('base64')
            })
          })
        ])
      );
    });
  });

  describe('resumeWithUserNotes', () => {
    let startResult: SVGArchitectResult;

    beforeEach(async () => {
      mockBlueprintClient.createCompletion.mockResolvedValue({
        content: '### Description\nTest\n### Blueprint\n{}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValue({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const input: SVGArchitectInput = { prompt: 'test' };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1',
        maxIterations: 5
      };

      startResult = await orchestrator.startGeneration(input, options, () => {});
      jest.clearAllMocks();
    });

    it('throws if conversation not found', async () => {
      await expect(
        orchestrator.resumeWithUserNotes('non-existent', 'Make it bigger', () => {})
      ).rejects.toThrow('Conversation non-existent not found');
    });

    it('refines with user notes and renders', async () => {
      mockBlueprintClient.createCompletion.mockResolvedValueOnce({
        content: '### Blueprint\n{"improved": true}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValueOnce({
        content: '<svg><rect width="200"/></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const progressUpdates: SVGArchitectProgress[] = [];
      const result = await orchestrator.resumeWithUserNotes(
        startResult.conversationId,
        'Make it bigger',
        (progress) => progressUpdates.push(progress)
      );

      expect(result.status).toBe('validating');
      expect(result.iterations).toBe(2);
      expect(progressUpdates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: 'refining' }),
          expect.objectContaining({ status: 'validating' })
        ])
      );
    });

    it('includes user notes in refinement prompt', async () => {
      mockBlueprintClient.createCompletion.mockResolvedValue({
        content: '### Blueprint\n{}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValue({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      await orchestrator.resumeWithUserNotes(
        startResult.conversationId,
        'Add more detail',
        () => {}
      );

      // Verify refinement call included user notes
      const callArgs = mockBlueprintClient.createCompletion.mock.calls[0];
      const userMessage = callArgs[0][1];
      expect(userMessage.content).toContain('User Guidance');
      expect(userMessage.content).toContain('Add more detail');
    });

    it('clears user notes after use', async () => {
      mockBlueprintClient.createCompletion.mockResolvedValue({
        content: '### Blueprint\n{}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValue({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      await orchestrator.resumeWithUserNotes(
        startResult.conversationId,
        'Make changes',
        () => {}
      );

      const conv = orchestrator.getConversation(startResult.conversationId);
      expect(conv?.userNotes).toBe('');
    });
  });

  describe('getConversation', () => {
    it('returns conversation state', async () => {
      mockBlueprintClient.createCompletion.mockResolvedValue({
        content: '### Description\nTest\n### Blueprint\n{}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValue({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const input: SVGArchitectInput = { prompt: 'test' };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1',
        maxIterations: 5
      };

      const result = await orchestrator.startGeneration(input, options, () => {});

      const conv = orchestrator.getConversation(result.conversationId);
      expect(conv).toBeDefined();
      expect(conv?.id).toBe(result.conversationId);
      expect(conv?.originalInput.prompt).toBe('test');
    });

    it('returns undefined for non-existent conversation', () => {
      const conv = orchestrator.getConversation('non-existent');
      expect(conv).toBeUndefined();
    });
  });

  describe('prompt loading', () => {
    it('loads correct prompts for each phase', async () => {
      mockBlueprintClient.createCompletion.mockResolvedValue({
        content: '### Description\nTest\n### Blueprint\n{}\n',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as TextCompletionResult);

      mockRenderClient.createCompletion.mockResolvedValue({
        content: '<svg></svg>',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      } as TextCompletionResult);

      const input: SVGArchitectInput = { prompt: 'test' };
      const options: SVGArchitectOptions = {
        blueprintModel: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1',
        maxIterations: 5
      };

      await orchestrator.startGeneration(input, options, () => {});

      // Verify prompts were loaded
      expect(mockPromptLoader.load).toHaveBeenCalledWith('svg-architect', 'blueprint-analysis');
      expect(mockPromptLoader.load).toHaveBeenCalledWith('svg-architect', 'blueprint-render');
    });
  });
});
