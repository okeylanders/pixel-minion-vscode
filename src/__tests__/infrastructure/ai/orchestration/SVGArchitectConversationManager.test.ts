/**
 * Tests for SVGArchitectConversationManager
 *
 * Coverage:
 * - CRUD operations (create, get, delete)
 * - Status management
 * - Iteration management
 * - Token accumulation
 * - Context image optimization (first + latest only)
 * - Re-hydration from webview history
 */

import {
  SVGArchitectConversationManager,
  SVGArchitectStatus
} from '@ai';
import { LoggingService } from '@logging';

describe('SVGArchitectConversationManager', () => {
  let manager: SVGArchitectConversationManager;
  let mockLogger: jest.Mocked<LoggingService>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    manager = new SVGArchitectConversationManager(mockLogger);
  });

  describe('create', () => {
    it('creates conversation with initial state', () => {
      const conv = manager.create(
        'test prompt',
        'claude-opus-4',
        'gpt-5.1',
        '1:1',
        5,
        'base64image',
        'svg text'
      );

      expect(conv.id).toBeDefined();
      expect(conv.status).toBe('analyzing');
      expect(conv.originalInput.prompt).toBe('test prompt');
      expect(conv.originalInput.referenceImageBase64).toBe('base64image');
      expect(conv.originalInput.referenceSvgText).toBe('svg text');
      expect(conv.model).toBe('claude-opus-4');
      expect(conv.renderModel).toBe('gpt-5.1');
      expect(conv.aspectRatio).toBe('1:1');
      expect(conv.maxIterations).toBe(5);
      expect(conv.iterations).toHaveLength(0);
      expect(conv.currentIteration).toBe(0);
      expect(conv.description).toBeNull();
      expect(conv.userNotes).toBeNull();
      expect(conv.totalUsage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      });
      expect(conv.createdAt).toBeDefined();
      expect(conv.updatedAt).toBeDefined();
    });

    it('creates conversation without optional reference data', () => {
      const conv = manager.create(
        'test prompt',
        'claude-opus-4',
        'gpt-5.1',
        '16:9',
        3
      );

      expect(conv.id).toBeDefined();
      expect(conv.originalInput.referenceImageBase64).toBeUndefined();
      expect(conv.originalInput.referenceSvgText).toBeUndefined();
    });

    it('logs conversation creation', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Created SVG Architect conversation: ${conv.id}`)
      );
    });
  });

  describe('get', () => {
    it('returns undefined for non-existent conversation', () => {
      expect(manager.get('non-existent')).toBeUndefined();
    });

    it('returns existing conversation', () => {
      const created = manager.create('test', 'model', 'render', '1:1', 5);
      const retrieved = manager.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.originalInput.prompt).toBe('test');
    });
  });

  describe('delete', () => {
    it('deletes existing conversation', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      expect(manager.delete(conv.id)).toBe(true);
      expect(manager.get(conv.id)).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Deleted SVG Architect conversation: ${conv.id}`)
      );
    });

    it('returns false for non-existent conversation', () => {
      expect(manager.delete('non-existent')).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('updates status of existing conversation', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);
      const initialUpdatedAt = conv.updatedAt;

      manager.updateStatus(conv.id, 'rendering');
      const updated = manager.get(conv.id);

      expect(updated?.status).toBe('rendering');
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(initialUpdatedAt);
    });

    it('does nothing for non-existent conversation', () => {
      manager.updateStatus('non-existent', 'complete');
      // Should not throw
    });

    it('handles all status types', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      const statuses: SVGArchitectStatus[] = [
        'analyzing',
        'rendering',
        'validating',
        'refining',
        'needs_user',
        'complete',
        'max_iterations',
        'error'
      ];

      statuses.forEach(status => {
        manager.updateStatus(conv.id, status);
        expect(manager.get(conv.id)?.status).toBe(status);
      });
    });
  });

  describe('setDescription', () => {
    it('sets description', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      manager.setDescription(conv.id, 'A beautiful icon');
      const updated = manager.get(conv.id);

      expect(updated?.description).toBe('A beautiful icon');
    });

    it('does nothing for non-existent conversation', () => {
      manager.setDescription('non-existent', 'test');
      // Should not throw
    });
  });

  describe('addIteration', () => {
    it('adds iteration and increments counter', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      const iteration = manager.addIteration(conv.id, '{"blueprint": "test"}');

      expect(iteration.iterationNumber).toBe(1);
      expect(iteration.blueprintJson).toBe('{"blueprint": "test"}');
      expect(iteration.svgCode).toBeNull();
      expect(iteration.renderedPngBase64).toBeNull();
      expect(iteration.validationResult).toBeNull();
      expect(iteration.timestamp).toBeDefined();

      const updated = manager.get(conv.id);
      expect(updated?.currentIteration).toBe(1);
      expect(updated?.iterations).toHaveLength(1);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Added iteration 1 to conversation')
      );
    });

    it('adds multiple iterations with incrementing numbers', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      const iter1 = manager.addIteration(conv.id, 'blueprint1');
      const iter2 = manager.addIteration(conv.id, 'blueprint2');
      const iter3 = manager.addIteration(conv.id, 'blueprint3');

      expect(iter1.iterationNumber).toBe(1);
      expect(iter2.iterationNumber).toBe(2);
      expect(iter3.iterationNumber).toBe(3);

      const updated = manager.get(conv.id);
      expect(updated?.currentIteration).toBe(3);
      expect(updated?.iterations).toHaveLength(3);
    });

    it('accumulates token usage', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      manager.addIteration(conv.id, 'blueprint', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costUsd: 0.01
      });

      const updated = manager.get(conv.id);
      expect(updated?.totalUsage.promptTokens).toBe(100);
      expect(updated?.totalUsage.completionTokens).toBe(50);
      expect(updated?.totalUsage.totalTokens).toBe(150);
      expect(updated?.totalUsage.costUsd).toBe(0.01);
    });

    it('accumulates usage across multiple iterations', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      manager.addIteration(conv.id, 'blueprint1', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costUsd: 0.01
      });

      manager.addIteration(conv.id, 'blueprint2', {
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        costUsd: 0.02
      });

      const updated = manager.get(conv.id);
      expect(updated?.totalUsage.promptTokens).toBe(300);
      expect(updated?.totalUsage.completionTokens).toBe(150);
      expect(updated?.totalUsage.totalTokens).toBe(450);
      expect(updated?.totalUsage.costUsd).toBe(0.03);
    });

    it('handles missing usage data', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      manager.addIteration(conv.id, 'blueprint');

      const updated = manager.get(conv.id);
      expect(updated?.totalUsage.totalTokens).toBe(0);
    });

    it('throws for non-existent conversation', () => {
      expect(() => {
        manager.addIteration('non-existent', 'blueprint');
      }).toThrow('Conversation non-existent not found');
    });
  });

  describe('setIterationSvg', () => {
    it('sets SVG code on current iteration', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);
      manager.addIteration(conv.id, 'blueprint');

      manager.setIterationSvg(conv.id, '<svg></svg>');

      const updated = manager.get(conv.id);
      expect(updated?.iterations[0].svgCode).toBe('<svg></svg>');
    });

    it('accumulates usage from rendering', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);
      manager.addIteration(conv.id, 'blueprint', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costUsd: 0.01
      });

      manager.setIterationSvg(conv.id, '<svg></svg>', {
        promptTokens: 50,
        completionTokens: 100,
        totalTokens: 150,
        costUsd: 0.015
      });

      const updated = manager.get(conv.id);
      expect(updated?.totalUsage.promptTokens).toBe(150);
      expect(updated?.totalUsage.completionTokens).toBe(150);
      expect(updated?.totalUsage.totalTokens).toBe(300);
      expect(updated?.totalUsage.costUsd).toBe(0.025);
    });

    it('does nothing for non-existent conversation', () => {
      manager.setIterationSvg('non-existent', '<svg></svg>');
      // Should not throw
    });

    it('does nothing when no iterations exist', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);
      manager.setIterationSvg(conv.id, '<svg></svg>');
      // Should not throw
    });
  });

  describe('setIterationPng', () => {
    it('sets PNG on current iteration', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);
      manager.addIteration(conv.id, 'blueprint');

      manager.setIterationPng(conv.id, 'png-base64');

      const updated = manager.get(conv.id);
      expect(updated?.iterations[0].renderedPngBase64).toBe('png-base64');
    });

    it('does nothing for non-existent conversation', () => {
      manager.setIterationPng('non-existent', 'png');
      // Should not throw
    });
  });

  describe('setValidationResult', () => {
    it('sets validation result on current iteration', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);
      manager.addIteration(conv.id, 'blueprint');

      manager.setValidationResult(
        conv.id,
        85,
        ['issue1', 'issue2'],
        ['fix1', 'fix2'],
        'ACCEPT'
      );

      const updated = manager.get(conv.id);
      const validation = updated?.iterations[0].validationResult;

      expect(validation?.confidenceScore).toBe(85);
      expect(validation?.issues).toEqual(['issue1', 'issue2']);
      expect(validation?.corrections).toEqual(['fix1', 'fix2']);
      expect(validation?.recommendation).toBe('ACCEPT');
    });

    it('accumulates usage from validation', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);
      manager.addIteration(conv.id, 'blueprint', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      });

      manager.setValidationResult(
        conv.id,
        85,
        [],
        [],
        'ACCEPT',
        {
          promptTokens: 75,
          completionTokens: 25,
          totalTokens: 100,
          costUsd: 0.01
        }
      );

      const updated = manager.get(conv.id);
      expect(updated?.totalUsage.promptTokens).toBe(175);
      expect(updated?.totalUsage.completionTokens).toBe(75);
      expect(updated?.totalUsage.totalTokens).toBe(250);
      expect(updated?.totalUsage.costUsd).toBe(0.01);
    });

    it('handles all recommendation types', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      const recommendations: Array<'ACCEPT' | 'ITERATE' | 'NEEDS_USER'> = [
        'ACCEPT',
        'ITERATE',
        'NEEDS_USER'
      ];

      recommendations.forEach((recommendation, index) => {
        manager.addIteration(conv.id, `blueprint${index}`);
        manager.setValidationResult(conv.id, 50, [], [], recommendation);

        const updated = manager.get(conv.id);
        expect(updated?.iterations[index].validationResult?.recommendation).toBe(recommendation);
      });
    });
  });

  describe('setUserNotes', () => {
    it('sets user notes', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      manager.setUserNotes(conv.id, 'Make it bigger');

      const updated = manager.get(conv.id);
      expect(updated?.userNotes).toBe('Make it bigger');
    });

    it('does nothing for non-existent conversation', () => {
      manager.setUserNotes('non-existent', 'test');
      // Should not throw
    });
  });

  describe('getContextImages', () => {
    it('returns empty array for non-existent conversation', () => {
      const images = manager.getContextImages('non-existent');
      expect(images).toEqual([]);
    });

    it('returns only original reference when no iterations', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5, 'original-image');

      const images = manager.getContextImages(conv.id);
      expect(images).toEqual(['original-image']);
    });

    it('returns empty array when no reference and no iterations', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      const images = manager.getContextImages(conv.id);
      expect(images).toEqual([]);
    });

    it('returns original and latest PNG', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5, 'original-image');
      manager.addIteration(conv.id, 'blueprint1');
      manager.setIterationPng(conv.id, 'png1');

      const images = manager.getContextImages(conv.id);
      expect(images).toEqual(['original-image', 'png1']);
    });

    it('returns only original and latest PNG (not intermediate)', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5, 'original-image');

      manager.addIteration(conv.id, 'blueprint1');
      manager.setIterationPng(conv.id, 'png1');

      manager.addIteration(conv.id, 'blueprint2');
      manager.setIterationPng(conv.id, 'png2');

      manager.addIteration(conv.id, 'blueprint3');
      manager.setIterationPng(conv.id, 'png3');

      const images = manager.getContextImages(conv.id);
      expect(images).toHaveLength(2);
      expect(images[0]).toBe('original-image'); // First is always original
      expect(images[1]).toBe('png3'); // Second is latest only
    });

    it('returns only latest PNG when no original reference', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      manager.addIteration(conv.id, 'blueprint1');
      manager.setIterationPng(conv.id, 'png1');

      manager.addIteration(conv.id, 'blueprint2');
      manager.setIterationPng(conv.id, 'png2');

      const images = manager.getContextImages(conv.id);
      expect(images).toEqual(['png2']);
    });

    it('returns only original when iterations have no PNG yet', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5, 'original-image');
      manager.addIteration(conv.id, 'blueprint1');
      // PNG not set yet

      const images = manager.getContextImages(conv.id);
      expect(images).toEqual(['original-image']);
    });
  });

  describe('hasReachedMaxIterations', () => {
    it('returns false when under limit', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 3);
      manager.addIteration(conv.id, 'blueprint');

      expect(manager.hasReachedMaxIterations(conv.id)).toBe(false);
    });

    it('returns true when at limit', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 2);
      manager.addIteration(conv.id, 'blueprint1');
      manager.addIteration(conv.id, 'blueprint2');

      expect(manager.hasReachedMaxIterations(conv.id)).toBe(true);
    });

    it('returns true when over limit', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 1);
      manager.addIteration(conv.id, 'blueprint1');
      manager.addIteration(conv.id, 'blueprint2');

      expect(manager.hasReachedMaxIterations(conv.id)).toBe(true);
    });

    it('returns true for non-existent conversation', () => {
      expect(manager.hasReachedMaxIterations('non-existent')).toBe(true);
    });

    it('returns false when no iterations yet', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      expect(manager.hasReachedMaxIterations(conv.id)).toBe(false);
    });
  });

  describe('getLatestSvg', () => {
    it('returns null for non-existent conversation', () => {
      expect(manager.getLatestSvg('non-existent')).toBeNull();
    });

    it('returns null when no iterations', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      expect(manager.getLatestSvg(conv.id)).toBeNull();
    });

    it('returns latest SVG code', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);
      manager.addIteration(conv.id, 'blueprint1');
      manager.setIterationSvg(conv.id, '<svg>v1</svg>');
      manager.addIteration(conv.id, 'blueprint2');
      manager.setIterationSvg(conv.id, '<svg>v2</svg>');

      expect(manager.getLatestSvg(conv.id)).toBe('<svg>v2</svg>');
    });
  });

  describe('getLatestConfidence', () => {
    it('returns null for non-existent conversation', () => {
      expect(manager.getLatestConfidence('non-existent')).toBeNull();
    });

    it('returns null when no iterations', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);

      expect(manager.getLatestConfidence(conv.id)).toBeNull();
    });

    it('returns null when no validation result', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);
      manager.addIteration(conv.id, 'blueprint');

      expect(manager.getLatestConfidence(conv.id)).toBeNull();
    });

    it('returns latest confidence score', () => {
      const conv = manager.create('test', 'model', 'render', '1:1', 5);
      manager.addIteration(conv.id, 'blueprint1');
      manager.setValidationResult(conv.id, 70, [], [], 'ITERATE');
      manager.addIteration(conv.id, 'blueprint2');
      manager.setValidationResult(conv.id, 85, [], [], 'ACCEPT');

      expect(manager.getLatestConfidence(conv.id)).toBe(85);
    });
  });

  describe('rehydrate', () => {
    it('rebuilds conversation from history', () => {
      const conv = manager.rehydrate('rehydrated-id', {
        originalInput: {
          prompt: 'test prompt',
          referenceImageBase64: 'image-data'
        },
        iterations: [
          { blueprintJson: 'bp1', svgCode: '<svg>v1</svg>', confidenceScore: 70 },
          { blueprintJson: 'bp2', svgCode: '<svg>v2</svg>', confidenceScore: 80 },
        ],
        model: 'claude',
        renderModel: 'gpt',
        aspectRatio: '16:9'
      });

      expect(conv.id).toBe('rehydrated-id');
      expect(conv.status).toBe('analyzing');
      expect(conv.originalInput.prompt).toBe('test prompt');
      expect(conv.originalInput.referenceImageBase64).toBe('image-data');
      expect(conv.model).toBe('claude');
      expect(conv.renderModel).toBe('gpt');
      expect(conv.aspectRatio).toBe('16:9');
      expect(conv.iterations).toHaveLength(2);
      expect(conv.currentIteration).toBe(2);
      expect(conv.maxIterations).toBe(5); // Default
    });

    it('reconstructs validation results from confidence scores', () => {
      const conv = manager.rehydrate('test-id', {
        originalInput: { prompt: 'test' },
        iterations: [
          { blueprintJson: 'bp1', svgCode: 'svg1', confidenceScore: 90 },
          { blueprintJson: 'bp2', svgCode: 'svg2', confidenceScore: 70 },
        ],
        model: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1'
      });

      expect(conv.iterations[0].validationResult?.confidenceScore).toBe(90);
      expect(conv.iterations[0].validationResult?.recommendation).toBe('ACCEPT');
      expect(conv.iterations[1].validationResult?.confidenceScore).toBe(70);
      expect(conv.iterations[1].validationResult?.recommendation).toBe('ITERATE');
    });

    it('sets PNGs to null (cannot recover from history)', () => {
      const conv = manager.rehydrate('test-id', {
        originalInput: { prompt: 'test' },
        iterations: [
          { blueprintJson: 'bp1', svgCode: 'svg1', confidenceScore: 80 },
        ],
        model: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1'
      });

      expect(conv.iterations[0].renderedPngBase64).toBeNull();
    });

    it('logs re-hydration', () => {
      manager.rehydrate('test-id', {
        originalInput: { prompt: 'test' },
        iterations: [
          { blueprintJson: 'bp1', svgCode: 'svg1', confidenceScore: 80 },
          { blueprintJson: 'bp2', svgCode: 'svg2', confidenceScore: 85 },
        ],
        model: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1'
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Re-hydrated SVG Architect conversation test-id with 2 iterations')
      );
    });

    it('handles empty iterations', () => {
      const conv = manager.rehydrate('test-id', {
        originalInput: { prompt: 'test' },
        iterations: [],
        model: 'claude',
        renderModel: 'gpt',
        aspectRatio: '1:1'
      });

      expect(conv.iterations).toHaveLength(0);
      expect(conv.currentIteration).toBe(0);
    });
  });
});
