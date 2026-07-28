/**
 * OpenRouter Provider Configuration
 *
 * Curated model lists for image and SVG generation via OpenRouter API.
 */

import { ProviderConfig, ModelDefinition } from '../../../shared/types/providers';

export const OPENROUTER_IMAGE_MODELS: ModelDefinition[] = [
  { id: 'google/gemini-3.1-flash-image', displayName: '⭐ Nano Banana 2 (Gemini 3.1 Flash Image) - Recommended', inputCost: 0.5, outputCost: 60 },
  { id: 'google/gemini-3.1-flash-image-preview', displayName: 'Nano Banana 2 (Gemini 3.1 Flash Image Preview)', inputCost: 0.5, outputCost: 60 },
  { id: 'google/gemini-3-pro-image', displayName: '⭐ Nano Banana Pro (Gemini 3 Pro Image)', inputCost: 2, outputCost: 120 },
  { id: 'google/gemini-3-pro-image-preview', displayName: 'Nano Banana Pro (Gemini 3 Pro Image Preview)', inputCost: 2, outputCost: 120 },
  { id: 'google/gemini-3.1-flash-lite-image', displayName: 'Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image)', inputCost: 0.25, outputCost: 30 },
  { id: 'google/gemini-2.5-flash-image', displayName: 'Nano Banana (Gemini 2.5 Flash Image)', inputCost: 0.3, outputCost: 30 },
  { id: 'openai/gpt-image-2', displayName: '⭐ GPT Image 2', outputCost: 30 },
  { id: 'openai/gpt-image-1', displayName: 'GPT Image 1', outputCost: 40 },
  { id: 'openai/gpt-image-1-mini', displayName: 'GPT Image 1 Mini', outputCost: 8 },
  { id: 'openai/gpt-5.4-image-2', displayName: 'GPT-5.4 Image 2', outputCost: 30 },
  { id: 'openai/gpt-5-image', displayName: 'GPT-5 Image', outputCost: 40 },
  { id: 'openai/gpt-5-image-mini', displayName: 'GPT-5 Image Mini', outputCost: 8 },
  { id: 'microsoft/mai-image-2.5-pro', displayName: 'MAI-Image 2.5 Pro', inputCost: 5, outputCost: 108 },
  { id: 'microsoft/mai-image-2.5', displayName: 'MAI-Image 2.5', inputCost: 5, outputCost: 47 },
  { id: 'krea/krea-2-large', displayName: 'Krea 2 Large', outputCost: 0.06 },
  { id: 'krea/krea-2-medium', displayName: 'Krea 2 Medium', outputCost: 0.03 },
  { id: 'krea/krea-2-medium-turbo', displayName: 'Krea 2 Medium Turbo', outputCost: 0.015 },
  { id: 'black-forest-labs/flux.2-klein-4b', displayName: 'FLUX.2 Klein 4B', outputCost: 0.014 },
  { id: 'black-forest-labs/flux.2-pro', displayName: 'FLUX.2 Pro', outputCost: 0.03 },
  { id: 'black-forest-labs/flux.2-flex', displayName: 'FLUX.2 Flex', inputCost: 0.06, outputCost: 0.06 },
  { id: 'black-forest-labs/flux.2-max', displayName: 'FLUX.2 Max', outputCost: 0.07 },
  { id: 'sourceful/riverflow-v2.5-pro', displayName: 'Riverflow V2.5 Pro', outputCost: 0.13 },
  { id: 'sourceful/riverflow-v2.5-fast', displayName: 'Riverflow V2.5 Fast', outputCost: 0.019 },
  { id: 'sourceful/riverflow-v2-pro', displayName: 'Riverflow V2 Pro', outputCost: 0.15 },
  { id: 'sourceful/riverflow-v2-fast', displayName: 'Riverflow V2 Fast', outputCost: 0.02 },
  { id: 'bytedance-seed/seedream-4.5', displayName: 'Seedream 4.5', outputCost: 0.04 },
  { id: 'recraft/recraft-v4.1-pro', displayName: 'Recraft V4.1 Pro', outputCost: 0.21 },
  { id: 'recraft/recraft-v4.1', displayName: 'Recraft V4.1', outputCost: 0.035 },
  { id: 'recraft/recraft-v4.1-utility-pro', displayName: 'Recraft V4.1 Utility Pro', outputCost: 0.21 },
  { id: 'recraft/recraft-v4.1-utility', displayName: 'Recraft V4.1 Utility', outputCost: 0.035 },
  { id: 'recraft/recraft-v4-pro', displayName: 'Recraft V4 Pro', outputCost: 0.25 },
  { id: 'recraft/recraft-v4', displayName: 'Recraft V4', outputCost: 0.04 },
  { id: 'recraft/recraft-v3', displayName: 'Recraft V3', outputCost: 0.04 },
  { id: 'x-ai/grok-imagine-image-quality', displayName: 'Grok Imagine Image Quality', inputCost: 0.01, outputCost: 0.05 },
];

export const OPENROUTER_SVG_MODELS: ModelDefinition[] = [
  { id: 'recraft/recraft-v4.1-pro-vector', displayName: '⭐ Recraft V4.1 Pro Vector (native SVG, 1:1 only) - Recommended', outputCost: 0.30 },
  { id: 'recraft/recraft-v4.1-vector', displayName: 'Recraft V4.1 Vector (native SVG, budget, 1:1 only)', outputCost: 0.08 },
  { id: 'anthropic/claude-fable-5', displayName: '⭐ Claude Fable 5 (code SVG) - Recommended', inputCost: 10, outputCost: 50 },
  { id: 'anthropic/claude-opus-5', displayName: '⭐ Claude Opus 5 (code SVG) - Recommended', inputCost: 5, outputCost: 25 },
  { id: 'anthropic/claude-opus-5-fast', displayName: 'Claude Opus 5 Fast (code SVG)', inputCost: 10, outputCost: 50 },
  { id: 'openai/gpt-5.6-sol', displayName: '⭐ GPT-5.6 Sol (code SVG) - Recommended', inputCost: 5, outputCost: 30 },
  { id: 'openai/gpt-5.6-sol-pro', displayName: 'GPT-5.6 Sol Pro (code SVG)', inputCost: 5, outputCost: 30 },
  { id: 'openai/gpt-5.4', displayName: 'GPT-5.4 (code SVG)', inputCost: 2.5, outputCost: 15 },
  { id: 'google/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro (code SVG)', inputCost: 2, outputCost: 12 },
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
export const DEFAULT_IMAGE_MODEL = 'google/gemini-3.1-flash-image';

/** Default model for SVG generation */
export const DEFAULT_SVG_MODEL = 'recraft/recraft-v4.1-pro-vector';
