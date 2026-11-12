/**
 * OpenRouter Provider Configuration
 *
 * Infrastructure-shaped provider config (baseUrl + capability flags).
 * The pure static model catalogs, defaults and retired-id map live in
 * `src/shared/models` so the webview can import them without crossing into
 * the infrastructure layer.
 */

import { ProviderConfig } from '../../../shared/types/providers';
import { OPENROUTER_IMAGE_MODELS, OPENROUTER_SVG_MODELS } from '../../../shared/models';

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
