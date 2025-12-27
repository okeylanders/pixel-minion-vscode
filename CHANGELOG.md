<p align="center">
  <img src="assets/pixel-minion-icon.png" alt="Pixel Minion" width="128"/>
</p>

# Changelog

For detailed technical documentation, see [docs/CHANGELOG-DETAILED.md](docs/CHANGELOG-DETAILED.md).

## [1.1.1] - 2025-12-27

### Added

- **New Image Generation Model**
  - ByteDance Seedream 4.5 (bytedance-seedream/seedream-4.5) - Advanced image generation from ByteDance

---

## [1.1.0] - 2025-12-18

### Added

- **New Image Generation Models**
  - FLUX.2 Max (black-forest-labs/flux.2-max) - Top-tier image model from Black Forest Labs
  - Riverflow V2 Max Preview (sourceful/riverflow-v2-max-preview)
  - Riverflow V2 Standard Preview (sourceful/riverflow-v2-standard-preview)
  - Riverflow V2 Fast Preview (sourceful/riverflow-v2-fast-preview)

- **New SVG Generation Model**
  - Gemini Flash 3.0 (google/gemini-3-flash-preview) - Fast reasoning model for SVG generation

- **Sourceful Size Warning** - Displays a warning when reference images exceed Sourceful's 4.5MB request limit

### Changed

- Added 16 new unit tests for size warning utility functions

---

## [1.0.2] - 2025-12-01

### Fixed

- **SVG Extraction Fallback** - `extractSVG()` now throws a clear error instead of returning raw content when no valid SVG is found. Prevents displaying AI explanations as "SVG code". (Debt-001)

### Added

- **PromptLoader Service** - Centralized system prompt management via `resources/system-prompts/` directory with caching support. (Feature-001)
- **SVG Architect Prompts** - Placeholder prompts for upcoming multi-agent SVG generation pipeline
- 35 new tests (16 for SVG extraction, 19 for PromptLoader)

---

## [1.0.1] - 2025-12-01

### Fixed

- **SVG Model Race Condition** - Fixed race condition where concurrent SVG generation requests with different models could interfere with each other. Models are now passed per-request instead of using shared state. (Debt-006)

### Changed

- `setModel()` method on `OpenRouterDynamicTextClient` is now deprecated. Pass model in `createCompletion()` options instead.

### Added

- 32 new tests for `OpenRouterDynamicTextClient` covering concurrent request handling

---

## [1.0.0] - 2025-11-30

### Overview

First release of Pixel Minion - AI-powered image and SVG generation inside VS Code.

### Added

- **Image Generation Tab** - Text-to-image and image-to-image generation
  - Multi-turn conversations for iterative refinement
  - Reference image upload for context
  - SVG attachment support (sent as text context)
  - Aspect ratio selection (1:1, 16:9, 9:16, 4:3, 3:4)
  - Seed control for reproducible results
  - Enhance Prompt button for AI-powered prompt improvement
  - Per-turn token usage and cost display

- **SVG Generation Tab** - Vector graphics generation using text models
  - Multi-turn conversations for refinement
  - Reference image upload
  - Multi-size preview (32px, 64px, 128px thumbnails)
  - Code view with copy functionality
  - Per-turn token usage and cost display

- **Model Support**
  - Image: Gemini 2.5 Flash (Nano Banana), GPT-5 Image, FLUX.2 Pro/Flex
  - SVG: GPT-5.1 Codex (default), Gemini Pro 3.0, Claude Opus 4.5

- **Token Usage Tracking** - Real-time token counts and cost display per generation turn

- **Settings**
  - OpenRouter API key management (secure storage)
  - Model selection for Image and SVG
  - Output directory configuration

### Security

- **Secure API Key Storage** - API keys stored in OS keychain via VS Code SecretStorage

### Architecture

- Clean Architecture with TypeScript
- Message Envelope pattern for extension-webview communication
- React-based webview UI with VS Code theming
- Three-Suite AI Infrastructure (Text, Image, SVG orchestrators)

---

## Support & Feedback

**Issues**: [GitHub Issues](https://github.com/okeylanders/pixel-minion-vscode/issues)

**Documentation**: See [README.md](README.md) for comprehensive usage guide

**Support Development**: [Buy me a coffee](https://buymeacoffee.com/okeylanders)

---

**Thank you for using Pixel Minion! Happy creating!**
