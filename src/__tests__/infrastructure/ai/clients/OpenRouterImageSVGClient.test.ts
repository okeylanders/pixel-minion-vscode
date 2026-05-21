/**
 * OpenRouterImageSVGClient tests
 *
 * Verifies the vector-image SVG client:
 * - Posts modalities: ['image'] to /chat/completions
 * - Decodes data:image/svg+xml;base64 payloads into raw SVG markup
 * - Surfaces usage data
 * - Errors clearly when the payload is missing or unexpected
 */
import { OpenRouterImageSVGClient } from '../../../../infrastructure/ai/clients/OpenRouterImageSVGClient';
import { SecretStorageService } from '../../../../infrastructure/secrets/SecretStorageService';
import { LoggingService } from '../../../../infrastructure/logging/LoggingService';
import { TextMessage } from '../../../../infrastructure/ai/clients/TextClient';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const SAMPLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>';

const buildResponse = (overrides: { url?: string; usage?: unknown } = {}) => ({
  ok: true,
  json: async () => ({
    id: 'cmpl-test',
    choices: [
      {
        message: {
          content: null,
          images: [
            {
              type: 'image_url',
              image_url: {
                url: overrides.url ?? `data:image/svg+xml;base64,${Buffer.from(SAMPLE_SVG, 'utf-8').toString('base64')}`,
              },
            },
          ],
        },
        finish_reason: 'stop',
      },
    ],
    usage: overrides.usage ?? {
      prompt_tokens: 5,
      completion_tokens: 200,
      cost: 0.01,
    },
  }),
});

describe('OpenRouterImageSVGClient', () => {
  let client: OpenRouterImageSVGClient;
  let mockSecretStorage: jest.Mocked<SecretStorageService>;
  let mockLogger: jest.Mocked<LoggingService>;
  const messages: TextMessage[] = [
    { role: 'system', content: 'be an svg artist' },
    { role: 'user', content: 'a red circle' },
  ];

  beforeEach(() => {
    mockFetch.mockReset();
    mockSecretStorage = {
      getApiKey: jest.fn().mockResolvedValue('test-key'),
      hasApiKey: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<SecretStorageService>;
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggingService>;
    client = new OpenRouterImageSVGClient(mockSecretStorage, mockLogger);
  });

  it('posts modalities: [image] and decodes base64 SVG into raw markup', async () => {
    mockFetch.mockResolvedValueOnce(buildResponse());

    const result = await client.createCompletion(messages, { model: 'recraft/recraft-v4.1-pro-vector' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.modalities).toEqual(['image']);
    expect(body.model).toBe('recraft/recraft-v4.1-pro-vector');
    expect(result.content).toBe(SAMPLE_SVG);
    expect(result.usage).toEqual(expect.objectContaining({
      promptTokens: 5,
      completionTokens: 200,
      totalTokens: 205,
      costUsd: 0.01,
    }));
  });

  it('throws a clear error when the response carries no image payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: null, images: [] }, finish_reason: 'stop' }] }),
    });

    await expect(
      client.createCompletion(messages, { model: 'recraft/recraft-v4-vector' })
    ).rejects.toThrow(/no image data/i);
  });

  it('throws a clear error when the image is not an SVG data URL', async () => {
    mockFetch.mockResolvedValueOnce(
      buildResponse({ url: 'data:image/png;base64,AAAA' })
    );

    await expect(
      client.createCompletion(messages, { model: 'recraft/recraft-v4-vector' })
    ).rejects.toThrow(/image\/svg\+xml/);
  });

  it('falls back to the constructor default model when no override is passed', async () => {
    mockFetch.mockResolvedValueOnce(buildResponse());

    await client.createCompletion(messages);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.model).toBe('recraft/recraft-v4.1-pro-vector');
  });
});
