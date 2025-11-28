/**
 * LoggingService tests
 *
 * Tests centralized logging functionality
 */
import { LoggingService } from '../../../infrastructure/logging/LoggingService';

const createMockOutputChannel = () => ({
  appendLine: jest.fn(),
  show: jest.fn(),
  clear: jest.fn(),
  dispose: jest.fn(),
});

describe('LoggingService', () => {
  let mockChannel: ReturnType<typeof createMockOutputChannel>;
  let service: LoggingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChannel = createMockOutputChannel();
    service = new LoggingService(mockChannel as never);
  });

  describe('debug', () => {
    it('should log debug message with timestamp and level', () => {
      service.debug('Test debug message');

      expect(mockChannel.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[DEBUG\] Test debug message/)
      );
    });

    it('should include additional arguments as JSON', () => {
      service.debug('Debug with args', { key: 'value' }, 123);

      expect(mockChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[{"key":"value"},123]')
      );
    });
  });

  describe('info', () => {
    it('should log info message with timestamp and level', () => {
      service.info('Test info message');

      expect(mockChannel.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[INFO\] Test info message/)
      );
    });
  });

  describe('warn', () => {
    it('should log warning message with timestamp and level', () => {
      service.warn('Test warning message');

      expect(mockChannel.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[WARN\] Test warning message/)
      );
    });
  });

  describe('error', () => {
    it('should log error message with timestamp and level', () => {
      service.error('Test error message');

      expect(mockChannel.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[ERROR\] Test error message/)
      );
    });

    it('should include Error message when provided', () => {
      const error = new Error('Something went wrong');
      service.error('Operation failed', error);

      expect(mockChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed: Something went wrong')
      );
    });

    it('should include stack trace when available', () => {
      const error = new Error('Stack test');
      error.stack = 'Error: Stack test\n    at test.ts:10';

      service.error('With stack', error);

      expect(mockChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Stack:')
      );
    });

    it('should handle non-Error objects', () => {
      service.error('Non-error', 'string error');

      expect(mockChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Non-error: string error')
      );
    });

    it('should handle undefined error', () => {
      service.error('Just a message');

      expect(mockChannel.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\] Just a message$/)
      );
    });
  });

  describe('separator', () => {
    it('should log a simple separator line', () => {
      service.separator();

      expect(mockChannel.appendLine).toHaveBeenCalledWith('---');
    });

    it('should log a titled separator', () => {
      service.separator('Section Title');

      expect(mockChannel.appendLine).toHaveBeenCalledWith('\n=== Section Title ===');
    });
  });

  describe('show', () => {
    it('should show the output channel', () => {
      service.show();

      expect(mockChannel.show).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear the output channel', () => {
      service.clear();

      expect(mockChannel.clear).toHaveBeenCalled();
    });
  });

  describe('getChannel', () => {
    it('should return the underlying output channel', () => {
      const channel = service.getChannel();

      expect(channel).toBe(mockChannel);
    });
  });

  describe('create (static)', () => {
    it('should create a new LoggingService with OutputChannel', () => {
      // This requires the vscode mock to be set up properly
      const vscode = require('vscode');
      const mockCreatedChannel = createMockOutputChannel();
      vscode.window.createOutputChannel.mockReturnValue(mockCreatedChannel);

      const { service: newService, disposable } = LoggingService.create();

      expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Pixel Minion');
      expect(newService).toBeInstanceOf(LoggingService);
      expect(disposable).toBe(mockCreatedChannel);
    });
  });
});
