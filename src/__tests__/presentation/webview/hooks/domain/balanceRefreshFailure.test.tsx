/** @jest-environment jsdom */
/**
 * Host + webview together: a failed balance refresh must not hide the last
 * good figures. The real AccountBalanceService and AccountBalanceHandler
 * answer the real useOpenRouterBalance hook; only the OpenRouter client is a
 * stub. Before the fix, the handler's error fallback was stamped "now", so
 * it replaced the good figures and the hook's newest-wins check then
 * rejected every later (older) cached copy of them.
 */
import { act, renderHook } from '@testing-library/react';
import { MessageEnvelope, MessageType, OpenRouterBalancePayload } from '@messages';

const webviewPosts: MessageEnvelope[] = [];
(globalThis as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
  postMessage: (message: MessageEnvelope) => webviewPosts.push(message),
  getState: () => undefined,
  setState: () => undefined,
});

import { AccountBalanceHandler } from '../../../../../application/handlers/domain/AccountBalanceHandler';
import { AccountBalanceService } from '../../../../../infrastructure/account';
import { useOpenRouterBalance } from '../../../../../presentation/webview/hooks/domain/useOpenRouterBalance';

const KEY_OK = { status: 'ok', data: { limit: null, limitRemaining: null, resetWindow: 'unknown' } };
const creditsOk = (remaining: number) => ({
  status: 'ok',
  data: { totalCredits: 100, totalUsage: 100 - remaining, remaining },
});

describe('balance refresh failure, host and webview together', () => {
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  let client: { fetchKeyLimit: jest.Mock; fetchCredits: jest.Mock };
  let service: AccountBalanceService;
  let hostPosts: MessageEnvelope[];
  let handler: AccountBalanceHandler;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-07T12:00:00Z'));
    webviewPosts.length = 0;
    hostPosts = [];
    client = {
      fetchKeyLimit: jest.fn().mockResolvedValue(KEY_OK),
      fetchCredits: jest.fn().mockResolvedValue(creditsOk(12.34)),
    };
    service = new AccountBalanceService(client as never, logger as never);
    handler = new AccountBalanceHandler((message) => hostPosts.push(message), service, logger as never);
  });

  afterEach(() => {
    service.dispose();
    jest.useRealTimers();
  });

  function mountHook() {
    return renderHook(() => useOpenRouterBalance(true));
  }

  /** Run the webview's pending balance requests through the host, then deliver the answers in order. */
  async function exchange(hook: ReturnType<typeof mountHook>): Promise<void> {
    const requests = webviewPosts.splice(0).filter(
      (message) => message.type === MessageType.REQUEST_OPENROUTER_BALANCE
    );
    for (const message of requests) {
      await handler.handleRequest(message as never);
    }
    for (const message of hostPosts.splice(0)) {
      act(() => hook.result.current.handleBalanceData(message));
    }
  }

  const shown = (hook: ReturnType<typeof mountHook>): OpenRouterBalancePayload | null =>
    hook.result.current.balance;

  it('keeps the last good figures on screen when a forced refresh fails, and afterwards', async () => {
    const hook = mountHook();
    await exchange(hook);
    expect(shown(hook)?.credits?.remaining).toBe(12.34);
    const goodFetchedAt = shown(hook)?.fetchedAt;

    // A minute later the refresh fails outright (the client throws).
    jest.advanceTimersByTime(60_000);
    client.fetchKeyLimit.mockRejectedValueOnce(new Error('keychain locked'));
    act(() => hook.result.current.refresh());
    await exchange(hook);

    expect(shown(hook)).toEqual(expect.objectContaining({
      status: 'ok',
      credits: expect.objectContaining({ remaining: 12.34 }),
      fetchedAt: goodFetchedAt,
    }));
    expect(hook.result.current.isLoading).toBe(false);

    // The host's cached copy (e.g. answering a re-resolved view) still lands.
    act(() => hook.result.current.handleBalanceData({
      type: MessageType.OPENROUTER_BALANCE_DATA,
      source: 'extension.account',
      payload: service.lastKnownBalance(),
      timestamp: Date.now(),
    }));
    expect(shown(hook)?.credits?.remaining).toBe(12.34);

    // And the next successful refresh replaces it.
    jest.advanceTimersByTime(60_000);
    client.fetchCredits.mockResolvedValue(creditsOk(11));
    act(() => hook.result.current.refresh());
    await exchange(hook);
    expect(shown(hook)?.credits?.remaining).toBe(11);
  });

  it('shows "unavailable" when the first fetch fails, then the real figures once a refresh works', async () => {
    client.fetchKeyLimit.mockRejectedValueOnce(new Error('keychain locked'));
    const hook = mountHook();
    await exchange(hook);
    expect(shown(hook)?.status).toBe('unavailable');

    jest.advanceTimersByTime(5_000);
    act(() => hook.result.current.refresh());
    await exchange(hook);
    expect(shown(hook)?.credits?.remaining).toBe(12.34);
  });
});
