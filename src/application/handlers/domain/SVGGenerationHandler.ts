/**
 * SVGGenerationHandler - Handles SVG generation requests via OpenRouter text completion
 *
 * Pattern: Domain handler for AI SVG generation with conversation state management
 * Unlike ImageGenerationHandler, this uses text completion API to generate SVG code
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
  AspectRatio,
  ASPECT_RATIO_DIMENSIONS,
  StatusPayload,
} from '@messages';
import { LoggingService } from '@logging';
import { SecretStorageService } from '@secrets';

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
}

interface ConversationState {
  id: string;
  messages: ConversationMessage[];
  model: string;
  aspectRatio: AspectRatio;
  turnNumber: number;
}

const SVG_SYSTEM_PROMPT = `You are an expert SVG artist. Generate clean, well-structured SVG code based on user descriptions.

Rules:
1. Output ONLY valid SVG code - no explanations unless asked
2. Use viewBox for scalability
3. Prefer semantic grouping with <g> elements
4. Use meaningful id attributes for key elements
5. Keep code clean and readable with proper indentation
6. For the requested aspect ratio, set appropriate viewBox dimensions
7. If a reference image is provided, use it as inspiration for style/composition

When user asks for refinements, output the complete updated SVG (not just changes).`;

export class SVGGenerationHandler {
  private readonly configSection = 'pixelMinion';
  private readonly conversations = new Map<string, ConversationState>();

  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService
  ) {
    this.logger.debug('SVGGenerationHandler initialized');
  }

  /**
   * Handle new SVG generation request
   */
  async handleGenerationRequest(message: MessageEnvelope<SVGGenerationRequestPayload>): Promise<void> {
    const { prompt, model, aspectRatio, referenceImage, conversationId } = message.payload;
    this.logger.info(`SVG generation request: ${prompt.substring(0, 50)}...`);

    // Send loading status
    this.postMessage(createEnvelope<StatusPayload>(
      MessageType.STATUS,
      'extension.svgGeneration',
      { message: 'Generating SVG...', isLoading: true },
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

      // Build user message with prompt and optional reference image
      let userContent: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;

      if (referenceImage) {
        // Multi-modal message with reference image
        userContent = [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: referenceImage } }
        ];
      } else {
        // Simple text message
        userContent = prompt;
      }

      const userMessage: ConversationMessage = {
        role: 'user',
        content: userContent
      };

      conversation.messages.push(userMessage);

      // Call OpenRouter API for text completion
      const svgCode = await this.callOpenRouter(apiKey, conversation);

      // Create assistant message with the SVG code
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: svgCode
      };

      conversation.messages.push(assistantMessage);
      conversation.turnNumber++;

      // Send response
      this.postMessage(createEnvelope<SVGGenerationResponsePayload>(
        MessageType.SVG_GENERATION_RESPONSE,
        'extension.svgGeneration',
        {
          conversationId: activeConversationId,
          svgCode,
          turnNumber: conversation.turnNumber,
        },
        message.correlationId
      ));

      this.logger.info(`SVG generation complete (turn ${conversation.turnNumber})`);
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
    const { prompt, conversationId } = message.payload;
    this.logger.info(`SVG generation continue: ${prompt.substring(0, 50)}...`);

    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      this.logger.error(`Conversation ${conversationId} not found`);
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.svgGeneration',
        {
          message: 'Conversation not found. Please start a new generation.',
          code: 'CONVERSATION_NOT_FOUND',
        },
        message.correlationId
      ));
      return;
    }

    // Reuse the generation request handler by creating a request payload
    const requestPayload: SVGGenerationRequestPayload = {
      prompt,
      model: conversation.model,
      aspectRatio: conversation.aspectRatio,
      conversationId,
    };

    await this.handleGenerationRequest({
      ...message,
      payload: requestPayload,
    } as MessageEnvelope<SVGGenerationRequestPayload>);
  }

  /**
   * Handle conversation clear request
   */
  handleClearConversation(message: MessageEnvelope<{ conversationId: string }>): void {
    const { conversationId } = message.payload;
    this.logger.info(`Clearing SVG generation conversation: ${conversationId}`);
    this.conversations.delete(conversationId);
  }

  /**
   * Handle SVG save request
   */
  async handleSaveRequest(message: MessageEnvelope<SVGSaveRequestPayload>): Promise<void> {
    const { svgCode, suggestedFilename } = message.payload;
    this.logger.info(`Saving SVG: ${suggestedFilename}`);

    try {
      const filePath = await this.saveSVG(svgCode, suggestedFilename);

      this.postMessage(createEnvelope<SVGSaveResultPayload>(
        MessageType.SVG_SAVE_RESULT,
        'extension.svgGeneration',
        {
          success: true,
          filePath,
        },
        message.correlationId
      ));

      this.logger.info(`SVG saved successfully: ${filePath}`);
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
   * Create a new conversation
   */
  private createConversation(model: string, aspectRatio: AspectRatio): string {
    const id = `svg-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Get dimensions for the aspect ratio
    const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];
    const systemPrompt = `${SVG_SYSTEM_PROMPT}\n\nFor this conversation, use viewBox="0 0 ${dimensions.width} ${dimensions.height}" for the ${aspectRatio} aspect ratio.`;

    this.conversations.set(id, {
      id,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        }
      ],
      model,
      aspectRatio,
      turnNumber: 0,
    });
    this.logger.debug(`Created SVG conversation: ${id} with aspect ratio ${aspectRatio}`);
    return id;
  }

  /**
   * Call OpenRouter API for text completion
   */
  private async callOpenRouter(apiKey: string, conversation: ConversationState): Promise<string> {
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
        // No modalities parameter - this is text completion, not image generation
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenRouter API error: ${response.status} ${errorText}`);
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    this.logger.debug('OpenRouter response received');

    // Extract text content from response
    const choice = result.choices?.[0];
    if (!choice?.message?.content) {
      throw new Error('No content returned from API');
    }

    const content = choice.message.content;

    // Extract SVG from the response (may be wrapped in markdown)
    const svgCode = this.extractSVG(content);

    if (!svgCode) {
      throw new Error('Failed to extract SVG code from response');
    }

    return svgCode;
  }

  /**
   * Extract SVG code from AI response
   * The response may include markdown code blocks, so we need to extract the SVG
   */
  private extractSVG(content: string): string {
    // Try to extract from markdown code block first
    const codeBlockMatch = content.match(/```(?:svg|xml)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to extract raw SVG
    const svgMatch = content.match(/<svg[\s\S]*<\/svg>/i);
    if (svgMatch) {
      return svgMatch[0].trim();
    }

    // If no SVG tags found, return the content as-is
    // (the AI might have returned pure SVG without markdown)
    return content.trim();
  }

  /**
   * Save SVG to workspace
   */
  private async saveSVG(svgCode: string, suggestedFilename: string): Promise<string> {
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

    return fileUri.fsPath;
  }
}
