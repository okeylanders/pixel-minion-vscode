/**
 * OpenRouter Provider Configuration
 *
 * Curated model lists for image and SVG generation via OpenRouter API.
 */

import { ProviderConfig, ModelDefinition } from '../../../shared/types/providers';

export const OPENROUTER_IMAGE_MODELS: ModelDefinition[] = [
  { id: 'google/gemini-2.5-flash-image', displayName: '⭐ Nano Banana 10/25 (Google: Gemini 2.5 Flash Image) - Recommended', inputCost: 0.30, outputCost: 2.50 },
  { id: 'google/gemini-2.5-flash-image-preview', displayName: 'Nano Banana 8/25 (Google: Gemini 2.5 Flash Image Preview)', inputCost: 0.30, outputCost: 2.50 },
  { id: 'google/gemini-3-pro-image-preview', displayName: 'Nano Banana Pro (Google: Gemini 3 Pro Image Preview)', inputCost: 2.00, outputCost: 12.00 },
  { id: 'openai/gpt-5-image-mini', displayName: 'GPT-5 Image Mini', inputCost: 2.50, outputCost: 2.00 },
  { id: 'openai/gpt-5-image', displayName: 'GPT-5 Image', inputCost: 10.00, outputCost: 10.00 },
  { id: 'black-forest-labs/flux.2-pro', displayName: 'FLUX.2 Pro', inputCost: 3.66, outputCost: 3.66 },
  { id: 'black-forest-labs/flux.2-flex', displayName: 'FLUX.2 Flex', inputCost: 14.64, outputCost: 14.64 },
  { id: 'black-forest-labs/flux.2-max', displayName: 'FLUX.2 Max', inputCost: 30.00, outputCost: 70.00 },
  { id: 'sourceful/riverflow-v2-max-preview', displayName: 'Riverflow V2 Max Preview', outputCost: 75.00 },
  { id: 'sourceful/riverflow-v2-standard-preview', displayName: 'Riverflow V2 Standard Preview', outputCost: 35.00 },
  { id: 'sourceful/riverflow-v2-fast-preview', displayName: 'Riverflow V2 Fast Preview', outputCost: 30.00 },
];

export const OPENROUTER_SVG_MODELS: ModelDefinition[] = [
  { id: 'google/gemini-3-pro-preview', displayName: 'Gemini Pro 3.0', inputCost: 1.25, outputCost: 10.00 },
  { id: 'google/gemini-3-flash-preview', displayName: 'Gemini Flash 3.0', inputCost: 0.15, outputCost: 0.60 },
  { id: 'anthropic/claude-opus-4', displayName: 'Claude Opus 4.5', inputCost: 15.00, outputCost: 75.00 },
  { id: 'openai/gpt-5.1-codex', displayName: 'OpenAI: GPT-5.1 Codex' },
];

export const OPENROUTER_CONFIG: ProviderConfig = {
  id: 'openrouter',
  displayName: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  supportsImageInput: true,
  supportsImageOutput: true,
  models: {
    image: OPENROUTER_IMAGE_MODELS,
    svg: OPENROUTER_SVG_MODELS,
  },
};

/** Default model for image generation */
export const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image';

/** Default model for SVG generation */
export const DEFAULT_SVG_MODEL = 'openai/gpt-5.1-codex';
