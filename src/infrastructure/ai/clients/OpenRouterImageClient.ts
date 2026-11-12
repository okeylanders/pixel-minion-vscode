// Ported from frame-minion@40e7949 packages/core/src/infrastructure/ai/clients/OpenRouterImageClient.ts; keep in sync
/**
 * OpenRouter image generation with catalog-selected wire adapters.
 *
 * The mode and the model's route capabilities (ImageGenerationModes.ts)
 * choose the endpoint: Single Shot goes to the dedicated Image API, a
 * Conversation to `/chat/completions`. Everything the route can't take
 * (reference counts and formats, an unsupported ratio or resolution, a
 * Conversation on a model without a verified route) is refused here, before
 * the provider is called. One request goes to one endpoint: a provider failure
 * is reported, never retried on the other (billable) endpoint.
 *
 * Pixel deltas from Frame: Pixel's `HTTP-Referer` / `X-Title`; the debug log
 * keeps the assistant-message signature diagnostics for Conversation; and a
 * failure says why, with the provider's `error.message` (one plain line, at
 * most 300 characters, the API key masked), including a 200 response that
 * carries an error and no images.
 */
import {
  ImageGenerationClient,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageConversationMessage,
  GeneratedImageData,
} from './ImageGenerationClient';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';
import { imageRouteCapabilities } from '../../../shared/models';
import type { AspectRatio, ImageResolution } from '@messages';
import { openRouterImageTransport } from './OpenRouterImageTransport';

/** The longest provider reason a user-facing error carries. */
const MAX_PROVIDER_REASON_CHARS = 300;
/** Control characters, and the invisible or direction-changing ones that could disguise a message. */
function isUnprintable(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0xad || code === 0x61c || code === 0x180e ||
    (code >= 0x200b && code <= 0x200f) || (code >= 0x2028 && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2069) || code === 0xfeff;
}

/**
 * The provider's own explanation (the body's `error.message`) as one line of
 * plain text short enough for an error banner, or undefined when the body has
 * none. Nothing else from the response, and nothing from the request, is
 * shown; the API key is masked in case a provider echoes it.
 */
export function providerErrorReason(body: unknown, apiKey: string): string | undefined {
  const error = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  const message = error && typeof error === 'object' ? (error as { message?: unknown }).message : undefined;
  if (typeof message !== 'string') return undefined;
  // Bound the work before cleaning; only the first few hundred characters are shown.
  const masked = (apiKey ? message.split(apiKey).join('[redacted]') : message).slice(0, 4 * MAX_PROVIDER_REASON_CHARS);
  const line = Array.from(masked, character => (isUnprintable(character.codePointAt(0) ?? 0) ? ' ' : character))
    .join('').replace(/\s+/g, ' ').trim();
  if (!line) return undefined;
  const characters = Array.from(line);
  return characters.length > MAX_PROVIDER_REASON_CHARS
    ? `${characters.slice(0, MAX_PROVIDER_REASON_CHARS - 1).join('').trimEnd()}…`
    : line;
}

function withReason(message: string, reason: string | undefined): Error {
  return new Error(reason ? `${message} — ${reason}` : message);
}

export class OpenRouterImageClient implements ImageGenerationClient {
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor(
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService
  ) {}

  async isConfigured(): Promise<boolean> {
    return this.secretStorage.hasApiKey();
  }

  async generateImages(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const apiKey = await this.secretStorage.getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
    }

    // The Image API takes one prompt and its current image references. The
    // orchestrator supplies prior output as references for a continuation.
    const userMessage = [...request.messages].reverse().find(message => message.role === 'user');
    if (!userMessage) {
      throw new Error('Image generation request has no user prompt');
    }
    const mode = request.mode;
    if (mode !== 'edit' && mode !== 'conversation') throw new Error('Unknown image generation mode');
    const capabilities = imageRouteCapabilities(request.model, mode);
    if (!capabilities) {
      throw new Error(mode === 'conversation'
        ? 'This model has no verified Conversation route. Choose another model or use Single Shot.'
        : 'Choose an image model first.');
    }
    const referenceCount = userMessage.content.filter(block => block.type === 'image_url').length;
    const referenceLimits = capabilities.referenceImages;
    if (referenceLimits && (referenceCount < referenceLimits.min || referenceCount > referenceLimits.max)) {
      throw new Error(`This model accepts ${referenceLimits.min === referenceLimits.max ? referenceLimits.min : `${referenceLimits.min}–${referenceLimits.max}`} reference images; received ${referenceCount}.`);
    }
    if (capabilities.referenceMimeTypes) {
      for (const block of userMessage.content.filter(block => block.type === 'image_url')) {
        const mime = /^data:(image\/[^;,]+)[;,]/i.exec(block.image_url?.url ?? '')?.[1]?.toLowerCase();
        const normalizedMime = mime === 'image/jpg' ? 'image/jpeg' : mime;
        if (!normalizedMime || !capabilities.referenceMimeTypes.includes(normalizedMime as typeof capabilities.referenceMimeTypes[number])) {
          throw new Error('This model requires PNG, JPEG, or WebP reference images.');
        }
      }
    }
    if (!capabilities.supportedAspectRatios.includes(request.aspectRatio as AspectRatio)) throw new Error('Aspect ratio is not supported in this mode');
    if (request.resolution && request.resolution !== 'auto' && !capabilities.supportedResolutions.includes(request.resolution as Exclude<ImageResolution, 'auto'>)) throw new Error('Resolution is not supported in this mode');
    const transport = openRouterImageTransport(capabilities);
    const supportsSeed = capabilities.supportsSeed;
    const supportedRequest = { ...request, seed: supportsSeed ? request.seed : undefined, resolution: request.resolution === 'auto' ? undefined : request.resolution };

    this.logger.debug('Calling OpenRouter image generation', {
      endpoint: transport.path,
      mode,
      model: request.model,
      aspectRatio: request.aspectRatio,
      resolution: request.resolution,
      seed: supportedRequest.seed,
      inputReferenceCount: referenceCount,
      ...(mode === 'conversation' ? {
        messageCount: request.messages.length,
        assistantMessageDiagnostics: this.getAssistantMessageDiagnostics(request.messages),
      } : {}),
    });

    const response = await fetch(`${this.baseUrl}${transport.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/pixel-minion-vscode',
        'X-Title': 'Pixel Minion VS Code Extension',
      },
      body: JSON.stringify(transport.buildBody(supportedRequest, userMessage, capabilities)),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenRouter image generation error: ${response.status} ${errorText}`);
      let errorBody: unknown;
      try { errorBody = JSON.parse(errorText); } catch { errorBody = undefined; }
      throw withReason(`OpenRouter image generation error: ${response.status} ${response.statusText}`, providerErrorReason(errorBody, apiKey));
    }

    const result = await response.json();
    // A 200 can still carry an error instead of images; say what it was.
    const reason = providerErrorReason(result, apiKey);
    let images: GeneratedImageData[];
    try {
      images = transport.parseImages(result, this.logger);
    } catch (error) {
      throw withReason(error instanceof Error ? error.message : String(error), reason);
    }
    if (images.length === 0) throw withReason('Failed to parse images from OpenRouter response', reason);
    return {
      ...this.parseResponse(result, images, supportedRequest.seed),
      seedSupported: supportsSeed,
      ...(mode === 'conversation' ? { assistantMessage: transport.assistantMessage?.(result) } : {}),
    };
  }

  private parseResponse(result: any, images: ImageGenerationResult['images'], requestedSeed?: number): ImageGenerationResult {
    const promptTokens = result.usage?.native_tokens_prompt ?? result.usage?.prompt_tokens ?? 0;
    const completionTokens = result.usage?.native_tokens_completion ?? result.usage?.completion_tokens ?? 0;
    const hasNativeUsage = result.usage?.native_tokens_prompt !== undefined || result.usage?.native_tokens_completion !== undefined;
    return {
      images,
      seed: requestedSeed ?? 0,
      usage: result.usage ? {
        promptTokens,
        completionTokens,
        totalTokens: hasNativeUsage ? promptTokens + completionTokens : result.usage.total_tokens ?? (promptTokens + completionTokens),
        costUsd: result.usage.cost ?? result.usage.total_cost,
      } : undefined,
    };
  }

  /** How many replayed assistant turns carry Gemini signatures (debug log only). */
  private getAssistantMessageDiagnostics(messages: ImageConversationMessage[]): {
    assistantCount: number;
    withReasoningDetails: number;
    withImageThoughtSignatures: number;
    withContentImageThoughtSignatures: number;
  } {
    const assistants = messages.filter(message => message.role === 'assistant');

    const withReasoningDetails = assistants.filter(message =>
      Array.isArray(message.reasoning_details) && message.reasoning_details.length > 0
    ).length;

    const withImageThoughtSignatures = assistants.filter(message =>
      Array.isArray(message.images) && message.images.some(image => 'thought_signature' in image)
    ).length;

    const withContentImageThoughtSignatures = assistants.filter(message =>
      Array.isArray(message.content) &&
      message.content.some(block => block.type === 'image_url' && 'thought_signature' in block)
    ).length;

    return {
      assistantCount: assistants.length,
      withReasoningDetails,
      withImageThoughtSignatures,
      withContentImageThoughtSignatures,
    };
  }
}
