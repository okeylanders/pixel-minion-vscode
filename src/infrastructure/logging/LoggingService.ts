/**
 * LoggingService - Centralized logging via VSCode OutputChannel
 *
 * Pattern: Singleton wrapper for VSCode's OutputChannel API
 * Benefits:
 * - All logs go to VSCode's Output panel (View > Output > "Extension Template")
 * - Consistent log formatting with timestamps and levels
 * - Constructor-injectable for testability
 * - No console.log pollution
 *
 * Reference: docs/example-repo/src/extension.ts OutputChannel pattern
 */
import * as vscode from 'vscode';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class LoggingService {
  private static readonly CHANNEL_NAME = 'Extension Template';

  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  /**
   * Create a LoggingService with a new OutputChannel
   * Call this once in extension.ts and pass the service to other components
   */
  static create(): { service: LoggingService; disposable: vscode.Disposable } {
    const outputChannel = vscode.window.createOutputChannel(LoggingService.CHANNEL_NAME);
    const service = new LoggingService(outputChannel);
    return { service, disposable: outputChannel };
  }

  /**
   * Log a debug message (for development troubleshooting)
   */
  debug(message: string, ...args: unknown[]): void {
    this.log('DEBUG', message, ...args);
  }

  /**
   * Log an info message (general information)
   */
  info(message: string, ...args: unknown[]): void {
    this.log('INFO', message, ...args);
  }

  /**
   * Log a warning message (potential issues)
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('WARN', message, ...args);
  }

  /**
   * Log an error message (errors and exceptions)
   */
  error(message: string, error?: unknown): void {
    if (error instanceof Error) {
      this.log('ERROR', `${message}: ${error.message}`);
      if (error.stack) {
        this.outputChannel.appendLine(`  Stack: ${error.stack}`);
      }
    } else if (error !== undefined) {
      this.log('ERROR', `${message}: ${String(error)}`);
    } else {
      this.log('ERROR', message);
    }
  }

  /**
   * Log a separator line (useful for grouping related logs)
   */
  separator(title?: string): void {
    if (title) {
      this.outputChannel.appendLine(`\n=== ${title} ===`);
    } else {
      this.outputChannel.appendLine('---');
    }
  }

  /**
   * Show the output channel to the user
   */
  show(): void {
    this.outputChannel.show();
  }

  /**
   * Clear the output channel
   */
  clear(): void {
    this.outputChannel.clear();
  }

  /**
   * Get the underlying OutputChannel (for passing to services that need it directly)
   */
  getChannel(): vscode.OutputChannel {
    return this.outputChannel;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}${formattedArgs}`);
  }
}
