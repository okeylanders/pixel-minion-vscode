import { AccountBalanceHandler } from '../../../../application/handlers/domain/AccountBalanceHandler';
import {
  MessageType,
  OpenRouterBalancePayload,
  RequestOpenRouterBalancePayload,
  createEnvelope,
} from '@messages';

const BALANCE: OpenRouterBalancePayload = {
  status: 'ok',
  credits: { totalCredits: 20, totalUsage: 7.66, remaining: 12.34 },
  creditsStatus: 'ok',
  accountEpoch: 3,
  fetchedAt: 1_700_000_000_000,
};

describe('AccountBalanceHandler', () => {
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  let postMessage: jest.Mock;
  let service: {
    getBalance: jest.Mock;
    invalidate: jest.Mock;
    lastKnownBalance: jest.Mock;
    accountEpoch: jest.Mock;
  };
  let handler: AccountBalanceHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    postMessage = jest.fn();
    service = {
      getBalance: jest.fn().mockResolvedValue(BALANCE),
      invalidate: jest.fn(),
      lastKnownBalance: jest.fn().mockReturnValue(undefined),
      accountEpoch: jest.fn().mockReturnValue(3),
    };
    handler = new AccountBalanceHandler(postMessage, service as never, logger as never);
  });

  const request = (payload: RequestOpenRouterBalancePayload | undefined, correlationId?: string) =>
    createEnvelope(MessageType.REQUEST_OPENROUTER_BALANCE, 'webview.account', payload, correlationId);

  it('posts the balance in an extension.account envelope, echoing the correlation id', async () => {
    await handler.handleRequest(request({}, 'corr-1'));

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      type: MessageType.OPENROUTER_BALANCE_DATA,
      source: 'extension.account',
      payload: BALANCE,
      correlationId: 'corr-1',
      timestamp: expect.any(Number),
    });
  });

  it.each([
    [{ forceRefresh: true }, true],
    [{ forceRefresh: false }, false],
    [{}, false],
    [undefined, false],
  ])('passes forceRefresh from %p through as %p', async (payload, expected) => {
    await handler.handleRequest(request(payload as RequestOpenRouterBalancePayload | undefined));

    expect(service.getBalance).toHaveBeenCalledWith(expected);
  });

  it('re-posts the last known figures, with their own fetchedAt, when a refresh fails', async () => {
    service.getBalance.mockRejectedValue(new Error('keychain locked'));
    service.lastKnownBalance.mockReturnValue(BALANCE);

    await handler.handleRequest(request({ forceRefresh: true }, 'corr-3'));

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.OPENROUTER_BALANCE_DATA,
      correlationId: 'corr-3',
      payload: BALANCE,
    }));
  });

  it('posts an unavailable payload instead of throwing when the service fails with nothing cached', async () => {
    service.getBalance.mockRejectedValue(new Error('keychain locked'));

    await expect(handler.handleRequest(request({ forceRefresh: true }, 'corr-2'))).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith('OpenRouter balance request failed', expect.any(Error));
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.OPENROUTER_BALANCE_DATA,
      correlationId: 'corr-2',
      payload: {
        status: 'unavailable',
        creditsStatus: 'unavailable',
        accountEpoch: 3,
        fetchedAt: expect.any(Number),
      },
    }));
  });

  it("labels the fallback with the key the load was for, so a key change makes the webview drop it", async () => {
    let epoch = 3;
    service.accountEpoch.mockImplementation(() => epoch);
    service.getBalance.mockImplementation(async () => {
      epoch = 4; // the key is replaced while this load is in flight
      throw new Error('keychain locked');
    });

    await handler.handleRequest(request({}, 'corr-4'));

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      correlationId: 'corr-4',
      payload: expect.objectContaining({ status: 'unavailable', accountEpoch: 3 }),
    }));
  });

  it('on a key change, drops the old figures, resets the view, then force-fetches and pushes the result', async () => {
    const order: string[] = [];
    let epoch = 3;
    service.accountEpoch.mockImplementation(() => epoch);
    service.invalidate.mockImplementation(() => {
      epoch += 1;
      order.push('invalidate');
    });
    postMessage.mockImplementation((message) => order.push(`post ${message.type}`));
    service.getBalance.mockImplementation(async (force: boolean) => {
      order.push(`getBalance(${force})`);
      return { status: 'no_key', creditsStatus: 'no_key', accountEpoch: 4, fetchedAt: 1 };
    });

    await handler.handleApiKeyChanged();

    expect(order).toEqual([
      'invalidate',
      `post ${MessageType.OPENROUTER_BALANCE_RESET}`,
      'getBalance(true)',
      `post ${MessageType.OPENROUTER_BALANCE_DATA}`,
    ]);
    expect(postMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: MessageType.OPENROUTER_BALANCE_RESET,
      source: 'extension.account',
      payload: { accountEpoch: 4 },
    }));
    expect(postMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: MessageType.OPENROUTER_BALANCE_DATA,
      payload: { status: 'no_key', creditsStatus: 'no_key', accountEpoch: 4, fetchedAt: 1 },
    }));
  });

  it('resets the view before the new key\'s fetch settles', async () => {
    let settle!: (payload: OpenRouterBalancePayload) => void;
    service.getBalance.mockReturnValue(new Promise((resolve) => { settle = resolve; }));

    const changed = handler.handleApiKeyChanged();

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.OPENROUTER_BALANCE_RESET,
    }));
    settle(BALANCE);
    await changed;
    expect(postMessage).toHaveBeenCalledTimes(2);
  });
});
