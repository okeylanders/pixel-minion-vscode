/**
 * Tests for useImageGeneration utility functions
 */
import {
  calculateBase64Size,
  imagesOverRequestLimit,
  normalizeAspectRatioForModel,
  normalizeResolutionForModel,
  referenceImageIssue,
  referenceRequirementNote,
} from '../../../../../presentation/webview/hooks/domain/useImageGeneration';
import { imageRouteCapabilities } from '@shared/models';
import type { ImageRouteCapabilities } from '@shared/models';

/** A data URL whose base64 payload decodes to about `bytes` bytes. */
const dataUrlOf = (bytes: number) => `data:image/png;base64,${'A'.repeat(Math.ceil(bytes / 0.75))}`;
const MB = 1024 * 1024;

describe('imagesOverRequestLimit (the request-size limit is a catalog field)', () => {
  it('reports images over a Sourceful route’s 4.5 MB limit', () => {
    expect(imagesOverRequestLimit('sourceful/riverflow-v2-pro', 'edit', [dataUrlOf(3 * MB), dataUrlOf(2 * MB)]))
      .toEqual({ totalBytes: expect.any(Number), limitBytes: 4.5 * MB });
    expect(imagesOverRequestLimit('sourceful/riverflow-v2-pro', 'edit', [dataUrlOf(4 * MB)])).toBeNull();
  });

  it('says nothing for a route that states no limit, whatever its id', () => {
    expect(imagesOverRequestLimit('google/gemini-2.5-flash-image', 'edit', [dataUrlOf(20 * MB)])).toBeNull();
    // An id the catalog doesn't list states no limit, even under sourceful/.
    expect(imagesOverRequestLimit('sourceful/riverflow-v9-unlisted', 'edit', [dataUrlOf(20 * MB)])).toBeNull();
  });

  it('says nothing when the request carries no images', () => {
    expect(imagesOverRequestLimit('sourceful/riverflow-v2-pro', 'edit', [])).toBeNull();
  });
});

describe('referenceRequirementNote (wording from catalog fields only)', () => {
  it('names style references, their formats and count for a style route', () => {
    expect(referenceRequirementNote(imageRouteCapabilities('recraft/recraft-v4-styles', 'edit')))
      .toBe('Requires 1–10 PNG, JPEG, or WebP style references: this model makes a new image in their style.');
  });

  it('says an edit route edits what you attach', () => {
    expect(referenceRequirementNote(imageRouteCapabilities('krea/k3-edit', 'edit')))
      .toBe('Requires 1–8 reference images: this model edits the images you attach.');
  });

  it('says “exactly” for a fixed count, and claims nothing it wasn’t told', () => {
    const fixed: ImageRouteCapabilities = {
      transport: 'images', supportedAspectRatios: ['auto'], supportedResolutions: [], supportsSeed: false,
      referenceImages: { min: 1, max: 1 },
    };
    expect(referenceRequirementNote(fixed)).toBe('Requires exactly 1 reference image.');
    expect(referenceRequirementNote({ ...fixed, referenceImages: { min: 2, max: 2 }, referenceMimeTypes: ['image/png'] }))
      .toBe('Requires exactly 2 PNG reference images.');
    // A format list alone no longer implies style references.
    expect(referenceRequirementNote({ ...fixed, referenceImages: { min: 1, max: 4 }, referenceMimeTypes: ['image/png', 'image/webp'] }))
      .toBe('Requires 1–4 PNG or WebP reference images.');
  });

  it('has no note where references are optional or the route is unknown', () => {
    expect(referenceRequirementNote(imageRouteCapabilities('recraft/recraft-v4.1', 'edit'))).toBeNull();
    expect(referenceRequirementNote(imageRouteCapabilities('vendor/custom', 'edit'))).toBeNull();
    expect(referenceRequirementNote(undefined)).toBeNull();
  });
});

describe('calculateBase64Size', () => {
  it('returns 0 for empty array', () => {
    expect(calculateBase64Size([])).toBe(0);
  });

  it('returns 0 for data URL with no base64 content', () => {
    expect(calculateBase64Size(['data:image/png;base64,'])).toBe(0);
  });

  it('calculates approximate decoded size for single image', () => {
    // 100 base64 characters decode to approximately 75 bytes
    const dataUrl = 'data:image/png;base64,' + 'A'.repeat(100);
    expect(calculateBase64Size([dataUrl])).toBe(75);
  });

  it('calculates size for multiple images', () => {
    const dataUrl1 = 'data:image/png;base64,' + 'A'.repeat(100); // 75 bytes
    const dataUrl2 = 'data:image/jpeg;base64,' + 'B'.repeat(200); // 150 bytes
    expect(calculateBase64Size([dataUrl1, dataUrl2])).toBe(225);
  });

  it('handles data URLs without comma gracefully', () => {
    expect(calculateBase64Size(['invalid-data-url'])).toBe(0);
  });

  it('handles mixed valid and empty data URLs', () => {
    const validUrl = 'data:image/png;base64,' + 'A'.repeat(100);
    const emptyUrl = 'data:image/png;base64,';
    expect(calculateBase64Size([validUrl, emptyUrl])).toBe(75);
  });

  it('calculates realistic image size correctly', () => {
    // A 1MB base64 string (after the comma) decodes to ~750KB
    const oneMBBase64 = 'data:image/png;base64,' + 'A'.repeat(1024 * 1024);
    const result = calculateBase64Size([oneMBBase64]);
    // Should be approximately 786,432 bytes (1MB * 0.75)
    expect(result).toBe(Math.ceil(1024 * 1024 * 0.75));
  });

  it('exceeds 4.5MB threshold with large images', () => {
    // 6.1MB of base64 data should decode to ~4.575MB (> 4.5MB limit)
    const largBase64 = 'data:image/png;base64,' + 'A'.repeat(6.1 * 1024 * 1024);
    const result = calculateBase64Size([largBase64]);
    const fourPointFiveMB = 4.5 * 1024 * 1024;
    expect(result).toBeGreaterThan(fourPointFiveMB);
  });
});

// Ported from frame-minion@40e7949 useImageGeneration.test.ts ("model capability
// normalization"); Muse cases use a custom id, which Pixel no longer lists.
// Pixel requires the mode, so every case names the route it checks.
describe('model capability normalization', () => {
  it('resets an unsupported aspect ratio to the route’s first ratio', () => {
    expect(normalizeAspectRatioForModel('openai/gpt-image-1', '16:9', 'edit')).toBe('1:1');
    expect(normalizeAspectRatioForModel('recraft/recraft-v4.1', '21:9', 'edit')).toBe('1:1');
    // The chat route lists the same ratios as the model's Image API record.
    expect(normalizeAspectRatioForModel('openai/gpt-5-image', '16:9', 'conversation')).toBe('1:1');
  });

  it('keeps a supported extended aspect ratio', () => {
    expect(normalizeAspectRatioForModel('bytedance-seed/seedream-5-0-pro', '9:21', 'edit')).toBe('9:21');
    expect(normalizeAspectRatioForModel('google/gemini-3.1-flash-image', '1:8', 'conversation')).toBe('1:8');
  });

  it('resets an unsupported resolution to auto', () => {
    expect(normalizeResolutionForModel('bytedance-seed/seedream-5-0-lite', '1K', 'edit')).toBe('auto');
    expect(normalizeResolutionForModel('vendor/custom', '4K', 'edit')).toBe('auto');
    expect(normalizeAspectRatioForModel('vendor/custom', '16:9', 'edit')).toBe('auto');
  });

  it('keeps the current value where the route is unknown (a custom id in Conversation)', () => {
    expect(normalizeAspectRatioForModel('vendor/custom', '16:9', 'conversation')).toBe('16:9');
    expect(normalizeResolutionForModel('vendor/custom', '4K', 'conversation')).toBe('auto');
  });

  it('keeps a supported high-resolution tier', () => {
    expect(normalizeResolutionForModel('google/gemini-3.1-flash-image', '4K', 'conversation')).toBe('4K');
    expect(normalizeResolutionForModel('google/gemini-3.1-flash-image', '4K', 'edit')).toBe('4K');
  });

  it('uses the route’s own lists: Gemini’s 512 tier is Single Shot only', () => {
    expect(normalizeResolutionForModel('google/gemini-3.1-flash-image', '512', 'edit')).toBe('512');
    expect(normalizeResolutionForModel('google/gemini-3.1-flash-image', '512', 'conversation')).toBe('auto');
  });
});

describe('referenceImageIssue', () => {
  const png = 'data:image/png;base64,QUJD';

  it('blocks references to a text-only model', () => {
    expect(referenceImageIssue('recraft/recraft-v4.1-flash', 'edit', [])).toBeNull();
    expect(referenceImageIssue('recraft/recraft-v4.1-flash', 'edit', [png])).toMatch(/text prompts only/);
  });

  it('asks for the references a model requires', () => {
    expect(referenceImageIssue('krea/k3-edit', 'edit', [])).toBe('This model needs at least 1 reference image. Add one to generate.');
    expect(referenceImageIssue('krea/k3-edit', 'edit', [png])).toBeNull();
  });

  it('counts references against the model’s maximum', () => {
    expect(referenceImageIssue('recraft/recraft-v4.1', 'edit', [png, png, png]))
      .toBe('This model accepts 0–1 reference images; 3 attached. Remove 2 to generate.');
    expect(referenceImageIssue('google/gemini-2.5-flash-image', 'conversation', [png, png, png, png])).toMatch(/0–3/);
  });

  it('checks reference formats where the model restricts them', () => {
    expect(referenceImageIssue('recraft/recraft-v4-styles', 'edit', ['data:image/gif;base64,R0lG']))
      .toBe('This model requires PNG, JPEG, or WebP reference images.');
    expect(referenceImageIssue('recraft/recraft-v4-styles', 'edit', ['data:image/jpg;base64,QUJD'])).toBeNull();
  });

  it('places no bounds on a custom id in Single Shot', () => {
    expect(referenceImageIssue('vendor/custom', 'edit', [png, png, png, png, png])).toBeNull();
  });
});
