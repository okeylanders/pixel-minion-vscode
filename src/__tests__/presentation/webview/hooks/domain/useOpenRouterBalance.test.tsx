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

const payload = (remaining: number, fetchedAt: number): OpenRouterBalancePayload => ({
  status: 'ok',
  creditsStatus: 'ok',
  credits: { totalCredits: 100, totalUsage: 100 - remaining, remaining },
  fetchedAt,
});

const balanceRequests = () => postMessage.mock.calls
  .map(([message]) => message)
  .filter((message) => message.type === MessageType.REQUEST_OPENROUTER_BALANCE);

const data = (body: OpenRouterBalancePayload, correlationId?: string) =>
  createEnvelope(MessageType.OPENROUTER_BALANCE_DATA, 'extension.account', body, correlationId);

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
});
