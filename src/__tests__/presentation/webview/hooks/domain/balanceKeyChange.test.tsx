/** @jest-environment jsdom */
/**
 * Host + webview together: replacing the API key must take the previous
 * account's figures off screen at once, not when the new key's (possibly
 * slow) fetch settles, and a late answer for the previous key must never
 * bring them back. The real OpenRouterAccountClient, AccountBalanceService
 * and AccountBalanceHandler answer the real useOpenRouterBalance hook; only
 * fetch and the secret store are stubs, so nothing reaches OpenRouter.
 *
 * Replaces the PR #13 review witness, which demonstrated the defect: account
 * A's $75 stayed on screen, not loading, until account B's fetch resolved.
 */
import { act, renderHook } from '@testing-library/react';
import { MessageEnvelope, MessageType } from '@messages';

const webviewPosts: MessageEnvelope[] = [];
(globalThis as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
  postMessage: (message: MessageEnvelope) => webviewPosts.push(message),
  getState: () => undefined,
  setState: () => undefined,
});

import { AccountBalanceHandler } from '../../../../../application/handlers/domain/AccountBalanceHandler';
import { AccountBalanceService } from '../../../../../infrastructure/account';
import { OpenRouterAccountClient } from '../../../../../infrastructure/ai/clients/OpenRouterAccountClient';
import { useOpenRouterBalance } from '../../../../../presentation/webview/hooks/domain/useOpenRouterBalance';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const jsonResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const KEY_BODY = { data: { limit: null, limit_remaining: null } };
const creditsBody = (remaining: number) => ({ data: { total_credits: 100, total_usage: 100 - remaining } });

describe('balance across an API key change, host and webview together', () => {
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  // jsdom's AbortSignal has no timeout(); the client calls it on every fetch.
  beforeAll(() => {
    if (typeof AbortSignal.timeout !== 'function') {
      Object.defineProperty(AbortSignal, 'timeout', {
        configurable: true,
        value: () => new AbortController().signal,
      });
    }
  });
  const originalFetch = global.fetch;
  let storedKey: string;
  /** Credits replies per key; a held key gets a promise the test settles. */
  let creditsFor: Record<string, () => Promise<unknown>>;
  let secretStorage: { getApiKey: jest.Mock };
  let service: AccountBalanceService;
  let hostPosts: MessageEnvelope[];
  let handler: AccountBalanceHandler;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-07T12:00:00Z'));
    webviewPosts.length = 0;
    hostPosts = [];
    storedKey = 'account-A';
    creditsFor = {
      'account-A': async () => creditsBody(75),
      'account-B': async () => creditsBody(1),
    };
    global.fetch = jest.fn(async (url: string, init: { headers: Record<string, string> }) => {
      if (url.endsWith('/key')) return jsonResponse(KEY_BODY);
      const key = init.headers.Authorization.replace('Bearer ', '');
      return jsonResponse(await creditsFor[key]());
    }) as unknown as typeof fetch;
    secretStorage = { getApiKey: jest.fn(async () => storedKey) };
    service = new AccountBalanceService(
      new OpenRouterAccountClient(secretStorage as never, logger as never),
      logger as never
    );
    handler = new AccountBalanceHandler((message) => hostPosts.push(message), service, logger as never);
  });

  afterEach(() => {
    service.dispose();
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  function mountHook() {
    return renderHook(() => useOpenRouterBalance(true));
  }

  /** Deliver host posts to the hook the way App's router does, in order. */
  function deliver(hook: ReturnType<typeof mountHook>, messages = hostPosts.splice(0)): void {
    for (const message of messages) {
      act(() => {
        if (message.type === MessageType.OPENROUTER_BALANCE_RESET) {
          hook.result.current.handleBalanceReset(message);
        } else if (message.type === MessageType.OPENROUTER_BALANCE_DATA) {
          hook.result.current.handleBalanceData(message);
        }
      });
    }
  }

  /** Run the webview's pending balance requests through the host, then deliver the answers. */
  async function exchange(hook: ReturnType<typeof mountHook>): Promise<void> {
    const requests = webviewPosts.splice(0).filter(
      (message) => message.type === MessageType.REQUEST_OPENROUTER_BALANCE
    );
    for (const message of requests) {
      await handler.handleRequest(message as never);
    }
    deliver(hook);
  }

  /** Let the host's pending promise chains run (no timers involved). */
  const flush = () => act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });

  it("clears account A's figures before account B's fetch settles, then shows B's", async () => {
    const hook = mountHook();
    await exchange(hook);
    expect(hook.result.current.balance?.credits?.remaining).toBe(75);
    expect(hook.result.current.isLoading).toBe(false);

    // Replace the key with B and hold B's credits reply.
    const bCredits = deferred<unknown>();
    creditsFor['account-B'] = () => bCredits.promise;
    storedKey = 'account-B';
    const changed = handler.handleApiKeyChanged();
    deliver(hook);

    // B is fetching: A's $75 is already gone and the view says it's loading.
    expect(service.lastKnownBalance()).toBeUndefined();
    expect(hook.result.current.balance).toBeNull();
    expect(hook.result.current.isLoading).toBe(true);

    bCredits.resolve(creditsBody(1));
    await act(async () => { await changed; });
    deliver(hook);

    expect(hook.result.current.balance?.credits?.remaining).toBe(1);
    expect(hook.result.current.isLoading).toBe(false);
  });

  it("ignores a late reply carrying account A's figures after the reset", async () => {
    const hook = mountHook();
    const requests = webviewPosts.splice(0);
    await handler.handleRequest(requests[0] as never);
    // A's answer is posted but, like any message behind a slow host, reaches
    // the webview only after the key change.
    const lateA = hostPosts.splice(0);
    expect(lateA[0].payload).toEqual(expect.objectContaining({
      credits: expect.objectContaining({ remaining: 75 }),
    }));

    const bCredits = deferred<unknown>();
    creditsFor['account-B'] = () => bCredits.promise;
    storedKey = 'account-B';
    const changed = handler.handleApiKeyChanged();
    deliver(hook);
    deliver(hook, lateA);

    expect(hook.result.current.balance).toBeNull();
    expect(hook.result.current.isLoading).toBe(true);

    bCredits.resolve(creditsBody(1));
    await act(async () => { await changed; });
    deliver(hook);
    deliver(hook, lateA); // and again, after B has landed
    expect(hook.result.current.balance?.credits?.remaining).toBe(1);
  });

  it('ignores the fallback of a request for account A that fails after the key changed', async () => {
    // The mount request reads the key, and the read stalls (keychain prompt).
    const heldRead = deferred<string>();
    secretStorage.getApiKey.mockImplementationOnce(() => heldRead.promise);
    secretStorage.getApiKey.mockImplementationOnce(() => heldRead.promise);
    const hook = mountHook();
    const mountRequest = handler.handleRequest(webviewPosts.splice(0)[0] as never);

    // Meanwhile the key is replaced with B, whose credits reply is slow too.
    const bCredits = deferred<unknown>();
    creditsFor['account-B'] = () => bCredits.promise;
    storedKey = 'account-B';
    const changed = handler.handleApiKeyChanged();
    deliver(hook);

    // A's request now fails. Its fallback must not show "unavailable" for B.
    heldRead.reject(new Error('keychain locked'));
    await act(async () => { await mountRequest; });
    expect(hostPosts.map((message) => message.payload)).toEqual([
      expect.objectContaining({ status: 'unavailable', accountEpoch: 0 }),
    ]);
    deliver(hook);
    expect(hook.result.current.balance).toBeNull();
    expect(hook.result.current.isLoading).toBe(true);

    bCredits.resolve(creditsBody(1));
    await flush();
    await act(async () => { await changed; });
    deliver(hook);
    expect(hook.result.current.balance?.credits?.remaining).toBe(1);
    expect(hook.result.current.isLoading).toBe(false);
  });

  it('shows "no key" straight after the key is cleared', async () => {
    const hook = mountHook();
    await exchange(hook);

    storedKey = '';
    await handler.handleApiKeyChanged();
    deliver(hook);

    expect(hook.result.current.balance?.status).toBe('no_key');
    expect(hook.result.current.balance?.credits).toBeUndefined();
    expect(hook.result.current.isLoading).toBe(false);
  });
});
