/**
 * ImageGenerationHandler - Handles image generation requests via OpenRouter
 *
 * Pattern: Domain handler for AI image generation with conversation state management
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
  ASPECT_RATIO_DIMENSIONS,
  StatusPayload,
} from '@messages';
import { LoggingService } from '@logging';
import { SecretStorageService } from '@secrets';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
  images?: Array<{ image_url: { url: string } }>;
}

interface ConversationState {
  id: string;
  messages: ConversationMessage[];
  model: string;
  aspectRatio: string;
  turnNumber: number;
}

export class ImageGenerationHandler {
  private readonly configSection = 'pixelMinion';
  private readonly conversations = new Map<string, ConversationState>();

  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService
  ) {
    this.logger.debug('ImageGenerationHandler initialized');
  }

  /**
   * Handle new image generation request
   */
  async handleGenerationRequest(message: MessageEnvelope<ImageGenerationRequestPayload>): Promise<void> {
    const { prompt, model, aspectRatio, referenceImages, conversationId } = message.payload;
    this.logger.info(`Image generation request: ${prompt.substring(0, 50)}...`);

    // Send loading status
    this.postMessage(createEnvelope<StatusPayload>(
      MessageType.STATUS,
      'extension.imageGeneration',
      { message: 'Generating image...', isLoading: true },
      message.correlationId
    ));

    try {
      // Get API key
      const apiKey = await this.secretStorage.getApiKey();
      if (!apiKey) {
        throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
      }

      // Get or create conversation
      const activeConversationId = conversationId ?? this.createConversation(model, aspectRatio);
      const conversation = this.conversations.get(activeConversationId);
      if (!conversation) {
        throw new Error(`Conversation ${activeConversationId} not found`);
      }

      // Build user message with prompt and optional reference images
      const content: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: prompt }
      ];

      // Add reference images if provided
      if (referenceImages && referenceImages.length > 0) {
        for (const imageData of referenceImages) {
          content.push({
            type: 'image_url',
            image_url: { url: imageData }
          });
        }
      }

      const userMessage: ConversationMessage = {
        role: 'user',
        content
      };

      conversation.messages.push(userMessage);

      // Call OpenRouter API
      const images = await this.callOpenRouter(apiKey, conversation);

      // Create assistant message with the generated images
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: [{ type: 'text', text: 'Generated images' }],
        images: images.map(img => ({ image_url: { url: img.data } }))
      };

      conversation.messages.push(assistantMessage);
      conversation.turnNumber++;

      // Send response
      this.postMessage(createEnvelope<ImageGenerationResponsePayload>(
        MessageType.IMAGE_GENERATION_RESPONSE,
        'extension.imageGeneration',
        {
          conversationId: activeConversationId,
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
    const { prompt, conversationId } = message.payload;
    this.logger.info(`Image generation continue: ${prompt.substring(0, 50)}...`);

    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      this.logger.error(`Conversation ${conversationId} not found`);
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

    // Reuse the generation request handler by creating a request payload
    const requestPayload: ImageGenerationRequestPayload = {
      prompt,
      model: conversation.model,
      aspectRatio: conversation.aspectRatio as any,
      conversationId,
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
    this.conversations.delete(conversationId);
  }

  /**
   * Handle image save request
   */
  async handleSaveRequest(message: MessageEnvelope<ImageSaveRequestPayload>): Promise<void> {
    const { imageId, data, mimeType, suggestedFilename } = message.payload;
    this.logger.info(`Saving image: ${suggestedFilename}`);

    try {
      const filePath = await this.saveImage(data, mimeType, suggestedFilename);

      this.postMessage(createEnvelope<ImageSaveResultPayload>(
        MessageType.IMAGE_SAVE_RESULT,
        'extension.imageGeneration',
        {
          success: true,
          imageId,
          filePath,
        },
        message.correlationId
      ));

      this.logger.info(`Image saved successfully: ${filePath}`);
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
   * Create a new conversation
   */
  private createConversation(model: string, aspectRatio: string): string {
    const id = `img-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.conversations.set(id, {
      id,
      messages: [],
      model,
      aspectRatio,
      turnNumber: 0,
    });
    this.logger.debug(`Created conversation: ${id}`);
    return id;
  }

  /**
   * Call OpenRouter API for image generation
   */
  private async callOpenRouter(apiKey: string, conversation: ConversationState): Promise<GeneratedImage[]> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/pixel-minion-vscode',
        'X-Title': 'Pixel Minion',
      },
      body: JSON.stringify({
        model: conversation.model,
        messages: conversation.messages,
        modalities: ['image', 'text'],
        image_config: { aspect_ratio: conversation.aspectRatio },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenRouter API error: ${response.status} ${errorText}`);
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    this.logger.debug('OpenRouter response received');

    // Extract images from response
    const images: GeneratedImage[] = [];
    const choice = result.choices?.[0];
    if (!choice?.message?.images) {
      throw new Error('No images returned from API');
    }

    // Get the prompt from the last user message
    const lastUserMessage = conversation.messages.filter(m => m.role === 'user').pop();
    const prompt = lastUserMessage?.content.find(c => c.type === 'text')?.text ?? 'Unknown prompt';

    for (const [index, image] of choice.message.images.entries()) {
      const imageUrl = image.image_url?.url;
      if (!imageUrl) {
        this.logger.warn(`Image ${index} missing URL`);
        continue;
      }

      // Extract base64 data and mime type from data URL
      const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        this.logger.warn(`Image ${index} is not a valid data URL`);
        continue;
      }

      const [, mimeType, base64Data] = match;

      images.push({
        id: `${conversation.id}-${conversation.turnNumber}-${index}`,
        data: imageUrl, // Keep full data URL for webview display
        mimeType,
        prompt,
        timestamp: Date.now(),
      });
    }

    if (images.length === 0) {
      throw new Error('Failed to parse images from API response');
    }

    return images;
  }

  /**
   * Save image to workspace
   */
  private async saveImage(dataUrl: string, mimeType: string, suggestedFilename: string): Promise<string> {
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

    return fileUri.fsPath;
  }
}
