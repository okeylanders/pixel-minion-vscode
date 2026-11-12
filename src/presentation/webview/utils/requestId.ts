/**
 * Correlation ids for webview → host requests.
 *
 * The host echoes `correlationId` on every response, status and error, so a
 * hook that remembers the id it dispatched can settle only its own request
 * and drop late or stale answers. The prefix names the owner, which keeps ids
 * readable in the Output channel and lets a hook recognise its own clear
 * requests (`image-clear-…`) after it has stopped tracking them.
 */
export function newRequestId(prefix: string): string {
  const unique = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${unique}`;
}

/**
 * True for ids minted by the Image or SVG tab (`image-…`, `svg-…`). An error
 * with such an id that neither tab claims answers a request that is no
 * longer outstanding, and is dropped as stale.
 */
export function isGenerationTabRequestId(correlationId: string | undefined): boolean {
  return correlationId !== undefined
    && (correlationId.startsWith('image-') || correlationId.startsWith('svg-'));
}
