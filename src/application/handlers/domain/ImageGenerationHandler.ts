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
    const { prompt, conversationId, history, model, aspectRatio, referenceSvgText } = message.payload;
    this.logger.info(`Image generation continue: ${prompt.substring(0, 50)}...`);

    this.sendLoadingStatus(true, message.correlationId);

    try {
      // Transform history to rehydration format
      const rehydrationHistory: RehydrationTurn[] | undefined = history?.map(h => ({
        prompt: h.prompt,
        images: h.images,
        referenceSvgText: h.referenceSvgText,
      }));

      const result = await this.orchestrator.continueConversation(
        conversationId,
        prompt,
        rehydrationHistory,
        model,
        aspectRatio,
        referenceSvgText
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
    this.orchestrator.clearConversation(conversationId);
  }

  /**
   * Handle image save request
   */
  async handleSaveRequest(message: MessageEnvelope<ImageSaveRequestPayload>): Promise<void> {
    const { imageId, data, mimeType, suggestedFilename } = message.payload;
    this.logger.info(`Saving image: ${suggestedFilename}`);

    try {
      const fileUri = await this.saveImage(data, mimeType, suggestedFilename);

      this.postMessage(createEnvelope<ImageSaveResultPayload>(
        MessageType.IMAGE_SAVE_RESULT,
        'extension.imageGeneration',
        { success: true, imageId, filePath: fileUri.fsPath },
        message.correlationId
      ));

      await vscode.commands.executeCommand('vscode.open', fileUri);
      this.logger.info(`Image saved and opened: ${fileUri.fsPath}`);
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

  private async saveImage(dataUrl: string, mimeType: string, suggestedFilename: string): Promise<vscode.Uri> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    // Generate filename if not provided
    let filename = suggestedFilename;
    if (!filename) {
      const extension = mimeType === 'image/png' ? 'png' : 'jpg';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      filename = `image-${timestamp}.${extension}`;
    }

    let fileUri: vscode.Uri;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      // No workspace open - show save dialog
      const extension = mimeType === 'image/png' ? 'png' : 'jpg';
      const result = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(filename),
        filters: {
          'Images': [extension],
          'All Files': ['*'],
        },
        saveLabel: 'Save Image',
      });

      if (!result) {
        throw new Error('Save cancelled');
      }
      fileUri = result;
    } else {
      // Workspace available - save to output directory
      const workspaceRoot = workspaceFolders[0].uri;
      const config = vscode.workspace.getConfiguration(this.configSection);
      const outputDir = config.get<string>('outputDirectory', 'pixel-minion');
      const outputDirUri = vscode.Uri.joinPath(workspaceRoot, outputDir);

      try {
        await vscode.workspace.fs.createDirectory(outputDirUri);
      } catch {
        // Directory may already exist
      }

      fileUri = vscode.Uri.joinPath(outputDirUri, filename);
    }
    const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid image data URL');
    }

    const buffer = Buffer.from(match[1], 'base64');
    await vscode.workspace.fs.writeFile(fileUri, buffer);

    return fileUri;
  }

  private applyTokenUsage(usage: TokenUsage): void {
    if (this.applyTokenUsageCallback) {
      this.applyTokenUsageCallback(usage);
    }
  }
}
