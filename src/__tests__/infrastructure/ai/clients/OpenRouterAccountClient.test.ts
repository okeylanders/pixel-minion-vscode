import { OpenRouterAccountClient } from '../../../../infrastructure/ai/clients/OpenRouterAccountClient';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const secretStorage = {
  getApiKey: jest.fn(),
};

const logger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('OpenRouterAccountClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secretStorage.getApiKey.mockResolvedValue('sk-test');
  });

  it('combines credits and key-limit data without exposing the API key', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { limit: 20, limit_remaining: 12, limit_reset: 'weekly' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { total_credits: 100, total_usage: 27.5 },
        }),
      });

    const client = new OpenRouterAccountClient(secretStorage as never, logger as never);
    const result = await client.fetchBalance();

    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      keyLimit: { limit: 20, limitRemaining: 12, resetWindow: 'weekly' },
      credits: { totalCredits: 100, totalUsage: 27.5, remaining: 72.5 },
    }));
    expect(JSON.stringify(result)).not.toContain('sk-test');
  });

  it('reports no_key without making a request', async () => {
    secretStorage.getApiKey.mockResolvedValue(undefined);
    const client = new OpenRouterAccountClient(secretStorage as never, logger as never);

    await expect(client.fetchBalance()).resolves.toEqual(expect.objectContaining({ status: 'no_key' }));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
