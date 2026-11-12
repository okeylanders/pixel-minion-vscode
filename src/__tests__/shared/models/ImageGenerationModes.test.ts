/**
 * Route capabilities against recorded provider evidence.
 *
 * Adapted from frame-minion@40e7949
 * packages/core/src/__tests__/infrastructure/ai/clients/ImageGenerationModes.test.ts,
 * re-based on Pixel's 2026-11-12 fixtures:
 *   - openrouter-image-chat-routes-2026-11-12.json: chat endpoint records for
 *     the conversational set and a free routing probe of every catalog id;
 *   - openrouter-image-endpoints-2026-11-12.json: each id's Image API
 *     endpoint records, intersected across endpoints.
 * When the catalog or a route changes, re-capture both (see the audit's
 * refresh procedure) rather than editing the expectations.
 */
import { imageRouteCapabilities, defaultImageMode, OPENROUTER_IMAGE_MODELS } from '../../../shared/models';
import chatRoutes from '../../fixtures/provider-contracts/openrouter-image-chat-routes-2026-11-12.json';
import endpoints from '../../fixtures/provider-contracts/openrouter-image-endpoints-2026-11-12.json';

type ProbeResult = 'chat-routable' | 'image-api-only';
const probe = chatRoutes.probe.results as Record<string, ProbeResult>;
type Price = { billable: string; unit: string; cost_usd: number; variant?: string };
type EndpointRecord = {
  endpointCount: number;
  referenceImages: { min: number; max: number } | null;
  aspectRatios: string[] | null;
  resolutions: string[] | null;
  supportsSeed: boolean;
  endpoints: Array<{ providerSlug: string; resolutions: string[] | null; pricing: Price[] }>;
};
const records = endpoints.models as Record<string, EndpointRecord>;
const catalogIds = OPENROUTER_IMAGE_MODELS.map(model => model.id);
const conversational = OPENROUTER_IMAGE_MODELS.filter(model => imageRouteCapabilities(model.id, 'conversation'));

describe('conversational routes', () => {
  it('only exposes curated models with a verified image-in/image-out chat route', () => {
    expect(conversational.map(model => model.id).sort()).toEqual([
      'google/gemini-2.5-flash-image',
      'google/gemini-3-pro-image',
      'google/gemini-3-pro-image-preview',
      'google/gemini-3.1-flash-image',
      'google/gemini-3.1-flash-image-preview',
      'google/gemini-3.1-flash-lite-image',
      'google/gemini-nano-banana-2.1',
      'openai/gpt-5-image',
      'openai/gpt-5-image-mini',
      'openai/gpt-5.4-image-2',
    ]);
    for (const model of conversational) {
      const record = chatRoutes.chatEndpoints.find(entry => entry.id === model.id);
      expect({ id: model.id, probe: probe[model.id] }).toEqual({ id: model.id, probe: 'chat-routable' });
      expect(record?.architecture.input_modalities).toContain('image');
      expect(record?.architecture.output_modalities).toEqual(expect.arrayContaining(['image', 'text']));
      // gpt-5.4-image-2's only endpoint reports status -5 (meaning undocumented,
      // audit O8); the probe still routes it, so a record need not be status 0.
      expect(record?.endpoints.length).toBeGreaterThan(0);
    }
  });

  it('keeps Muse out of both modes: OpenRouter rejects it on chat and lists no Image API endpoint', () => {
    expect(probe['meta/muse-image']).toBe('image-api-only');
    expect(records['meta/muse-image'].endpointCount).toBe(0);
    expect(catalogIds).not.toContain('meta/muse-image');
    expect(imageRouteCapabilities('meta/muse-image', 'conversation')).toBeUndefined();
  });

  it('chooses Conversation for a new thread only where the route is verified', () => {
    for (const id of catalogIds) {
      expect({ id, mode: defaultImageMode(id) })
        .toEqual({ id, mode: conversational.some(model => model.id === id) ? 'conversation' : 'edit' });
    }
    expect(defaultImageMode('vendor/custom')).toBe('edit');
  });
});

describe('transport guard', () => {
  it('has probe evidence for every catalog id (re-probe when a row is added)', () => {
    expect(catalogIds.filter(id => !(id in probe))).toEqual([]);
  });

  it.each(catalogIds.filter(id => probe[id] === 'image-api-only'))(
    'sends chat-blocked %s only to /images, never to /chat/completions', id => {
      expect(imageRouteCapabilities(id, 'edit')?.transport).toBe('images');
      expect(imageRouteCapabilities(id, 'conversation')).toBeUndefined();
    },
  );

  it.each(catalogIds)('routes %s over chat only through the verified conversational set', id => {
    for (const mode of ['edit', 'conversation'] as const) {
      if (imageRouteCapabilities(id, mode)?.transport !== 'chat-completions') continue;
      expect({ id, mode, probe: probe[id], verified: conversational.some(model => model.id === id) })
        .toEqual({ id, mode, probe: 'chat-routable', verified: true });
    }
    // Single Shot never uses chat for a curated row.
    expect(imageRouteCapabilities(id, 'edit')?.transport).toBe('images');
  });
});

describe('Single Shot capabilities', () => {
  it('keeps every catalog model eligible for Single Shot and omits unverified chat size tiers', () => {
    expect(OPENROUTER_IMAGE_MODELS.every(model => imageRouteCapabilities(model.id, 'edit'))).toBe(true);
    expect(imageRouteCapabilities('google/gemini-3.1-flash-image', 'conversation')?.supportedResolutions).toEqual(['1K', '2K', '4K']);
    expect(imageRouteCapabilities('google/gemini-3.1-flash-image', 'edit')?.supportedResolutions).toContain('512');
    expect(imageRouteCapabilities('openai/gpt-5-image', 'conversation')?.supportedResolutions).toEqual([]);
  });

  it('exposes audited reference and size controls for the Image API rows', () => {
    expect(imageRouteCapabilities('black-forest-labs/flux-3-image', 'edit')).toMatchObject({
      transport: 'images', referenceImages: { min: 0, max: 10 },
      supportedResolutions: ['768', '1K', '1.5K', '2K', '4K'], supportsSeed: false,
    });
    expect(imageRouteCapabilities('black-forest-labs/flux-3-image-klein', 'edit')?.supportsSeed).toBe(true);
    expect(imageRouteCapabilities('recraft/recraft-v4.1-flash', 'edit')?.referenceImages).toEqual({ min: 0, max: 0 });
    expect(imageRouteCapabilities('krea/k3-edit', 'edit')?.referenceImages).toEqual({ min: 1, max: 8 });
    expect(imageRouteCapabilities('recraft/recraft-v4-styles-pro', 'edit')).toMatchObject({
      referenceImages: { min: 1, max: 10 },
      referenceMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    });
    expect(imageRouteCapabilities('openai/gpt-image-1', 'edit')?.supportedAspectRatios).toEqual(['1:1', '2:3', '3:2', 'auto']);
  });

  it('gives a custom id permissive Single Shot with automatic dimensions, and no Conversation', () => {
    expect(imageRouteCapabilities('vendor/custom', 'edit')).toEqual({
      transport: 'images', supportedAspectRatios: ['auto'], supportedResolutions: [], supportsSeed: true,
    });
    expect(imageRouteCapabilities('vendor/custom', 'conversation')).toBeUndefined();
    expect(imageRouteCapabilities('  ', 'edit')).toBeUndefined();
  });

  it('bounds Conversation references by the model’s audited limits (Pixel delta)', () => {
    expect(imageRouteCapabilities('google/gemini-2.5-flash-image', 'conversation')?.referenceImages).toEqual({ min: 0, max: 3 });
  });
});

describe('catalog capabilities match the Image API endpoint records', () => {
  /**
   * Documented exceptions to "a capability counts only when every endpoint
   * advertises it". Each is a deliberate catalog choice, not drift.
   */
  const RESOLUTION_UNION: Record<string, string> = {
    // 4K is served by google-ai-studio/global only; vertex/global stops at 2K (audit O4; Frame keeps the union).
    'google/gemini-3-pro-image': '4K on one of two endpoints',
  };
  /** Prices are the standard tier: a `…/flex` endpoint's discounted rate is not the catalog's. */
  const standardPricing = (record: EndpointRecord) =>
    record.endpoints.filter(endpoint => !endpoint.providerSlug.endsWith('/flex')).flatMap(endpoint => endpoint.pricing);
  const lowest = (record: EndpointRecord, billable: string[], unit: string) => {
    const costs = standardPricing(record)
      .filter(entry => billable.includes(entry.billable) && entry.unit === unit)
      .map(entry => (unit === 'token' ? entry.cost_usd * 1e6 : entry.cost_usd));
    return costs.length ? Math.min(...costs) : undefined;
  };

  it.each(OPENROUTER_IMAGE_MODELS)('$id', model => {
    const record = records[model.id];
    expect(record).toBeDefined();
    expect({ refs: model.referenceImages }).toEqual({ refs: record.referenceImages });
    expect([...(model.supportedAspectRatios ?? [])].sort()).toEqual([...(record.aspectRatios ?? [])].sort());
    if (RESOLUTION_UNION[model.id]) {
      const union = new Set(record.endpoints.flatMap(endpoint => endpoint.resolutions ?? []));
      expect(model.supportedResolutions?.every(tier => union.has(tier))).toBe(true);
    } else {
      expect({ resolutions: model.supportedResolutions ?? null }).toEqual({ resolutions: record.resolutions });
    }
    expect({ seed: model.supportsSeed !== false }).toEqual({ seed: record.supportsSeed });

    const unit = { image: 'image', megapixel: 'megapixel', 'image-token': 'token' }[model.imagePricing!.unit];
    expect(model.imagePricing!.output).toBeCloseTo(lowest(record, ['output_image'], unit)!, 9);
    const input = lowest(record, ['input_image', 'input_reference'], unit);
    if (model.imagePricing!.input !== undefined && input !== undefined) {
      expect(model.imagePricing!.input).toBeCloseTo(input, 9);
    }
  });
});
