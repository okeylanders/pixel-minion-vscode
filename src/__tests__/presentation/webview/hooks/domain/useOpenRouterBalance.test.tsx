/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { MessageType, OpenRouterBalancePayload, createEnvelope } from '@messages';

const postMessage = jest.fn();
(globalThis as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
  postMessage,
  getState: () => undefined,
  setState: () => undefined,
});

import { useOpenRouterBalance } from '../../../../../presentation/webview/hooks/domain/useOpenRouterBalance';

const payload = (remaining: number, fetchedAt: number, accountEpoch = 0): OpenRouterBalancePayload => ({
  status: 'ok',
  creditsStatus: 'ok',
  credits: { totalCredits: 100, totalUsage: 100 - remaining, remaining },
  accountEpoch,
  fetchedAt,
});

const balanceRequests = () => postMessage.mock.calls
  .map(([message]) => message)
  .filter((message) => message.type === MessageType.REQUEST_OPENROUTER_BALANCE);

const data = (body: OpenRouterBalancePayload, correlationId?: string) =>
  createEnvelope(MessageType.OPENROUTER_BALANCE_DATA, 'extension.account', body, correlationId);

const reset = (accountEpoch: number) =>
  createEnvelope(MessageType.OPENROUTER_BALANCE_RESET, 'extension.account', { accountEpoch });

describe('useOpenRouterBalance', () => {
  beforeEach(() => postMessage.mockClear());

  it('waits for the API-key status before the first request, then asks once (not forced)', () => {
    const { rerender } = renderHook(({ known }) => useOpenRouterBalance(known), {
      initialProps: { known: false },
    });
    expect(balanceRequests()).toHaveLength(0);

    rerender({ known: true });
    rerender({ known: true });

    expect(balanceRequests()).toEqual([expect.objectContaining({
      source: 'webview.account',
      payload: { forceRefresh: false },
      correlationId: expect.any(String),
    })]);
  });

  it('refresh() forces a fetch and keeps the previous figures until the answer arrives', () => {
    const { result } = renderHook(() => useOpenRouterBalance(true));
    const [mountRequest] = balanceRequests();
    act(() => result.current.handleBalanceData(data(payload(12, 1), mountRequest.correlationId)));
    expect(result.current.isLoading).toBe(false);

    act(() => result.current.refresh());
    const refreshRequest = balanceRequests()[1];

    expect(refreshRequest.payload).toEqual({ forceRefresh: true });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.balance?.credits?.remaining).toBe(12);

    act(() => result.current.handleBalanceData(data(payload(11, 2), refreshRequest.correlationId)));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.balance?.credits?.remaining).toBe(11);
  });

  it('applies host pushes without settling an outstanding request', () => {
    const { result } = renderHook(() => useOpenRouterBalance(true));

    act(() => result.current.handleBalanceData(data(payload(9, 5))));

    expect(result.current.balance?.credits?.remaining).toBe(9);
    expect(result.current.isLoading).toBe(true);
  });

  it('never replaces newer figures with an older response', () => {
    const { result } = renderHook(() => useOpenRouterBalance(true));

    act(() => result.current.handleBalanceData(data(payload(5, 200))));
    act(() => result.current.handleBalanceData(data(payload(999, 100))));

    expect(result.current.balance?.credits?.remaining).toBe(5);
  });

  describe('key changes', () => {
    it("a reset clears the previous account's figures at once and shows loading until the new ones land", () => {
      const { result } = renderHook(() => useOpenRouterBalance(true));
      const [mountRequest] = balanceRequests();
      act(() => result.current.handleBalanceData(data(payload(75, 100, 0), mountRequest.correlationId)));
      expect(result.current.isLoading).toBe(false);

      act(() => result.current.handleBalanceReset(reset(1)));

      expect(result.current.balance).toBeNull();
      expect(result.current.isLoading).toBe(true);

      act(() => result.current.handleBalanceData(data(payload(1, 200, 1))));
      expect(result.current.balance?.credits?.remaining).toBe(1);
      expect(result.current.isLoading).toBe(false);
    });

    it('ignores a late payload for the previous key, but still settles the request it answers', () => {
      const { result } = renderHook(() => useOpenRouterBalance(true));
      const [mountRequest] = balanceRequests();
      act(() => result.current.handleBalanceReset(reset(1)));

      act(() => result.current.handleBalanceData(data(payload(75, 300, 0), mountRequest.correlationId)));

      expect(result.current.balance).toBeNull();
      expect(result.current.isLoading).toBe(true); // still waiting for the new key

      act(() => result.current.handleBalanceData(data(payload(1, 200, 1))));
      act(() => result.current.handleBalanceData(data(payload(75, 400, 0))));
      expect(result.current.balance?.credits?.remaining).toBe(1);
      expect(result.current.isLoading).toBe(false);
    });

    it("lets a newer account's figures replace the old ones even when its clock reads earlier", () => {
      const { result } = renderHook(() => useOpenRouterBalance(true));
      act(() => result.current.handleBalanceData(data(payload(75, 500, 0))));

      // Another view saved the key, so no reset reached this one.
      act(() => result.current.handleBalanceData(data(payload(1, 400, 1))));

      expect(result.current.balance?.credits?.remaining).toBe(1);
    });

    it('ignores a reset for an epoch it has already moved past', () => {
      const { result } = renderHook(() => useOpenRouterBalance(true));
      act(() => result.current.handleBalanceData(data(payload(1, 200, 2))));

      act(() => result.current.handleBalanceReset(reset(2)));
      act(() => result.current.handleBalanceReset(reset(1)));

      expect(result.current.balance?.credits?.remaining).toBe(1);
    });

    it('keeps the figures on screen through a same-account refresh', () => {
      const { result } = renderHook(() => useOpenRouterBalance(true));
      act(() => result.current.handleBalanceData(data(payload(12, 100, 1))));

      act(() => result.current.refresh());

      expect(result.current.balance?.credits?.remaining).toBe(12);
      expect(result.current.isLoading).toBe(true);
    });
  });
});
