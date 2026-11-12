/**
 * OpenRouterImageClient: the request bodies that reach OpenRouter.
 *
 * Ported from frame-minion@40e7949
 * packages/core/src/__tests__/infrastructure/ai/clients/OpenRouterImageClient.test.ts.
 * Pixel deltas: Muse cases use a Gemini / GPT-5 conversational route instead
 * (Muse has no route on 2026-11-12), the Ming and project-frame cases are
 * dropped (not in Pixel), and the old per-prefix modality snapshot is
 * replaced by catalog-wide route checks driven by the 2026-11-12 fixture.
 */
import { OpenRouterImageClient } from '../../../../infrastructure/ai/clients/OpenRouterImageClient';
import type { SecretStorageService } from '../../../../infrastructure/secrets/SecretStorageService';
import type { LoggingService } from '../../../../infrastructure/logging/LoggingService';
import { OPENROUTER_IMAGE_MODELS, imageRouteCapabilities } from '../../../../shared/models';
import chatRoutes from '../../../fixtures/provider-contracts/openrouter-image-chat-routes-2026-11-12.json';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const mockSecretStorage = {
  getApiKey: jest.fn().mockResolvedValue('test-api-key'),
  hasApiKey: jest.fn().mockResolvedValue(true),
} as unknown as jest.Mocked<SecretStorageService>;
const mockLogger = {
  debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
} as unknown as jest.Mocked<LoggingService>;
const client = () => new OpenRouterImageClient(mockSecretStorage, mockLogger);
const body = (call = 0) => JSON.parse(mockFetch.mock.calls[call][1].body);
const url = (call = 0) => mockFetch.mock.calls[call][0];
const prompt = (text: string) => [{ role: 'user' as const, content: [{ type: 'text' as const, text }] }];

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const signedAssistant = {
  role: 'assistant',
  content: [{ type: 'text', text: 'A blue knight' }],
  images: [{ image_url: { url: `data:image/png;base64,${PNG_1PX}` }, thought_signature: 'opaque' }],
};
const chatResponse = (message: object = signedAssistant, usage?: object) => ({
  ok: true, json: async () => ({ choices: [{ message }], ...(usage ? { usage } : {}) }),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [{ b64_json: 'AAA', media_type: 'image/png' }, { b64_json: 'BBB', media_type: 'image/webp' }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, cost: 0.001 },
    }),
  });
});

describe('Single Shot: the dedicated Image API', () => {
  it('sends the prompt, references, ratio and tier to /images, without the seed this route does not take', async () => {
    const result = await client().generateImages({
      model: 'google/gemini-3.1-flash-image', mode: 'edit', aspectRatio: '16:9', resolution: '4K', seed: 123,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'A cinematic forest' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,REF' } },
        ],
      }],
    });

    expect(url()).toBe('https://openrouter.ai/api/v1/images');
    expect(mockFetch.mock.calls[0][1].headers).toMatchObject({
      'HTTP-Referer': 'https://github.com/pixel-minion-vscode',
      'X-Title': 'Pixel Minion VS Code Extension',
    });
    // Field by field: Gemini's Image API record lists no `seed`, and nothing else rides along.
    expect(body()).toEqual({
      model: 'google/gemini-3.1-flash-image',
      prompt: 'A cinematic forest',
      aspect_ratio: '16:9',
      resolution: '4K',
      input_references: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,REF' } }],
    });
    expect(result.images).toEqual([
      { data: 'data:image/png;base64,AAA', mimeType: 'image/png' },
      { data: 'data:image/webp;base64,BBB', mimeType: 'image/webp' },
    ]);
    expect(result.seedSupported).toBe(false);
    expect(result.usage).toEqual({ promptTokens: 1, completionTokens: 2, totalTokens: 3, costUsd: 0.001 });
  });

  it.each(['black-forest-labs/flux-3-image-klein', 'black-forest-labs/flux-3-image-klein:floor'])(
    'sends the seed where the route takes one: %s', async model => {
      const result = await client().generateImages({
        model, mode: 'edit', aspectRatio: '1:1', resolution: '768', seed: 42,
        messages: prompt('A lighthouse'),
      });
      expect(body()).toEqual({ model, prompt: 'A lighthouse', seed: 42, aspect_ratio: '1:1', resolution: '768' });
      expect(result.seed).toBe(42);
      expect(result.seedSupported).toBe(true);
    },
  );

  it('keeps a curated variant’s dimensions and seed restriction while dispatching its full id', async () => {
    const model = 'Google/Gemini-3.1-Flash-Image:nitro';
    const result = await client().generateImages({
      model, mode: 'edit', aspectRatio: '16:9', resolution: '4K', seed: 42,
      messages: prompt('A lighthouse'),
    });
    expect(url()).toBe('https://openrouter.ai/api/v1/images');
    expect(body()).toEqual({ model, prompt: 'A lighthouse', aspect_ratio: '16:9', resolution: '4K' });
    expect(result.seedSupported).toBe(false);
  });

  it('sends ten FLUX.3 references and its 1.5K tier without a seed', async () => {
    const references = Array.from({ length: 10 }, (_, index) => ({ type: 'image_url' as const, image_url: { url: `data:image/png;base64,REF${index}` } }));
    await client().generateImages({
      model: 'black-forest-labs/flux-3-image', mode: 'edit', aspectRatio: '7:5', resolution: '1.5K', seed: 123,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Keep the subject, change the lighting' }, ...references] }],
    });
    expect(body()).toMatchObject({ model: 'black-forest-labs/flux-3-image', resolution: '1.5K', aspect_ratio: '7:5' });
    expect(body().input_references).toHaveLength(10);
    expect(body()).not.toHaveProperty('seed');
  });

  it('sends a prompt-only Recraft V4.1 Flash request with no references and no seed', async () => {
    await client().generateImages({
      model: 'recraft/recraft-v4.1-flash', mode: 'edit', aspectRatio: 'auto', seed: 12,
      messages: prompt('A poster'),
    });
    // Auto is in this route's list, so it is sent; the route lists no seed.
    expect(body()).toEqual({ model: 'recraft/recraft-v4.1-flash', prompt: 'A poster', aspect_ratio: 'auto' });
  });

  it.each([
    ['black-forest-labs/flux-3-image', 11],
    ['bytedance-seed/seedream-5-0-flash', 15],
    ['recraft/recraft-v4.1-flash', 1],
    ['recraft/recraft-v4.1', 2],
    ['RECRAFT/RECRAFT-V4.1-FLASH:nitro', 1],
    ['black-forest-labs/flux-3-image:floor', 11],
  ])('rejects excess references before calling %s', async (model, count) => {
    const references = Array.from({ length: count }, () => ({ type: 'image_url' as const, image_url: { url: 'data:image/png;base64,REF' } }));
    await expect(client().generateImages({
      model, mode: 'edit', aspectRatio: '1:1',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'A tree' }, ...references] }],
    })).rejects.toThrow(/reference images/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each(['krea/k3-edit', 'recraft/recraft-v4-styles', 'recraft/recraft-v4-styles-pro', 'KREA/K3-EDIT:floor'])(
    'requires a reference before %s is called', async model => {
      await expect(client().generateImages({
        model, mode: 'edit', aspectRatio: '1:1', messages: prompt('A botanical poster'),
      })).rejects.toThrow(/at least|1–(8|10) reference images; received 0/);
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it.each(['recraft/recraft-v4-styles', 'recraft/recraft-v4-styles:nitro'])(
    'requires a PNG, JPEG or WebP style reference for %s', async model => {
      await expect(client().generateImages({
        model, mode: 'edit', aspectRatio: '1:1',
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'A botanical poster' },
          { type: 'image_url', image_url: { url: 'data:image/gif;base64,REF' } },
        ] }],
      })).rejects.toThrow('requires PNG, JPEG, or WebP');
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it.each(['', ':nitro'])('rejects unsupported dimensions before calling the provider, including variant %s', async variant => {
    await expect(client().generateImages({
      model: `openai/gpt-image-1${variant}`, mode: 'edit', aspectRatio: '16:9', messages: prompt('A tree'),
    })).rejects.toThrow('Aspect ratio is not supported');
    await expect(client().generateImages({
      model: `bytedance-seed/seedream-5-0-lite${variant}`, mode: 'edit', aspectRatio: '1:1', resolution: '1K', messages: prompt('A tree'),
    })).rejects.toThrow('Resolution is not supported');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'],
    [Buffer.from([255, 216, 255, 224]), 'image/jpeg'],
    [Buffer.from('GIF89a'), 'image/gif'],
    [Buffer.from('RIFF0000WEBP'), 'image/webp'],
  ])('identifies omitted media_type from raster bytes (%s)', async (bytes, mimeType) => {
    const base64 = (bytes as Buffer).toString('base64');
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [{ b64_json: base64 }] }) });
    const result = await client().generateImages({
      model: 'google/gemini-3.1-flash-image', mode: 'edit', aspectRatio: '1:1', messages: prompt('A tree'),
    });
    expect(result.images[0]).toEqual({ data: `data:${mimeType};base64,${base64}`, mimeType });
  });

  it('trusts the bytes over a disagreeing media_type', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [{ b64_json: PNG_1PX, media_type: 'image/jpeg' }] }) });
    const result = await client().generateImages({ model: 'recraft/recraft-v4.1', mode: 'edit', aspectRatio: '1:1', messages: prompt('A tree') });
    expect(result.images[0].mimeType).toBe('image/png');
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('disagrees with its bytes'));
  });

  it.each([
    [{ data: [{ b64_json: 'QUJD' }] }, 'no usable image'],
    [{ data: [{ b64_json: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64'), media_type: 'image/svg+xml' }] }, 'no usable image'],
    [{ data: [{ url: 'https://example.com/a.png' }, null, { b64_json: '' }] }, 'no usable image'],
    [{ data: [] }, 'No images returned'],
    [{}, 'No images returned'],
  ])('rejects unidentified or missing output instead of saving a guess: %j', async (response, message) => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => response });
    await expect(client().generateImages({
      model: 'vendor/custom', mode: 'edit', aspectRatio: 'auto', messages: prompt('A tree'),
    })).rejects.toThrow(message);
  });

  it('refuses a request without a known mode, or without a model, before calling the provider', async () => {
    const unchecked = { model: 'krea/krea-2-medium-turbo', aspectRatio: '21:9', resolution: '4K', messages: prompt('A tree') };
    await expect(client().generateImages(unchecked as never)).rejects.toThrow('Unknown image generation mode');
    await expect(client().generateImages({ ...unchecked, mode: 'chat' } as never)).rejects.toThrow('Unknown image generation mode');
    await expect(client().generateImages({ mode: 'edit', model: ' ', aspectRatio: 'auto', messages: prompt('A tree') })).rejects.toThrow('Choose an image model');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps the usable images when another result has no data or an unidentifiable format', async () => {
    const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64');
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [
      { b64_json: PNG, media_type: 'image/png' },
      { b64_json: 'QUJD' },
      { url: 'https://example.com/b.png' },
      { b64_json: Buffer.from('<svg/>').toString('base64'), media_type: 'image/svg+xml' },
    ], usage: { cost: 0.04 } }) });
    const result = await client().generateImages({ model: 'krea/krea-2-medium-turbo', mode: 'edit', aspectRatio: '1:1', messages: prompt('A tree') });
    expect(result.images).toEqual([{ data: `data:image/png;base64,${PNG}`, mimeType: 'image/png' }]);
    expect(result.usage?.costUsd).toBe(0.04);
    const warnings = (mockLogger.warn as jest.Mock).mock.calls.map(([message]) => String(message));
    expect(warnings).toEqual([
      'Image API result 1 could not be identified as PNG, JPEG, WebP or GIF (media type: none); skipped',
      'Image API result 2 has no base64 image data; skipped',
      'Image API result 3 could not be identified as PNG, JPEG, WebP or GIF (media type: image/svg+xml); skipped',
    ]);
  });

  it('omits an unverified automatic ratio for a custom id', async () => {
    await client().generateImages({ model: 'vendor/custom', mode: 'edit', aspectRatio: 'auto', seed: 5, messages: prompt('A tree') });
    // Custom ids keep a seed (permissive) but no ratio the catalog never verified.
    expect(body()).toEqual({ model: 'vendor/custom', prompt: 'A tree', seed: 5 });
  });

  it('omits resolution when the picker is set to auto', async () => {
    await client().generateImages({ model: 'openai/gpt-image-2', mode: 'edit', aspectRatio: '1:1', resolution: 'auto', messages: prompt('A tree') });
    expect(body()).not.toHaveProperty('resolution');
  });

  it.each([
    'openai/gpt-image-2.5-sunburst', 'openai/gpt-image-2.5-flare', 'openai/gpt-image-2.6-flare',
    'microsoft/mai-image-2.6', 'microsoft/mai-image-2.6-flash',
  ])('routes %s through the Image API without an unsupported seed', async model => {
    await client().generateImages({ model, mode: 'edit', aspectRatio: '16:9', seed: 123, messages: prompt('A tree') });
    expect(url()).toBe('https://openrouter.ai/api/v1/images');
    expect(body()).toEqual({ model, prompt: 'A tree', aspect_ratio: '16:9' });
  });

  it('does not retry a failed Image API request on the other billable endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, statusText: 'Unavailable', text: async () => 'Unavailable' });
    await expect(client().generateImages({
      model: 'google/gemini-3.1-flash-image', mode: 'edit', aspectRatio: '1:1', messages: prompt('A tree'),
    })).rejects.toThrow('503');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('Conversation: chat/completions', () => {
  const transcript = [
    { role: 'user' as const, content: [{ type: 'text' as const, text: 'Keep the knight blue' }] },
    signedAssistant as never,
    { role: 'user' as const, content: [
      { type: 'text' as const, text: 'Add a tree' },
      { type: 'image_url' as const, image_url: { url: `data:image/png;base64,${PNG_1PX}` } },
    ] },
  ];

  it('sends the whole transcript with exactly these fields (old body: usage.include dropped, stream added)', async () => {
    mockFetch.mockResolvedValue(chatResponse());
    const result = await client().generateImages({
      mode: 'conversation', model: 'google/gemini-3-pro-image', aspectRatio: '16:9', resolution: '4K', seed: 7,
      messages: transcript,
    });
    expect(url()).toBe('https://openrouter.ai/api/v1/chat/completions');
    // Before P3 the chat body was { model, messages, modalities, seed,
    // image_config: { aspect_ratio }, usage: { include: true } }. usage.include
    // is deprecated (cost is always returned); stream and image_size are new.
    expect(body()).toEqual({
      model: 'google/gemini-3-pro-image',
      messages: transcript,
      modalities: ['image', 'text'],
      stream: false,
      seed: 7,
      image_config: { aspect_ratio: '16:9', image_size: '4K' },
    });
    expect(result.assistantMessage).toEqual(signedAssistant);
    expect(result.seedSupported).toBe(true);
  });

  it('sends no image_size for a GPT-5 wrapper (no chat size tiers) and rejects an unlisted tier', async () => {
    mockFetch.mockResolvedValue(chatResponse());
    await client().generateImages({ mode: 'conversation', model: 'openai/gpt-5-image', aspectRatio: '3:2', messages: transcript });
    expect(body().image_config).toEqual({ aspect_ratio: '3:2' });
    await expect(client().generateImages({
      mode: 'conversation', model: 'openai/gpt-5-image', aspectRatio: '1:1', resolution: '2K', messages: transcript,
    })).rejects.toThrow('Resolution is not supported');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('omits aspect_ratio for Auto on chat (the GPT-5 wrappers list Auto), as /images does', async () => {
    mockFetch.mockResolvedValue(chatResponse());
    await client().generateImages({ mode: 'conversation', model: 'openai/gpt-5-image', aspectRatio: 'auto', messages: transcript });
    expect(body()).not.toHaveProperty('image_config');
    // A listed ratio is still sent.
    await client().generateImages({ mode: 'conversation', model: 'openai/gpt-5-image', aspectRatio: '2:3', messages: transcript });
    expect(body(1).image_config).toEqual({ aspect_ratio: '2:3' });
  });

  it('refuses Conversation for a model without a verified chat route, before any request', async () => {
    for (const model of ['openai/gpt-image-2.5-flare', 'krea/k3-edit', 'recraft/recraft-v4.1', 'vendor/custom', 'meta/muse-image', 'google/gemini-3.1-flash-image:nitro', 'GOOGLE/GEMINI-3.1-FLASH-IMAGE']) {
      await expect(client().generateImages({ mode: 'conversation', model, aspectRatio: '1:1', messages: prompt('A tree') }))
        .rejects.toThrow('no verified Conversation route');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('bounds the latest message’s references by the model’s limits', async () => {
    const references = Array.from({ length: 4 }, () => ({ type: 'image_url' as const, image_url: { url: 'data:image/png;base64,REF' } }));
    await expect(client().generateImages({
      mode: 'conversation', model: 'google/gemini-2.5-flash-image', aspectRatio: '1:1',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'A tree' }, ...references] }],
    })).rejects.toThrow('0–3 reference images; received 4');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('normalizes image/jpg chat results without altering the opaque assistant message', async () => {
    mockFetch.mockResolvedValue(chatResponse({
      role: 'assistant', content: [], images: [{ image_url: { url: 'data:image/jpg;base64,QUJD' }, thought_signature: 'opaque' }],
    }));
    const result = await client().generateImages({ mode: 'conversation', model: 'google/gemini-3.1-flash-image', aspectRatio: '1:1', messages: prompt('A tree') });
    expect(result.images[0]).toEqual({ data: 'data:image/jpeg;base64,QUJD', mimeType: 'image/jpeg' });
    expect(result.assistantMessage?.images?.[0].image_url.url).toBe('data:image/jpg;base64,QUJD');
  });

  it.each([
    {}, { choices: [] }, { choices: [{ message: { content: 'No image' } }] },
    { choices: [{ message: { images: [null, {}, { image_url: { url: 'https://example.com/image.png' } }] } }] },
    { choices: [{ message: { images: [{ image_url: { url: 'data:image/svg+xml;base64,QUJD' } }] } }] },
  ])('rejects missing or unsupported chat image responses: %j', async response => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => response });
    await expect(client().generateImages({
      mode: 'conversation', model: 'google/gemini-3.1-flash-image', aspectRatio: '1:1', messages: prompt('A tree'),
    })).rejects.toThrow(/images/i);
  });

  it('does not retry a failed chat request on the other billable endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, statusText: 'Unavailable', text: async () => 'Unavailable' });
    await expect(client().generateImages({
      mode: 'conversation', model: 'google/gemini-3.1-flash-image', aspectRatio: '1:1', messages: prompt('A tree'),
    })).rejects.toThrow('503');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('prefers native token counts over normalized counts for the full transcript', async () => {
    mockFetch.mockResolvedValue(chatResponse(signedAssistant, {
      prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, native_tokens_prompt: 1400, native_tokens_completion: 900, cost: 0.06,
    }));
    const result = await client().generateImages({ mode: 'conversation', model: 'google/gemini-3.1-flash-image', aspectRatio: '1:1', messages: prompt('A tree') });
    expect(body()).not.toHaveProperty('usage');
    expect(result.usage).toEqual({ promptTokens: 1400, completionTokens: 900, totalTokens: 2300, costUsd: 0.06 });
  });
});

describe('provider failure reasons', () => {
  const failure = (status: number, statusText: string, text: string) => ({ ok: false, status, statusText, text: async () => text });
  const singleShot = () => client().generateImages({ model: 'recraft/recraft-v4.1', mode: 'edit', aspectRatio: '1:1', messages: prompt('A tree') });
  const failureOf = async () => {
    try { await singleShot(); } catch (error) { return error as Error; }
    throw new Error('expected the request to fail');
  };

  it('adds the provider’s error.message to an HTTP failure', async () => {
    mockFetch.mockResolvedValue(failure(404, 'Not Found', JSON.stringify({ error: { code: 404, message: 'No endpoints found that can be served by your own provider keys.' } })));
    await expect(singleShot()).rejects.toThrow(/^OpenRouter image generation error: 404 Not Found — No endpoints found that can be served by your own provider keys\.$/);
  });

  it('keeps the reason to one plain line of at most 300 characters', async () => {
    const message = `Line one\r\nline\ttwo \u202Eflipped\u0007 ${'x'.repeat(1000)}`;
    mockFetch.mockResolvedValue(failure(400, 'Bad Request', JSON.stringify({ error: { message } })));
    const error = await failureOf();
    const reason = error.message.split(' — ')[1];
    expect(reason.startsWith('Line one line two flipped x')).toBe(true);
    expect(Array.from(reason)).toHaveLength(300);
    expect(reason.endsWith('…')).toBe(true);
    for (const unprintable of ['\r', '\n', '\t', '\u0007', '\u202E']) expect(error.message).not.toContain(unprintable);
  });

  it('never shows the API key, headers or the request body', async () => {
    mockFetch.mockResolvedValue(failure(401, 'Unauthorized', JSON.stringify({
      error: { message: 'Invalid key test-api-key for this request', metadata: { raw: 'secret upstream detail' } },
      user_id: 'user-123',
    })));
    const error = await failureOf();
    expect(error.message).toBe('OpenRouter image generation error: 401 Unauthorized — Invalid key [redacted] for this request');
    for (const leak of ['test-api-key', 'Bearer', 'HTTP-Referer', 'secret upstream detail', 'user-123', '"prompt"']) expect(error.message).not.toContain(leak);
  });

  it('reports only the status when the body has no error.message', async () => {
    mockFetch.mockResolvedValue(failure(502, 'Bad Gateway', '<html><body>upstream exploded</body></html>'));
    await expect(singleShot()).rejects.toThrow(/^OpenRouter image generation error: 502 Bad Gateway$/);
    mockFetch.mockResolvedValue(failure(500, 'Internal Server Error', JSON.stringify({ error: { message: 42 } })));
    await expect(singleShot()).rejects.toThrow(/^OpenRouter image generation error: 500 Internal Server Error$/);
  });

  it('explains a 200 that carries an error and no images, on either endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ error: { message: 'The prompt was refused by the provider.' } }) });
    await expect(singleShot()).rejects.toThrow('No images returned from OpenRouter Image API — The prompt was refused by the provider.');
    await expect(client().generateImages({ mode: 'conversation', model: 'google/gemini-3.1-flash-image', aspectRatio: '1:1', messages: prompt('A tree') }))
      .rejects.toThrow('No images returned from OpenRouter chat image response — The prompt was refused by the provider.');
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { images: [{ image_url: { url: 'https://example.com/a.png' } }] } }], error: { message: 'Partial failure' } }) });
    await expect(client().generateImages({ mode: 'conversation', model: 'google/gemini-3.1-flash-image', aspectRatio: '1:1', messages: prompt('A tree') }))
      .rejects.toThrow('Failed to parse images from OpenRouter response — Partial failure');
  });
});

describe('catalog-wide routes', () => {
  const declaredOutput = (id: string) =>
    chatRoutes.chatEndpoints.find(entry => entry.id === id)?.architecture.output_modalities ?? [];

  it.each(OPENROUTER_IMAGE_MODELS.map(model => model.id))('sends %s to /images in Single Shot, with no chat fields', async id => {
    const model = OPENROUTER_IMAGE_MODELS.find(entry => entry.id === id)!;
    const min = model.referenceImages?.min ?? 0;
    const references = Array.from({ length: min }, () => ({ type: 'image_url' as const, image_url: { url: 'data:image/png;base64,REF' } }));
    await client().generateImages({
      model: id, mode: 'edit', aspectRatio: model.supportedAspectRatios![0],
      messages: [{ role: 'user', content: [{ type: 'text', text: 'A tree' }, ...references] }],
    });
    expect(url()).toBe('https://openrouter.ai/api/v1/images');
    for (const field of ['messages', 'modalities', 'image_config', 'usage', 'stream']) expect(body()).not.toHaveProperty(field);
  });

  it.each(OPENROUTER_IMAGE_MODELS.filter(model => imageRouteCapabilities(model.id, 'conversation')).map(model => model.id))(
    'sends %s to chat in Conversation, asking only for the output modalities it declares', async id => {
      mockFetch.mockResolvedValue(chatResponse());
      const ratio = imageRouteCapabilities(id, 'conversation')!.supportedAspectRatios[0];
      await client().generateImages({ mode: 'conversation', model: id, aspectRatio: ratio, messages: prompt('A tree') });
      expect(url()).toBe('https://openrouter.ai/api/v1/chat/completions');
      const requested: string[] = body().modalities;
      expect(requested).toContain('image');
      expect(requested.filter(modality => !declaredOutput(id).includes(modality))).toEqual([]);
    },
  );
});
