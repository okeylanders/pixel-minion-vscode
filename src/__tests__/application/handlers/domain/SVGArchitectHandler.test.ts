/**
 * SVGArchitectHandler tests
 *
 * Tests SVG Architect multi-agent pipeline message handling
 * Sprint 5.4 - Tests for Application Layer Handler
 */
import { SVGArchitectHandler } from '../../../../application/handlers/domain/SVGArchitectHandler';
import {
  MessageType,
  createEnvelope,
  SVGArchitectRequestPayload,
  SVGArchitectPngPayload,
  SVGArchitectResumePayload,
  SVGArchitectCancelPayload,
  TokenUsage,
} from '@messages';

// Mock SVGArchitectOrchestrator
const mockOrchestrator = {
  startGeneration: jest.fn(),
  continueWithRenderedPng: jest.fn(),
  resumeWithUserNotes: jest.fn(),
  cancel: jest.fn(),
  getConversation: jest.fn(),
};

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('SVGArchitectHandler', () => {
  let postMessage: jest.Mock;
  let applyTokenUsageCallback: jest.Mock;
  let handler: SVGArchitectHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    postMessage = jest.fn();
    applyTokenUsageCallback = jest.fn();

    handler = new SVGArchitectHandler(
      postMessage,
      mockOrchestrator as never,
      mockLogger as never,
      applyTokenUsageCallback
    );
  });

  describe('handleGenerationRequest', () => {
    const mockRequestPayload: SVGArchitectRequestPayload = {
      prompt: 'Create a logo with a red circle',
      blueprintModel: 'anthropic/claude-opus-4',
      renderModel: 'google/gemini-3-pro-preview',
      aspectRatio: '1:1',
      maxIterations: 5,
    };

    it('should call orchestrator.startGeneration with correct parameters', async () => {
      mockOrchestrator.startGeneration.mockResolvedValue({
        conversationId: 'conv-123',
        status: 'validating',
        svgCode: '<svg></svg>',
        finalConfidence: null,
        iterations: 1,
        totalUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      const message = createEnvelope<SVGArchitectRequestPayload>(
        MessageType.SVG_ARCHITECT_REQUEST,
        'webview.svgArchitect',
        mockRequestPayload,
        'correlation-123'
      );

      await handler.handleGenerationRequest(message);

      expect(mockOrchestrator.startGeneration).toHaveBeenCalledWith(
        {
          prompt: mockRequestPayload.prompt,
          referenceImageBase64: undefined,
          referenceSvgText: undefined,
        },
        {
          blueprintModel: mockRequestPayload.blueprintModel,
          renderModel: mockRequestPayload.renderModel,
          aspectRatio: mockRequestPayload.aspectRatio,
          maxIterations: mockRequestPayload.maxIterations,
        },
        expect.any(Function)
      );
    });

    it('should send progress updates via postMessage during generation', async () => {
      mockOrchestrator.startGeneration.mockImplementation(
        async (_input, _options, onProgress) => {
          // Simulate progress callbacks
          onProgress({
            conversationId: 'conv-123',
            status: 'analyzing',
            iteration: 0,
            maxIterations: 5,
            message: 'Analyzing input...',
          });

          onProgress({
            conversationId: 'conv-123',
            status: 'rendering',
            iteration: 1,
            maxIterations: 5,
            message: 'Rendering SVG...',
          });

          return {
            conversationId: 'conv-123',
            status: 'validating',
            svgCode: '<svg></svg>',
            finalConfidence: null,
            iterations: 1,
            totalUsage: {
              promptTokens: 100,
              completionTokens: 50,
              totalTokens: 150,
            },
          };
        }
      );

      const message = createEnvelope<SVGArchitectRequestPayload>(
        MessageType.SVG_ARCHITECT_REQUEST,
        'webview.svgArchitect',
        mockRequestPayload,
        'correlation-123'
      );

      await handler.handleGenerationRequest(message);

      // Check progress messages were sent
      const progressCalls = postMessage.mock.calls.filter(
        (call) => call[0].type === MessageType.SVG_ARCHITECT_PROGRESS
      );

      expect(progressCalls.length).toBeGreaterThanOrEqual(2);
      expect(progressCalls[0][0].payload.status).toBe('analyzing');
      expect(progressCalls[1][0].payload.status).toBe('rendering');
    });

    it('should send result message on completion', async () => {
      const mockResult = {
        conversationId: 'conv-123',
        status: 'validating' as const,
        svgCode: '<svg><circle cx="50" cy="50" r="40" fill="red" /></svg>',
        finalConfidence: null,
        iterations: 1,
        totalUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      };

      mockOrchestrator.startGeneration.mockResolvedValue(mockResult);

      const message = createEnvelope<SVGArchitectRequestPayload>(
        MessageType.SVG_ARCHITECT_REQUEST,
        'webview.svgArchitect',
        mockRequestPayload,
        'correlation-123'
      );

      await handler.handleGenerationRequest(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SVG_ARCHITECT_RESULT,
          source: 'extension.svgArchitect',
          payload: mockResult,
          correlationId: 'correlation-123',
        })
      );
    });

    it('should apply token usage when available', async () => {
      const mockUsage: TokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costUsd: 0.05,
      };

      mockOrchestrator.startGeneration.mockResolvedValue({
        conversationId: 'conv-123',
        status: 'complete',
        svgCode: '<svg></svg>',
        finalConfidence: 95,
        iterations: 3,
        totalUsage: mockUsage,
      });

      const message = createEnvelope<SVGArchitectRequestPayload>(
        MessageType.SVG_ARCHITECT_REQUEST,
        'webview.svgArchitect',
        mockRequestPayload,
        'correlation-123'
      );

      await handler.handleGenerationRequest(message);

      expect(applyTokenUsageCallback).toHaveBeenCalledWith(mockUsage);
    });

    it('should handle errors and send ERROR message', async () => {
      const error = new Error('Blueprint generation failed');
      mockOrchestrator.startGeneration.mockRejectedValue(error);

      const message = createEnvelope<SVGArchitectRequestPayload>(
        MessageType.SVG_ARCHITECT_REQUEST,
        'webview.svgArchitect',
        mockRequestPayload,
        'correlation-456'
      );

      await handler.handleGenerationRequest(message);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'SVG Architect generation failed',
        error
      );

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          source: 'extension.svgArchitect',
          payload: {
            message: 'Blueprint generation failed',
            code: 'SVG_ARCHITECT_ERROR',
          },
          correlationId: 'correlation-456',
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockOrchestrator.startGeneration.mockRejectedValue('String error');

      const message = createEnvelope<SVGArchitectRequestPayload>(
        MessageType.SVG_ARCHITECT_REQUEST,
        'webview.svgArchitect',
        mockRequestPayload
      );

      await handler.handleGenerationRequest(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: {
            message: 'SVG Architect generation failed',
            code: 'SVG_ARCHITECT_ERROR',
          },
        })
      );
    });

    it('should include reference image when provided', async () => {
      mockOrchestrator.startGeneration.mockResolvedValue({
        conversationId: 'conv-123',
        status: 'validating',
        svgCode: '<svg></svg>',
        finalConfidence: null,
        iterations: 1,
        totalUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const payloadWithImage: SVGArchitectRequestPayload = {
        ...mockRequestPayload,
        referenceImage: 'base64EncodedPngData',
      };

      const message = createEnvelope<SVGArchitectRequestPayload>(
        MessageType.SVG_ARCHITECT_REQUEST,
        'webview.svgArchitect',
        payloadWithImage,
        'correlation-123'
      );

      await handler.handleGenerationRequest(message);

      expect(mockOrchestrator.startGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceImageBase64: 'base64EncodedPngData',
        }),
        expect.anything(),
        expect.any(Function)
      );
    });

    it('should include reference SVG when provided', async () => {
      mockOrchestrator.startGeneration.mockResolvedValue({
        conversationId: 'conv-123',
        status: 'validating',
        svgCode: '<svg></svg>',
        finalConfidence: null,
        iterations: 1,
        totalUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const payloadWithSvg: SVGArchitectRequestPayload = {
        ...mockRequestPayload,
        referenceSvgText: '<svg><rect /></svg>',
      };

      const message = createEnvelope<SVGArchitectRequestPayload>(
        MessageType.SVG_ARCHITECT_REQUEST,
        'webview.svgArchitect',
        payloadWithSvg,
        'correlation-123'
      );

      await handler.handleGenerationRequest(message);

      expect(mockOrchestrator.startGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceSvgText: '<svg><rect /></svg>',
        }),
        expect.anything(),
        expect.any(Function)
      );
    });
  });

  describe('handlePngReady', () => {
    const mockPngPayload: SVGArchitectPngPayload = {
      conversationId: 'conv-123',
      pngBase64: 'base64EncodedPngData',
    };

    it('should call orchestrator.continueWithRenderedPng with conversationId and png', async () => {
      mockOrchestrator.continueWithRenderedPng.mockResolvedValue({
        conversationId: 'conv-123',
        status: 'complete',
        svgCode: '<svg></svg>',
        finalConfidence: 92,
        iterations: 2,
        totalUsage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
      });

      const message = createEnvelope<SVGArchitectPngPayload>(
        MessageType.SVG_ARCHITECT_PNG_READY,
        'webview.svgArchitect',
        mockPngPayload,
        'correlation-789'
      );

      await handler.handlePngReady(message);

      expect(mockOrchestrator.continueWithRenderedPng).toHaveBeenCalledWith(
        'conv-123',
        'base64EncodedPngData',
        expect.any(Function)
      );
    });

    it('should send progress updates during validation', async () => {
      mockOrchestrator.continueWithRenderedPng.mockImplementation(
        async (_conversationId, _png, onProgress) => {
          onProgress({
            conversationId: 'conv-123',
            status: 'validating',
            iteration: 2,
            maxIterations: 5,
            message: 'Validating rendered output...',
          });

          return {
            conversationId: 'conv-123',
            status: 'complete',
            svgCode: '<svg></svg>',
            finalConfidence: 92,
            iterations: 2,
            totalUsage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
          };
        }
      );

      const message = createEnvelope<SVGArchitectPngPayload>(
        MessageType.SVG_ARCHITECT_PNG_READY,
        'webview.svgArchitect',
        mockPngPayload,
        'correlation-789'
      );

      await handler.handlePngReady(message);

      const progressCalls = postMessage.mock.calls.filter(
        (call) => call[0].type === MessageType.SVG_ARCHITECT_PROGRESS
      );

      expect(progressCalls.length).toBeGreaterThanOrEqual(1);
      expect(progressCalls[0][0].payload.status).toBe('validating');
    });

    it('should send result message after validation', async () => {
      const mockResult = {
        conversationId: 'conv-123',
        status: 'complete' as const,
        svgCode: '<svg></svg>',
        finalConfidence: 92,
        iterations: 2,
        totalUsage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
      };

      mockOrchestrator.continueWithRenderedPng.mockResolvedValue(mockResult);

      const message = createEnvelope<SVGArchitectPngPayload>(
        MessageType.SVG_ARCHITECT_PNG_READY,
        'webview.svgArchitect',
        mockPngPayload,
        'correlation-789'
      );

      await handler.handlePngReady(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SVG_ARCHITECT_RESULT,
          source: 'extension.svgArchitect',
          payload: mockResult,
          correlationId: 'correlation-789',
        })
      );
    });

    it('should handle errors during validation', async () => {
      const error = new Error('Validation failed');
      mockOrchestrator.continueWithRenderedPng.mockRejectedValue(error);

      const message = createEnvelope<SVGArchitectPngPayload>(
        MessageType.SVG_ARCHITECT_PNG_READY,
        'webview.svgArchitect',
        mockPngPayload,
        'correlation-999'
      );

      await handler.handlePngReady(message);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'PNG validation failed',
        error
      );

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          source: 'extension.svgArchitect',
          payload: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
          },
          correlationId: 'correlation-999',
        })
      );
    });
  });

  describe('handleResume', () => {
    const mockResumePayload: SVGArchitectResumePayload = {
      conversationId: 'conv-123',
      userNotes: 'Make the circle bigger and change color to blue',
    };

    it('should call orchestrator.resumeWithUserNotes with conversationId and notes', async () => {
      mockOrchestrator.resumeWithUserNotes.mockResolvedValue({
        conversationId: 'conv-123',
        status: 'validating',
        svgCode: '<svg><circle cx="50" cy="50" r="60" fill="blue" /></svg>',
        finalConfidence: null,
        iterations: 3,
        totalUsage: { promptTokens: 300, completionTokens: 150, totalTokens: 450 },
      });

      const message = createEnvelope<SVGArchitectResumePayload>(
        MessageType.SVG_ARCHITECT_RESUME,
        'webview.svgArchitect',
        mockResumePayload,
        'correlation-456'
      );

      await handler.handleResume(message);

      expect(mockOrchestrator.resumeWithUserNotes).toHaveBeenCalledWith(
        'conv-123',
        'Make the circle bigger and change color to blue',
        expect.any(Function)
      );
    });

    it('should send progress updates during resume', async () => {
      mockOrchestrator.resumeWithUserNotes.mockImplementation(
        async (_conversationId, _notes, onProgress) => {
          onProgress({
            conversationId: 'conv-123',
            status: 'refining',
            iteration: 3,
            maxIterations: 5,
            message: 'Refining based on user guidance...',
          });

          onProgress({
            conversationId: 'conv-123',
            status: 'rendering',
            iteration: 3,
            maxIterations: 5,
            message: 'Rendering refined SVG...',
          });

          return {
            conversationId: 'conv-123',
            status: 'validating',
            svgCode: '<svg></svg>',
            finalConfidence: null,
            iterations: 3,
            totalUsage: { promptTokens: 300, completionTokens: 150, totalTokens: 450 },
          };
        }
      );

      const message = createEnvelope<SVGArchitectResumePayload>(
        MessageType.SVG_ARCHITECT_RESUME,
        'webview.svgArchitect',
        mockResumePayload,
        'correlation-456'
      );

      await handler.handleResume(message);

      const progressCalls = postMessage.mock.calls.filter(
        (call) => call[0].type === MessageType.SVG_ARCHITECT_PROGRESS
      );

      expect(progressCalls.length).toBeGreaterThanOrEqual(2);
      expect(progressCalls[0][0].payload.status).toBe('refining');
      expect(progressCalls[1][0].payload.status).toBe('rendering');
    });

    it('should send result message on completion', async () => {
      const mockResult = {
        conversationId: 'conv-123',
        status: 'validating' as const,
        svgCode: '<svg></svg>',
        finalConfidence: null,
        iterations: 3,
        totalUsage: { promptTokens: 300, completionTokens: 150, totalTokens: 450 },
      };

      mockOrchestrator.resumeWithUserNotes.mockResolvedValue(mockResult);

      const message = createEnvelope<SVGArchitectResumePayload>(
        MessageType.SVG_ARCHITECT_RESUME,
        'webview.svgArchitect',
        mockResumePayload,
        'correlation-456'
      );

      await handler.handleResume(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SVG_ARCHITECT_RESULT,
          source: 'extension.svgArchitect',
          payload: mockResult,
          correlationId: 'correlation-456',
        })
      );
    });

    it('should handle errors during resume', async () => {
      const error = new Error('Resume failed');
      mockOrchestrator.resumeWithUserNotes.mockRejectedValue(error);

      const message = createEnvelope<SVGArchitectResumePayload>(
        MessageType.SVG_ARCHITECT_RESUME,
        'webview.svgArchitect',
        mockResumePayload,
        'correlation-789'
      );

      await handler.handleResume(message);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Resume with user notes failed',
        error
      );

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          source: 'extension.svgArchitect',
          payload: {
            message: 'Resume failed',
            code: 'RESUME_ERROR',
          },
          correlationId: 'correlation-789',
        })
      );
    });
  });

  describe('handleCancel', () => {
    const mockCancelPayload: SVGArchitectCancelPayload = {
      conversationId: 'conv-123',
    };

    it('should log cancel request and acknowledge gracefully', () => {
      const message = createEnvelope<SVGArchitectCancelPayload>(
        MessageType.SVG_ARCHITECT_CANCEL,
        'webview.svgArchitect',
        mockCancelPayload,
        'correlation-999'
      );

      handler.handleCancel(message);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cancel request: conv-123'
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cancel not yet implemented in orchestrator - request acknowledged'
      );
    });

    it('should not call orchestrator.cancel (not implemented yet)', () => {
      const message = createEnvelope<SVGArchitectCancelPayload>(
        MessageType.SVG_ARCHITECT_CANCEL,
        'webview.svgArchitect',
        mockCancelPayload
      );

      handler.handleCancel(message);

      // Orchestrator.cancel is not called because it's not implemented
      expect(mockOrchestrator.cancel).not.toHaveBeenCalled();
    });
  });

  describe('progress callback integration', () => {
    it('should preserve correlationId in progress messages', async () => {
      mockOrchestrator.startGeneration.mockImplementation(
        async (_input, _options, onProgress) => {
          onProgress({
            conversationId: 'conv-123',
            status: 'analyzing',
            iteration: 0,
            maxIterations: 5,
            message: 'Analyzing...',
          });

          return {
            conversationId: 'conv-123',
            status: 'validating',
            svgCode: '<svg></svg>',
            finalConfidence: null,
            iterations: 1,
            totalUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          };
        }
      );

      const message = createEnvelope<SVGArchitectRequestPayload>(
        MessageType.SVG_ARCHITECT_REQUEST,
        'webview.svgArchitect',
        {
          prompt: 'Test',
          blueprintModel: 'test-model',
          renderModel: 'test-render',
          aspectRatio: '1:1',
          maxIterations: 5,
        },
        'correlation-preserved'
      );

      await handler.handleGenerationRequest(message);

      const progressCalls = postMessage.mock.calls.filter(
        (call) => call[0].type === MessageType.SVG_ARCHITECT_PROGRESS
      );

      expect(progressCalls[0][0].correlationId).toBe('correlation-preserved');
    });

    it('should include optional fields in progress payload when provided', async () => {
      mockOrchestrator.startGeneration.mockImplementation(
        async (_input, _options, onProgress) => {
          onProgress({
            conversationId: 'conv-123',
            status: 'rendering',
            iteration: 1,
            maxIterations: 5,
            message: 'Rendering...',
            svgCode: '<svg><rect /></svg>',
            confidenceScore: 75,
          });

          return {
            conversationId: 'conv-123',
            status: 'validating',
            svgCode: '<svg></svg>',
            finalConfidence: null,
            iterations: 1,
            totalUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          };
        }
      );

      const message = createEnvelope<SVGArchitectRequestPayload>(
        MessageType.SVG_ARCHITECT_REQUEST,
        'webview.svgArchitect',
        {
          prompt: 'Test',
          blueprintModel: 'test-model',
          renderModel: 'test-render',
          aspectRatio: '1:1',
          maxIterations: 5,
        }
      );

      await handler.handleGenerationRequest(message);

      const progressCalls = postMessage.mock.calls.filter(
        (call) => call[0].type === MessageType.SVG_ARCHITECT_PROGRESS
      );

      expect(progressCalls[0][0].payload).toMatchObject({
        svgCode: '<svg><rect /></svg>',
        confidenceScore: 75,
      });
    });
  });
});
