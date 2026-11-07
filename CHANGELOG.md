<p align="center">
  <img src="assets/pixel-minion-icon.png" alt="Pixel Minion" width="128"/>
</p>

# Changelog

For detailed technical documentation, see [docs/CHANGELOG-DETAILED.md](docs/CHANGELOG-DETAILED.md).

## [Unreleased]

### Added

- **A new look that matches Frame Minion and Prose Minion**
  - Pixel's own brand colours (ember and oxblood, from the logo), and the full-colour logo in the header.
  - Cleaner Image and SVG tabs: controls stack neatly, and generated images and SVGs have room to breathe even in a narrow sidebar.
  - One consistent style for fields and buttons, a refreshed Settings panel, and friendlier empty states.
- **New model browser** - The Image, SVG and Settings model pickers open the same browser as Frame Minion: search, three ways to group models (by provider, by family, by release date), and a card for each model showing its price, what the estimate assumes, badges and a short description. The current model is scrolled into view when the browser opens, and the browser works from the keyboard and with screen readers.
- **OpenRouter balance in the header.**
  - See your remaining credit at a glance and expand it for details.
  - It refreshes automatically after each generation and whenever you change your API key.
  - It tells you clearly when the balance can't be read, the key is invalid, or you're offline.
- **Accessibility**
  - Full keyboard support for tabs and dialogs: arrow keys move between tabs, focus stays inside an open dialog and returns when it closes, and Escape closes only the top dialog.
  - High-contrast theme support.
  - Respects "reduce motion".
- **New image models**
  - ⭐ Nano Banana 2.1 - Google's newest Flash-tier image model, at half Nano Banana 2's output price
  - Seedream 5.0 Pro, Seedream 5.0 Lite and Seedream 5.0 Flash
  - MAI-Image 2.6 and MAI-Image 2.6 Flash
  - Riverflow V2.6 Pro
  - Recraft V4.1 Flash (prompt only, no reference images)
  - Grok Imagine Image 2.0
- **New SVG code models**
  - ⭐ Claude Opus 5.5, ⭐ Claude Fable 5.1 and ⭐ GPT-6.1 Sol
  - Claude Sonnet 5.5, Claude Haiku 5.5 (budget), GPT-6 Astra, GPT-6.1 Terra, Gemini 4 Argon, Gemini 3.8 Flash (budget) and Grok 4.7

### Changed

- **Honest price estimates** - Each model's price now follows how it is actually billed: per image, per megapixel or per token. Per-image estimates for token-billed models come from each model's own reference, so GPT-5.4 Image 2 now reads ≈ $0.211 per image at 1K high quality instead of ≈ $0.039. This corrects the estimate; OpenRouter's prices did not go up. Extra charges for reference images are shown where OpenRouter lists them.
- **SVG models are grouped by how they make SVG** - "Native SVG" (Recraft) or "SVG code". Code models show their per-token price, with an approximate cost per SVG and a note when the model reasons by default.
- **Older SVG models keep working** - Claude Opus 5, Claude Fable 5, GPT-5.6 Sol, GPT-5.6 Sol Pro, GPT-5.4 and Gemini 3.1 Pro left the list for their newer versions. If one of them is selected, it stays selected and is labelled "Custom".
- **GPT-5 Image Mini** is labelled "retiring Dec 1, 2026", the date OpenRouter has announced.
- **Saved models that are no longer available switch automatically** to a working model, with a note in the Pixel Minion output log: Grok Imagine (Image Quality) → Grok Imagine Image 2.0, Claude Opus 4 and Claude Opus 5 Fast → Claude Opus 5.5, and the Riverflow V2 preview tiers → Riverflow V2.5.
- The model picker in each tab is the same height and style as the fields beside it.

### Fixed

- Krea, MAI-Image and Recraft V4.1 models no longer fail with "No endpoints found that support the requested output modalities".
- **Long SVGs from code models could come back cut off** - Most code models reason before they answer, and that reasoning counts against the response limit. SVG requests now allow up to 32,000 tokens (was 16,384).
- The SVG model browser grouped Gemini text models with the image models.
- **Answers land where they belong.** Every generation, refinement, prompt enhancement and save now carries its own request id. A late or repeated answer can no longer replace a newer result, and an Enhance Prompt error in one tab no longer stops the other tab's spinner or appears in both tabs.
- **A failed turn is not sent again.** When a generation or refinement fails, its prompt is dropped instead of being resent with your next refinement. Starting a second refinement of the same conversation while one is running is refused instead of mixing the two.
- **An attached SVG reaches the model once.** On the Image tab, an attached SVG's markup was sent twice with the first prompt. It is now sent once and stays with the turn it was attached to, including after VS Code restarts.
- **Refine keeps the conversation's own settings.** A refinement always uses the model and aspect ratio the conversation started with, also after a restart, and no longer picks up attachments added afterwards: those apply to your next Generate, and a note says so.
- **"Saved" means saved.** The checkmark now waits until the file is written. Cancelling the save dialog or a failed write no longer shows "Saved", and a cancel is no longer reported as an error.
- **WebP and GIF images keep their format when saved.** Files are named after the image's real format (`.png`, `.jpg`, `.webp`, `.gif`) instead of always `.jpg`. Data that isn't a supported image is refused instead of being saved under the wrong name.
- A failed settings change now shows its error in the tab you are looking at, without stopping a generation in progress.
- The panel no longer re-saves all of its state, including every generated image, each time it redraws.

## [1.3.0] - 2026-05-20

### Added

- **Recraft Vector SVG Models** - Native vector (SVG) generation from prompts via Recraft's image-output models
  - ⭐ Recraft V4.1 Pro Vector (now the default SVG model)
  - Recraft V4 Vector (budget tier)
  - Output is real `<svg>` markup, not raster traced to vectors
- **New Image Models**
  - Recraft raster: V4.1 Pro, V4 Pro, V4, V3 (text-to-image)
  - Grok Imagine (Image Quality) - xAI's image generation model
- **New SVG Text Models**
  - ⭐ Claude Opus 4.7 - now the top recommendation for high-quality SVG codegen
  - OpenAI GPT-5.4
  - Google Gemini Flash 3.5

### Fixed

- **Seedream 4.5 generation errors** - Was sending unsupported `image+text` output modalities, getting 404. Now correctly requests `image` only.
- **Gemini Flash 3.0 pricing** - Catalog had stale $0.15/$0.60, now correctly reflects $0.50/$3.00 per million tokens.
- **Claude Opus 4 mislabel** - Was displayed as "Claude Opus 4.5" but pointed to the different `claude-opus-4` model. Display name now matches the model.

### Changed

- **Default SVG model** is now Recraft V4.1 Pro Vector (was GPT-5.3 Codex). Existing users keep their current selection.
- **Refine** input on the SVG tab is automatically disabled when a Recraft vector model is selected, with a hint explaining that Recraft regenerates from scratch instead of iterating. Start a new generation to change the prompt.
- Recraft vector entries display "1:1 only" because Recraft ignores `aspect_ratio` for vector output. Raster Recraft models honor the aspect ratio normally.

### Removed

- **Stale catalog entries** with no live OpenRouter endpoints: Gemini 2.5 Flash Image Preview (image tab), Gemini Pro 3.0 (SVG tab).

---

## [1.2.3] - 2026-04-24

### Added

- **New Image Generation Model**
  - GPT-5.4 Image 2 (openai/gpt-5.4-image-2) - Latest OpenAI image model on OpenRouter

### Changed

- Updated Nano Banana 2 pricing metadata to match OpenRouter's current model API

---

## [1.2.2] - 2026-03-04

### Fixed

- **Gemini Image Continuation Reliability**
  - Preserves Gemini reasoning metadata and applies safe continuation fallback behavior when unsigned assistant image parts are returned
  - Prevents continuation failures caused by thought-signature validation in multi-turn image conversations

- **FLUX and Riverflow Request Compatibility**
  - Uses model-specific output modalities for OpenRouter image requests
  - FLUX and Sourceful Riverflow models now request image-only output instead of image+text, resolving 404 endpoint errors

---

## [1.2.1] - 2026-03-03

### Added

- **New Image Generation Model**
  - Nano Banana 2 (google/gemini-3.1-flash-image-preview) - Latest Gemini Flash image model, now the recommended default

- **New SVG Generation Models**
  - Gemini Pro 3.1 (google/gemini-3.1-pro-preview) - Latest Google Pro model
  - GPT-5.3 Codex (openai/gpt-5.3-codex) - Latest OpenAI coding model, now the default

### Changed

- Default image model updated from Nano Banana (Gemini 2.5 Flash) to Nano Banana 2 (Gemini 3.1 Flash)
- Default SVG model updated from GPT-5.2 Codex to GPT-5.3 Codex

---

## [1.2.0] - 2026-02-11

### Added

- **New Image Generation Models**
  - FLUX.2 Klein 4B (black-forest-labs/flux.2-klein-4b) - Fastest and cheapest FLUX.2 variant
  - Riverflow V2 Pro (sourceful/riverflow-v2-pro) - Top-tier GA Sourceful model
  - Riverflow V2 Fast (sourceful/riverflow-v2-fast) - Fast GA Sourceful model

- **New SVG Generation Models**
  - Claude Opus 4.6 (anthropic/claude-opus-4.6) - Latest Anthropic model, cheaper than Opus 4
  - GPT-5.2 Codex (openai/gpt-5.2-codex) - Latest OpenAI coding model, now the default

### Changed

- Default SVG model updated from GPT-5.1 Codex to GPT-5.2 Codex

---

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
