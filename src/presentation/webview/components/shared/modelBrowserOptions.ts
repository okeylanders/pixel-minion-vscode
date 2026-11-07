import { ModelDefinition } from '../../../../shared/types/providers';
import { ModelBrowserOption } from './modelBrowserTypes';

export type ModelBrowserKind = 'image' | 'svg';

const providerNames: Record<string, string> = {
  anthropic: 'Anthropic',
  'black-forest-labs': 'Black Forest Labs',
  'bytedance-seed': 'ByteDance Seed',
  google: 'Google',
  krea: 'Krea',
  microsoft: 'Microsoft',
  openai: 'OpenAI',
  recraft: 'Recraft',
  sourceful: 'Sourceful',
  'x-ai': 'xAI',
};

interface ModelMetadata {
  releaseDate: string;
  narrative: string;
}

const MODEL_METADATA: Record<string, ModelMetadata> = {
  'google/gemini-3.1-flash-image': { releaseDate: '2026-06-18', narrative: 'Default-quality Nano Banana 2: strong prompt following and editing for polished images without jumping to the Pro price tier.' },
  'google/gemini-3.1-flash-image-preview': { releaseDate: '2026-02-26', narrative: 'Preview build of Nano Banana 2, retained for compatibility with projects tuned against the earlier model.' },
  'google/gemini-3-pro-image': { releaseDate: '2026-06-18', narrative: "Google's premium image model for high-fidelity edits, difficult prompt adherence, and final-quality work." },
  'google/gemini-3-pro-image-preview': { releaseDate: '2025-11-20', narrative: 'Preview-era Nano Banana Pro, useful for older projects whose look was tuned against the preview.' },
  'google/gemini-3.1-flash-lite-image': { releaseDate: '2026-06-30', narrative: 'Fastest Nano Banana 2 lane for high-volume iteration, rough comps, and inexpensive visual exploration.' },
  'google/gemini-2.5-flash-image': { releaseDate: '2025-10-07', narrative: 'The earlier Nano Banana workhorse, retained for its familiar Flash-image behavior and modest price.' },
  'openai/gpt-5.4-image-2': { releaseDate: '2026-04-21', narrative: "OpenAI's higher-end image path for complex instruction following and text-aware visual edits." },
  'openai/gpt-5-image': { releaseDate: '2025-10-14', narrative: 'General OpenAI image generation with stronger language grounding than the mini tier.' },
  'openai/gpt-5-image-mini': { releaseDate: '2025-10-16', narrative: 'Lower-cost OpenAI image model for drafts, alternates, and quick visual passes.' },
  'microsoft/mai-image-2.5': { releaseDate: '2026-06-02', narrative: "Microsoft's MAI-Image via Azure for photorealistic and artistic generation with aspect-ratio control." },
  'microsoft/mai-image-2.5-pro': { releaseDate: '2026-07-23', narrative: 'Higher-fidelity MAI-Image tier for more demanding prompts and cleaner detail.' },
  'black-forest-labs/flux.2-klein-4b': { releaseDate: '2026-01-14', narrative: 'Small FLUX.2 model for very cheap drafts and broad visual exploration.' },
  'black-forest-labs/flux.2-pro': { releaseDate: '2025-11-25', narrative: 'Balanced FLUX.2 model for photoreal and cinematic image generation.' },
  'black-forest-labs/flux.2-flex': { releaseDate: '2025-11-25', narrative: 'Flexible FLUX.2 tier for more demanding prompts and composition control.' },
  'black-forest-labs/flux.2-max': { releaseDate: '2025-12-16', narrative: 'Highest-cost FLUX.2 lane for maximum quality when the image is worth the spend.' },
  'sourceful/riverflow-v2.5-pro': { releaseDate: '2026-06-04', narrative: "Riverflow's higher-quality branch for stylized generation where the final look matters more than raw speed." },
  'sourceful/riverflow-v2.5-fast': { releaseDate: '2026-06-04', narrative: 'Fast Riverflow variant for rapid image iteration and inexpensive ideation.' },
  'sourceful/riverflow-v2-pro': { releaseDate: '2026-02-02', narrative: 'Earlier Riverflow Pro path retained for projects tuned to the V2 look.' },
  'sourceful/riverflow-v2-fast': { releaseDate: '2026-02-02', narrative: 'Earlier fast Riverflow lane for low-cost drafts and variants.' },
  'bytedance-seed/seedream-4.5': { releaseDate: '2025-12-23', narrative: 'ByteDance image model for broad stylistic exploration at a low per-image cost.' },
  'recraft/recraft-v4.1-pro': { releaseDate: '2026-05-13', narrative: "Recraft's premium design and illustration lane for controlled graphic style and polished commercial output." },
  'recraft/recraft-v4.1': { releaseDate: '2026-05-13', narrative: 'Balanced Recraft option for stylized graphics, posters, and design-forward images.' },
  'recraft/recraft-v4.1-utility-pro': { releaseDate: '2026-05-13', narrative: 'Higher-quality Recraft utility model for precise edits and design cleanup.' },
  'recraft/recraft-v4.1-utility': { releaseDate: '2026-05-13', narrative: 'Lower-cost Recraft utility model for quick edits and graphic variations.' },
  'recraft/recraft-v4-pro': { releaseDate: '2026-05-07', narrative: 'Older premium Recraft V4 model, retained for projects tuned to that generation.' },
  'recraft/recraft-v4': { releaseDate: '2026-05-07', narrative: 'Earlier Recraft V4 model for economical design-style generation.' },
  'recraft/recraft-v3': { releaseDate: '2026-05-07', narrative: 'Legacy Recraft option for compatibility with older style tests.' },
  'recraft/recraft-v4.1-pro-vector': { releaseDate: '2026-05-13', narrative: "Recraft's premium native-vector lane for polished, scalable SVG artwork without code generation." },
  'recraft/recraft-v4.1-vector': { releaseDate: '2026-05-13', narrative: 'Budget native-vector generation for scalable SVG drafts and graphic exploration.' },
  'anthropic/claude-fable-5': { releaseDate: '2026-06-09', narrative: "Anthropic's long-horizon creative model, well suited to intricate SVG composition and iterative visual refinement." },
  'anthropic/claude-opus-5': { releaseDate: '2026-07-24', narrative: 'Premium Claude model for complex, carefully structured SVG markup and difficult visual instructions.' },
  'openai/gpt-5.6-sol': { releaseDate: '2026-07-09', narrative: 'OpenAI flagship model for complex SVG geometry, detailed creative direction, and reliable code structure.' },
  'openai/gpt-5.6-sol-pro': { releaseDate: '2026-07-09', narrative: 'Higher-compute Sol routing for the most demanding SVG composition and refinement work.' },
  'openai/gpt-5.4': { releaseDate: '2026-03-05', narrative: 'Strong general coding model for editable SVG markup at a lower price than newer flagship lanes.' },
  'google/gemini-3.1-pro-preview': { releaseDate: '2026-02-19', narrative: 'Preview Pro model for visual interpretation and complex SVG prompt following.' },
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
  const metadata = MODEL_METADATA[model.id];
  const providerCost = nativeCost(model, kind);
  const estimatedCost = estimateCost(model, kind);
  const tokenBilled =
    kind === 'image' &&
    (model.id.startsWith('google/') || model.id.startsWith('openai/') || model.id.startsWith('microsoft/'));
  return {
    id: model.id,
    label: cleanLabel(model.displayName),
    description: descriptionFor(model, kind),
    narrative: metadata?.narrative,
    provider: providerFor(model.id),
    family: familyFor(model),
    releaseDate: metadata?.releaseDate,
    costLabel: [providerCost, estimatedCost]
      .filter(Boolean)
      .join(' (') + (providerCost && estimatedCost ? ')' : ''),
    estimateLabel: estimatedCost,
    badges: [
      ...(isRecommended ? [{ label: 'recommended', tone: 'accent' as const }] : []),
      { label: kind === 'svg' ? (model.id.startsWith('recraft/') ? 'native SVG' : 'SVG code') : 'image output' },
      ...(tokenBilled ? [{ label: 'per token' }] : []),
    ],
    searchText: model.displayName,
  };
}
