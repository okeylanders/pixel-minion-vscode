import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageEnvelope,
  MessageType,
  OpenRouterBalancePayload,
  createEnvelope,
} from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';

export interface UseOpenRouterBalanceReturn {
  balance: OpenRouterBalancePayload | null;
  isLoading: boolean;
  refresh: () => void;
  handleBalanceData: (message: MessageEnvelope) => void;
}

export function useOpenRouterBalance(apiKeyConfigured: boolean): UseOpenRouterBalanceReturn {
  const vscode = useVSCodeApi();
  const [balance, setBalance] = useState<OpenRouterBalancePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousConfigured = useRef(apiKeyConfigured);

  const request = useCallback(() => {
    setIsLoading(true);
    vscode.postMessage(createEnvelope(
      MessageType.REQUEST_OPENROUTER_BALANCE,
      'webview.account',
      { forceRefresh: true }
    ));
  }, [vscode]);

  const handleBalanceData = useCallback((message: MessageEnvelope) => {
    setBalance(message.payload as OpenRouterBalancePayload);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    request();
  }, [request]);

  useEffect(() => {
    if (!previousConfigured.current && apiKeyConfigured) request();
    previousConfigured.current = apiKeyConfigured;
  }, [apiKeyConfigured, request]);

  return { balance, isLoading, refresh: request, handleBalanceData };
}
