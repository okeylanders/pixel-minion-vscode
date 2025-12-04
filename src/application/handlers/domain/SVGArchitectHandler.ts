/**
 * SVGArchitectHandler - Handles SVG Architect multi-agent pipeline requests (thin handler)
 *
 * Pattern: Thin message router - all business logic in SVGArchitectOrchestrator
 * Responsibilities:
 * - Route SVG Architect messages to orchestrator
 * - Send progress updates during generation
 * - Handle PNG feedback loop for validation
 * - Handle user-guided refinement
 * - Handle cancellation requests
 */
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  SVGArchitectRequestPayload,
  SVGArchitectProgressPayload,
  SVGArchitectPngPayload,
  SVGArchitectResumePayload,
  SVGArchitectResultPayload,
  SVGArchitectCancelPayload,
  SVGArchitectStatusType,
  TokenUsage,
} from '@messages';
import { LoggingService } from '@logging';
import { SVGArchitectOrchestrator, SVGArchitectProgress } from '@ai';
import { SVGArchitectStatus } from '@ai';

export class SVGArchitectHandler {
  /**
   * Map infrastructure status to message status
   */
  private mapStatus(infraStatus: SVGArchitectStatus): SVGArchitectStatusType {
    switch (infraStatus) {
      case 'needs_user':
        return 'awaiting_user';
      case 'max_iterations':
        return 'complete'; // Max iterations is a type of completion
      default:
        return infraStatus as SVGArchitectStatusType;
    }
  }
  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly orchestrator: SVGArchitectOrchestrator,
    private readonly logger: LoggingService,
    private readonly applyTokenUsageCallback?: (usage: TokenUsage) => void
  ) {
    this.logger.debug('SVGArchitectHandler initialized');
  }

  /**
   * Handle new SVG Architect generation request
   */
  async handleGenerationRequest(message: MessageEnvelope<SVGArchitectRequestPayload>): Promise<void> {
    const {
      prompt,
      blueprintModel,
      renderModel,
      aspectRatio,
      maxIterations,
      referenceImage,
      referenceSvgText
    } = message.payload;

    this.logger.info(`SVG Architect generation request: ${prompt.substring(0, 50)}...`);

    try {
      // Use orchestrator for generation with progress callback
      const result = await this.orchestrator.startGeneration(
        {
          prompt,
          referenceImageBase64: referenceImage,
          referenceSvgText,
        },
        {
          blueprintModel,
          renderModel,
          aspectRatio,
          maxIterations,
        },
        (progress: SVGArchitectProgress) => {
          // Send progress updates with detail fields
          this.postMessage(createEnvelope<SVGArchitectProgressPayload>(
            MessageType.SVG_ARCHITECT_PROGRESS,
            'extension.svgArchitect',
            {
              conversationId: progress.conversationId,
              status: this.mapStatus(progress.status),
              iteration: progress.iteration,
              maxIterations: progress.maxIterations,
              message: progress.message,
              svgCode: progress.svgCode,
              confidenceScore: progress.confidenceScore,
              description: progress.description,
              blueprint: progress.blueprint,
              issues: progress.issues,
              corrections: progress.corrections,
              renderedPng: progress.renderedPng,
            },
            message.correlationId
          ));
        }
      );

      // Apply token usage if available
      if (result.totalUsage) {
        this.applyTokenUsage(result.totalUsage);
      }

      // Send final result
      this.postMessage(createEnvelope<SVGArchitectResultPayload>(
        MessageType.SVG_ARCHITECT_RESULT,
        'extension.svgArchitect',
        {
          conversationId: result.conversationId,
          status: this.mapStatus(result.status),
          svgCode: result.svgCode,
          finalConfidence: result.finalConfidence,
          iterations: result.iterations,
          totalUsage: result.totalUsage,
        },
        message.correlationId
      ));

      this.logger.info(`SVG Architect generation complete (${result.iterations} iterations)`);
    } catch (error) {
      this.logger.error('SVG Architect generation failed', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.svgArchitect',
        {
          message: error instanceof Error ? error.message : 'SVG Architect generation failed',
          code: 'SVG_ARCHITECT_ERROR',
        },
        message.correlationId
      ));
    }
  }

  /**
   * Handle PNG ready - webview sends rendered PNG for validation
   */
  async handlePngReady(message: MessageEnvelope<SVGArchitectPngPayload>): Promise<void> {
    const { conversationId, pngBase64 } = message.payload;
    this.logger.info(`PNG ready for validation: ${conversationId}`);

    try {
      // Continue with PNG for validation
      const result = await this.orchestrator.continueWithRenderedPng(
        conversationId,
        pngBase64,
        (progress: SVGArchitectProgress) => {
          // Send progress updates with detail fields
          this.postMessage(createEnvelope<SVGArchitectProgressPayload>(
            MessageType.SVG_ARCHITECT_PROGRESS,
            'extension.svgArchitect',
            {
              conversationId: progress.conversationId,
              status: this.mapStatus(progress.status),
              iteration: progress.iteration,
              maxIterations: progress.maxIterations,
              message: progress.message,
              svgCode: progress.svgCode,
              confidenceScore: progress.confidenceScore,
              description: progress.description,
              blueprint: progress.blueprint,
              issues: progress.issues,
              corrections: progress.corrections,
              renderedPng: progress.renderedPng,
            },
            message.correlationId
          ));
        }
      );

      // Apply token usage if available
      if (result.totalUsage) {
        this.applyTokenUsage(result.totalUsage);
      }

      // Send result
      this.postMessage(createEnvelope<SVGArchitectResultPayload>(
        MessageType.SVG_ARCHITECT_RESULT,
        'extension.svgArchitect',
        {
          conversationId: result.conversationId,
          status: this.mapStatus(result.status),
          svgCode: result.svgCode,
          finalConfidence: result.finalConfidence,
          iterations: result.iterations,
          totalUsage: result.totalUsage,
        },
        message.correlationId
      ));

      this.logger.info(`Validation cycle complete: ${conversationId}`);
    } catch (error) {
      this.logger.error('PNG validation failed', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.svgArchitect',
        {
          message: error instanceof Error ? error.message : 'Validation failed',
          code: 'VALIDATION_ERROR',
        },
        message.correlationId
      ));
    }
  }

  /**
   * Handle resume with user notes
   */
  async handleResume(message: MessageEnvelope<SVGArchitectResumePayload>): Promise<void> {
    const { conversationId, userNotes } = message.payload;
    this.logger.info(`Resuming with user notes: ${conversationId}`);

    try {
      // Resume with user guidance
      const result = await this.orchestrator.resumeWithUserNotes(
        conversationId,
        userNotes,
        (progress: SVGArchitectProgress) => {
          // Send progress updates with detail fields
          this.postMessage(createEnvelope<SVGArchitectProgressPayload>(
            MessageType.SVG_ARCHITECT_PROGRESS,
            'extension.svgArchitect',
            {
              conversationId: progress.conversationId,
              status: this.mapStatus(progress.status),
              iteration: progress.iteration,
              maxIterations: progress.maxIterations,
              message: progress.message,
              svgCode: progress.svgCode,
              confidenceScore: progress.confidenceScore,
              description: progress.description,
              blueprint: progress.blueprint,
              issues: progress.issues,
              corrections: progress.corrections,
              renderedPng: progress.renderedPng,
            },
            message.correlationId
          ));
        }
      );

      // Apply token usage if available
      if (result.totalUsage) {
        this.applyTokenUsage(result.totalUsage);
      }

      // Send result
      this.postMessage(createEnvelope<SVGArchitectResultPayload>(
        MessageType.SVG_ARCHITECT_RESULT,
        'extension.svgArchitect',
        {
          conversationId: result.conversationId,
          status: this.mapStatus(result.status),
          svgCode: result.svgCode,
          finalConfidence: result.finalConfidence,
          iterations: result.iterations,
          totalUsage: result.totalUsage,
        },
        message.correlationId
      ));

      this.logger.info(`Resume complete: ${conversationId}`);
    } catch (error) {
      this.logger.error('Resume with user notes failed', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.svgArchitect',
        {
          message: error instanceof Error ? error.message : 'Resume failed',
          code: 'RESUME_ERROR',
        },
        message.correlationId
      ));
    }
  }

  /**
   * Handle cancel request
   */
  handleCancel(message: MessageEnvelope<SVGArchitectCancelPayload>): void {
    const { conversationId } = message.payload;
    this.logger.info(`Cancel request: ${conversationId}`);

    // Orchestrator doesn't currently implement cancel() method
    // For now, just acknowledge gracefully
    this.logger.warn('Cancel not yet implemented in orchestrator - request acknowledged');
  }

  /**
   * Apply token usage via callback
   */
  private applyTokenUsage(usage: TokenUsage): void {
    if (this.applyTokenUsageCallback) {
      this.applyTokenUsageCallback(usage);
    }
  }
}
