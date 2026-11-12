/**
 * Invariants of the shared model catalogs. Prices and capabilities are
 * checked against live data by hand (docs/model-catalog-audit-2026-11-07.md);
 * these tests keep the data internally consistent and the migrations sound.
 */
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_SVG_MODEL,
  OPENROUTER_IMAGE_MODELS,
  OPENROUTER_SVG_MODELS,
  RETIRED_MODELS,
  RETIRED_MODEL_REPLACEMENTS,
} from '../../../shared/models';

const imageIds = OPENROUTER_IMAGE_MODELS.map(model => model.id);
const svgIds = OPENROUTER_SVG_MODELS.map(model => model.id);

describe('shared model catalogs', () => {
  it('ship their defaults', () => {
    expect(imageIds).toContain(DEFAULT_IMAGE_MODEL);
    expect(svgIds).toContain(DEFAULT_SVG_MODEL);
  });

  it('never list a retired id', () => {
    expect([...imageIds, ...svgIds].filter(id => id in RETIRED_MODELS)).toEqual([]);
  });

  it('move every retired id to a model the matching catalog ships', () => {
    for (const [id, { replacement }] of Object.entries(RETIRED_MODELS)) {
      const isSvg = id.startsWith('anthropic/') || id.includes('-vector');
      expect({ id, replacement, shipped: (isSvg ? svgIds : imageIds).includes(replacement) })
        .toEqual({ id, replacement, shipped: true });
    }
    expect(RETIRED_MODEL_REPLACEMENTS['x-ai/grok-imagine-image-quality']).toBe('x-ai/grok-imagine-image-2.0');
  });

  it.each(OPENROUTER_IMAGE_MODELS)('records coherent capabilities for $id', model => {
    // Every row carries the capability data the Image tab and the host gate on.
    expect(model.referenceImages).toBeDefined();
    expect(model.referenceImages!.min).toBeGreaterThanOrEqual(0);
    expect(model.referenceImages!.max).toBeGreaterThanOrEqual(model.referenceImages!.min);
    expect(model.supportedAspectRatios?.length).toBeGreaterThan(0);
    expect(new Set(model.supportedAspectRatios).size).toBe(model.supportedAspectRatios!.length);
    expect(new Set(model.supportedResolutions ?? []).size).toBe(model.supportedResolutions?.length ?? 0);
    expect(model.imagePricing?.output).toBeGreaterThanOrEqual(0);
    // Every row is served by the Image API; chat routes are a mode, not a row field.
    expect(model.transport ?? 'images').toBe('images');
  });

  it('lists the reference-constrained models now that references are gated by capability', () => {
    const bounds = (id: string) => OPENROUTER_IMAGE_MODELS.find(model => model.id === id)?.referenceImages;
    // Text only: no uploader, and no Single Shot follow-up (it would send the last image).
    expect(bounds('recraft/recraft-v4.1-flash')).toEqual({ min: 0, max: 0 });
    // A reference is required: Generate stays blocked until one is attached.
    expect(bounds('krea/k3-edit')).toEqual({ min: 1, max: 8 });
    expect(bounds('recraft/recraft-v4-styles')).toEqual({ min: 1, max: 10 });
    expect(bounds('recraft/recraft-v4-styles-pro')).toEqual({ min: 1, max: 10 });
  });

  it('states the wording and warning fields where the Image tab needs them', () => {
    // Every Riverflow row carries Sourceful's request limit, so a new one can't miss the warning.
    for (const model of OPENROUTER_IMAGE_MODELS.filter(entry => entry.id.startsWith('sourceful/'))) {
      expect({ id: model.id, maxRequestBytes: model.maxRequestBytes }).toEqual({ id: model.id, maxRequestBytes: 4.5 * 1024 * 1024 });
    }
    expect(OPENROUTER_IMAGE_MODELS.filter(model => model.maxRequestBytes).every(model => model.id.startsWith('sourceful/'))).toBe(true);
    // Style wording only where a row says so (not inferred from a format list).
    expect(OPENROUTER_IMAGE_MODELS.filter(model => model.referenceRole === 'style').map(model => model.id).sort())
      .toEqual(['recraft/recraft-v4-styles', 'recraft/recraft-v4-styles-pro']);
    expect(OPENROUTER_IMAGE_MODELS.find(model => model.id === 'krea/k3-edit')?.referenceRole).toBe('edit');
    // No description claims a rule the tab doesn't check.
    expect(OPENROUTER_IMAGE_MODELS.filter(model => /\b\d+\s?px\b/.test(model.description ?? '')).map(model => model.id)).toEqual([]);
  });

  it.each(OPENROUTER_SVG_MODELS)('prices $id in the shape its kind needs', model => {
    if (model.kind === 'native-vector') {
      expect(model.imagePricing?.unit).toBe('image');
      expect(model.imagePricing?.output).toBeGreaterThan(0);
      expect(model.referenceImages?.min ?? 0).toBe(0);
    } else {
      expect(model.textPricing.inputPer1M).toBeGreaterThan(0);
      expect(model.textPricing.outputPer1M).toBeGreaterThan(0);
      // The SVG tab sends a reference image as image_url to code models.
      expect(model.acceptsImageInput).toBe(true);
    }
  });

  it('keeps native vector models on recraft/, the off-catalog fallback route', () => {
    // svgRoutes routes a curated id by its `kind`, and an id the catalog doesn't
    // list (custom or superseded) by the recraft/ prefix. Keep the two agreeing so
    // a model routes the same way after it leaves the catalog.
    for (const model of OPENROUTER_SVG_MODELS) {
      expect({ id: model.id, recraft: model.id.startsWith('recraft/') })
        .toEqual({ id: model.id, recraft: model.kind === 'native-vector' });
    }
  });
});
