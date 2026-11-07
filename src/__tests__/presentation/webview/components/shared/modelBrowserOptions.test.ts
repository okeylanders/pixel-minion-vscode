/**
 * Model Browser option mapping. The "image pricing labels" block is ported
 * from frame-minion@40e7949 (modelBrowserOptions.test.ts), limited to rows
 * Pixel ships; the SVG block is Pixel-only.
 */
import {
  customSvgModelToBrowserOption,
  modelDefinitionToBrowserOption,
  svgModelToBrowserOption,
} from '../../../../../presentation/webview/components/shared/modelBrowserOptions';
import { OPENROUTER_IMAGE_MODELS, OPENROUTER_SVG_MODELS } from '../../../../../shared/models';
import type { ImageModelDefinition, SvgModelDefinition } from '../../../../../shared/types/providers';

const imageModel = (id: string): ImageModelDefinition => {
  const model = OPENROUTER_IMAGE_MODELS.find((entry) => entry.id === id);
  if (!model) throw new Error(`missing image model in catalog: ${id}`);
  return model;
};

const svgModel = (id: string): SvgModelDefinition => {
  const model = OPENROUTER_SVG_MODELS.find((entry) => entry.id === id);
  if (!model) throw new Error(`missing SVG model in catalog: ${id}`);
  return model;
};

/** Strict calendar date: YYYY-MM-DD that round-trips through Date. */
const isCalendarDate = (value: string | undefined): boolean =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

describe('modelBrowserOptions', () => {
  describe('image pricing labels', () => {
    it.each(OPENROUTER_IMAGE_MODELS)('shows a per-image comparison for $id', model => {
      const pricing = model.imagePricing;
      const perImage = pricing?.approxUsdPerImage ?? (pricing?.unit === 'image' ? pricing.output : undefined);
      expect(perImage).toBeGreaterThan(0);
      expect(Number.isFinite(perImage)).toBe(true);
      const option = modelDefinitionToBrowserOption(model);
      expect(option.costLabel).toMatch(/^≈ \$[\d.]+ \| image/);
      expect(option.costLabel).not.toMatch(/varies by|per 1M/);
      if (pricing?.unit !== 'image') expect(option.costDescription).toBeTruthy();
    });

    it.each(['openai/gpt-5.4-image-2', 'openai/gpt-5-image', 'openai/gpt-5-image-mini'])(
      'excludes language-model overhead explicitly for %s', id => {
        expect(modelDefinitionToBrowserOption(imageModel(id)).costDescription)
          .toContain('Language-model and reasoning charges are also additional');
      },
    );

    it('uses the documented model-specific Gemini output token counts', () => {
      expect(imageModel('google/gemini-3.1-flash-image').imagePricing?.approxUsdPerImage).toBeCloseTo(1120 * 60 / 1e6);
      expect(imageModel('google/gemini-3-pro-image').imagePricing?.approxUsdPerImage).toBeCloseTo(1120 * 120 / 1e6);
      expect(imageModel('google/gemini-2.5-flash-image').imagePricing?.approxUsdPerImage).toBeCloseTo(1290 * 30 / 1e6);
    });

    it('labels per-image models with a flat $/image', () => {
      const option = modelDefinitionToBrowserOption(imageModel('recraft/recraft-v4'));
      expect(option.costLabel).toBe('≈ $0.04 | image');
      expect(option.badges).toContainEqual({ label: 'per image' });
      expect(option.badges).toContainEqual({ label: 'image output' });
    });

    it('leads with per-image estimates while preserving native input and output rates', () => {
      // gemini-2.5-flash-image bills input ($0.30/1M) AND output ($30/1M);
      // i2i/reference requests pay both, so the details retain both rates.
      const option = modelDefinitionToBrowserOption(imageModel('google/gemini-2.5-flash-image'));
      expect(option.costLabel).toBe('≈ $0.0387 | image @ 1K');
      expect(option.costDescription).toContain('$0.3/$30 per 1M image tokens (input/output)');
      expect(option.badges).toContainEqual({ label: 'per token' });
    });

    it('prices GPT-5.4 Image 2 from the GPT Image 2 high-quality reference, not a Gemini token count', () => {
      const option = modelDefinitionToBrowserOption(imageModel('openai/gpt-5.4-image-2'));
      expect(option.costLabel).toBe('≈ $0.211 | image @ 1K · high');
      expect(option.costDescription).toContain('1024×1024, high quality');
    });

    it('labels megapixel-billed models per-megapixel with a ~1MP per-image translation', () => {
      const option = modelDefinitionToBrowserOption(imageModel('black-forest-labs/flux.2-pro'));
      expect(option.costLabel).toBe('≈ $0.03 | image @ ~1 MP');
      expect(option.costDescription).toContain('$0.03 per megapixel (output)');
      expect(option.badges).toContainEqual({ label: 'per megapixel' });
      // flux.2-flex bills input per-megapixel too — dual-rate form.
      expect(modelDefinitionToBrowserOption(imageModel('black-forest-labs/flux.2-flex')).costDescription)
        .toContain('$0.06/$0.06 per megapixel (input/output)');
    });

    it.each([
      ['microsoft/mai-image-2.5', '≈ $0.048 | image'],
      ['microsoft/mai-image-2.5-pro', '≈ $0.111 | image'],
    ])('makes the %s token-budget assumption visible', (id, label) => {
      const option = modelDefinitionToBrowserOption(imageModel(id));
      expect(option.costLabel).toBe(label);
      expect(option.costDescription).toContain('$8/');
      expect(option.costDescription).toContain('Assumes 1,024 image output tokens');
      expect(option.costDescription).toContain('charges are additional');
      expect(option.costLabel).not.toContain('1K');
    });

    it('omits the cost label and renders exactly the base badge set when unpriced', () => {
      // Unknown custom models must not inherit a fabricated default price.
      const option = modelDefinitionToBrowserOption({ id: 'custom/unpriced-image', displayName: 'Unpriced image' });
      expect(option.costLabel).toBeUndefined();
      expect(option.badges).toEqual([{ label: 'image output' }]);
    });

    it.each([
      ['google/gemini-3.1-flash-image-preview', 'google/gemini-3.1-flash-image'],
      ['google/gemini-3-pro-image-preview', 'google/gemini-3-pro-image'],
    ])('prices the %s preview alias by mirroring its parent', (previewId, parentId) => {
      expect(modelDefinitionToBrowserOption(imageModel(previewId)).costLabel)
        .toBe(modelDefinitionToBrowserOption(imageModel(parentId)).costLabel);
    });
  });

  describe('labels and groups', () => {
    it('normalizes recommended labels before displaying or deriving model families', () => {
      const option = modelDefinitionToBrowserOption(imageModel('google/gemini-3.1-flash-image'));
      expect(option.label).toBe('Nano Banana 2 (Google: Gemini 3.1 Flash Image)');
      expect(option.family).toBe('Gemini');
      expect(option.provider).toBe('Google');
      expect(option.badges).toContainEqual({ label: 'recommended', tone: 'accent' });
    });

    it('derives families from the label after any "Vendor:" prefix', () => {
      expect(modelDefinitionToBrowserOption(imageModel('microsoft/mai-image-2.5')).family).toBe('MAI-Image');
      expect(modelDefinitionToBrowserOption(imageModel('black-forest-labs/flux.2-max')).family).toBe('FLUX.2');
      expect(modelDefinitionToBrowserOption(imageModel('sourceful/riverflow-v2-pro')).family).toBe('Riverflow');
    });

    it('gives every curated model a strict release date and a narrative', () => {
      const options = [
        ...OPENROUTER_IMAGE_MODELS.map(modelDefinitionToBrowserOption),
        ...OPENROUTER_SVG_MODELS.map(svgModelToBrowserOption),
      ];
      expect(options.filter(option => !isCalendarDate(option.releaseDate)).map(option => option.id)).toEqual([]);
      expect(options.filter(option => !option.narrative).map(option => option.id)).toEqual([]);
    });

    it('keeps catalog ids unique', () => {
      const ids = [...OPENROUTER_IMAGE_MODELS, ...OPENROUTER_SVG_MODELS].map(model => model.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('SVG options', () => {
    it('prices native vector models per SVG and groups them as native SVG', () => {
      const option = svgModelToBrowserOption(svgModel('recraft/recraft-v4.1-pro-vector'));
      expect(option.costLabel).toBe('≈ $0.3 | SVG');
      expect(option.family).toBe('Native SVG');
      expect(option.provider).toBe('Recraft');
      expect(option.badges).toEqual([
        { label: 'recommended', tone: 'accent' },
        { label: 'native SVG' },
        { label: 'per SVG' },
      ]);
      expect(option.releaseDate).toBe('2026-05-13');
    });

    it('prices code models per 1M tokens and moves the 1k/4k estimate into the cost description', () => {
      const option = svgModelToBrowserOption(svgModel('anthropic/claude-fable-5'));
      expect(option.costLabel).toBe('$10/$50 per 1M');
      expect(option.costDescription).toBe(
        '≈ $0.21 per SVG at about 1k input and 4k output tokens. '
        + 'Reasons by default (high effort); reasoning tokens bill as output, so expect more.'
      );
      expect(option.family).toBe('SVG code');
      expect(option.badges).toEqual([
        { label: 'recommended', tone: 'accent' },
        { label: 'SVG code' },
        { label: 'per token' },
        { label: 'image input' },
      ]);
    });

    it('drops the reasoning caveat for models that only reason on request', () => {
      const option = svgModelToBrowserOption({
        kind: 'code',
        id: 'example/quiet-coder',
        displayName: 'Quiet coder',
        textPricing: { inputPer1M: 1, outputPer1M: 5 },
        acceptsImageInput: false,
        reasoning: { mandatory: false, defaultEffort: 'medium' },
      });
      expect(option.costDescription).toContain('≈ $0.021 per SVG');
      expect(option.costDescription).toContain('Longer or more detailed SVGs cost more.');
      expect(option.costDescription).not.toContain('Reasons by default');
      expect(option.badges).not.toContainEqual({ label: 'image input' });
    });

    it('groups every code model under "SVG code", whatever its vendor name says', () => {
      // Regression: a /gemini/ label regex grouped the Gemini text model as "Gemini Image".
      const codeModels = OPENROUTER_SVG_MODELS.filter(model => model.kind === 'code');
      expect(codeModels.length).toBeGreaterThan(0);
      expect(codeModels.map(svgModelToBrowserOption).map(option => option.family))
        .toEqual(codeModels.map(() => 'SVG code'));
      const native = OPENROUTER_SVG_MODELS.filter(model => model.kind === 'native-vector');
      expect(native.map(svgModelToBrowserOption).map(option => option.family))
        .toEqual(native.map(() => 'Native SVG'));
    });

    it('keeps an off-list SVG selection visible as a custom card', () => {
      const option = customSvgModelToBrowserOption('openai/gpt-5.6-sol');
      expect(option.label).toBe('Custom: openai/gpt-5.6-sol');
      expect(option.provider).toBe('OpenAI');
      expect(option.family).toBe('Custom');
      expect(option.costLabel).toBeUndefined();
    });
  });
});
