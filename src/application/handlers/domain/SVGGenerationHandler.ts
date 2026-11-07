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
import { inspectSvgDocument } from '../../../shared/svg/SVGDocumentPolicy';
import { plainSaveFileName } from '../saveFileName';

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
    const { prompt, conversationId, history, model, aspectRatio } = message.payload;
    this.logger.info(`SVG generation continue: ${prompt.substring(0, 50)}...`);

    // Send loading status
    this.postMessage(createEnvelope<StatusPayload>(
      MessageType.STATUS,
      'extension.svgGeneration',
      { message: 'Generating SVG...', isLoading: true },
      message.correlationId
    ));

    try {
      // A refinement carries only its prompt; attachments stay with the
      // turns that sent them (in the transcript or `history`).
      const result = await this.svgOrchestrator.continueSVG(
        conversationId,
        prompt,
        history,
        model,
        aspectRatio
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
    try {
      this.svgOrchestrator.clearConversation(conversationId);
    } catch (error) {
      this.logger.warn('SVG conversation clear refused', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.svgGeneration',
        {
          message: error instanceof Error ? error.message : 'Could not clear the conversation',
          code: 'SVG_CLEAR_ERROR',
        },
        message.correlationId
      ));
    }
  }

  /**
   * Handle SVG save request
   */
  async handleSaveRequest(message: MessageEnvelope<SVGSaveRequestPayload>): Promise<void> {
    const { svgCode, suggestedFilename } = message.payload;
    this.logger.info(`Saving SVG: ${suggestedFilename}`);

    let fileUri: vscode.Uri | undefined;
    try {
      fileUri = await this.saveSVG(svgCode, suggestedFilename);
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
      return;
    }

    if (!fileUri) {
      this.logger.info('SVG save cancelled');
      this.postMessage(createEnvelope<SVGSaveResultPayload>(
        MessageType.SVG_SAVE_RESULT,
        'extension.svgGeneration',
        { success: false, cancelled: true },
        message.correlationId
      ));
      return;
    }

    // Exactly one result per request, sent once the file is written.
    this.postMessage(createEnvelope<SVGSaveResultPayload>(
      MessageType.SVG_SAVE_RESULT,
      'extension.svgGeneration',
      {
        success: true,
        filePath: fileUri.fsPath,
      },
      message.correlationId
    ));

    // Opening the file is a convenience: failing to open it can't undo a
    // completed write, so it must not turn into a second, failed result.
    try {
      await vscode.commands.executeCommand('vscode.open', fileUri);
      this.logger.info(`SVG saved and opened: ${fileUri.fsPath}`);
    } catch (error) {
      this.logger.warn(`SVG saved to ${fileUri.fsPath} but could not be opened`, error);
    }
  }

  /**
   * Save SVG to workspace or user-selected location. Returns undefined when
   * the user cancels the save dialog. A document the SVGDocumentPolicy
   * rejects is never written: a saved .svg opened in a browser runs with full
   * privileges, unlike the webview's isolated preview.
   */
  private async saveSVG(svgCode: string, suggestedFilename: string): Promise<vscode.Uri | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    const verdict = inspectSvgDocument(svgCode);
    if (!verdict.accepted) {
      throw new Error(`Not saved: this SVG ${verdict.reason}.`);
    }

    // A plain name, never a path
    let filename = suggestedFilename ? plainSaveFileName(suggestedFilename) : '';
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      filename = `svg-${timestamp}.svg`;
    }

    // Ensure .svg extension
    if (!filename.toLowerCase().endsWith('.svg')) {
      filename += '.svg';
    }

    let fileUri: vscode.Uri;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      // No workspace open - show save dialog
      const result = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(filename),
        filters: {
          'SVG Files': ['svg'],
          'All Files': ['*'],
        },
        saveLabel: 'Save SVG',
      });

      if (!result) {
        return undefined;
      }
      fileUri = result;
    } else {
      // Workspace available - save to output directory
      const workspaceRoot = workspaceFolders[0].uri;
      const config = vscode.workspace.getConfiguration(this.configSection);
      const outputDir = config.get<string>('outputDirectory', 'pixel-minion');
      const outputDirUri = vscode.Uri.joinPath(workspaceRoot, outputDir);

      // Ensure directory exists
      try {
        await vscode.workspace.fs.createDirectory(outputDirUri);
      } catch (error) {
        // Directory might already exist, that's okay
        this.logger.debug('Output directory creation skipped (may already exist)');
      }

      fileUri = vscode.Uri.joinPath(outputDirUri, filename);
    }

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
