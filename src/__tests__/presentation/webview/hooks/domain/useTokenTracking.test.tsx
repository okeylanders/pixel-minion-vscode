/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { MessageType, TokenUsage, createEnvelope } from '@messages';
import { useTokenTracking } from '../../../../../presentation/webview/hooks/domain/useTokenTracking';

const usage = (totalTokens: number): TokenUsage => ({
  promptTokens: totalTokens,
  completionTokens: 0,
  totalTokens,
  costUsd: totalTokens / 100_000,
});

describe('useTokenTracking', () => {
  it('restores the last request from persisted state', () => {
    const { result } = renderHook(() => useTokenTracking({ lastRequest: usage(10), requestedAt: 123 }));

    expect(result.current.lastRequest).toEqual(usage(10));
    expect(result.current.requestedAt).toBe(123);
    expect(result.current.persistedState).toEqual({ lastRequest: usage(10), requestedAt: 123 });
  });

  it('replaces the last request and its timestamp on TOKEN_USAGE_UPDATE, and persists both', () => {
    const { result } = renderHook(() => useTokenTracking({ lastRequest: usage(10), requestedAt: 123 }));

    act(() => result.current.handleTokenUsageUpdate(createEnvelope(
      MessageType.TOKEN_USAGE_UPDATE,
      'extension.settings',
      { lastRequest: usage(42), requestedAt: 456 }
    )));

    expect(result.current.persistedState).toEqual({ lastRequest: usage(42), requestedAt: 456 });
  });
});
