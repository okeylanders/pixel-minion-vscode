/**
 * useSvgArchitect hook tests
 *
 * Tests the SVG Architect domain hook following tripartite interface pattern
 * Sprint 6.6 - Presentation Layer Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useSvgArchitect } from '@/presentation/webview/hooks/domain/useSvgArchitect';
import { MessageType, SVGArchitectStatusType } from '@messages';

// Create mock functions that can be referenced in factory
const mockPostMessage = jest.fn();
const mockRenderSvgToPng = jest.fn();

// Mock modules using factory functions
jest.mock('@/presentation/webview/hooks/useVSCodeApi', () => ({
  useVSCodeApi: jest.fn(() => ({
    postMessage: mockPostMessage,
  })),
}));

jest.mock('@/presentation/webview/utils/svgToPng', () => ({
  renderSvgToPng: jest.fn((...args) => mockRenderSvgToPng(...args)),
}));

describe('useSvgArchitect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRenderSvgToPng.mockResolvedValue('mockBase64Png');
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useSvgArchitect());

      expect(result.current.isEnabled).toBe(false);
      expect(result.current.status).toBe('idle');
      expect(result.current.iteration).toBe(0);
      expect(result.current.maxIterations).toBe(3);
      expect(result.current.svgCode).toBeNull();
      expect(result.current.blueprint).toBeNull();
      expect(result.current.confidenceScore).toBeNull();
      expect(result.current.conversationId).toBeNull();
      expect(result.current.userNotes).toBe('');
      expect(result.current.error).toBeNull();
      expect(result.current.conversationEntries).toEqual([]);
    });

    it('should restore from initial state', () => {
      const initialState = {
        isEnabled: true,
        conversationId: 'test-conv-123',
        svgCode: '<svg></svg>',
        conversationEntries: [
          {
            timestamp: Date.now(),
            type: 'analysis' as const,
            message: 'Test message',
          },
        ],
      };

      const { result } = renderHook(() => useSvgArchitect(initialState));

      expect(result.current.isEnabled).toBe(true);
      expect(result.current.conversationId).toBe('test-conv-123');
      expect(result.current.svgCode).toBe('<svg></svg>');
      expect(result.current.conversationEntries).toEqual(initialState.conversationEntries);
    });
  });

  describe('setEnabled', () => {
    it('should update isEnabled state', () => {
      const { result } = renderHook(() => useSvgArchitect());

      act(() => {
        result.current.setEnabled(true);
      });

      expect(result.current.isEnabled).toBe(true);

      act(() => {
        result.current.setEnabled(false);
      });

      expect(result.current.isEnabled).toBe(false);
    });
  });

  describe('generate', () => {
    it('should post SVG_ARCHITECT_REQUEST message', () => {
      const { result } = renderHook(() => useSvgArchitect());

      act(() => {
        result.current.generate('Create a blue circle', {
          blueprintModel: 'gpt-4',
          renderModel: 'claude-3',
          aspectRatio: '1:1',
          maxIterations: 3,
        });
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SVG_ARCHITECT_REQUEST,
          source: 'webview.svgArchitect',
          payload: {
            prompt: 'Create a blue circle',
            blueprintModel: 'gpt-4',
            renderModel: 'claude-3',
            aspectRatio: '1:1',
            maxIterations: 3,
          },
        })
      );
    });

    it('should reset state for new generation', () => {
      const { result } = renderHook(() => useSvgArchitect());

      // Set some state
      act(() => {
        result.current.handleProgress({
          type: MessageType.SVG_ARCHITECT_PROGRESS,
          payload: {
            conversationId: 'old-conv',
            status: 'rendering' as SVGArchitectStatusType,
            iteration: 1,
            maxIterations: 3,
            message: 'Rendering...',
            svgCode: '<svg>old</svg>',
            confidenceScore: 50,
          },
        } as any);
      });

      // Start new generation
      act(() => {
        result.current.generate('New prompt', {
          blueprintModel: 'gpt-4',
          renderModel: 'claude-3',
          aspectRatio: '1:1',
          maxIterations: 3,
        });
      });

      expect(result.current.status).toBe('analyzing');
      expect(result.current.iteration).toBe(0);
      expect(result.current.svgCode).toBeNull();
      expect(result.current.blueprint).toBeNull();
      expect(result.current.confidenceScore).toBeNull();
      expect(result.current.conversationId).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.conversationEntries).toEqual([]);
    });

    it('should not generate if prompt is empty', () => {
      const { result } = renderHook(() => useSvgArchitect());

      act(() => {
        result.current.generate('   ', {
          blueprintModel: 'gpt-4',
          renderModel: 'claude-3',
          aspectRatio: '1:1',
          maxIterations: 3,
        });
      });

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Please enter a prompt');
    });
  });

  describe('handleProgress', () => {
    it('should update status and add conversation entry', () => {
      const { result } = renderHook(() => useSvgArchitect());

      act(() => {
        result.current.handleProgress({
          type: MessageType.SVG_ARCHITECT_PROGRESS,
          payload: {
            conversationId: 'conv-123',
            status: 'analyzing' as SVGArchitectStatusType,
            iteration: 1,
            maxIterations: 3,
            message: 'Analyzing prompt...',
          },
        } as any);
      });

      expect(result.current.conversationId).toBe('conv-123');
      expect(result.current.status).toBe('analyzing');
      expect(result.current.iteration).toBe(1);
      expect(result.current.maxIterations).toBe(3);
      expect(result.current.conversationEntries).toHaveLength(1);
      expect(result.current.conversationEntries[0]).toMatchObject({
        type: 'analysis',
        message: 'Analyzing prompt...',
      });
      expect(result.current.error).toBeNull();
    });

    it('should update svgCode and confidenceScore when provided', () => {
      const { result } = renderHook(() => useSvgArchitect());

      act(() => {
        result.current.handleProgress({
          type: MessageType.SVG_ARCHITECT_PROGRESS,
          payload: {
            conversationId: 'conv-123',
            status: 'rendering' as SVGArchitectStatusType,
            iteration: 1,
            maxIterations: 3,
            message: 'Rendering SVG...',
            svgCode: '<svg><circle /></svg>',
            confidenceScore: 85,
          },
        } as any);
      });

      expect(result.current.svgCode).toBe('<svg><circle /></svg>');
      expect(result.current.confidenceScore).toBe(85);
    });
  });

  describe('handleResult', () => {
    it('should set final state and add result entry', () => {
      const { result } = renderHook(() => useSvgArchitect());

      act(() => {
        result.current.handleResult({
          type: MessageType.SVG_ARCHITECT_RESULT,
          payload: {
            conversationId: 'conv-123',
            status: 'complete' as SVGArchitectStatusType,
            iterations: 2,
            svgCode: '<svg>final</svg>',
            finalConfidence: 95,
          },
        } as any);
      });

      expect(result.current.conversationId).toBe('conv-123');
      expect(result.current.status).toBe('complete');
      expect(result.current.svgCode).toBe('<svg>final</svg>');
      expect(result.current.confidenceScore).toBe(95);
      expect(result.current.iteration).toBe(2);
      expect(result.current.conversationEntries).toHaveLength(1);
      expect(result.current.conversationEntries[0]).toMatchObject({
        type: 'result',
        message: expect.stringContaining('95%'),
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe('handleError', () => {
    it('should set error state', () => {
      const { result } = renderHook(() => useSvgArchitect());

      act(() => {
        result.current.handleError({
          type: MessageType.ERROR,
          payload: {
            message: 'Test error occurred',
          },
        } as any);
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Test error occurred');
      expect(result.current.conversationEntries).toHaveLength(1);
      expect(result.current.conversationEntries[0]).toMatchObject({
        type: 'result',
        message: 'Error: Test error occurred',
      });
    });
  });

  describe('submitUserNotes', () => {
    it('should post SVG_ARCHITECT_RESUME message', () => {
      const { result } = renderHook(() => useSvgArchitect());

      // Set conversation ID first
      act(() => {
        result.current.handleProgress({
          type: MessageType.SVG_ARCHITECT_PROGRESS,
          payload: {
            conversationId: 'conv-123',
            status: 'awaiting_user' as SVGArchitectStatusType,
            iteration: 1,
            maxIterations: 3,
            message: 'Awaiting user input',
          },
        } as any);
      });

      // Set user notes
      act(() => {
        result.current.setUserNotes('Make it darker');
      });

      // Submit notes
      act(() => {
        result.current.submitUserNotes('Make it darker');
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SVG_ARCHITECT_RESUME,
          source: 'webview.svgArchitect',
          payload: {
            conversationId: 'conv-123',
            userNotes: 'Make it darker',
          },
        })
      );

      // Should add user notes entry
      expect(result.current.conversationEntries.some(e => e.type === 'user_notes')).toBe(true);

      // Should clear user notes input
      expect(result.current.userNotes).toBe('');
    });

    it('should not submit empty notes', () => {
      const { result } = renderHook(() => useSvgArchitect());

      act(() => {
        result.current.handleProgress({
          type: MessageType.SVG_ARCHITECT_PROGRESS,
          payload: {
            conversationId: 'conv-123',
            status: 'awaiting_user' as SVGArchitectStatusType,
            iteration: 1,
            maxIterations: 3,
            message: 'Awaiting user input',
          },
        } as any);
      });

      act(() => {
        result.current.submitUserNotes('   ');
      });

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Please enter feedback notes');
    });
  });

  describe('cancel', () => {
    it('should post SVG_ARCHITECT_CANCEL message', () => {
      const { result } = renderHook(() => useSvgArchitect());

      // Set conversation ID
      act(() => {
        result.current.handleProgress({
          type: MessageType.SVG_ARCHITECT_PROGRESS,
          payload: {
            conversationId: 'conv-123',
            status: 'rendering' as SVGArchitectStatusType,
            iteration: 1,
            maxIterations: 3,
            message: 'Rendering...',
          },
        } as any);
      });

      act(() => {
        result.current.cancel();
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SVG_ARCHITECT_CANCEL,
          source: 'webview.svgArchitect',
          payload: {
            conversationId: 'conv-123',
          },
        })
      );

      expect(result.current.status).toBe('idle');
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const { result } = renderHook(() => useSvgArchitect());

      // Set some state
      act(() => {
        result.current.handleProgress({
          type: MessageType.SVG_ARCHITECT_PROGRESS,
          payload: {
            conversationId: 'conv-123',
            status: 'rendering' as SVGArchitectStatusType,
            iteration: 2,
            maxIterations: 3,
            message: 'Rendering...',
            svgCode: '<svg>test</svg>',
            confidenceScore: 75,
          },
        } as any);
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.iteration).toBe(0);
      expect(result.current.svgCode).toBeNull();
      expect(result.current.blueprint).toBeNull();
      expect(result.current.confidenceScore).toBeNull();
      expect(result.current.conversationId).toBeNull();
      expect(result.current.userNotes).toBe('');
      expect(result.current.error).toBeNull();
      expect(result.current.conversationEntries).toEqual([]);
    });
  });

  describe('Auto-render effect', () => {
    it('should trigger PNG message when status is validating', async () => {
      const { result } = renderHook(() => useSvgArchitect());

      await act(async () => {
        result.current.handleProgress({
          type: MessageType.SVG_ARCHITECT_PROGRESS,
          payload: {
            conversationId: 'conv-123',
            status: 'validating' as SVGArchitectStatusType,
            iteration: 1,
            maxIterations: 3,
            message: 'Validating...',
            svgCode: '<svg><circle /></svg>',
          },
        } as any);
      });

      // Wait for async effect
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockRenderSvgToPng).toHaveBeenCalledWith('<svg><circle /></svg>', 1024, 1024);

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SVG_ARCHITECT_PNG_READY,
          source: 'webview.svgArchitect',
          payload: {
            conversationId: 'conv-123',
            pngBase64: 'mockBase64Png',
          },
        })
      );
    });

    it('should not trigger PNG message when status is not validating', async () => {
      const { result } = renderHook(() => useSvgArchitect());

      await act(async () => {
        result.current.handleProgress({
          type: MessageType.SVG_ARCHITECT_PROGRESS,
          payload: {
            conversationId: 'conv-123',
            status: 'rendering' as SVGArchitectStatusType,
            iteration: 1,
            maxIterations: 3,
            message: 'Rendering...',
            svgCode: '<svg><circle /></svg>',
          },
        } as any);
      });

      expect(mockRenderSvgToPng).not.toHaveBeenCalled();
    });
  });
});
