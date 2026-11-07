// Ported from frame-minion@40e7949 packages/core/src/presentation/webview/components/shared/modelBrowserOptions.ts; keep in sync
/**
 * Maps catalog rows to Model Browser options.
 *
 * Shared with Frame: the provider/family/label helpers, the unit-aware image
 * pricing labels and `modelDefinitionToBrowserOption`. Pixel deltas:
 *   - `PROVIDER_LABELS` keeps Frame's image/text providers (not its video
 *     ones) and adds `krea`, `qwen`.
 *   - Metadata narratives say "image" where Frame's say "frame".
 *   - Metadata may carry `retiresOn` (OpenRouter `expiration_date`), shown as
 *     a warn badge. Frame has no expiring image model yet; upstream with one.
 *   - `imagePricingLabel` / `imageUnitBadgeLabel` take an output noun so the
 *     SVG tab can say "| SVG" (default "image" keeps Frame's labels).
 *   - `svgModelToBrowserOption` and its metadata are Pixel-only.
 * Frame's text, video and orchestrator mappers have no Pixel consumer and
 * are not ported.
 */
import type {
  CodeSvgModelDefinition,
  ImageModelDefinition,
  ImagePricing,
  SvgModelDefinition,
} from '@shared/types/providers';
import type { ModelBrowserBadge, ModelBrowserOption } from './modelBrowserTypes';

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  'black-forest-labs': 'Black Forest Labs',
  'bytedance-seed': 'ByteDance Seed',
  google: 'Google',
  inclusionai: 'inclusionAI',
  krea: 'Krea',
  meta: 'Meta',
  microsoft: 'Microsoft',
  openai: 'OpenAI',
  qwen: 'Qwen',
  recraft: 'Recraft',
  sourceful: 'Sourceful',
  'x-ai': 'xAI',
};

interface ModelMetadata {
  /** OpenRouter `created`, as YYYY-MM-DD. */
  releaseDate?: string;
  narrative: string;
  description?: string;
  /** OpenRouter `expiration_date`, as YYYY-MM-DD (Pixel-only). */
  retiresOn?: string;
}

const IMAGE_MODEL_METADATA: Record<string, ModelMetadata> = {
  // OpenRouter catalog creation dates (`created`), checked 2026-11-07.
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
};

const SVG_MODEL_METADATA: Record<string, ModelMetadata> = {
  // OpenRouter catalog creation dates (`created`), checked 2026-11-07.
  'recraft/recraft-v4.1-pro-vector': { releaseDate: '2026-05-13', narrative: "Recraft's premium native-vector lane for polished, scalable SVG artwork without code generation." },
  'recraft/recraft-v4.1-vector': { releaseDate: '2026-05-13', narrative: 'Budget native-vector generation for scalable SVG drafts and graphic exploration.' },
  'anthropic/claude-fable-5': { releaseDate: '2026-06-09', narrative: "Anthropic's long-horizon creative model, well suited to intricate SVG composition and iterative visual refinement." },
  'anthropic/claude-opus-5': { releaseDate: '2026-07-24', narrative: 'Premium Claude model for complex, carefully structured SVG markup and difficult visual instructions.' },
  'openai/gpt-5.6-sol': { releaseDate: '2026-07-09', narrative: 'OpenAI flagship model for complex SVG geometry, detailed creative direction, and reliable code structure.' },
  'openai/gpt-5.6-sol-pro': { releaseDate: '2026-07-09', narrative: 'Higher-compute Sol routing for the most demanding SVG composition and refinement work.' },
  'openai/gpt-5.4': { releaseDate: '2026-03-05', narrative: 'Strong general coding model for editable SVG markup at a lower price than newer flagship lanes.' },
  'google/gemini-3.1-pro-preview': { releaseDate: '2026-02-19', narrative: 'Preview Pro model for visual interpretation and complex SVG prompt following.' },
};

function providerFromId(id: string): string {
  const slug = id.split('/')[0] ?? 'custom';
  return PROVIDER_LABELS[slug] ?? slug;
}

function familyFromLabel(label: string, fallback: string): string {
  const normalized = stripRecommended(label).replace(/^.+?:\s*/, '');
  const firstWord = normalized.split(/\s+/)[0];
  return firstWord || fallback;
}

function stripRecommended(label: string): string {
  return label
    .replace(/^⭐\s*/, '')
    .replace(/^[-* ]*Recommended[: -]*/i, '')
    .replace(/\s*[—-]\s*Recommended\s*$/i, '')
    .trim();
}

function costPair(inputCost?: number, outputCost?: number): string | undefined {
  if (inputCost == null && outputCost == null) return undefined;
  if (inputCost != null && outputCost != null) return `$${inputCost}/$${outputCost} per 1M`;
  if (outputCost != null) return `$${outputCost} output`;
  return `$${inputCost} input`;
}

/** Trim float noise for display: 30 → "$30", 0.039 → "$0.039". */
function formatUsd(value: number): string {
  return `$${Number(value.toFixed(6))}`;
}

/** Native rates stay visible alongside per-image comparisons. */
function imageNativePricingLabel(pricing: ImagePricing): string {
  const output = formatUsd(pricing.output);
  const rate = pricing.input != null ? `${formatUsd(pricing.input)}/${output}` : output;
  switch (pricing.unit) {
    case 'image':
      return `${rate}/image`;
    case 'megapixel':
      return `${rate} per megapixel`;
    case 'image-token':
      return `${rate} per 1M image tokens`;
  }
}

/** `noun` names one output in the label ("image"; the SVG tab passes "SVG"). */
function imagePricingLabel(pricing: ImagePricing, noun = 'image'): string {
  if (pricing.unit === 'image' && pricing.output === 0) return 'Free';
  const perImage = pricing.approxUsdPerImage ?? (pricing.unit === 'image' ? pricing.output : undefined);
  if (perImage != null) {
    return `≈ ${formatUsd(perImage)} | ${noun}${pricing.approxNote ? ` ${pricing.approxNote}` : ''}`;
  }
  return imageNativePricingLabel(pricing);
}

function imagePricingDescription(pricing: ImagePricing): string | undefined {
  if (pricing.unit === 'image') return pricing.approxBasis;
  if (pricing.approxUsdPerImage == null) return undefined;
  const rateOrder = pricing.input != null ? ' (input/output)' : ' (output)';
  const basis = pricing.approxBasis ?? 'Output estimate; prompt and reference-image charges may be additional.';
  return `${imageNativePricingLabel(pricing)}${rateOrder}. ${basis}`;
}

function imageUnitBadgeLabel(unit: ImagePricing['unit'], noun = 'image'): string {
  switch (unit) {
    case 'image':
      return `per ${noun}`;
    case 'megapixel':
      return 'per megapixel';
    case 'image-token':
      return 'per token';
  }
}

function recommendedBadge(label: string): ModelBrowserBadge[] {
  return label.includes('⭐') || /recommended/i.test(label)
    ? [{ label: 'recommended', tone: 'accent' }]
    : [];
}

/** Pixel-only: a dashed warn badge for a model OpenRouter will stop serving. */
function retiringBadge(metadata?: ModelMetadata): ModelBrowserBadge[] {
  if (!metadata?.retiresOn) return [];
  const date = new Date(`${metadata.retiresOn}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return [];
  const label = date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  return [{ label: `retiring ${label}`, tone: 'warn' }];
}

export function modelDefinitionToBrowserOption(model: ImageModelDefinition): ModelBrowserOption {
  const provider = providerFromId(model.id);
  const metadata = IMAGE_MODEL_METADATA[model.id];
  const pricing = model.imagePricing;
  return {
    id: model.id,
    label: stripRecommended(model.displayName),
    narrative: metadata?.narrative,
    description: model.description ?? metadata?.description ?? model.id,
    provider,
    family: familyFromLabel(model.displayName, provider),
    releaseDate: metadata?.releaseDate,
    // No legacy fallback: `imagePricing` is the only pricing surface on
    // ImageModelDefinition (absent ⇒ the provider publishes no price).
    costLabel: pricing ? imagePricingLabel(pricing) : undefined,
    costDescription: pricing ? imagePricingDescription(pricing) : undefined,
    badges: [
      ...recommendedBadge(model.displayName),
      ...retiringBadge(metadata),
      { label: 'image output' },
      ...(pricing ? [{ label: imageUnitBadgeLabel(pricing.unit) }] : []),
    ],
    searchText: model.displayName,
  };
}

/** Pixel-only: helper under a trigger whose selection isn't in the curated list. */
export const OFF_LIST_MODEL_HELP = "Not in Pixel Minion's curated list. Requests still use this model id.";

// ── Pixel-only: the SVG tab ──────────────────────────────────────────────

/** The picker's "By Family" groups for the SVG tab: how the model makes SVG. */
export const SVG_KIND_FAMILY: Record<SvgModelDefinition['kind'], string> = {
  'native-vector': 'Native SVG',
  code: 'SVG code',
};

/**
 * House assumption for comparing code models: one SVG turn ≈ 1k input +
 * 4k output tokens. Shown in the card's cost description, never as a price.
 */
const SVG_CODE_INPUT_TOKENS = 1_000;
const SVG_CODE_OUTPUT_TOKENS = 4_000;

function reasonsByDefault(model: CodeSvgModelDefinition): boolean {
  return model.reasoning?.mandatory === true || model.reasoning?.defaultEnabled === true;
}

function codeSvgCostDescription(model: CodeSvgModelDefinition): string {
  const { inputPer1M, outputPer1M } = model.textPricing;
  const estimate = (inputPer1M * SVG_CODE_INPUT_TOKENS + outputPer1M * SVG_CODE_OUTPUT_TOKENS) / 1_000_000;
  // The pill already shows the native per-1M rates; this line adds the comparison.
  const assumption = `≈ ${formatUsd(estimate)} per SVG at about 1k input and 4k output tokens.`;
  const caveat = reasonsByDefault(model)
    ? `Reasons by default (${model.reasoning?.defaultEffort} effort); reasoning tokens bill as output, so expect more.`
    : 'Longer or more detailed SVGs cost more.';
  return `${assumption} ${caveat}`;
}

export function svgModelToBrowserOption(model: SvgModelDefinition): ModelBrowserOption {
  const provider = providerFromId(model.id);
  const metadata = SVG_MODEL_METADATA[model.id];
  const shared = {
    id: model.id,
    label: stripRecommended(model.displayName),
    narrative: metadata?.narrative,
    provider,
    family: SVG_KIND_FAMILY[model.kind],
    releaseDate: metadata?.releaseDate,
    searchText: model.displayName,
  };

  if (model.kind === 'native-vector') {
    const pricing = model.imagePricing;
    return {
      ...shared,
      description: model.description ?? metadata?.description
        ?? 'Returns SVG directly instead of writing code, so it cannot be refined in a follow-up turn. Pixel requests it without an aspect ratio, so the output is square.',
      costLabel: pricing ? imagePricingLabel(pricing, 'SVG') : undefined,
      costDescription: pricing ? imagePricingDescription(pricing) : undefined,
      badges: [
        ...recommendedBadge(model.displayName),
        ...retiringBadge(metadata),
        { label: 'native SVG' },
        ...(pricing ? [{ label: imageUnitBadgeLabel(pricing.unit, 'SVG') }] : []),
      ],
    };
  }

  return {
    ...shared,
    // Falls back to the id, which the card hides: the "SVG code" family and
    // badge already say what every code model does.
    description: model.description ?? metadata?.description ?? model.id,
    costLabel: costPair(model.textPricing.inputPer1M, model.textPricing.outputPer1M),
    costDescription: codeSvgCostDescription(model),
    badges: [
      ...recommendedBadge(model.displayName),
      ...retiringBadge(metadata),
      { label: 'SVG code' },
      { label: 'per token' },
      ...(model.acceptsImageInput ? [{ label: 'image input' }] : []),
    ],
  };
}

/** Pixel-only: an off-list SVG selection, kept visible as "Custom: <id>". */
export function customSvgModelToBrowserOption(id: string): ModelBrowserOption {
  return {
    id,
    label: `Custom: ${id}`,
    description: id,
    provider: providerFromId(id),
    family: 'Custom',
    badges: [],
    searchText: id,
  };
}
