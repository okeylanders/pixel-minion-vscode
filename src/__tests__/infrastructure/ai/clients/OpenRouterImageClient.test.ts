import { OpenRouterImageClient } from '../../../../infrastructure/ai/clients/OpenRouterImageClient';
import type { SecretStorageService } from '../../../../infrastructure/secrets/SecretStorageService';
import type { LoggingService } from '../../../../infrastructure/logging/LoggingService';
import { OPENROUTER_IMAGE_MODELS } from '../../../../infrastructure/ai/providers/OpenRouterProvider';

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

  const requestModalities = async (model: string): Promise<string[]> => {
    mockFetch.mockClear();
    await client.generateImages({
      model,
      aspectRatio: '1:1',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'A tree' }] }],
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    return body.modalities;
  };

  it('uses image-only modalities for image-only providers (FLUX, Sourceful, Recraft, Seedream, Krea, MAI, Grok Imagine)', async () => {
    const imageOnlyModels = [
      'black-forest-labs/flux.2-flex',
      'sourceful/riverflow-v2-fast',
      'recraft/recraft-v4.1-pro',
      'recraft/recraft-v4-pro',
      'openai/gpt-image-2',
      'bytedance-seed/seedream-4.5',
      'krea/krea-2-large',
      'microsoft/mai-image-2.5-pro',
      'x-ai/grok-imagine-image-2.0',
    ];

    for (const model of imageOnlyModels) {
      expect({ model, modalities: await requestModalities(model) })
        .toEqual({ model, modalities: ['image'] });
    }
  });

  it('uses image+text modalities for Gemini image models', async () => {
    expect(await requestModalities('google/gemini-3.1-flash-image-preview')).toEqual(['image', 'text']);
  });

  it('never sends text output to Recraft V4.1 (its endpoints are image-only)', async () => {
    for (const model of ['recraft/recraft-v4.1', 'recraft/recraft-v4.1-pro', 'recraft/recraft-v4.1-utility-pro']) {
      expect(await requestModalities(model)).toEqual(['image']);
    }
  });

  describe('catalog-wide modality contract', () => {
    /**
     * Output modalities each catalog model declares on OpenRouter, copied from
     * `GET https://openrouter.ai/api/v1/images/models` (`architecture.output_modalities`)
     * snapshot taken 2026-11-07. Asking an image-only endpoint for text output fails
     * with 404 "No endpoints found that support the requested output modalities".
     * When the catalog changes, re-check the live feed and update this map.
     */
    const DECLARED_OUTPUT_MODALITIES_2026_11_07: Record<string, string[]> = {
      'google/gemini-3.1-flash-image': ['image', 'text'],
      'google/gemini-3.1-flash-image-preview': ['image', 'text'],
      'google/gemini-3-pro-image': ['image', 'text'],
      'google/gemini-3-pro-image-preview': ['image', 'text'],
      'google/gemini-3.1-flash-lite-image': ['image', 'text'],
      'google/gemini-2.5-flash-image': ['image', 'text'],
      'openai/gpt-image-2': ['image'],
      'openai/gpt-image-1': ['image'],
      'openai/gpt-image-1-mini': ['image'],
      'openai/gpt-5.4-image-2': ['image', 'text'],
      'openai/gpt-5-image': ['image', 'text'],
      'openai/gpt-5-image-mini': ['image', 'text'],
      'microsoft/mai-image-2.5-pro': ['image'],
      'microsoft/mai-image-2.5': ['image'],
      'krea/krea-2-large': ['image'],
      'krea/krea-2-medium': ['image'],
      'krea/krea-2-medium-turbo': ['image'],
      'black-forest-labs/flux.2-klein-4b': ['image'],
      'black-forest-labs/flux.2-pro': ['image'],
      'black-forest-labs/flux.2-flex': ['image'],
      'black-forest-labs/flux.2-max': ['image'],
      'sourceful/riverflow-v2.5-pro': ['image'],
      'sourceful/riverflow-v2.5-fast': ['image'],
      'sourceful/riverflow-v2-pro': ['image'],
      'sourceful/riverflow-v2-fast': ['image'],
      'bytedance-seed/seedream-4.5': ['image'],
      'recraft/recraft-v4.1-pro': ['image'],
      'recraft/recraft-v4.1': ['image'],
      'recraft/recraft-v4.1-utility-pro': ['image'],
      'recraft/recraft-v4.1-utility': ['image'],
      'recraft/recraft-v4-pro': ['image'],
      'recraft/recraft-v4': ['image'],
      'recraft/recraft-v3': ['image'],
    };

    it('has a snapshot entry for every catalog image model', () => {
      const missing = OPENROUTER_IMAGE_MODELS
        .map(model => model.id)
        .filter(id => !(id in DECLARED_OUTPUT_MODALITIES_2026_11_07));
      expect(missing).toEqual([]);
    });

    it.each(OPENROUTER_IMAGE_MODELS.map(model => model.id))(
      'requests only output modalities %s declares',
      async (id) => {
        const requested = await requestModalities(id);
        const declared = DECLARED_OUTPUT_MODALITIES_2026_11_07[id] ?? [];
        expect(requested.filter(modality => !declared.includes(modality))).toEqual([]);
        expect(requested).toContain('image');
      }
    );
  });
});
