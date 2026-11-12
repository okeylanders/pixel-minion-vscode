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
 *   - A row with only an `approxNote` (no verifiable per-image estimate, e.g.
 *     GPT Image 2.6) keeps its native-rate label and explains why in its
 *     cost description.
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
  // Image API (Single Shot) rows added with the P3 transport; dates checked 2026-11-12.
  'openai/gpt-image-2.6-sunburst': { releaseDate: '2026-11-04', narrative: 'OpenAI’s newest detail-optimized tier for dense compositions, text-heavy layouts, and edits that stay consistent from one pass to the next.' },
  'openai/gpt-image-2.6-flare': { releaseDate: '2026-11-04', narrative: 'OpenAI’s newest speed-optimized tier, about 50% faster than GPT Image 2.5, for fast text-to-image and image-to-image iteration.' },
  'qwen/qwen-image-2.1-turbo': { releaseDate: '2026-10-16', narrative: 'Fast, low-cost Qwen generation and editing where throughput and price matter most.' },
  'krea/k3-edit': { releaseDate: '2026-10-15', narrative: 'Instruction-following edits from one to eight reference images. It edits what you attach; it does not generate from a prompt alone.' },
  'black-forest-labs/flux-3-image-klein': { releaseDate: '2026-10-15', narrative: 'Open-weights FLUX.3 for very cheap generation and multi-reference edits that keep characters and subjects consistent.' },
  'google/gemini-nano-banana-2.1': { releaseDate: '2026-10-06', narrative: 'Flash-tier successor to Nano Banana 2 and Nano Banana Pro: stronger product recontextualization and editing at half Nano Banana 2’s output-token rate.' },
  'black-forest-labs/flux-3-image': { releaseDate: '2026-10-01', narrative: 'FLUX flagship image generation and editing with up to 10 references, from 768 up to 4K.' },
  'recraft/recraft-v4.1-flash': { releaseDate: '2026-09-23', narrative: 'Fast, very cheap Recraft generation from a text prompt alone; it takes no reference images.' },
  'openai/gpt-image-2.5-sunburst': { releaseDate: '2026-09-09', narrative: 'Precision-focused GPT Image 2.5 for detailed creative instructions and careful visual edits.' },
  'openai/gpt-image-2.5-flare': { releaseDate: '2026-09-09', narrative: 'Speed-focused GPT Image 2.5 for everyday image work and frequent iteration.' },
  'recraft/recraft-v4-styles': { releaseDate: '2026-08-26', narrative: 'Create a new raster image matching the style of 1–10 reference images.' },
  'recraft/recraft-v4-styles-pro': { releaseDate: '2026-08-26', narrative: 'Create a higher-resolution raster image matching the style of 1–10 reference images.' },
  'qwen/qwen-image-3-pro': { releaseDate: '2026-08-05', narrative: 'Premium Qwen generation and editing with finely rendered small text, detail, and knowledge-rich scenes.' },
  'qwen/qwen-image-3': { releaseDate: '2026-08-05', narrative: 'Versatile Qwen generation and editing with crisp small text and strong prompt detail.' },
  'krea/krea-2-large': { releaseDate: '2026-07-20', narrative: "Krea's largest image model for high-detail, aesthetic-forward generation." },
  'krea/krea-2-medium': { releaseDate: '2026-07-20', narrative: 'Balanced Krea tier for everyday image generation at a lower cost.' },
  'krea/krea-2-medium-turbo': { releaseDate: '2026-07-20', narrative: 'Fastest Krea lane for rapid iteration and cheap drafts.' },
  'openai/gpt-image-2': { releaseDate: '2026-06-24', narrative: 'Premium OpenAI image generation for final-quality compositions and text-sensitive edits.' },
  'openai/gpt-image-1': { releaseDate: '2026-06-24', narrative: "OpenAI's general GPT Image model (the tier below GPT Image 2); solid instruction following for edits and text-in-image." },
  'openai/gpt-image-1-mini': { releaseDate: '2026-06-24', narrative: 'Compact OpenAI image model for cheaper drafts and quick alternates.' },
  'sourceful/riverflow-v2.6-pro': { releaseDate: '2026-10-29', narrative: 'Flagship Riverflow 2.6 for text-to-image and edits, planning each image before it renders.' },
  'bytedance-seed/seedream-5-0-flash': { releaseDate: '2026-10-01', narrative: 'Fast Seedream editing with up to 14 references.' },
  'microsoft/mai-image-2.6': { releaseDate: '2026-09-04', narrative: 'MAI image generation and reference-guided editing, with up to five reference images.' },
  'microsoft/mai-image-2.6-flash': { releaseDate: '2026-09-04', narrative: 'Lower-latency MAI image generation and editing with lower image-token rates than the standard tier.' },
  'bytedance-seed/seedream-5-0-lite': { releaseDate: '2026-08-13', narrative: 'Seedream 5.0’s broad-knowledge tier for polished concepts and complex prompts, rendered at 2K or 4K.' },
  'bytedance-seed/seedream-5-0-pro': { releaseDate: '2026-08-12', narrative: 'Precise, natural-looking ByteDance generation and editing for commercial visual work, with up to 14 references.' },
  'x-ai/grok-imagine-image-2.0': { releaseDate: '2026-08-11', narrative: 'xAI’s current image model for prompt-driven generation and reference-based edits; it replaces Grok Imagine Image Quality.' },
  'google/gemini-3.1-flash-image': { releaseDate: '2026-06-18', narrative: 'Default-quality Nano Banana 2: strong prompt following and editing for polished images without jumping to the Pro price tier.' },
  'google/gemini-3.1-flash-image-preview': { releaseDate: '2026-02-26', narrative: 'Preview build of Nano Banana 2, retained for compatibility with projects tuned against the earlier model.' },
  'google/gemini-3-pro-image': { releaseDate: '2026-06-18', narrative: "Google's premium image model for high-fidelity edits, difficult prompt adherence, and final-quality work." },
  'google/gemini-3-pro-image-preview': { releaseDate: '2025-11-20', narrative: 'Preview-era Nano Banana Pro, useful for older projects whose look was tuned against the preview.' },
  'google/gemini-3.1-flash-lite-image': { releaseDate: '2026-06-30', narrative: 'Fastest Nano Banana 2 lane for high-volume iteration, rough comps, and inexpensive visual exploration.' },
  'google/gemini-2.5-flash-image': { releaseDate: '2025-10-07', narrative: 'The earlier Nano Banana workhorse, retained for its familiar Flash-image behavior and modest price.' },
  'openai/gpt-5.4-image-2': { releaseDate: '2026-04-21', narrative: "OpenAI's higher-end image path for complex instruction following and text-aware visual edits." },
  'openai/gpt-5-image': { releaseDate: '2025-10-14', narrative: 'General OpenAI image generation with stronger language grounding than the mini tier.' },
  'openai/gpt-5-image-mini': { releaseDate: '2025-10-16', retiresOn: '2026-12-01', narrative: 'Lower-cost OpenAI image model for drafts, alternates, and quick visual passes. OpenRouter retires it on December 1, 2026.' },
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
  'openai/gpt-6.1-terra': { releaseDate: '2026-10-26', narrative: 'Mid-tier OpenAI model that OpenRouter describes as particularly strong at reading screenshots, for affordable SVG from a visual reference.' },
  'google/gemini-4-argon': { releaseDate: '2026-10-13', narrative: "Google's flagship reasoning model for complex SVG geometry and close prompt following, at a lower output rate than Gemini 3.1 Pro." },
  'anthropic/claude-haiku-5.5': { releaseDate: '2026-10-07', narrative: 'Small, fast Claude for very cheap SVG drafts and quick iterations.' },
  'openai/gpt-6.1-sol': { releaseDate: '2026-09-29', narrative: "OpenAI's Sol tier, below Astra, for complex SVG geometry, detailed creative direction, and reliable code structure." },
  'anthropic/claude-sonnet-5.5': { releaseDate: '2026-09-28', narrative: 'Mid-price Claude for well-structured SVG markup and steady multi-turn refinement.' },
  'anthropic/claude-opus-5.5': { releaseDate: '2026-09-22', narrative: 'Premium Claude model for complex, carefully structured SVG markup and difficult visual instructions.' },
  'x-ai/grok-4.7': { releaseDate: '2026-09-21', narrative: "xAI's flagship reasoning model, with the lowest output rate among the flagship SVG coders." },
  'openai/gpt-6-astra': { releaseDate: '2026-09-04', narrative: "OpenAI's top tier for the most demanding SVG composition, when quality matters more than cost." },
  'google/gemini-3.8-flash': { releaseDate: '2026-09-02', narrative: 'Fast, low-cost Gemini for SVG drafts and quick variations.' },
  'anthropic/claude-fable-5.1': { releaseDate: '2026-09-01', narrative: "Anthropic's long-horizon creative model, well suited to intricate SVG composition and iterative visual refinement." },
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
  // Pixel delta: a row with no verifiable per-image reference still explains
  // its native rates (Frame has no such row yet).
  if (pricing.approxUsdPerImage == null) {
    if (!pricing.approxNote && !pricing.approxBasis) return undefined;
    const rateOrder = pricing.input != null ? ' (input/output)' : ' (output)';
    const note = pricing.approxNote ? ` No per-image estimate: cost ${pricing.approxNote}.` : '';
    return `${imageNativePricingLabel(pricing)}${rateOrder}.${note}${pricing.approxBasis ? ` ${pricing.approxBasis}` : ''}`;
  }
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
