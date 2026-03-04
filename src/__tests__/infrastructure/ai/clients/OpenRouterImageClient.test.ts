import { OpenRouterImageClient } from '../../../../infrastructure/ai/clients/OpenRouterImageClient';
import type { SecretStorageService } from '../../../../infrastructure/secrets/SecretStorageService';
import type { LoggingService } from '../../../../infrastructure/logging/LoggingService';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('OpenRouterImageClient', () => {
  let client: OpenRouterImageClient;
  let mockSecretStorage: jest.Mocked<SecretStorageService>;
  let mockLogger: jest.Mocked<LoggingService>;

  const createMockApiResponse = () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: [{ type: 'text', text: 'Generated image' }],
            images: [{ image_url: { url: 'data:image/png;base64,AAA' } }],
          },
        },
      ],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        cost: 0.001,
      },
    }),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockSecretStorage = {
      getApiKey: jest.fn().mockResolvedValue('test-api-key'),
      hasApiKey: jest.fn().mockResolvedValue(true),
      storeSecret: jest.fn().mockResolvedValue(undefined),
      getSecret: jest.fn().mockResolvedValue('test-api-key'),
      deleteSecret: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SecretStorageService>;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      separator: jest.fn(),
      show: jest.fn(),
      clear: jest.fn(),
      getChannel: jest.fn(),
    } as unknown as jest.Mocked<LoggingService>;

    client = new OpenRouterImageClient(mockSecretStorage, mockLogger);
    mockFetch.mockResolvedValue(createMockApiResponse());
  });

  it('uses image-only modalities for FLUX and Sourceful models', async () => {
    await client.generateImages({
      model: 'black-forest-labs/flux.2-flex',
      aspectRatio: '16:9',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'A tree' }] }],
      seed: 123,
    });

    await client.generateImages({
      model: 'sourceful/riverflow-v2-fast',
      aspectRatio: '16:9',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'A tree' }] }],
      seed: 456,
    });

    const firstBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body as string);

    expect(firstBody.modalities).toEqual(['image']);
    expect(secondBody.modalities).toEqual(['image']);
  });

  it('uses image+text modalities for Gemini image models', async () => {
    await client.generateImages({
      model: 'google/gemini-3.1-flash-image-preview',
      aspectRatio: '1:1',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'A tree' }] }],
      seed: 789,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.modalities).toEqual(['image', 'text']);
  });
});
