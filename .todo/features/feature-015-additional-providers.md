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

---

## Investigation Notes

### Replicate (Investigated: 2025-11-30)

**Status:** Researched - promising candidate

#### API Overview

| Aspect | Details |
|--------|---------|
| **Base URL** | `https://api.replicate.com/v1` |
| **Auth** | Bearer token: `Authorization: Bearer <token>` |
| **Rate Limits** | 600/min (predictions), 3000/min (other endpoints) |
| **Timeout** | 30 min max prediction runtime |
| **npm package** | `replicate` |

#### Key Differences from OpenRouter

| Feature | OpenRouter | Replicate |
|---------|------------|-----------|
| **Request Model** | Synchronous (chat/completions) | Async by default (create → poll) |
| **Image Output** | Base64 data URLs inline | HTTPS URLs requiring auth header to fetch |
| **Model Selection** | `model` field in request | `version` field with `owner/name` format |
| **Streaming** | SSE built-in | SSE via `stream: true` + separate URL |
| **Sync Mode** | Default | `Prefer: wait` header (60s timeout) |

#### Prediction Lifecycle

```
starting → processing → succeeded/failed/canceled/aborted
```

- Async predictions require polling `GET /predictions/{id}` or webhooks
- Can use `Prefer: wait` header for synchronous mode (60s timeout limit)

#### Image Input Handling

| Size | Method |
|------|--------|
| < 1MB | Base64 data URI (`data:image/png;base64,...`) |
| 1-100MB | Upload via library or pass hosted URL |
| Hosted files | Direct HTTP URLs accepted |

#### Popular Models for Our Use Cases

**Image Generation:**
- `black-forest-labs/flux-1.1-pro` - $0.04/image, supports aspect_ratio, seed, prompt_upsampling
- `black-forest-labs/flux-2-pro` - Latest FLUX with reference image support
- `bytedance/seedream-4` - Unified generation + editing

**Text/SVG Generation:**
- `meta/meta-llama-3-70b-instruct` - $0.65/1M input tokens, supports streaming
- Also exposes Claude, Gemini, GPT via their marketplace

#### Integration Considerations

**Pros:**
1. Huge model ecosystem (FLUX, Stable Diffusion variants, specialized models)
2. Per-model pricing transparency
3. Direct model access (no aggregator markup on some models)
4. Streaming for text models
5. Official npm package with good TypeScript support

**Cons:**
1. Async-first requires polling logic (adds complexity)
2. Image outputs are URLs, not inline base64 (need to fetch with auth)
3. No unified chat format (each model has its own input schema via OpenAPI)
4. Version management (models have explicit 64-char version IDs)

#### Architecture Impact

The `ProviderConfig` interface would need extensions:

```typescript
// For Replicate, extend ModelDefinition:
interface ReplicateModelDefinition extends ModelDefinition {
  versionId: string;  // Full 64-char version ID
  inputSchema?: object;  // OpenAPI schema per model (varies)
}
```

New client requirements:
1. **Prediction polling** or `Prefer: wait` for sync mode
2. **Image URL fetching** with auth headers for outputs
3. **Model-specific input formatting** (schemas vary by model)

#### Recommended Integration Approach

1. **Sync mode only** (`Prefer: wait` header) - simpler but 60s timeout limit
2. **Full async** - more robust, needs prediction polling infrastructure
3. **Hybrid** - sync for quick models, async for image generation (recommended)

#### Sample API Call

```typescript
// Create prediction (async)
const response = await fetch('https://api.replicate.com/v1/predictions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    version: 'black-forest-labs/flux-1.1-pro',
    input: {
      prompt: 'A pixel art castle',
      aspect_ratio: '16:9',
      output_format: 'png',
    }
  })
});

// Sync mode (add header, 60s timeout)
// 'Prefer': 'wait'
```

#### Sources

- [Replicate HTTP API Reference](https://replicate.com/docs/reference/http)
- [Replicate Node.js Guide](https://replicate.com/docs/get-started/nodejs)
- [Replicate Streaming](https://replicate.com/docs/topics/streaming)
- [FLUX 1.1 Pro Model](https://replicate.com/black-forest-labs/flux-1.1-pro)

---

### OpenAI Direct (Investigated: 2025-11-30)

**Status:** Researched - straightforward integration (very similar to OpenRouter)

#### Why OpenAI Direct?

1. **Familiar API** - Same format as OpenRouter (both OpenAI-compatible)
2. **Official TypeScript SDK** - `openai` npm package with full types
3. **DALL-E 3 + gpt-image-1** - Latest image generation models
4. **GPT-4o for SVG** - Strong reasoning for code generation
5. **Direct access** - No proxy/aggregator, potentially lower latency

#### API Overview

| Aspect | Details |
|--------|---------|
| **Base URL** | `https://api.openai.com/v1` |
| **Auth** | Bearer token: `Authorization: Bearer sk-****` |
| **npm package** | `openai` (official) |
| **Image Endpoint** | `POST /v1/images/generations` |
| **Chat Endpoint** | `POST /v1/chat/completions` |

#### Key Differences from OpenRouter

| Feature | OpenRouter | OpenAI Direct |
|---------|------------|---------------|
| **Models** | Multi-provider (OpenAI, Anthropic, etc.) | OpenAI only |
| **Image Format** | Base64 inline | URL or base64 (configurable) |
| **Image Models** | Gemini, FLUX, etc. | DALL-E 3, gpt-image-1 |
| **Pricing** | Markup on provider rates | Direct OpenAI rates |
| **API Format** | OpenAI-compatible | OpenAI native |

#### Image Generation

**Models available:**

| Model | Sizes | Quality | Style | Price |
|-------|-------|---------|-------|-------|
| `dall-e-3` | 1024², 1792×1024, 1024×1792 | standard, hd | vivid, natural | $0.04-$0.12/img |
| `gpt-image-1` | Up to 4096² | low, medium, high | - | Token-based |
| `dall-e-2` | 256², 512², 1024² | - | - | $0.016-$0.02/img |

**Request format:**

```typescript
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// DALL-E 3
const response = await client.images.generate({
  model: 'dall-e-3',
  prompt: 'A pixel art castle at sunset',
  n: 1,
  size: '1024x1024',
  quality: 'hd',           // 'standard' or 'hd'
  style: 'vivid',          // 'vivid' or 'natural'
  response_format: 'b64_json',  // 'url' or 'b64_json'
});

const base64 = response.data[0].b64_json;
// OR if using 'url' format:
// const url = response.data[0].url;  // Valid for 60 minutes only!
```

**gpt-image-1 (newer model):**

```typescript
const response = await client.images.generate({
  model: 'gpt-image-1',
  prompt: 'A detailed landscape painting',
  size: '1024x1024',
  quality: 'high',         // 'low', 'medium', 'high'
  output_format: 'png',    // Always returns base64
});

const base64 = response.data[0].b64_json;
```

#### Chat Completions (for SVG)

**Identical to OpenRouter:**

```typescript
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are an SVG generator.' },
    { role: 'user', content: 'Create an SVG of a red circle' }
  ],
  max_tokens: 4096,
  temperature: 0.7,
});

const svgCode = response.choices[0].message.content;

// Streaming
const stream = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

#### Image Parameters

| Parameter | DALL-E 3 | gpt-image-1 | Description |
|-----------|----------|-------------|-------------|
| `prompt` | ✓ | ✓ | Text description (required) |
| `n` | 1 only | 1 only | Number of images |
| `size` | 1024², 1792×1024, 1024×1792 | Up to 4096² | Output dimensions |
| `quality` | standard, hd | low, medium, high | Quality level |
| `style` | vivid, natural | ✗ | Artistic style |
| `response_format` | url, b64_json | ✗ (always b64) | Output format |

**Note:** DALL-E 3 only supports `n=1` (one image per request).

#### Error Handling

```typescript
import OpenAI from 'openai';

try {
  const response = await client.images.generate({...});
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    console.error('Status:', error.status);      // HTTP status
    console.error('Message:', error.message);    // Error message
    console.error('Code:', error.code);          // Error code
    console.error('Type:', error.type);          // Error type
  }
}
```

Error types:
- `OpenAI.BadRequestError` (400)
- `OpenAI.AuthenticationError` (401)
- `OpenAI.PermissionDeniedError` (403)
- `OpenAI.NotFoundError` (404)
- `OpenAI.RateLimitError` (429)
- `OpenAI.InternalServerError` (500+)

#### Architecture Impact

**Minimal changes** - almost identical to OpenRouter:

```typescript
export class OpenAIImageClient implements ImageGenerationClient {
  private client: OpenAI;

  constructor(
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService
  ) {}

  async generateImages(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const apiKey = await this.secretStorage.getSecret('openai.apiKey');
    this.client = new OpenAI({ apiKey });

    const response = await this.client.images.generate({
      model: request.model,  // 'dall-e-3' or 'gpt-image-1'
      prompt: request.prompt,
      n: 1,
      size: this.mapAspectRatioToSize(request.aspectRatio),
      quality: request.advanced?.quality ?? 'standard',
      style: request.advanced?.style ?? 'vivid',
      response_format: 'b64_json',  // Always use base64 for consistency
    });

    const base64 = response.data[0].b64_json;

    return {
      images: [{
        data: `data:image/png;base64,${base64}`,
        mimeType: 'image/png',
      }],
      seed: 0,  // OpenAI doesn't expose seed
    };
  }

  private mapAspectRatioToSize(aspectRatio: string): string {
    // DALL-E 3 sizes
    switch (aspectRatio) {
      case '16:9': return '1792x1024';
      case '9:16': return '1024x1792';
      default: return '1024x1024';
    }
  }
}
```

#### Integration Considerations

**Pros:**

1. **Near-identical to OpenRouter** - Minimal code changes
2. **Official SDK** - Well-maintained, full TypeScript support
3. **Base64 option** - No need to fetch URLs (use `response_format: 'b64_json'`)
4. **Direct pricing** - No aggregator markup
5. **gpt-image-1** - Access to newest image model (4096² resolution)

**Cons:**

1. **OpenAI models only** - No FLUX, Gemini, etc.
2. **No seed support** - Can't reproduce exact images
3. **n=1 limit** - DALL-E 3 only generates one image per request
4. **URL expiry** - If using URL format, only valid for 60 minutes
5. **Separate API key** - Users need both OpenRouter and OpenAI keys

#### Comparison: OpenAI vs OpenRouter vs Hugging Face

| Aspect | OpenAI Direct | OpenRouter | Hugging Face |
|--------|---------------|------------|--------------|
| **Complexity** | Low | Low | Low |
| **Image Models** | DALL-E 3, gpt-image-1 | Gemini, FLUX, DALL-E | FLUX, SDXL, + LoRAs |
| **Text Models** | GPT-4o, o1, etc. | All providers | Llama, Qwen, etc. |
| **Image Output** | Base64 or URL | Base64 | Blob |
| **Seed Support** | ✗ | ✓ | ✓ |
| **LoRA Support** | ✗ | ✗ | ✓ |
| **Free Tier** | ✗ | ✗ | $0.10/month |
| **Best For** | GPT + DALL-E users | Multi-provider access | Open models + LoRAs |

#### Sources

- [OpenAI Node.js Library](https://github.com/openai/openai-node)
- [OpenAI Image Generation Guide](https://platform.openai.com/docs/guides/image-generation)
- [gpt-image-1 Model](https://platform.openai.com/docs/models/gpt-image-1)
- [OpenAI Cookbook - Image Generation](https://cookbook.openai.com/examples/generate_images_with_gpt_image)
- [DALL-E 3 API Guide](https://help.openai.com/en/articles/8555480-dall-e-3-api)

---

### Hugging Face (Investigated: 2025-11-30)

**Status:** Researched - **RECOMMENDED** as first additional provider

#### Why Hugging Face First?

1. **Simpler than Replicate** - Synchronous responses, no polling needed
2. **Official TypeScript SDK** - `@huggingface/inference` with full types
3. **OpenAI-compatible** - Chat completions use familiar format
4. **18+ providers unified** - Including Replicate! (can access Replicate models through HF)
5. **Image returns Blob** - Easier to convert to base64 than fetching URLs

#### API Overview

| Aspect | Details |
|--------|---------|
| **Base URL** | `https://router.huggingface.co/v1` (OpenAI-compat) |
| **Serverless URL** | `https://api-inference.huggingface.co/models/{model}` |
| **Auth** | Bearer token: `Authorization: Bearer hf_****` |
| **npm package** | `@huggingface/inference` |
| **Free Tier** | $0.10/month credits (PRO: $2.00/month + pay-as-you-go) |

#### Key Differences from OpenRouter

| Feature | OpenRouter | Hugging Face |
|---------|------------|--------------|
| **Request Model** | Synchronous | Synchronous (same!) |
| **Image Output** | Base64 data URLs | Raw bytes (Blob) |
| **Model Selection** | `model` field | `model` field (same!) |
| **Streaming** | SSE built-in | SSE built-in (same!) |
| **Provider Routing** | Single provider | 18+ providers with auto-routing |

#### Inference Providers (18+)

HF acts as a **unified gateway** to multiple providers:

| Provider | Chat (LLM) | Chat (VLM) | Image Gen | Speech |
|----------|------------|------------|-----------|--------|
| Cerebras | ✓ | | | |
| Fal AI | | | ✓ | ✓ |
| Fireworks | ✓ | ✓ | | |
| Groq | ✓ | ✓ | | |
| HF Inference | ✓ | ✓ | ✓ | |
| Nebius | ✓ | ✓ | ✓ | |
| **Replicate** | | | ✓ | ✓ |
| Together | ✓ | ✓ | ✓ | |
| + 10 more... | | | | |

**Key insight**: Adding HF gives indirect access to Replicate models too!

#### Image Generation

**Response format**: Raw bytes (Blob), not base64 or URL

```typescript
import { InferenceClient } from '@huggingface/inference';

const client = new InferenceClient(process.env.HF_TOKEN);

// Generate image - returns Blob
const imageBlob = await client.textToImage({
  model: 'black-forest-labs/FLUX.1-dev',
  inputs: 'A pixel art castle at sunset',
  parameters: {
    width: 1024,
    height: 1024,
    guidance_scale: 7.5,
    negative_prompt: 'blurry, low quality',
    seed: 12345,
  }
});

// Convert Blob to base64 for our existing infrastructure
const buffer = Buffer.from(await imageBlob.arrayBuffer());
const base64 = `data:image/png;base64,${buffer.toString('base64')}`;
```

**With provider routing**:
```typescript
await client.textToImage({
  provider: 'replicate',  // or 'fal-ai', 'together', etc.
  model: 'black-forest-labs/FLUX.1-dev',
  inputs: 'A pixel art castle',
});
```

#### Text/Chat Generation

**OpenAI-compatible format**:
```typescript
const response = await client.chatCompletion({
  model: 'Qwen/Qwen3-32B',
  provider: 'cerebras',  // optional - auto-routes if omitted
  messages: [
    { role: 'system', content: 'You are a helpful SVG generator.' },
    { role: 'user', content: 'Create an SVG of a red circle' }
  ],
  max_tokens: 4096,
  temperature: 0.7,
});

// Streaming
for await (const chunk of client.chatCompletionStream({...})) {
  process.stdout.write(chunk.choices[0].delta.content || '');
}
```

#### Image Input Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `inputs` | string | Text prompt (required) |
| `width` | number | Output width in pixels |
| `height` | number | Output height in pixels |
| `guidance_scale` | number | Prompt adherence (higher = stronger) |
| `negative_prompt` | string | What to exclude |
| `num_inference_steps` | number | Quality/speed tradeoff |
| `seed` | number | For reproducibility |
| `scheduler` | string | Alternative scheduler |

#### Error Handling

Built-in TypeScript error classes:
```typescript
import {
  InferenceClientError,           // Base class
  InferenceClientInputError,      // Bad parameters
  InferenceClientProviderApiError, // Provider API failure
  InferenceClientHubApiError,     // Hub API failure
  InferenceClientProviderOutputError // Malformed response
} from '@huggingface/inference';

try {
  await client.textToImage({...});
} catch (error) {
  if (error instanceof InferenceClientProviderApiError) {
    console.error('Provider error:', error.message);
  }
}
```

#### Popular Models for Our Use Cases

**Image Generation:**
- `black-forest-labs/FLUX.1-dev` - State-of-the-art diffusion
- `black-forest-labs/FLUX.1-Krea-dev` - Creative variant
- `stabilityai/stable-diffusion-xl-base-1.0` - SDXL
- `ByteDance/SDXL-Lightning` - Fast SDXL

**Text/SVG Generation:**
- `Qwen/Qwen3-32B` - Strong reasoning
- `meta-llama/Llama-3-70b-chat-hf` - Meta's flagship
- `google/gemma-2-27b-it` - Google's open model
- `deepseek-ai/DeepSeek-R1` - Reasoning model

#### Architecture Impact

**Minimal changes needed** - HF is more similar to OpenRouter:

```typescript
// New client - follows existing pattern closely
export class HuggingFaceImageClient implements ImageGenerationClient {
  private client: InferenceClient;

  constructor(
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService
  ) {}

  async generateImages(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const token = await this.secretStorage.getSecret('huggingface.apiKey');
    this.client = new InferenceClient(token);

    const blob = await this.client.textToImage({
      model: request.model,
      inputs: request.prompt,
      parameters: {
        width: this.getWidth(request.aspectRatio),
        height: this.getHeight(request.aspectRatio),
        seed: request.seed,
      }
    });

    // Convert Blob to base64 (matches our existing format)
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

    return {
      images: [{ data: base64, mimeType: 'image/png' }],
      seed: request.seed ?? 0,
    };
  }
}
```

#### Integration Considerations

**Pros:**
1. **Synchronous by default** - No polling infrastructure needed
2. **Official TypeScript SDK** - Full types, good DX
3. **OpenAI-compatible chat** - Minimal changes to text client
4. **Provider abstraction** - Access 18+ providers with one API key
5. **Image returns Blob** - Easy conversion to base64
6. **Free tier available** - $0.10/month for testing
7. **Includes Replicate** - Get Replicate models "for free"

**Cons:**
1. **Blob → base64 conversion** - Small overhead (but straightforward)
2. **Credit-based free tier** - May need PRO for heavy usage
3. **Provider availability varies** - Not all models on all providers
4. **No aspect_ratio param** - Must calculate width/height ourselves

#### Recommended Integration Approach

1. **Phase 1**: Add `HuggingFaceImageClient` for image generation
   - Use `@huggingface/inference` SDK
   - Convert Blob responses to base64
   - Map aspect ratios to width/height

2. **Phase 2**: Add `HuggingFaceDynamicTextClient` for SVG
   - Use OpenAI-compatible chat endpoint
   - Reuse existing message format

3. **Phase 3**: Provider routing UI
   - Let users select preferred provider (auto/fastest/cheapest)
   - Store provider preference in settings

#### Comparison: Hugging Face vs Replicate

| Aspect | Hugging Face | Replicate |
|--------|--------------|-----------|
| **Complexity** | Low (sync) | Medium (async/polling) |
| **SDK Quality** | Excellent | Good |
| **Image Output** | Blob (easy) | URL (needs fetch) |
| **Chat Format** | OpenAI-compat | Model-specific |
| **Free Tier** | $0.10/month | None |
| **Model Access** | 18+ providers | Direct only |
| **Recommended** | **Yes - start here** | Later addition |

#### LoRA Support

HF supports LoRA adapters for style customization:

**Approach 1: Reference LoRA model directly**

```typescript
await client.textToImage({
  model: 'username/my-flux-lora',  // LoRA model ID from Hub
  inputs: 'a portrait in anime style',
  provider: 'fal-ai',  // or 'replicate', 'together'
});
```

**Approach 2: Provider-specific params (more control)**

```typescript
// Together AI example
await client.textToImage({
  model: 'black-forest-labs/FLUX.1-dev-lora',
  inputs: 'a portrait',
  provider: 'together',
  extra_body: {
    image_loras: [
      { path: 'https://huggingface.co/user/lora-model', scale: 1.0 }
    ]
  }
});
```

**Provider LoRA Support:**

| Provider | LoRA Support | Notes |
|----------|--------------|-------|
| fal-ai | ✓ | Fast LoRA inference, FLUX LoRAs |
| Replicate | ✓ | Wide LoRA ecosystem |
| Together | ✓ | Explicit `image_loras` array |
| HF Inference | ✓ | Dynamic loading from Hub |

**Finding LoRAs:**

- [FLUX.1-dev LoRAs](https://huggingface.co/models?other=base_model:adapter:black-forest-labs/FLUX.1-dev)
- [SDXL LoRAs](https://huggingface.co/models?other=base_model:adapter:stabilityai/stable-diffusion-xl-base-1.0)

#### Auto-Routing

HF automatically routes requests to the best available provider:

```typescript
// These are equivalent - auto is the default
await client.textToImage({
  model: 'black-forest-labs/FLUX.1-dev',
  inputs: 'A castle',
});

await client.textToImage({
  model: 'black-forest-labs/FLUX.1-dev',
  inputs: 'A castle',
  provider: 'auto',  // explicit default
});
```

**How it works:**

1. **Model → Provider Lookup**: HF maintains mapping of which providers support each model
2. **Preference Order**: Routes to first available provider based on account settings
3. **Automatic Failover**: If provider A is down, tries B, C, etc.

**Multi-provider models:**

| Model | Available Providers |
|-------|---------------------|
| `black-forest-labs/FLUX.1-dev` | fal-ai, replicate, together, nebius |
| `meta-llama/Llama-3.3-70B-Instruct` | 10+ providers |
| `Qwen/Qwen3-32B` | cerebras, novita, nebius, fireworks |

**Override when needed:**

```typescript
// Force specific provider
await client.textToImage({
  model: 'black-forest-labs/FLUX.1-dev',
  inputs: 'A castle',
  provider: 'fal-ai',  // or 'replicate', 'together'
});
```

**For our integration:** Just pass the model - HF handles routing. Optional "preferred provider" dropdown in advanced settings for power users.

#### Sources

- [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers/en/index)
- [Hugging Face JS SDK](https://huggingface.co/docs/huggingface.js/en/inference/README)
- [GitHub: huggingface.js](https://github.com/huggingface/huggingface.js)
- [Text-to-Image Task](https://huggingface.co/docs/inference-providers/en/tasks/text-to-image)
- [LoRA Dynamic Loading](https://huggingface.co/blog/lora-adapters-dynamic-loading)
- [Together AI FLUX LoRAs](https://www.together.ai/blog/generate-images-with-specific-styles-using-flux-loras-on-together-ai)

---

## Cross-Provider Design: Advanced Settings

### Problem

Different providers support different parameters:

| Parameter | OpenRouter | Hugging Face | Replicate |
|-----------|------------|--------------|-----------|
| `negative_prompt` | ✗ | ✓ | ✓ |
| `guidance_scale` | ✗ | ✓ | ✓ |
| `num_inference_steps` | ✗ | ✓ | ✓ |
| `scheduler` | ✗ | ✓ | ✓ |
| `seed` | ✓ | ✓ | ✓ |
| `aspect_ratio` | ✓ | ✗ (width/height) | ✓ |
| `lora` | ✗ | ✓ | ✓ |

### Proposed Solution: Provider Capabilities + Conditional UI

#### 1. Provider Capabilities Interface

```typescript
// src/shared/types/providers.ts

export interface ProviderCapabilities {
  // Image generation capabilities
  image: {
    supportsNegativePrompt: boolean;
    supportsGuidanceScale: boolean;
    supportsInferenceSteps: boolean;
    supportsScheduler: boolean;
    supportsSeed: boolean;
    supportsAspectRatio: boolean;  // vs width/height
    supportsLoRA: boolean;
    supportsImageInput: boolean;   // img2img

    // Parameter ranges (for validation/UI)
    guidanceScaleRange?: { min: number; max: number; default: number };
    inferenceStepsRange?: { min: number; max: number; default: number };
    schedulers?: string[];  // Available scheduler options
  };

  // Text generation capabilities
  text: {
    supportsStreaming: boolean;
    supportsSystemPrompt: boolean;
    maxTokens: number;
  };
}

export interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  models: Record<GenerationType, ModelDefinition[]>;
  capabilities: ProviderCapabilities;  // NEW
}
```

#### 2. Example Provider Configs

```typescript
export const OPENROUTER_CONFIG: ProviderConfig = {
  id: 'openrouter',
  displayName: 'OpenRouter',
  capabilities: {
    image: {
      supportsNegativePrompt: false,
      supportsGuidanceScale: false,
      supportsInferenceSteps: false,
      supportsScheduler: false,
      supportsSeed: true,
      supportsAspectRatio: true,
      supportsLoRA: false,
      supportsImageInput: true,
    },
    text: {
      supportsStreaming: true,
      supportsSystemPrompt: true,
      maxTokens: 48000,
    }
  },
  // ...models
};

export const HUGGINGFACE_CONFIG: ProviderConfig = {
  id: 'huggingface',
  displayName: 'Hugging Face',
  capabilities: {
    image: {
      supportsNegativePrompt: true,
      supportsGuidanceScale: true,
      supportsInferenceSteps: true,
      supportsScheduler: true,
      supportsSeed: true,
      supportsAspectRatio: false,  // uses width/height
      supportsLoRA: true,
      supportsImageInput: true,
      guidanceScaleRange: { min: 1, max: 20, default: 7.5 },
      inferenceStepsRange: { min: 1, max: 100, default: 30 },
      schedulers: ['DDIM', 'DPMSolver', 'EulerDiscrete', 'PNDM'],
    },
    text: {
      supportsStreaming: true,
      supportsSystemPrompt: true,
      maxTokens: 32000,
    }
  },
  // ...models
};
```

#### 3. UI Component: AdvancedSettings

```tsx
// src/presentation/webview/components/image/AdvancedSettings.tsx

interface AdvancedSettingsProps {
  capabilities: ProviderCapabilities['image'];
  settings: AdvancedImageSettings;
  onChange: (settings: AdvancedImageSettings) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export interface AdvancedImageSettings {
  negativePrompt?: string;
  guidanceScale?: number;
  inferenceSteps?: number;
  scheduler?: string;
  loraModel?: string;
  loraScale?: number;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  capabilities,
  settings,
  onChange,
  isExpanded,
  onToggle,
}) => {
  // Don't render button if no advanced features available
  const hasAdvancedFeatures =
    capabilities.supportsNegativePrompt ||
    capabilities.supportsGuidanceScale ||
    capabilities.supportsInferenceSteps ||
    capabilities.supportsScheduler ||
    capabilities.supportsLoRA;

  if (!hasAdvancedFeatures) {
    return null;
  }

  return (
    <div className="advanced-settings">
      <button
        className="advanced-toggle"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span>Advanced Settings</span>
        <ChevronIcon direction={isExpanded ? 'up' : 'down'} />
      </button>

      {isExpanded && (
        <div className="advanced-panel">
          {/* Negative Prompt */}
          {capabilities.supportsNegativePrompt && (
            <div className="setting-row">
              <label>Negative Prompt</label>
              <textarea
                value={settings.negativePrompt ?? ''}
                onChange={(e) => onChange({
                  ...settings,
                  negativePrompt: e.target.value
                })}
                placeholder="blurry, low quality, distorted..."
              />
            </div>
          )}

          {/* Guidance Scale */}
          {capabilities.supportsGuidanceScale && (
            <div className="setting-row">
              <label>
                Guidance Scale
                <span className="value">{settings.guidanceScale ?? capabilities.guidanceScaleRange?.default}</span>
              </label>
              <input
                type="range"
                min={capabilities.guidanceScaleRange?.min ?? 1}
                max={capabilities.guidanceScaleRange?.max ?? 20}
                step={0.5}
                value={settings.guidanceScale ?? capabilities.guidanceScaleRange?.default ?? 7.5}
                onChange={(e) => onChange({
                  ...settings,
                  guidanceScale: parseFloat(e.target.value)
                })}
              />
            </div>
          )}

          {/* Inference Steps */}
          {capabilities.supportsInferenceSteps && (
            <div className="setting-row">
              <label>
                Inference Steps
                <span className="value">{settings.inferenceSteps ?? capabilities.inferenceStepsRange?.default}</span>
              </label>
              <input
                type="range"
                min={capabilities.inferenceStepsRange?.min ?? 1}
                max={capabilities.inferenceStepsRange?.max ?? 100}
                value={settings.inferenceSteps ?? capabilities.inferenceStepsRange?.default ?? 30}
                onChange={(e) => onChange({
                  ...settings,
                  inferenceSteps: parseInt(e.target.value)
                })}
              />
            </div>
          )}

          {/* Scheduler */}
          {capabilities.supportsScheduler && capabilities.schedulers?.length && (
            <div className="setting-row">
              <label>Scheduler</label>
              <select
                value={settings.scheduler ?? ''}
                onChange={(e) => onChange({
                  ...settings,
                  scheduler: e.target.value || undefined
                })}
              >
                <option value="">Default</option>
                {capabilities.schedulers.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {/* LoRA Model */}
          {capabilities.supportsLoRA && (
            <div className="setting-row">
              <label>LoRA Model (Hub ID)</label>
              <input
                type="text"
                value={settings.loraModel ?? ''}
                onChange={(e) => onChange({
                  ...settings,
                  loraModel: e.target.value || undefined
                })}
                placeholder="username/my-lora-model"
              />
              {settings.loraModel && (
                <>
                  <label>
                    LoRA Scale
                    <span className="value">{settings.loraScale ?? 1.0}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={settings.loraScale ?? 1.0}
                    onChange={(e) => onChange({
                      ...settings,
                      loraScale: parseFloat(e.target.value)
                    })}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

#### 4. Integration in ImageView

```tsx
// In ImageView.tsx

const ImageView: React.FC<ImageViewProps> = ({ ... }) => {
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedImageSettings>({});

  // Get current provider's capabilities
  const providerCapabilities = useMemo(() => {
    return getProviderConfig(selectedProvider).capabilities.image;
  }, [selectedProvider]);

  // Reset advanced settings when provider changes (capabilities differ)
  useEffect(() => {
    setAdvancedSettings({});
  }, [selectedProvider]);

  return (
    <div className="image-view">
      {/* ... existing controls ... */}

      {/* Advanced Settings - only shows if provider has advanced features */}
      <AdvancedSettings
        capabilities={providerCapabilities}
        settings={advancedSettings}
        onChange={setAdvancedSettings}
        isExpanded={advancedExpanded}
        onToggle={() => setAdvancedExpanded(!advancedExpanded)}
      />

      {/* ... generate button, results, etc ... */}
    </div>
  );
};
```

#### 5. Message Payload Extension

```typescript
// src/shared/types/messages/imageGeneration.ts

export interface ImageGenerationRequestPayload {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  seed?: number;
  referenceImages?: string[];
  conversationId?: string;

  // Advanced settings (provider-dependent)
  advanced?: {
    negativePrompt?: string;
    guidanceScale?: number;
    inferenceSteps?: number;
    scheduler?: string;
    loraModel?: string;
    loraScale?: number;
  };
}
```

#### 6. Client Implementation

```typescript
// In HuggingFaceImageClient.ts

async generateImages(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const params: Record<string, unknown> = {
    width: this.getWidth(request.aspectRatio),
    height: this.getHeight(request.aspectRatio),
  };

  // Only include supported params
  if (request.seed !== undefined) {
    params.seed = request.seed;
  }
  if (request.advanced?.negativePrompt) {
    params.negative_prompt = request.advanced.negativePrompt;
  }
  if (request.advanced?.guidanceScale !== undefined) {
    params.guidance_scale = request.advanced.guidanceScale;
  }
  if (request.advanced?.inferenceSteps !== undefined) {
    params.num_inference_steps = request.advanced.inferenceSteps;
  }
  if (request.advanced?.scheduler) {
    params.scheduler = request.advanced.scheduler;
  }

  const blob = await this.client.textToImage({
    model: request.advanced?.loraModel ?? request.model,
    inputs: request.prompt,
    parameters: params,
  });

  // ... convert blob to base64 ...
}
```

### Benefits of This Approach

1. **Type-safe** - Capabilities are part of `ProviderConfig`, TypeScript catches mismatches
2. **Self-documenting** - UI automatically reflects what's available
3. **No dead UI** - Advanced button hidden when provider has no advanced features
4. **Graceful degradation** - OpenRouter users see simpler UI, HF users get full control
5. **Extensible** - Adding new providers or capabilities is straightforward
6. **Consistent UX** - Same component across Image and SVG tabs

### UI Mockup

```
┌─────────────────────────────────────────┐
│ [Model Dropdown    ▾] [Aspect ▾] [Seed] │
├─────────────────────────────────────────┤
│ [Prompt textarea                      ] │
│ [                                     ] │
├─────────────────────────────────────────┤
│ ▶ Advanced Settings                     │  ← Collapsed by default
├─────────────────────────────────────────┤
│ [Generate]                              │
└─────────────────────────────────────────┘

When expanded (Hugging Face selected):

┌─────────────────────────────────────────┐
│ [Model Dropdown    ▾] [Aspect ▾] [Seed] │
├─────────────────────────────────────────┤
│ [Prompt textarea                      ] │
├─────────────────────────────────────────┤
│ ▼ Advanced Settings                     │
│ ┌─────────────────────────────────────┐ │
│ │ Negative Prompt                     │ │
│ │ [blurry, low quality...           ] │ │
│ │                                     │ │
│ │ Guidance Scale           [7.5]     │ │
│ │ ─────────●─────────────────        │ │
│ │                                     │ │
│ │ Inference Steps          [30]      │ │
│ │ ───────────●───────────────        │ │
│ │                                     │ │
│ │ Scheduler                          │ │
│ │ [DPMSolver                     ▾]  │ │
│ │                                     │ │
│ │ LoRA Model (Hub ID)                │ │
│ │ [username/my-style-lora         ]  │ │
│ │ LoRA Scale               [1.0]     │ │
│ │ ─────────────●─────────────        │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [Generate]                              │
└─────────────────────────────────────────┘

When OpenRouter selected (no advanced features):

┌─────────────────────────────────────────┐
│ [Model Dropdown    ▾] [Aspect ▾] [Seed] │
├─────────────────────────────────────────┤
│ [Prompt textarea                      ] │
├─────────────────────────────────────────┤
│                                         │  ← No Advanced Settings button
├─────────────────────────────────────────┤
│ [Generate]                              │
└─────────────────────────────────────────┘
```
