import { ModelDefinition } from '../../../../shared/types/providers';
import { ModelBrowserOption } from './modelBrowserTypes';

export type ModelBrowserKind = 'image' | 'svg';

const providerNames: Record<string, string> = {
  anthropic: 'Anthropic',
  'black-forest-labs': 'Black Forest Labs',
  'bytedance-seed': 'ByteDance',
  google: 'Google',
  krea: 'Krea',
  microsoft: 'Microsoft',
  openai: 'OpenAI',
  recraft: 'Recraft',
  sourceful: 'Sourceful',
  'x-ai': 'xAI',
};

const cleanLabel = (label: string): string =>
  label.replace(/⭐\s*/g, '').replace(/\s*-\s*Recommended/g, '');

const providerFor = (id: string): string =>
  providerNames[id.replace(/^~/, '').split('/')[0]] ?? id.split('/')[0];

const familyFor = (model: ModelDefinition): string => {
  const label = cleanLabel(model.displayName);
  if (/gemini|nano banana/i.test(label)) return 'Gemini Image';
  if (/gpt.*image/i.test(label)) return 'GPT Image';
  if (/gpt/i.test(label)) return 'GPT';
  if (/claude/i.test(label)) return 'Claude';
  if (/recraft/i.test(label)) return 'Recraft';
  if (/flux/i.test(label)) return 'FLUX';
  if (/riverflow/i.test(label)) return 'Riverflow';
  return label.split(/\s+/).slice(0, 2).join(' ');
};

const nativeCost = (model: ModelDefinition, kind: ModelBrowserKind): string | undefined => {
  const { id, inputCost, outputCost } = model;
  if (inputCost === undefined && outputCost === undefined) return undefined;
  if (kind === 'svg' && !id.startsWith('recraft/')) {
    return `$${inputCost ?? 0}/$${outputCost ?? 0} per 1M text tokens`;
  }
  if (kind === 'svg' && id.startsWith('recraft/')) return `$${outputCost}/SVG`;
  if (id.startsWith('black-forest-labs/')) return `$${outputCost}/megapixel`;
  if (id.startsWith('google/') || id.startsWith('openai/') || id.startsWith('microsoft/')) {
    return inputCost === undefined
      ? `$${outputCost}/1M image tokens`
      : `$${inputCost}/$${outputCost} per 1M image tokens`;
  }
  return `$${outputCost}/image`;
};

const estimateCost = (model: ModelDefinition, kind: ModelBrowserKind): string | undefined => {
  const { id, inputCost = 0, outputCost } = model;
  if (outputCost === undefined) return undefined;

  if (kind === 'svg') {
    if (id.startsWith('recraft/')) return `≈ $${outputCost.toFixed(3)}/SVG`;
    // Explicit house assumption: typical SVG request ≈1k input + 4k output tokens.
    const estimate = inputCost * 0.001 + outputCost * 0.004;
    return `≈ $${estimate.toFixed(3)}/SVG`;
  }

  if (id.startsWith('black-forest-labs/')) return `≈ $${outputCost.toFixed(3)} at 1 MP`;
  if (id.startsWith('google/') || id.startsWith('openai/') || id.startsWith('microsoft/')) {
    // Comparable estimate across token-billed image models. Actual cost varies
    // with resolution/quality; the browser states the 1,290-token assumption.
    return `≈ $${((outputCost / 1_000_000) * 1_290).toFixed(3)}/image`;
  }
  return `≈ $${outputCost.toFixed(3)}/image`;
};

const descriptionFor = (model: ModelDefinition, kind: ModelBrowserKind): string => {
  if (model.description) return model.description;
  if (kind === 'svg' && model.id.startsWith('recraft/')) {
    return 'Native vector generation. Returns SVG image output directly from OpenRouter.';
  }
  if (kind === 'svg') {
    return 'Generates editable SVG markup as code; estimate assumes roughly 1k input and 4k output tokens.';
  }
  if (model.id.startsWith('recraft/') && model.id.includes('utility')) {
    return 'Utility-oriented image editing and transformation model.';
  }
  return 'OpenRouter image generation model with text and supported reference-image inputs.';
};

export function modelToBrowserOption(
  model: ModelDefinition,
  kind: ModelBrowserKind
): ModelBrowserOption {
  const isRecommended = /⭐|recommended/i.test(model.displayName);
  const tokenBilled =
    kind === 'image' &&
    (model.id.startsWith('google/') || model.id.startsWith('openai/') || model.id.startsWith('microsoft/'));
  return {
    id: model.id,
    label: cleanLabel(model.displayName),
    description: descriptionFor(model, kind),
    provider: providerFor(model.id),
    family: familyFor(model),
    costLabel: nativeCost(model, kind),
    estimateLabel: estimateCost(model, kind),
    badges: [
      ...(isRecommended ? [{ label: 'recommended', tone: 'accent' as const }] : []),
      { label: kind === 'svg' ? (model.id.startsWith('recraft/') ? 'native SVG' : 'SVG code') : 'image output' },
      ...(tokenBilled ? [{ label: '≈1,290 output tokens; refs excluded' }] : []),
    ],
  };
}
