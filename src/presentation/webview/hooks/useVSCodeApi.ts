/**
 * useVSCodeApi - Provides access to VSCode webview API
 *
 * Pattern: Singleton wrapper for acquireVsCodeApi()
 * Note: acquireVsCodeApi() can only be called once
 */
import { useRef } from 'react';

interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

// Declare the global function provided by VSCode
declare function acquireVsCodeApi(): VSCodeApi;

// Store the API instance at module level (singleton)
let vscodeApi: VSCodeApi | null = null;

function getVSCodeApi(): VSCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export function useVSCodeApi(): VSCodeApi {
  const apiRef = useRef<VSCodeApi>(getVSCodeApi());
  return apiRef.current;
}
