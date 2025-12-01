# Feature-015: Additional Providers

**Status:** Planned
**Planned Version:** TBD
**Priority:** High
**Created:** 2025-11-30

## Summary

Add support for additional AI providers beyond OpenRouter.

## Description

Extend the provider interface to support multiple AI backends, giving users flexibility in how they access AI models.

## Providers to Add

### OpenAI Direct
- [ ] Direct OpenAI API integration
- [ ] Support for GPT-4, DALL-E, etc.
- [ ] Separate API key storage
- [ ] Model enumeration from OpenAI

### Hugging Face
- [ ] Hugging Face Inference API
- [ ] Support for open models
- [ ] Hugging Face API token storage
- [ ] Model search/selection

### Custom URL
- [ ] User-configurable endpoint URL
- [ ] OpenAI-compatible API format
- [ ] Custom authentication options
- [ ] For self-hosted models (Ollama, vLLM, etc.)

### Shell CLI
- [ ] Execute local CLI commands for generation
- [ ] Support for tools like `stable-diffusion-cli`
- [ ] Configurable command templates
- [ ] Parse output from CLI tools

## Architecture Changes

- [ ] Extend `ProviderConfig` interface
- [ ] Create provider-specific clients
- [ ] Add provider selection in Settings
- [ ] Store credentials per provider in SecretStorage
- [ ] Update model dropdowns to show provider

## UI Changes

- [ ] Provider selector in Settings
- [ ] Per-provider API key fields
- [ ] Custom URL configuration panel
- [ ] CLI command configuration panel
- [ ] Model dropdown grouped by provider

## Settings

```json
{
  "pixelMinion.provider": "openrouter | openai | huggingface | custom | cli",
  "pixelMinion.customEndpoint": "http://localhost:11434/v1",
  "pixelMinion.cliCommand": "sd-cli generate --prompt {prompt}"
}
```

## Notes

The existing provider interface pattern in `src/shared/types/providers.ts` was designed for extensibility. Each provider implements `ProviderConfig` with its own model lists.
