/**
 * ImageGenerationHandler - Handles image generation requests
 *
 * Pattern: Domain handler that delegates to infrastructure layer
 * Responsibilities:
 * - Route messages to appropriate operations
 * - Transform between presentation and infrastructure types
 * - Handle file save operations (VSCode-specific)
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
} from '@messages';
import { LoggingService } from '@logging';
import {
  ImageGenerationClient,
  ImageConversationManager,
  RehydrationTurn,
} from '@ai';

export class ImageGenerationHandler {
  private readonly configSection = 'pixelMinion';

  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly imageClient: ImageGenerationClient,
    private readonly conversationManager: ImageConversationManager,
    private readonly logger: LoggingService
  ) {
    this.logger.debug('ImageGenerationHandler initialized');
  }

  /**
   * Generate a random seed (0 to 2^31-1)
   */
  private generateSeed(): number {
    return Math.floor(Math.random() * 2147483647);
  }

  /**
   * Handle new image generation request
   */
  async handleGenerationRequest(message: MessageEnvelope<ImageGenerationRequestPayload>): Promise<void> {
    const { prompt, model, aspectRatio, referenceImages, conversationId, seed: requestedSeed } = message.payload;

    // Use provided seed or generate a new one
    const seed = requestedSeed ?? this.generateSeed();
    this.logger.info(`Image generation request: ${prompt.substring(0, 50)}... (seed: ${seed})`);

    // Send loading status
    this.postMessage(createEnvelope<StatusPayload>(
      MessageType.STATUS,
      'extension.imageGeneration',
      { message: 'Generating image...', isLoading: true },
      message.correlationId
    ));

    try {
      // Check if client is configured
      if (!(await this.imageClient.isConfigured())) {
        throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
      }

      // Get or create conversation
      const conversation = this.conversationManager.getOrCreate(conversationId, model, aspectRatio);

      // Add user message with prompt and optional reference images
      this.conversationManager.addUserMessage(conversation.id, prompt, referenceImages);
      conversation.lastSeed = seed;

      // Call image generation API
      const result = await this.imageClient.generateImages({
        messages: conversation.messages,
        model: conversation.model,
        aspectRatio: conversation.aspectRatio,
        seed,
      });

      // Add assistant response to conversation
      this.conversationManager.addAssistantResponse(conversation.id, result);

      // Transform to presentation format
      const images = this.transformToGeneratedImages(result, conversation.id, conversation.turnNumber, prompt, seed);

      // Send response
      this.postMessage(createEnvelope<ImageGenerationResponsePayload>(
        MessageType.IMAGE_GENERATION_RESPONSE,
        'extension.imageGeneration',
        {
          conversationId: conversation.id,
          images,
          turnNumber: conversation.turnNumber,
        },
        message.correlationId
      ));

      this.logger.info(`Image generation complete (turn ${conversation.turnNumber})`);
    } catch (error) {
      this.logger.error('Image generation failed', error);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.imageGeneration',
        {
          message: error instanceof Error ? error.message : 'Image generation failed',
          code: 'IMAGE_GENERATION_ERROR',
        },
        message.correlationId
      ));
    } finally {
      // Clear loading status
      this.postMessage(createEnvelope<StatusPayload>(
        MessageType.STATUS,
        'extension.imageGeneration',
        { message: '', isLoading: false },
        message.correlationId
      ));
    }
  }

  /**
   * Handle conversation continuation request
   */
  async handleContinueRequest(message: MessageEnvelope<ImageGenerationContinuePayload>): Promise<void> {
    const { prompt, conversationId, history, model, aspectRatio } = message.payload;
    this.logger.info(`Image generation continue: ${prompt.substring(0, 50)}...`);

    let conversation = this.conversationManager.get(conversationId);

    // If conversation not found but history provided, re-hydrate from history
    if (!conversation && history && history.length > 0 && model && aspectRatio) {
      this.logger.info(`Conversation ${conversationId} not found, re-hydrating from ${history.length} turns`);
      const rehydrationHistory: RehydrationTurn[] = history.map(h => ({
        prompt: h.prompt,
        images: h.images,
      }));
      conversation = this.conversationManager.rehydrate(conversationId, model, aspectRatio, rehydrationHistory);
    }

    if (!conversation) {
      this.logger.error(`Conversation ${conversationId} not found and no history provided`);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.imageGeneration',
        {
          message: 'Conversation not found. Please start a new generation.',
          code: 'CONVERSATION_NOT_FOUND',
        },
        message.correlationId
      ));
      return;
    }

    // Reuse the generation request handler
    // Use the last seed for consistency when refining images
    const requestPayload: ImageGenerationRequestPayload = {
      prompt,
      model: conversation.model,
      aspectRatio: conversation.aspectRatio as any,
      conversationId,
      seed: conversation.lastSeed,
    };

    await this.handleGenerationRequest({
      ...message,
      payload: requestPayload,
    } as MessageEnvelope<ImageGenerationRequestPayload>);
  }

  /**
   * Handle conversation clear request
   */
  handleClearConversation(message: MessageEnvelope<{ conversationId: string }>): void {
    const { conversationId } = message.payload;
    this.logger.info(`Clearing image generation conversation: ${conversationId}`);
    this.conversationManager.clear(conversationId);
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
        {
          success: true,
          imageId,
          filePath: fileUri.fsPath,
        },
        message.correlationId
      ));

      // Open the saved image in VSCode's preview
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

  /**
   * Transform infrastructure result to presentation format
   */
  private transformToGeneratedImages(
    result: { images: Array<{ data: string; mimeType: string }>; seed: number },
    conversationId: string,
    turnNumber: number,
    prompt: string,
    seed: number
  ): GeneratedImage[] {
    return result.images.map((img, index) => ({
      id: `${conversationId}-${turnNumber}-${index}`,
      data: img.data,
      mimeType: img.mimeType,
      prompt,
      timestamp: Date.now(),
      seed,
    }));
  }

  /**
   * Save image to workspace and return the file URI
   */
  private async saveImage(dataUrl: string, mimeType: string, suggestedFilename: string): Promise<vscode.Uri> {
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
      const extension = mimeType === 'image/png' ? 'png' : 'jpg';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      filename = `image-${timestamp}.${extension}`;
    }

    // Create file URI
    const fileUri = vscode.Uri.joinPath(outputDirUri, filename);

    // Extract base64 data from data URL
    const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid image data URL');
    }

    const base64Data = match[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // Write file
    await vscode.workspace.fs.writeFile(fileUri, buffer);

    return fileUri;
  }
}
