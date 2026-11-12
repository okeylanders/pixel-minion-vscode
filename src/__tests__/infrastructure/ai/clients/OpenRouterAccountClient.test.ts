import { OpenRouterAccountClient } from '../../../../infrastructure/ai/clients/OpenRouterAccountClient';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const secretStorage = {
  getApiKey: jest.fn(),
};

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const nonJsonResponse = (status: number) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); },
});

describe('OpenRouterAccountClient', () => {
  let client: OpenRouterAccountClient;

  beforeEach(() => {
    jest.clearAllMocks();
    secretStorage.getApiKey.mockResolvedValue('sk-test');
    client = new OpenRouterAccountClient(secretStorage as never, logger as never);
  });

  describe('fetchKeyLimit', () => {
    it('reads the key limit, sends the key and branding headers, and applies a timeout', async () => {
      mockFetch.mockResolvedValue(jsonResponse(200, {
        data: { limit: 20, limit_remaining: 12, limit_reset: 'weekly' },
      }));

      const result = await client.fetchKeyLimit();

      expect(result).toEqual({
        status: 'ok',
        data: { limit: 20, limitRemaining: 12, resetWindow: 'weekly' },
      });
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://openrouter.ai/api/v1/key');
      expect(init.headers).toEqual(expect.objectContaining({
        Authorization: 'Bearer sk-test',
        'HTTP-Referer': 'https://github.com/pixel-minion-vscode',
        'X-Title': 'Pixel Minion VS Code Extension',
      }));
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(JSON.stringify(result)).not.toContain('sk-test');
    });

    it.each([
      ['daily', 'daily'],
      ['weekly', 'weekly'],
      ['monthly', 'monthly'],
      ['MONTHLY', 'monthly'],
      [null, 'unknown'],
      ['quarterly', 'unknown'],
      [undefined, 'unknown'],
    ])('maps limit_reset %p to %p', async (limitReset, expected) => {
      mockFetch.mockResolvedValue(jsonResponse(200, {
        data: { limit: 5, limit_remaining: 4.5, limit_reset: limitReset },
      }));

      const result = await client.fetchKeyLimit();

      expect(result).toEqual({
        status: 'ok',
        data: { limit: 5, limitRemaining: 4.5, resetWindow: expected },
      });
    });

    it('reports an unlimited key as null limits, not zero', async () => {
      mockFetch.mockResolvedValue(jsonResponse(200, {
        data: { limit: null, limit_remaining: null, limit_reset: null },
      }));

      await expect(client.fetchKeyLimit()).resolves.toEqual({
        status: 'ok',
        data: { limit: null, limitRemaining: null, resetWindow: 'unknown' },
      });
    });

    it('treats a 200 without a data object as malformed', async () => {
      mockFetch.mockResolvedValue(jsonResponse(200, { error: 'nope' }));

      await expect(client.fetchKeyLimit()).resolves.toEqual({
        status: 'unavailable',
        issue: { kind: 'malformed' },
      });
      expect(logger.warn).toHaveBeenCalledWith('OpenRouter /key response is missing a data object');
    });
  });

  describe('fetchCredits', () => {
    it('computes the remaining balance, including an overdrawn account', async () => {
      mockFetch.mockResolvedValue(jsonResponse(200, {
        data: { total_credits: 10, total_usage: 11.5 },
      }));

      await expect(client.fetchCredits()).resolves.toEqual({
        status: 'ok',
        data: { totalCredits: 10, totalUsage: 11.5, remaining: -1.5 },
      });
      expect(mockFetch.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/credits');
    });

    it('treats missing total_usage as zero usage', async () => {
      mockFetch.mockResolvedValue(jsonResponse(200, { data: { total_credits: 25 } }));

      await expect(client.fetchCredits()).resolves.toEqual({
        status: 'ok',
        data: { totalCredits: 25, totalUsage: 0, remaining: 25 },
      });
    });

    it('treats a missing total_credits as unavailable instead of inventing a balance', async () => {
      mockFetch.mockResolvedValue(jsonResponse(200, { data: { total_usage: 3 } }));

      await expect(client.fetchCredits()).resolves.toEqual({
        status: 'unavailable',
        issue: { kind: 'malformed' },
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'OpenRouter /credits response is missing a numeric total_credits'
      );
    });

    it('treats a non-JSON 200 as malformed, not as a network failure', async () => {
      mockFetch.mockResolvedValue(nonJsonResponse(200));

      await expect(client.fetchCredits()).resolves.toEqual({
        status: 'unavailable',
        issue: { kind: 'malformed' },
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'OpenRouter /credits returned a non-JSON body',
        expect.any(SyntaxError)
      );
    });
  });

  describe('failures', () => {
    it.each([
      [401, { kind: 'invalid_key', httpStatus: 401 }],
      [403, { kind: 'forbidden', httpStatus: 403 }],
      [429, { kind: 'rate_limited', httpStatus: 429 }],
      [404, { kind: 'http_error', httpStatus: 404 }],
      [500, { kind: 'server_error', httpStatus: 500 }],
      [503, { kind: 'server_error', httpStatus: 503 }],
    ])('maps HTTP %i to %p', async (status, issue) => {
      mockFetch.mockResolvedValue(jsonResponse(status, { error: { message: 'raw body with secrets' } }));

      const result = await client.fetchCredits();

      expect(result).toEqual({ status: 'unavailable', issue });
      expect(JSON.stringify(result)).not.toContain('raw body');
    });

    it('logs 4xx at debug (a key/scope problem) and 5xx at warn (an outage)', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(403, {}));
      await client.fetchCredits();
      expect(logger.debug).toHaveBeenCalledWith('OpenRouter /credits returned 403');
      expect(logger.warn).not.toHaveBeenCalled();

      mockFetch.mockResolvedValueOnce(jsonResponse(502, {}));
      await client.fetchKeyLimit();
      expect(logger.warn).toHaveBeenCalledWith('OpenRouter /key returned 502');
    });

    it('reports a thrown request (offline) as a network issue', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      await expect(client.fetchKeyLimit()).resolves.toEqual({
        status: 'unavailable',
        issue: { kind: 'network' },
      });
      expect(logger.warn).toHaveBeenCalledWith('OpenRouter /key request failed', expect.any(TypeError));
    });

    it('reports a timeout as a network issue', async () => {
      const timeout = new Error('The operation was aborted due to timeout');
      timeout.name = 'TimeoutError';
      mockFetch.mockRejectedValue(timeout);

      await expect(client.fetchCredits()).resolves.toEqual({
        status: 'unavailable',
        issue: { kind: 'network' },
      });
    });
  });

  it('reports no_key without making a request', async () => {
    secretStorage.getApiKey.mockResolvedValue(undefined);

    await expect(client.fetchKeyLimit()).resolves.toEqual({ status: 'no_key' });
    await expect(client.fetchCredits()).resolves.toEqual({ status: 'no_key' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
