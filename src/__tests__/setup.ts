/**
 * Jest setup file
 * Mocks VSCode API for testing
 */

// Mock vscode module
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn()
    }))
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn()
    })),
    workspaceFolders: [],
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      stat: jest.fn()
    }
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, path })),
    parse: jest.fn((path: string) => ({ fsPath: path, path })),
    joinPath: jest.fn((base: { fsPath: string; path: string }, ...segments: string[]) => ({
      fsPath: [base.fsPath, ...segments].join('/'),
      path: [base.path, ...segments].join('/')
    }))
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  SecretStorage: jest.fn(() => ({
    get: jest.fn(),
    store: jest.fn(),
    delete: jest.fn()
  }))
}), { virtual: true });
