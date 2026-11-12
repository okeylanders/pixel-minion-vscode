/**
 * Extension Entry Point
 *
 * This is the main entry point for the VSCode extension.
 * It handles activation, deactivation, and dependency injection setup.
 *
 * Pattern: Dependency Injection - all services are instantiated here and passed down
 * Reference: docs/example-repo/src/extension.ts
 */
import * as vscode from 'vscode';
import { WebviewViewProvider } from './application/providers/WebviewViewProvider';
import { SecretStorageService } from './infrastructure/secrets/SecretStorageService';
import { LoggingService } from './infrastructure/logging/LoggingService';
import { PromptLoader } from './infrastructure/resources/PromptLoader';
import { OpenRouterAccountClient } from './infrastructure/ai/clients/OpenRouterAccountClient';
import { AccountBalanceService } from './infrastructure/account';
import { VsCodeGlobalStorage, workspaceStorageRoot } from './infrastructure/storage';
import { FileImageConversationStore } from './infrastructure/ai/orchestration/ImageConversationStore';
import { ImageOrchestrator } from './infrastructure/ai/orchestration/ImageOrchestrator';
import { OpenRouterImageClient } from './infrastructure/ai/clients/OpenRouterImageClient';

// Module-level reference to logging service for deactivate()
let logger: LoggingService | undefined;

/**
 * Called when the extension is activated.
 * This happens when:
 * - The view is opened for the first time
 * - A command from this extension is executed
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create logging service first (all other services depend on it)
  const { service: loggingService, disposable: channelDisposable } = LoggingService.create();
  logger = loggingService;
  context.subscriptions.push(channelDisposable);

  // Log activation with version from package.json
  const extensionInfo = context.extension.packageJSON as { version: string };
  loggingService.separator('Extension Activated');
  loggingService.info('Pixel Minion is now active');
  loggingService.info(`>> v${extensionInfo.version} <<`);
  loggingService.info(`Extension URI: ${context.extensionUri.fsPath}`);

  // Initialize infrastructure services (with logging injected)
  const secretStorage = new SecretStorageService(context.secrets, loggingService);
  const promptLoader = new PromptLoader(context.extensionUri, loggingService);

  // One balance cache + refresh timer for the extension's lifetime, shared by
  // every MessageHandler (a re-resolved webview gets a new handler, not a new cache).
  const accountBalanceService = new AccountBalanceService(
    new OpenRouterAccountClient(secretStorage, loggingService),
    loggingService
  );
  context.subscriptions.push({ dispose: () => accountBalanceService.dispose() });

  // Conversation transcripts for restart recovery, in this workspace's
  // storage folder (an empty window uses one folder under global storage).
  const imageConversationStore = new FileImageConversationStore(
    new VsCodeGlobalStorage(workspaceStorageRoot(context))
  );
  // One image orchestrator for the extension's lifetime, like the balance
  // service: its threads and its one-request-per-thread lock must hold across
  // re-resolved views, or a new view could clear a thread the old one is
  // still generating.
  const imageOrchestrator = new ImageOrchestrator(loggingService, imageConversationStore);
  imageOrchestrator.setClient(new OpenRouterImageClient(secretStorage, loggingService));

  // Create and register the webview view provider
  const provider = new WebviewViewProvider(
    context.extensionUri,
    secretStorage,
    loggingService,
    accountBalanceService,
    imageOrchestrator
  );

  // Register the webview view provider
  const viewDisposable = vscode.window.registerWebviewViewProvider(
    WebviewViewProvider.viewType,
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true, // Keep webview state when hidden
      },
    }
  );
  loggingService.info('Webview provider registered', WebviewViewProvider.viewType);

  // Register commands
  const helloCommand = vscode.commands.registerCommand(
    'pixelMinion.helloWorld',
    () => {
      loggingService.info('Hello command executed');
      vscode.window.showInformationMessage('Hello from Pixel Minion!');
    }
  );

  // Settings icon command - sends message to webview to open settings overlay
  const settingsCommand = vscode.commands.registerCommand(
    'pixelMinion.openSettings',
    () => {
      loggingService.info('Opening settings overlay');
      provider.openSettings();
    }
  );

  // Output icon command - shows the output channel
  const outputCommand = vscode.commands.registerCommand(
    'pixelMinion.showOutput',
    () => {
      loggingService.info('Showing output channel');
      loggingService.show();
    }
  );

  // Listen for configuration changes
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
    provider.handleConfigurationChanged(e);
  });

  // Add all disposables to context subscriptions
  context.subscriptions.push(
    viewDisposable,
    helloCommand,
    settingsCommand,
    outputCommand,
    configChangeDisposable
  );
}

/**
 * Called when the extension is deactivated.
 * Clean up any resources here.
 */
export function deactivate(): void {
  logger?.info('Pixel Minion is now deactivated');
}
