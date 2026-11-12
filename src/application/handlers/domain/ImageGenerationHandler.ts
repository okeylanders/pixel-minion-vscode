/**
 * ImageGenerationHandler - Routes image generation messages to orchestrator
 *
 * Pattern: Thin handler - message routing only, no business logic
 * Responsibilities:
 * - Extract payloads from messages
 * - Route to orchestrator
 * - Transform responses for presentation
 * - Handle file operations (VSCode-specific)
 */
import * as vscode from 'vscode';
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  ImageGenerationRequestPayload,
  ImageGenerationContinuePayload,
  ImageGenerationResponsePayload,
  ImageSaveRequestPayload,
  ImageSaveResultPayload,
  GeneratedImage,
  StatusPayload,
  TokenUsage,
} from '@messages';
import { LoggingService } from '@logging';
import { ImageOrchestrator, RehydrationTurn } from '@ai';
import { imageExtensionForMime, sniffImageMime } from '../../../shared/media/imageFormats';
import { plainSaveFileName } from '../saveFileName';
import { workspaceOutputDirectory } from '../outputDirectory';

export class ImageGenerationHandler {
  private readonly configSection = 'pixelMinion';

  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly orchestrator: ImageOrchestrator,
    private readonly logger: LoggingService,
    private readonly applyTokenUsageCallback?: (usage: TokenUsage) => void
  ) {
    this.logger.debug('ImageGenerationHandler initialized');
  }

  /**
   * Handle new image generation request
   */
  async handleGenerationRequest(message: MessageEnvelope<ImageGenerationRequestPayload>): Promise<void> {
    const { prompt, model, aspectRatio, referenceImages, referenceSvgText, conversationId, seed } = message.payload;
    this.logger.info(`Image generation request: ${prompt.substring(0, 50)}...`);

    this.sendLoadingStatus(true, message.correlationId);

    try {
      const result = await this.orchestrator.generateImage(prompt, {
        model,
        aspectRatio,
        seed,
        referenceImages,
        referenceSvgText,
      }, conversationId);

      // Apply token usage if available
      if (result.usage) {
        this.applyTokenUsage(result.usage);
      }

      const images = this.transformToGeneratedImages(
        result.result,
        result.conversationId,
        result.turnNumber,
        prompt
      );

      this.postMessage(createEnvelope<ImageGenerationResponsePayload>(
        MessageType.IMAGE_GENERATION_RESPONSE,
        'extension.imageGeneration',
        {
          conversationId: result.conversationId,
          images,
          turnNumber: result.turnNumber,
          usage: result.usage,
        },
        message.correlationId
      ));
    } catch (error) {
      this.sendError(error, message.correlationId);
    } finally {
      this.sendLoadingStatus(false, message.correlationId);
    }
  }

  /**
   * Handle conversation continuation request
   */
  async handleContinueRequest(message: MessageEnvelope<ImageGenerationContinuePayload>): Promise<void> {
    const { prompt, conversationId, history, model, aspectRatio } = message.payload;
    this.logger.info(`Image generation continue: ${prompt.substring(0, 50)}...`);

    this.sendLoadingStatus(true, message.correlationId);

    try {
      // Transform history to rehydration format
      const rehydrationHistory: RehydrationTurn[] | undefined = history?.map(h => ({
        prompt: h.prompt,
        images: h.images,
        referenceSvgText: h.referenceSvgText,
      }));

      // A refinement carries only its prompt; references and SVG text stay
      // with the turns that sent them (in the transcript or `history`).
      const result = await this.orchestrator.continueConversation(
        conversationId,
        prompt,
        rehydrationHistory,
        model,
        aspectRatio
      );

      // Apply token usage if available
      if (result.usage) {
        this.applyTokenUsage(result.usage);
      }

      const images = this.transformToGeneratedImages(
        result.result,
        result.conversationId,
        result.turnNumber,
        prompt
      );

      this.postMessage(createEnvelope<ImageGenerationResponsePayload>(
        MessageType.IMAGE_GENERATION_RESPONSE,
        'extension.imageGeneration',
        {
          conversationId: result.conversationId,
          images,
          turnNumber: result.turnNumber,
          usage: result.usage,
        },
        message.correlationId
      ));
    } catch (error) {
      this.sendError(error, message.correlationId);
    } finally {
      this.sendLoadingStatus(false, message.correlationId);
    }
  }

  /**
   * Handle conversation clear request
   */
  handleClearConversation(message: MessageEnvelope<{ conversationId: string }>): void {
    const { conversationId } = message.payload;
    this.logger.info(`Clearing conversation: ${conversationId}`);
    try {
      this.orchestrator.clearConversation(conversationId);
    } catch (error) {
      this.logger.warn('Image conversation clear refused', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.imageGeneration',
        {
          message: error instanceof Error ? error.message : 'Could not clear the conversation',
          code: 'IMAGE_CLEAR_ERROR',
        },
        message.correlationId
      ));
    }
  }

  /**
   * Handle image save request
   */
  async handleSaveRequest(message: MessageEnvelope<ImageSaveRequestPayload>): Promise<void> {
    const { imageId, data, mimeType, suggestedFilename } = message.payload;
    this.logger.info(`Saving image: ${suggestedFilename}`);

    let fileUri: vscode.Uri | undefined;
    try {
      fileUri = await this.saveImage(data, mimeType, suggestedFilename);
    } catch (error) {
      this.logger.error('Image save failed', error);
      this.postMessage(createEnvelope<ImageSaveResultPayload>(
        MessageType.IMAGE_SAVE_RESULT,
        'extension.imageGeneration',
        {
          success: false,
          imageId,
          error: error instanceof Error ? error.message : 'Failed to save image',
        },
        message.correlationId
      ));
      return;
    }

    if (!fileUri) {
      this.logger.info('Image save cancelled');
      this.postMessage(createEnvelope<ImageSaveResultPayload>(
        MessageType.IMAGE_SAVE_RESULT,
        'extension.imageGeneration',
        { success: false, cancelled: true, imageId },
        message.correlationId
      ));
      return;
    }

    // Exactly one result per request, sent once the file is written.
    this.postMessage(createEnvelope<ImageSaveResultPayload>(
      MessageType.IMAGE_SAVE_RESULT,
      'extension.imageGeneration',
      { success: true, imageId, filePath: fileUri.fsPath },
      message.correlationId
    ));

    // Opening the file is a convenience: failing to open it can't undo a
    // completed write, so it must not turn into a second, failed result.
    try {
      await vscode.commands.executeCommand('vscode.open', fileUri);
      this.logger.info(`Image saved and opened: ${fileUri.fsPath}`);
    } catch (error) {
      this.logger.warn(`Image saved to ${fileUri.fsPath} but could not be opened`, error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private sendLoadingStatus(isLoading: boolean, correlationId?: string): void {
    this.postMessage(createEnvelope<StatusPayload>(
      MessageType.STATUS,
      'extension.imageGeneration',
      { message: isLoading ? 'Generating image...' : '', isLoading },
      correlationId
    ));
  }

  private sendError(error: unknown, correlationId?: string): void {
    this.logger.error('Image generation failed', error);
    this.postMessage(createEnvelope(
      MessageType.ERROR,
      'extension.imageGeneration',
      {
        message: error instanceof Error ? error.message : 'Image generation failed',
        code: 'IMAGE_GENERATION_ERROR',
      },
      correlationId
    ));
  }

  private transformToGeneratedImages(
    result: { images: Array<{ data: string; mimeType: string }>; seed: number },
    conversationId: string,
    turnNumber: number,
    prompt: string
  ): GeneratedImage[] {
    return result.images.map((img, index) => ({
      id: `${conversationId}-${turnNumber}-${index}`,
      data: img.data,
      mimeType: img.mimeType,
      prompt,
      timestamp: Date.now(),
      seed: result.seed,
    }));
  }

  /**
   * Write the image and return where it went, or undefined when the user
   * cancels the save dialog. The extension comes from the image bytes, so a
   * WebP is saved as `.webp` whatever name the webview suggested, and data we
   * can't identify as PNG, JPEG, WebP or GIF is refused instead of being
   * written as `.jpg`.
   */
  private async saveImage(dataUrl: string, mimeType: string, suggestedFilename: string): Promise<vscode.Uri | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    const match = dataUrl.match(/^data:image\/[\w.+-]+;base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid image data URL');
    }
    const buffer = Buffer.from(match[1], 'base64');
    const detectedMime = sniffImageMime(buffer);
    const extension = imageExtensionForMime(detectedMime);
    if (!detectedMime || !extension) {
      throw new Error(`Can't save this image: its format (${mimeType || 'unknown'}) isn't PNG, JPEG, WebP or GIF.`);
    }
    if (imageExtensionForMime(mimeType) !== extension) {
      this.logger.warn(`Image labelled ${mimeType} contains ${detectedMime}; saving as .${extension}`);
    }

    // A plain name, never a path; its extension always matches the bytes.
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const suggested = suggestedFilename ? plainSaveFileName(suggestedFilename) : `image-${timestamp}`;
    const stem = suggested.replace(/\.[A-Za-z0-9]+$/, '');
    const filename = `${stem}.${extension}`;

    let fileUri: vscode.Uri;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      // No workspace open - show save dialog
      const result = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(filename),
        filters: {
          'Images': [extension],
          'All Files': ['*'],
        },
        saveLabel: 'Save Image',
      });

      if (!result) {
        return undefined;
      }
      fileUri = result;
    } else {
      // Workspace available - save to output directory
      const workspaceRoot = workspaceFolders[0].uri;
      const config = vscode.workspace.getConfiguration(this.configSection);
      // Contained in the workspace folder, whatever the (possibly
      // repository-supplied) setting says.
      const outputDirUri = workspaceOutputDirectory(workspaceRoot, config.get<string>('outputDirectory', 'pixel-minion'));

      try {
        await vscode.workspace.fs.createDirectory(outputDirUri);
      } catch {
        // Directory may already exist
      }

      fileUri = vscode.Uri.joinPath(outputDirUri, filename);
    }

    await vscode.workspace.fs.writeFile(fileUri, buffer);

    return fileUri;
  }

  private applyTokenUsage(usage: TokenUsage): void {
    if (this.applyTokenUsageCallback) {
      this.applyTokenUsageCallback(usage);
    }
  }
}
