/**
 * AccountBalanceService - the one owner of OpenRouter balance state.
 *
 * Built once in extension.ts and injected into every MessageHandler, so a
 * re-resolved webview shares the same cache and timer. Responsibilities:
 * - Combine `/key` and `/credits` so one call's failure never hides the
 *   other's data, and record why each failed.
 * - Cache the sanitized payload for 120 s and share one in-flight fetch.
 * - Honor `forceRefresh`, but never more than once a second.
 * - Own the trailing post-request refresh. OpenRouter's billing figures lag
 *   spend by roughly 5-10 s, so the refresh waits 10 s after the last
 *   terminal AI response; bursts coalesce to one fetch.
 * - Drop everything from the previous key when the stored key changes.
 */
import { OpenRouterBalancePayload } from '@messages';
import { LoggingService } from '@logging';
import { OpenRouterAccountClient } from '../ai/clients/OpenRouterAccountClient';

export const BALANCE_CACHE_TTL_MS = 120_000;
/** Floor between forced fetches, so a chatty webview can't hammer billing endpoints. */
export const MIN_FORCED_REFRESH_INTERVAL_MS = 1_000;
export const POST_REQUEST_REFRESH_DELAY_MS = 10_000;

export type BalanceRefreshListener = (payload: OpenRouterBalancePayload) => void;

export class AccountBalanceService {
  private cache?: OpenRouterBalancePayload;
  private pending?: Promise<OpenRouterBalancePayload>;
  private pendingForced = false;
  /** Bumped when the stored key changes; fetches from an older key are discarded. */
  private keyGeneration = 0;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private readonly listeners = new Set<BalanceRefreshListener>();
  private disposed = false;

  constructor(
    private readonly client: OpenRouterAccountClient,
    private readonly logger: LoggingService
  ) {}

  /**
   * Current balance. A cached value is served while younger than the TTL, or,
   * for a forced call, younger than the forced-refresh floor. Concurrent calls
   * share one fetch, except that a forced call never accepts a non-forced
   * fetch that was already running: that result may predate the spend the
   * caller wants to see.
   */
  async getBalance(forceRefresh = false): Promise<OpenRouterBalancePayload> {
    if (this.cache) {
      const age = Date.now() - this.cache.fetchedAt;
      const maxAge = forceRefresh ? MIN_FORCED_REFRESH_INTERVAL_MS : BALANCE_CACHE_TTL_MS;
      if (age < maxAge) return this.cache;
    }

    if (this.pending && (!forceRefresh || this.pendingForced)) {
      return this.pending;
    }
    if (this.pending) {
      await this.pending.catch(() => undefined);
      // Another forced caller may have started a fetch while we waited.
      if (this.pending && this.pendingForced) return this.pending;
    }
    return this.startFetch(forceRefresh);
  }

  /** The stored key was saved, replaced or cleared: forget the old key's figures. */
  invalidate(): void {
    this.keyGeneration += 1;
    this.cache = undefined;
    this.pending = undefined;
    this.pendingForced = false;
  }

  /**
   * Arm the trailing refresh after a terminal AI response. Calls within the
   * delay coalesce; when it fires, listeners get one forced fetch's result.
   */
  scheduleRefresh(): void {
    if (this.disposed) return;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.runScheduledRefresh();
    }, POST_REQUEST_REFRESH_DELAY_MS);
  }

  /** Subscribe to scheduled refreshes. Returns the unsubscribe function. */
  addRefreshListener(listener: BalanceRefreshListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      // Nobody left to show the result to, so don't spend a request on it.
      if (this.listeners.size === 0) this.cancelScheduledRefresh();
    };
  }

  dispose(): void {
    this.disposed = true;
    this.cancelScheduledRefresh();
    this.listeners.clear();
  }

  private cancelScheduledRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  private async runScheduledRefresh(): Promise<void> {
    if (this.disposed || this.listeners.size === 0) return;

    let payload: OpenRouterBalancePayload;
    try {
      payload = await this.getBalance(true);
    } catch (error) {
      this.logger.error('Scheduled OpenRouter balance refresh failed', error);
      return;
    }
    if (this.disposed) return;

    for (const listener of [...this.listeners]) {
      try {
        listener(payload);
      } catch (error) {
        this.logger.error('OpenRouter balance listener threw', error);
      }
    }
  }

  private startFetch(forced: boolean): Promise<OpenRouterBalancePayload> {
    const generation = this.keyGeneration;
    const pending = this.fetchBalance().then((payload) => {
      if (generation !== this.keyGeneration) {
        // The key changed mid-flight; these figures belong to the old key.
        return this.getBalance();
      }
      this.cache = payload;
      return payload;
    });
    const settle = () => {
      if (this.pending === pending) {
        this.pending = undefined;
        this.pendingForced = false;
      }
    };
    pending.then(settle, settle);
    this.pending = pending;
    this.pendingForced = forced;
    return pending;
  }

  private async fetchBalance(): Promise<OpenRouterBalancePayload> {
    const [key, credits] = await Promise.all([
      this.client.fetchKeyLimit(),
      this.client.fetchCredits(),
    ]);
    const fetchedAt = Date.now();

    if (key.status === 'no_key' && credits.status === 'no_key') {
      return { status: 'no_key', creditsStatus: 'no_key', fetchedAt };
    }

    return {
      status: key.status === 'ok' || credits.status === 'ok' ? 'ok' : 'unavailable',
      ...(key.status === 'ok' ? { keyLimit: key.data } : {}),
      ...(credits.status === 'ok' ? { credits: credits.data } : {}),
      creditsStatus: credits.status,
      ...(key.status === 'unavailable' ? { keyIssue: key.issue } : {}),
      ...(credits.status === 'unavailable' ? { creditsIssue: credits.issue } : {}),
      fetchedAt,
    };
  }
}
