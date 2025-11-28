/**
 * HelloWorldHandler tests
 *
 * Tests markdown rendering and message handling
 */
import { HelloWorldHandler } from '../../../../application/handlers/domain/HelloWorldHandler';
import { MessageType, createEnvelope, HelloWorldRequestPayload } from '@messages';

// Mock marked
jest.mock('marked', () => ({
  marked: jest.fn((text: string) => Promise.resolve(`<p>${text}</p>`)),
}));

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('HelloWorldHandler', () => {
  let postMessage: jest.Mock;
  let handler: HelloWorldHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    postMessage = jest.fn();
    handler = new HelloWorldHandler(postMessage, mockLogger as never);
  });

  describe('handleRequest', () => {
    it('should render markdown and send result', async () => {
      const message = createEnvelope<HelloWorldRequestPayload>(
        MessageType.HELLO_WORLD_REQUEST,
        'webview.helloWorld',
        { text: 'Hello **World**' },
        'correlation-123'
      );

      await handler.handleRequest(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.HELLO_WORLD_RESULT,
          source: 'extension.helloWorld',
          payload: {
            renderedMarkdown: '<p>Hello **World**</p>',
            originalText: 'Hello **World**',
          },
          correlationId: 'correlation-123',
        })
      );
    });

    it('should log debug messages during processing', async () => {
      const message = createEnvelope<HelloWorldRequestPayload>(
        MessageType.HELLO_WORLD_REQUEST,
        'webview.helloWorld',
        { text: 'Test' }
      );

      await handler.handleRequest(message);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Processing Hello World request')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Hello World request processed successfully'
      );
    });

    it('should handle errors and send error message', async () => {
      const { marked } = require('marked');
      marked.mockRejectedValueOnce(new Error('Markdown parsing failed'));

      const message = createEnvelope<HelloWorldRequestPayload>(
        MessageType.HELLO_WORLD_REQUEST,
        'webview.helloWorld',
        { text: 'Invalid markdown' },
        'correlation-456'
      );

      await handler.handleRequest(message);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process Hello World request',
        expect.any(Error)
      );

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          source: 'extension.helloWorld',
          payload: {
            message: 'Markdown parsing failed',
            code: 'HELLO_WORLD_ERROR',
          },
          correlationId: 'correlation-456',
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      const { marked } = require('marked');
      marked.mockRejectedValueOnce('String error');

      const message = createEnvelope<HelloWorldRequestPayload>(
        MessageType.HELLO_WORLD_REQUEST,
        'webview.helloWorld',
        { text: 'Test' }
      );

      await handler.handleRequest(message);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: {
            message: 'Failed to process Hello World request',
            code: 'HELLO_WORLD_ERROR',
          },
        })
      );
    });

    it('should truncate long text in debug logs', async () => {
      const longText = 'A'.repeat(100);
      const message = createEnvelope<HelloWorldRequestPayload>(
        MessageType.HELLO_WORLD_REQUEST,
        'webview.helloWorld',
        { text: longText }
      );

      await handler.handleRequest(message);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('A'.repeat(50) + '...')
      );
    });
  });
});
