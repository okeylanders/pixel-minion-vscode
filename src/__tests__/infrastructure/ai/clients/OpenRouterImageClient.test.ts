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

  it('uses image-only modalities for image-only providers (FLUX, Sourceful, Recraft, Seedream, Grok Imagine)', async () => {
    const imageOnlyModels = [
      'black-forest-labs/flux.2-flex',
      'sourceful/riverflow-v2-fast',
      'recraft/recraft-v4-pro',
      'openai/gpt-image-2',
      'bytedance-seed/seedream-4.5',
      'x-ai/grok-imagine-image-quality',
    ];

    for (const model of imageOnlyModels) {
      await client.generateImages({
        model,
        aspectRatio: '16:9',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'A tree' }] }],
        seed: 1,
      });
    }

    imageOnlyModels.forEach((_, i) => {
      const body = JSON.parse(mockFetch.mock.calls[i][1].body as string);
      expect(body.modalities).toEqual(['image']);
    });
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

  it('uses image+text modalities for Recraft V4.1 models', async () => {
    await client.generateImages({
      model: 'recraft/recraft-v4.1-pro',
      aspectRatio: '1:1',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'A poster' }] }],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.modalities).toEqual(['image', 'text']);
  });
});
