/**
 * WebviewViewProvider - Manages webview lifecycle and communication
 *
 * Pattern: VSCode WebviewViewProvider implementation
 * Responsibilities:
 * - Creates and manages webview panel
 * - Handles bidirectional message passing
 * - Manages webview HTML and resources
 *
 * Reference: docs/example-repo/src/application/providers/ProseToolsViewProvider.ts
 */
import * as vscode from 'vscode';
import { MessageHandler } from '../handlers/MessageHandler';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';
import { MessageType, createEnvelope } from '@messages';

export class WebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'templateExtension.mainView';

  private _view?: vscode.WebviewView;
  private messageHandler?: MessageHandler;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    this.logger.info('Resolving webview view');

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Set HTML content
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Initialize message handler
    this.messageHandler = new MessageHandler(
      (message) => webviewView.webview.postMessage(message),
      this.secretStorage,
      this.logger
    );

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      (message) => this.messageHandler?.handleMessage(message),
      undefined,
      []
    );

    // Handle disposal
    webviewView.onDidDispose(() => {
      this.logger.info('Webview disposed');
      this._view = undefined;
      this.messageHandler = undefined;
    });

    this.logger.info('Webview view resolved successfully');
  }

  /**
   * Post a message to the webview
   */
  public postMessage(message: unknown): void {
    this._view?.webview.postMessage(message);
  }

  /**
   * Open settings overlay in the webview
   */
  public openSettings(): void {
    if (this._view) {
      const message = createEnvelope(
        MessageType.OPEN_SETTINGS_OVERLAY,
        'extension.settings',
        {}
      );
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Generate the HTML for the webview
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Get the webview script URI
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
    );

    // Use a nonce for security
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>VSCode Extension Template</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
