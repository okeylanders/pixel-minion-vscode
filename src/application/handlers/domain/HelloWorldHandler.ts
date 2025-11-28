/**
 * HelloWorldHandler - Handles Hello World domain messages
 *
 * Pattern: Domain handler - owns a specific domain and its complete lifecycle
 * Reference: docs/example-repo/src/application/handlers/domain/
 */
import {
  MessageType,
  MessageEnvelope,
  createEnvelope,
  HelloWorldRequestPayload,
  HelloWorldResultPayload,
} from '@messages';
import { LoggingService } from '@logging';
import { marked } from 'marked';

export class HelloWorldHandler {
  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly logger: LoggingService
  ) {}

  /**
   * Handle a Hello World request - render markdown and return result
   */
  async handleRequest(message: MessageEnvelope<HelloWorldRequestPayload>): Promise<void> {
    try {
      const { text } = message.payload;
      this.logger.debug(`Processing Hello World request: ${text.substring(0, 50)}...`);

      // Render markdown to HTML
      const renderedMarkdown = await marked(text);

      // Send the result back to webview
      const resultMessage = createEnvelope<HelloWorldResultPayload>(
        MessageType.HELLO_WORLD_RESULT,
        'extension.helloWorld',
        {
          renderedMarkdown,
          originalText: text,
        },
        message.correlationId
      );

      this.postMessage(resultMessage);
      this.logger.debug('Hello World request processed successfully');
    } catch (error) {
      this.logger.error('Failed to process Hello World request', error);
      // Send error message
      this.postMessage(createEnvelope(
        MessageType.ERROR,
        'extension.helloWorld',
        {
          message: error instanceof Error ? error.message : 'Failed to process Hello World request',
          code: 'HELLO_WORLD_ERROR',
        },
        message.correlationId
      ));
    }
  }
}
