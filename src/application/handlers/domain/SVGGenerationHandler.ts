/**
 * SVGGenerationHandler - Handles SVG generation requests (thin handler)
 *
 * Pattern: Thin message router - all business logic in infrastructure layer
 * Responsibilities:
 * - Route SVG generation messages
 * - Send status updates
 * - Handle file save operations (uses VSCode workspace APIs)
 */
import * as vscode from 'vscode';
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  SVGGenerationRequestPayload,
  SVGGenerationContinuePayload,
  SVGGenerationResponsePayload,
  SVGSaveRequestPayload,
  SVGSaveResultPayload,
  StatusPayload,
  TokenUsage,
} from '@messages';
import { LoggingService } from '@logging';
import { SVGOrchestrator } from '@ai';

export class SVGGenerationHandler {
  private readonly configSection = 'pixelMinion';

  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly svgOrchestrator: SVGOrchestrator,
    private readonly logger: LoggingService,
    private readonly applyTokenUsageCallback?: (usage: TokenUsage) => void
  ) {
    this.logger.debug('SVGGenerationHandler initialized');
  }

  /**
   * Handle new SVG generation request
   */
  async handleGenerationRequest(message: MessageEnvelope<SVGGenerationRequestPayload>): Promise<void> {
    const { prompt, model, aspectRatio, referenceImage, referenceSvgText, conversationId } = message.payload;
    this.logger.info(`SVG generation request: ${prompt.substring(0, 50)}...`);

    // Send loading status
    this.postMessage(createEnvelope<StatusPayload>(
      MessageType.STATUS,
      'extension.svgGeneration',
      { message: 'Generating SVG...', isLoading: true },
      message.correlationId
    ));

    try {
      // Use orchestrator for generation
      const result = await this.svgOrchestrator.generateSVG(
        prompt,
        { model, aspectRatio, referenceImage, referenceSvgText },
        conversationId
      );

      // Apply token usage if available
      if (result.usage) {
        this.applyTokenUsage(result.usage);
      }

      // Send response
      this.postMessage(createEnvelope<SVGGenerationResponsePayload>(
        MessageType.SVG_GENERATION_RESPONSE,
        'extension.svgGeneration',
        {
          conversationId: result.conversationId,
          svgCode: result.svgCode,
          turnNumber: result.turnNumber,
          usage: result.usage,
        },
        message.correlationId
      ));

      this.logger.info(`SVG generation complete (turn ${result.turnNumber})`);
    } catch (error) {
      this.logger.error('SVG generation failed', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.svgGeneration',
        {
          message: error instanceof Error ? error.message : 'SVG generation failed',
          code: 'SVG_GENERATION_ERROR',
        },
        message.correlationId
      ));
    } finally {
      // Clear loading status
      this.postMessage(createEnvelope<StatusPayload>(
        MessageType.STATUS,
        'extension.svgGeneration',
        { message: '', isLoading: false },
        message.correlationId
      ));
    }
  }

  /**
   * Handle conversation continuation request
   */
  async handleContinueRequest(message: MessageEnvelope<SVGGenerationContinuePayload>): Promise<void> {
    const { prompt, conversationId, history, model, aspectRatio, referenceSvgText } = message.payload;
    this.logger.info(`SVG generation continue: ${prompt.substring(0, 50)}...`);

    // Send loading status
    this.postMessage(createEnvelope<StatusPayload>(
      MessageType.STATUS,
      'extension.svgGeneration',
      { message: 'Generating SVG...', isLoading: true },
      message.correlationId
    ));

    try {
      // Use orchestrator for continuation
      const result = await this.svgOrchestrator.continueSVG(
        conversationId,
        prompt,
        history,
        model,
        aspectRatio,
        referenceSvgText
      );

      // Apply token usage if available
      if (result.usage) {
        this.applyTokenUsage(result.usage);
      }

      // Send response
      this.postMessage(createEnvelope<SVGGenerationResponsePayload>(
        MessageType.SVG_GENERATION_RESPONSE,
        'extension.svgGeneration',
        {
          conversationId: result.conversationId,
          svgCode: result.svgCode,
          turnNumber: result.turnNumber,
          usage: result.usage,
        },
        message.correlationId
      ));

      this.logger.info(`SVG generation complete (turn ${result.turnNumber})`);
    } catch (error) {
      this.logger.error('SVG generation continuation failed', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.svgGeneration',
        {
          message: error instanceof Error ? error.message : 'Conversation not found. Please start a new generation.',
          code: 'CONVERSATION_NOT_FOUND',
        },
        message.correlationId
      ));
    } finally {
      // Clear loading status
      this.postMessage(createEnvelope<StatusPayload>(
        MessageType.STATUS,
        'extension.svgGeneration',
        { message: '', isLoading: false },
        message.correlationId
      ));
    }
  }

  /**
   * Handle conversation clear request
   */
  handleClearConversation(message: MessageEnvelope<{ conversationId: string }>): void {
    const { conversationId } = message.payload;
    this.logger.info(`Clearing SVG generation conversation: ${conversationId}`);
    this.svgOrchestrator.clearConversation(conversationId);
  }

  /**
   * Handle SVG save request
   */
  async handleSaveRequest(message: MessageEnvelope<SVGSaveRequestPayload>): Promise<void> {
    const { svgCode, suggestedFilename } = message.payload;
    this.logger.info(`Saving SVG: ${suggestedFilename}`);

    try {
      const fileUri = await this.saveSVG(svgCode, suggestedFilename);

      this.postMessage(createEnvelope<SVGSaveResultPayload>(
        MessageType.SVG_SAVE_RESULT,
        'extension.svgGeneration',
        {
          success: true,
          filePath: fileUri.fsPath,
        },
        message.correlationId
      ));

      await vscode.commands.executeCommand('vscode.open', fileUri);
      this.logger.info(`SVG saved and opened: ${fileUri.fsPath}`);
    } catch (error) {
      this.logger.error('SVG save failed', error);
      this.postMessage(createEnvelope<SVGSaveResultPayload>(
        MessageType.SVG_SAVE_RESULT,
        'extension.svgGeneration',
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save SVG',
        },
        message.correlationId
      ));
    }
  }

  /**
   * Save SVG to workspace
   */
  private async saveSVG(svgCode: string, suggestedFilename: string): Promise<vscode.Uri> {
    // Get workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }

    const workspaceRoot = workspaceFolders[0].uri;

    // Get output directory from settings
    const config = vscode.workspace.getConfiguration(this.configSection);
    const outputDir = config.get<string>('outputDirectory', 'pixel-minion');

    // Create output directory URI
    const outputDirUri = vscode.Uri.joinPath(workspaceRoot, outputDir);

    // Ensure directory exists
    try {
      await vscode.workspace.fs.createDirectory(outputDirUri);
    } catch (error) {
      // Directory might already exist, that's okay
      this.logger.debug('Output directory creation skipped (may already exist)');
    }

    // Generate filename if not provided
    let filename = suggestedFilename;
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      filename = `svg-${timestamp}.svg`;
    }

    // Ensure .svg extension
    if (!filename.toLowerCase().endsWith('.svg')) {
      filename += '.svg';
    }

    // Create file URI
    const fileUri = vscode.Uri.joinPath(outputDirUri, filename);

    // Convert SVG string to buffer
    const buffer = Buffer.from(svgCode, 'utf-8');

    // Write file
    await vscode.workspace.fs.writeFile(fileUri, buffer);

    return fileUri;
  }

  private applyTokenUsage(usage: TokenUsage): void {
    if (this.applyTokenUsageCallback) {
      this.applyTokenUsageCallback(usage);
    }
  }
}
