import { modelToBrowserOption } from '../../../presentation/webview/components/shared/modelBrowserOptions';
import {
  OPENROUTER_IMAGE_MODELS,
  OPENROUTER_SVG_MODELS,
} from '../../../infrastructure/ai/providers/OpenRouterProvider';

describe('modelBrowserOptions', () => {
  it('normalizes token-priced image models to a stated 1,290-token estimate', () => {
    const option = modelToBrowserOption({
      id: 'google/gemini-3.1-flash-image',
      displayName: '⭐ Nano Banana 2 - Recommended',
      inputCost: 0.5,
      outputCost: 60,
    }, 'image');

    expect(option.costLabel).toBe('$0.5/$60 per 1M image tokens (≈ $0.077/image)');
    expect(option.estimateLabel).toBe('≈ $0.077/image');
    expect(option.badges).toContainEqual({ label: 'per token' });
    expect(option.releaseDate).toBe('2026-06-18');
  });

  it('estimates SVG code models with the documented 1k-in/4k-out assumption', () => {
    const option = modelToBrowserOption({
      id: 'openai/gpt-5.6-sol',
      displayName: 'GPT-5.6 Sol',
      inputCost: 5,
      outputCost: 30,
    }, 'svg');

    expect(option.costLabel).toBe('$5/$30 per 1M text tokens (≈ $0.125/SVG)');
    expect(option.estimateLabel).toBe('≈ $0.125/SVG');
    expect(option.description).toContain('1k input and 4k output');
    expect(option.releaseDate).toBe('2026-07-09');
  });

  it('uses the direct price for native SVG models', () => {
    const option = modelToBrowserOption({
      id: 'recraft/recraft-v4.1-pro-vector',
      displayName: 'Recraft V4.1 Pro Vector',
      outputCost: 0.3,
    }, 'svg');

    expect(option.costLabel).toBe('$0.3/SVG (≈ $0.300/SVG)');
    expect(option.estimateLabel).toBe('≈ $0.300/SVG');
    expect(option.badges).toContainEqual({ label: 'native SVG' });
    expect(option.releaseDate).toBe('2026-05-13');
  });

  it('includes a release date for every curated model', () => {
    const options = [
      ...OPENROUTER_IMAGE_MODELS.map(model => modelToBrowserOption(model, 'image')),
      ...OPENROUTER_SVG_MODELS.map(model => modelToBrowserOption(model, 'svg')),
    ];

    expect(options.filter(option => !option.releaseDate)).toEqual([]);
  });
});
