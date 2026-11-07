import {
  AccountBalanceService,
  BALANCE_CACHE_TTL_MS,
  FAILED_BALANCE_CACHE_TTL_MS,
  MIN_FORCED_REFRESH_INTERVAL_MS,
  POST_REQUEST_REFRESH_DELAY_MS,
} from '../../../infrastructure/account';
import type { OpenRouterAccountCallResult } from '../../../infrastructure/ai/clients/OpenRouterAccountClient';
import type { OpenRouterCredits, OpenRouterKeyLimit } from '@messages';

type KeyResult = OpenRouterAccountCallResult<OpenRouterKeyLimit>;
type CreditsResult = OpenRouterAccountCallResult<OpenRouterCredits>;

const KEY_OK: KeyResult = {
  status: 'ok',
  data: { limit: 5, limitRemaining: 4.5, resetWindow: 'monthly' },
};
const creditsOk = (remaining: number): CreditsResult => ({
  status: 'ok',
  data: { totalCredits: 100, totalUsage: 100 - remaining, remaining },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('AccountBalanceService', () => {
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  let client: { fetchKeyLimit: jest.Mock; fetchCredits: jest.Mock };
  let service: AccountBalanceService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-07T12:00:00Z'));
    jest.clearAllMocks();
    client = {
      fetchKeyLimit: jest.fn().mockResolvedValue(KEY_OK),
      fetchCredits: jest.fn().mockResolvedValue(creditsOk(72.5)),
    };
    service = new AccountBalanceService(client as never, logger as never);
  });

  afterEach(() => {
    service.dispose();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  const fetchCount = () => client.fetchCredits.mock.calls.length;

  describe('combining /key and /credits', () => {
    it('keeps the key limit when /credits is forbidden and records why credits failed', async () => {
      client.fetchCredits.mockResolvedValue({
        status: 'unavailable',
        issue: { kind: 'forbidden', httpStatus: 403 },
      });

      await expect(service.getBalance()).resolves.toEqual({
        status: 'ok',
        keyLimit: KEY_OK.status === 'ok' ? KEY_OK.data : undefined,
        creditsStatus: 'unavailable',
        creditsIssue: { kind: 'forbidden', httpStatus: 403 },
        accountEpoch: 0,
        fetchedAt: Date.now(),
      });
    });

    it('is unavailable when both calls fail, keeping each reason', async () => {
      client.fetchKeyLimit.mockResolvedValue({ status: 'unavailable', issue: { kind: 'invalid_key', httpStatus: 401 } });
      client.fetchCredits.mockResolvedValue({ status: 'unavailable', issue: { kind: 'invalid_key', httpStatus: 401 } });

      await expect(service.getBalance()).resolves.toEqual({
        status: 'unavailable',
        creditsStatus: 'unavailable',
        keyIssue: { kind: 'invalid_key', httpStatus: 401 },
        creditsIssue: { kind: 'invalid_key', httpStatus: 401 },
        accountEpoch: 0,
        fetchedAt: Date.now(),
      });
    });

    it('reports no_key when no key is stored', async () => {
      client.fetchKeyLimit.mockResolvedValue({ status: 'no_key' });
      client.fetchCredits.mockResolvedValue({ status: 'no_key' });

      await expect(service.getBalance()).resolves.toEqual({
        status: 'no_key',
        creditsStatus: 'no_key',
        accountEpoch: 0,
        fetchedAt: Date.now(),
      });
    });

    it('passes both figures through when both calls succeed', async () => {
      const balance = await service.getBalance();

      expect(balance).toEqual({
        status: 'ok',
        keyLimit: { limit: 5, limitRemaining: 4.5, resetWindow: 'monthly' },
        credits: { totalCredits: 100, totalUsage: 27.5, remaining: 72.5 },
        creditsStatus: 'ok',
        accountEpoch: 0,
        fetchedAt: Date.now(),
      });
    });
  });

  describe('cache and in-flight sharing', () => {
    it('serves the cache for 120 s, then fetches again', async () => {
      await service.getBalance();
      jest.advanceTimersByTime(BALANCE_CACHE_TTL_MS - 1);
      await service.getBalance();
      expect(fetchCount()).toBe(1);

      jest.advanceTimersByTime(1);
      await service.getBalance();
      expect(fetchCount()).toBe(2);
    });

    it('serves a failed result for only 15 s', async () => {
      client.fetchKeyLimit.mockResolvedValue({ status: 'unavailable', issue: { kind: 'network' } });
      client.fetchCredits.mockResolvedValue({ status: 'unavailable', issue: { kind: 'network' } });
      await expect(service.getBalance()).resolves.toMatchObject({ status: 'unavailable' });

      jest.advanceTimersByTime(FAILED_BALANCE_CACHE_TTL_MS - 1);
      await service.getBalance();
      expect(fetchCount()).toBe(1);

      // Back online: the next caller after 15 s gets fresh figures, not the outage.
      client.fetchKeyLimit.mockResolvedValue(KEY_OK);
      client.fetchCredits.mockResolvedValue(creditsOk(72.5));
      jest.advanceTimersByTime(1);
      await expect(service.getBalance()).resolves.toMatchObject({ status: 'ok', creditsStatus: 'ok' });
      expect(fetchCount()).toBe(2);
    });

    it('uses the short TTL when only one of the two calls failed', async () => {
      client.fetchCredits.mockResolvedValue({ status: 'unavailable', issue: { kind: 'server_error', httpStatus: 502 } });
      await service.getBalance();

      jest.advanceTimersByTime(FAILED_BALANCE_CACHE_TTL_MS);
      await service.getBalance();
      expect(fetchCount()).toBe(2);
    });

    it('keeps the full TTL for no_key (nothing failed)', async () => {
      client.fetchKeyLimit.mockResolvedValue({ status: 'no_key' });
      client.fetchCredits.mockResolvedValue({ status: 'no_key' });
      await service.getBalance();

      jest.advanceTimersByTime(FAILED_BALANCE_CACHE_TTL_MS);
      await service.getBalance();
      expect(fetchCount()).toBe(1);
    });

    it('shares one fetch between concurrent callers', async () => {
      const [a, b] = await Promise.all([service.getBalance(), service.getBalance()]);
      jest.advanceTimersByTime(MIN_FORCED_REFRESH_INTERVAL_MS);
      const [c, d] = await Promise.all([service.getBalance(true), service.getBalance(true)]);

      expect(fetchCount()).toBe(2);
      expect(a).toBe(b);
      expect(c).toBe(d);
    });

    it('honors forceRefresh, but not more than once a second', async () => {
      await service.getBalance();
      jest.advanceTimersByTime(MIN_FORCED_REFRESH_INTERVAL_MS - 1);
      await service.getBalance(true);
      expect(fetchCount()).toBe(1);

      jest.advanceTimersByTime(1);
      client.fetchCredits.mockResolvedValue(creditsOk(70));
      const forced = await service.getBalance(true);
      expect(fetchCount()).toBe(2);
      expect(forced.credits?.remaining).toBe(70);
    });

    it('does not hand a forced caller the result of an earlier non-forced fetch', async () => {
      const first = deferred<CreditsResult>();
      client.fetchCredits.mockReturnValueOnce(first.promise);
      client.fetchCredits.mockResolvedValueOnce(creditsOk(60));

      const mountLoad = service.getBalance();
      const manualRefresh = service.getBalance(true);
      first.resolve(creditsOk(72.5));

      await expect(mountLoad).resolves.toEqual(expect.objectContaining({
        credits: expect.objectContaining({ remaining: 72.5 }),
      }));
      await expect(manualRefresh).resolves.toEqual(expect.objectContaining({
        credits: expect.objectContaining({ remaining: 60 }),
      }));
      expect(fetchCount()).toBe(2);
    });

    it('keeps the last good figures when a forced refresh rejects', async () => {
      const good = await service.getBalance();
      jest.advanceTimersByTime(MIN_FORCED_REFRESH_INTERVAL_MS);
      client.fetchKeyLimit.mockRejectedValueOnce(new Error('keychain locked'));

      await expect(service.getBalance(true)).rejects.toThrow('keychain locked');

      await expect(service.getBalance()).resolves.toBe(good);
      expect(fetchCount()).toBe(2);
    });

    it('lets a rejected fetch propagate and retries on the next call', async () => {
      client.fetchKeyLimit.mockRejectedValueOnce(new Error('keychain locked'));

      await expect(service.getBalance()).rejects.toThrow('keychain locked');
      await expect(service.getBalance()).resolves.toEqual(expect.objectContaining({ status: 'ok' }));
    });
  });

  describe('invalidate (key saved, replaced or cleared)', () => {
    it('drops the cached figures of the previous key', async () => {
      await service.getBalance();
      service.invalidate();
      client.fetchKeyLimit.mockResolvedValue({ status: 'no_key' });
      client.fetchCredits.mockResolvedValue({ status: 'no_key' });

      await expect(service.getBalance()).resolves.toEqual(expect.objectContaining({ status: 'no_key' }));
      expect(fetchCount()).toBe(2);
    });

    it('never returns or caches figures fetched with the previous key', async () => {
      const oldKeyCredits = deferred<CreditsResult>();
      client.fetchCredits.mockReturnValueOnce(oldKeyCredits.promise);

      const startedBeforeChange = service.getBalance();
      service.invalidate();
      client.fetchCredits.mockResolvedValue(creditsOk(5));
      const afterChange = service.getBalance(true);
      oldKeyCredits.resolve(creditsOk(999));

      await expect(afterChange).resolves.toEqual(expect.objectContaining({
        credits: expect.objectContaining({ remaining: 5 }),
      }));
      await expect(startedBeforeChange).resolves.toEqual(expect.objectContaining({
        credits: expect.objectContaining({ remaining: 5 }),
      }));
      await expect(service.getBalance()).resolves.toEqual(expect.objectContaining({
        credits: expect.objectContaining({ remaining: 5 }),
      }));
    });

    it('stamps every payload with the epoch of the key its fetch started under', async () => {
      expect(service.accountEpoch()).toBe(0);
      await expect(service.getBalance()).resolves.toEqual(expect.objectContaining({ accountEpoch: 0 }));

      const oldKeyCredits = deferred<CreditsResult>();
      client.fetchCredits.mockReturnValueOnce(oldKeyCredits.promise);
      jest.advanceTimersByTime(MIN_FORCED_REFRESH_INTERVAL_MS);
      const startedBeforeChange = service.getBalance(true);
      service.invalidate();
      expect(service.accountEpoch()).toBe(1);
      oldKeyCredits.resolve(creditsOk(999));

      // The old key's answer is swapped for the new key's, stamped with its epoch.
      await expect(startedBeforeChange).resolves.toEqual(expect.objectContaining({
        accountEpoch: 1,
        credits: expect.objectContaining({ remaining: 72.5 }),
      }));
    });
  });

  describe('last known figures when a refresh fails transiently', () => {
    const offline = { status: 'unavailable', issue: { kind: 'network' } } as const;
    const badGateway = { status: 'unavailable', issue: { kind: 'server_error', httpStatus: 502 } } as const;
    const rejected = { status: 'unavailable', issue: { kind: 'invalid_key', httpStatus: 401 } } as const;

    async function readGoodFiguresThenWait(): Promise<number> {
      const good = await service.getBalance();
      jest.advanceTimersByTime(60_000);
      return good.fetchedAt;
    }

    it.each([
      ['offline', { kind: 'network' }],
      ['rate-limited', { kind: 'rate_limited', httpStatus: 429 }],
      ['an OpenRouter error', { kind: 'server_error', httpStatus: 503 }],
      ['an unreadable reply', { kind: 'malformed' }],
    ] as const)('keeps both figures, marked stale, when the refresh is %s', async (_label, issue) => {
      const readAt = await readGoodFiguresThenWait();
      client.fetchKeyLimit.mockResolvedValue({ status: 'unavailable', issue });
      client.fetchCredits.mockResolvedValue({ status: 'unavailable', issue });

      await expect(service.getBalance(true)).resolves.toEqual({
        status: 'ok',
        keyLimit: { limit: 5, limitRemaining: 4.5, resetWindow: 'monthly' },
        credits: { totalCredits: 100, totalUsage: 27.5, remaining: 72.5 },
        creditsStatus: 'unavailable',
        keyIssue: issue,
        creditsIssue: issue,
        stale: { figuresFetchedAt: readAt, issue },
        accountEpoch: 0,
        fetchedAt: Date.now(),
      });
    });

    it('carries only the figure that failed, and dates the staleness by that figure', async () => {
      const readAt = await readGoodFiguresThenWait();
      client.fetchCredits.mockResolvedValue(badGateway);
      client.fetchKeyLimit.mockResolvedValue({
        status: 'ok',
        data: { limit: 5, limitRemaining: 4, resetWindow: 'monthly' },
      });

      const shown = await service.getBalance(true);

      expect(shown.keyLimit).toEqual({ limit: 5, limitRemaining: 4, resetWindow: 'monthly' });
      expect(shown.credits?.remaining).toBe(72.5);
      expect(shown.stale).toEqual({ figuresFetchedAt: readAt, issue: badGateway.issue });
    });

    it('keeps the original read time across repeated failures, and clears the marker on success', async () => {
      const readAt = await readGoodFiguresThenWait();
      client.fetchKeyLimit.mockResolvedValue(offline);
      client.fetchCredits.mockResolvedValue(offline);
      await service.getBalance(true);
      jest.advanceTimersByTime(60_000);

      await expect(service.getBalance(true)).resolves.toEqual(expect.objectContaining({
        stale: { figuresFetchedAt: readAt, issue: offline.issue },
      }));

      jest.advanceTimersByTime(60_000);
      client.fetchKeyLimit.mockResolvedValue(KEY_OK);
      client.fetchCredits.mockResolvedValue(creditsOk(70));
      const fresh = await service.getBalance(true);
      expect(fresh.stale).toBeUndefined();
      expect(fresh.credits?.remaining).toBe(70);
    });

    it('retries a stale result after 15 s, like any failed result', async () => {
      await readGoodFiguresThenWait();
      client.fetchKeyLimit.mockResolvedValue(offline);
      client.fetchCredits.mockResolvedValue(offline);
      await service.getBalance(true);

      jest.advanceTimersByTime(FAILED_BALANCE_CACHE_TTL_MS);
      await service.getBalance();
      expect(fetchCount()).toBe(3);
    });

    it('drops a figure the key is refused, and never brings it back on a later glitch', async () => {
      await readGoodFiguresThenWait();
      client.fetchKeyLimit.mockResolvedValue(rejected);
      client.fetchCredits.mockResolvedValue(rejected);
      await expect(service.getBalance(true)).resolves.toEqual(expect.objectContaining({
        status: 'unavailable',
        keyIssue: rejected.issue,
      }));
      expect((await service.getBalance()).credits).toBeUndefined();

      jest.advanceTimersByTime(FAILED_BALANCE_CACHE_TTL_MS);
      client.fetchKeyLimit.mockResolvedValue(offline);
      client.fetchCredits.mockResolvedValue(offline);
      const later = await service.getBalance(true);
      expect(later.status).toBe('unavailable');
      expect(later.credits).toBeUndefined();
      expect(later.stale).toBeUndefined();
    });

    it('does not carry a forbidden /credits figure over either', async () => {
      await readGoodFiguresThenWait();
      client.fetchCredits.mockResolvedValue({ status: 'unavailable', issue: { kind: 'forbidden', httpStatus: 403 } });

      const shown = await service.getBalance(true);
      expect(shown.credits).toBeUndefined();
      expect(shown.stale).toBeUndefined();
    });

    it('never carries figures across a key change', async () => {
      await readGoodFiguresThenWait();
      service.invalidate();
      client.fetchKeyLimit.mockResolvedValue(offline);
      client.fetchCredits.mockResolvedValue(offline);

      await expect(service.getBalance(true)).resolves.toEqual({
        status: 'unavailable',
        creditsStatus: 'unavailable',
        keyIssue: offline.issue,
        creditsIssue: offline.issue,
        accountEpoch: 1,
        fetchedAt: Date.now(),
      });
    });

    it('forgets the figures once the key is gone', async () => {
      await readGoodFiguresThenWait();
      client.fetchKeyLimit.mockResolvedValue({ status: 'no_key' });
      client.fetchCredits.mockResolvedValue({ status: 'no_key' });
      await expect(service.getBalance(true)).resolves.toEqual(expect.objectContaining({ status: 'no_key' }));

      jest.advanceTimersByTime(MIN_FORCED_REFRESH_INTERVAL_MS);
      client.fetchKeyLimit.mockResolvedValue(offline);
      client.fetchCredits.mockResolvedValue(offline);
      await expect(service.getBalance(true)).resolves.toEqual(expect.objectContaining({ status: 'unavailable' }));
    });
  });

  describe('scheduled post-request refresh', () => {
    it('coalesces a burst into one forced fetch, 10 s after the last call', async () => {
      const listener = jest.fn();
      service.addRefreshListener(listener);
      await service.getBalance();
      client.fetchCredits.mockResolvedValue(creditsOk(71));

      service.scheduleRefresh();
      await jest.advanceTimersByTimeAsync(4_000);
      service.scheduleRefresh();
      await jest.advanceTimersByTimeAsync(4_000);
      service.scheduleRefresh();
      await jest.advanceTimersByTimeAsync(POST_REQUEST_REFRESH_DELAY_MS - 1);
      expect(listener).not.toHaveBeenCalled();
      expect(fetchCount()).toBe(1);

      await jest.advanceTimersByTimeAsync(1);
      expect(fetchCount()).toBe(2);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        credits: expect.objectContaining({ remaining: 71 }),
      }));
    });

    it('skips the fetch when nobody is listening', async () => {
      service.scheduleRefresh();
      await jest.advanceTimersByTimeAsync(POST_REQUEST_REFRESH_DELAY_MS);

      expect(fetchCount()).toBe(0);
    });

    it('cancels the pending refresh when the last listener unsubscribes (webview disposed)', async () => {
      const unsubscribe = service.addRefreshListener(jest.fn());
      service.scheduleRefresh();
      unsubscribe();

      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(POST_REQUEST_REFRESH_DELAY_MS);
      expect(fetchCount()).toBe(0);
    });

    it('dispose() clears the pending refresh and ignores later schedules', async () => {
      const listener = jest.fn();
      service.addRefreshListener(listener);
      service.scheduleRefresh();

      service.dispose();
      service.scheduleRefresh();
      await jest.advanceTimersByTimeAsync(POST_REQUEST_REFRESH_DELAY_MS);

      expect(fetchCount()).toBe(0);
      expect(listener).not.toHaveBeenCalled();
    });

    it('keeps notifying other listeners when one throws', async () => {
      const broken = jest.fn(() => { throw new Error('webview gone'); });
      const healthy = jest.fn();
      service.addRefreshListener(broken);
      service.addRefreshListener(healthy);

      service.scheduleRefresh();
      await jest.advanceTimersByTimeAsync(POST_REQUEST_REFRESH_DELAY_MS);

      expect(healthy).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('OpenRouter balance listener threw', expect.any(Error));
    });

    it('logs and swallows a failed scheduled fetch', async () => {
      const listener = jest.fn();
      service.addRefreshListener(listener);
      client.fetchKeyLimit.mockRejectedValueOnce(new Error('keychain locked'));

      service.scheduleRefresh();
      await jest.advanceTimersByTimeAsync(POST_REQUEST_REFRESH_DELAY_MS);

      expect(listener).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Scheduled OpenRouter balance refresh failed',
        expect.any(Error)
      );
    });
  });
});
