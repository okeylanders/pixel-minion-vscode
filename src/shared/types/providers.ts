/**
 * Provider Interface Types
 *
 * Defines the interface for AI providers (OpenRouter, future custom endpoints).
 * Each provider exposes curated model lists per generation type.
 */

import { TextClient } from '../../infrastructure/ai/clients/TextClient';

export type GenerationType = 'image' | 'svg';

export interface ModelDefinition {
  id: string;           // e.g., 'google/gemini-2.5-flash-image'
  displayName: string;  // e.g., 'Gemini 2.5 Flash Image'
  description?: string;
  inputCost?: number;   // $ per 1M tokens
  outputCost?: number;
}

export interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  models: Record<GenerationType, ModelDefinition[]>;
  supportsImageInput: boolean;
  supportsImageOutput: boolean;
}

export interface AIProvider {
  getConfig(): ProviderConfig;
  createClient(apiKey: string, model: string): TextClient;
}
