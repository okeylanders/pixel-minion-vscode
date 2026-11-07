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
    if (model.referenceImages) {
      expect(model.referenceImages.min).toBeGreaterThanOrEqual(0);
      expect(model.referenceImages.max).toBeGreaterThanOrEqual(model.referenceImages.min);
      // Rows that require a reference need UI gating Pixel doesn't have yet.
      expect(model.referenceImages.min).toBe(0);
    }
    expect(model.supportedAspectRatios?.length ?? 1).toBeGreaterThan(0);
    expect(new Set(model.supportedAspectRatios ?? []).size).toBe(model.supportedAspectRatios?.length ?? 0);
    expect(model.imagePricing?.output).toBeGreaterThanOrEqual(0);
    // Nothing reaches Pixel's chat-only client as an Image-API row.
    expect(model.transport).not.toBe('images');
  });

  /*
   * Pixel's Refine always sends the previous turn's image as a reference
   * (ImageOrchestrator.continueConversation passes conversation.lastImages),
   * and attached references survive a model switch. Until capability-aware
   * controls gate both (roadmap P3/P4), a model that accepts no reference
   * image would be sent image input it can't take, so none may be listed.
   * Recraft V4.1 Flash is deferred for exactly this (PR #14 review F-01).
   */
  it.each(OPENROUTER_IMAGE_MODELS)('accepts at least one reference image for Refine: $id', model => {
    expect({ id: model.id, maxReferences: model.referenceImages?.max })
      .toEqual({ id: model.id, maxReferences: expect.any(Number) });
    expect(model.referenceImages?.max).toBeGreaterThanOrEqual(1);
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
