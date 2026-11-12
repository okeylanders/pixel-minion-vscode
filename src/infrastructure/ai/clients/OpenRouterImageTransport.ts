// Ported from frame-minion@40e7949 packages/core/src/infrastructure/ai/clients/OpenRouterImageTransport.ts; keep in sync
/**
 * The two OpenRouter wire adapters for image generation. Each keeps one
 * endpoint's request body and response parsing together:
 *   - `/images` (the dedicated Image API): one prompt, its image references
 *     as `input_references`, `aspect_ratio` / `resolution` / `seed`, and
 *     `data[].b64_json` back.
 *   - `/chat/completions`: the conversation's messages (or just the current
 *     user message), `modalities`, an `image_config`, and
 *     `choices[0].message.images` back. The assistant message is returned
 *     untouched so provider signatures survive the next turn.
 *
 * Pixel delta: raster formats are recognised by the shared
 * `sniffImageMime` (src/shared/media/imageFormats.ts, also used by the save
 * handler) instead of a local copy, so display and save agree on one list.
 */
import type { ImageModelDefinition } from '../../../shared/types/providers';
import type { ImageRouteCapabilities } from '../../../shared/models/ImageGenerationModes';
import { sniffImageMime } from '../../../shared/media/imageFormats';
import type { LoggingService } from '@logging';
import type { GeneratedImageData, ImageGenerationRequest, ImageConversationMessage } from './ImageGenerationClient';

/** Wire adapters keep endpoint-specific request and response shapes together. */
interface OpenRouterImageTransport {
  path: string;
  buildBody(request: ImageGenerationRequest, userMessage: ImageConversationMessage, capabilities?: ImageRouteCapabilities): object;
  parseImages(result: unknown, logger: LoggingService): GeneratedImageData[];
  assistantMessage?(result: unknown): ImageConversationMessage | undefined;
}

const RASTER_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function detectRasterMime(base64: string): string | undefined {
  return sniffImageMime(Buffer.from(base64.slice(0, 32), 'base64'));
}

const imageApiTransport: OpenRouterImageTransport = {
  path: '/images',
  buildBody(request, userMessage, capabilities) {
    const prompt = userMessage.content
      .filter(block => block.type === 'text')
      .map(block => block.text ?? '')
      .join('\n');
    const inputReferences = userMessage.content
      .filter(block => block.type === 'image_url' && block.image_url?.url)
      .map(block => ({ type: 'image_url', image_url: { url: block.image_url!.url } }));
    return {
      model: request.model,
      prompt,
      seed: request.seed,
      // An unverified Auto is omitted rather than assumed to be accepted.
      ...(request.aspectRatio === 'auto' && !capabilities?.supportedAspectRatios.some(ratio => ratio !== 'auto')
        ? {} : { aspect_ratio: request.aspectRatio }),
      ...(request.resolution ? { resolution: request.resolution } : {}),
      ...(inputReferences.length > 0 ? { input_references: inputReferences } : {}),
    };
  },
  parseImages(result, logger) {
    const data = (result as { data?: unknown } | null)?.data;
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('No images returned from OpenRouter Image API');
    }
    return data.flatMap((image: unknown, index: number) => {
      if (!image || typeof image !== 'object' || typeof (image as { b64_json?: unknown }).b64_json !== 'string') {
        logger.warn(`Image ${index} missing base64 data`);
        return [];
      }
      const typedImage = image as { b64_json: string; media_type?: unknown };
      const declaredMime = typedImage.media_type === 'image/jpg' ? 'image/jpeg' : typedImage.media_type;
      const detectedMime = detectRasterMime(typedImage.b64_json);
      const mimeType = detectedMime ?? declaredMime;
      if (typeof mimeType !== 'string' || !RASTER_MIME_TYPES.includes(mimeType)) {
        throw new Error('Image response format could not be identified as a supported raster image.');
      }
      if (detectedMime && declaredMime && detectedMime !== declaredMime) logger.warn('Image media type disagrees with its bytes; using the detected raster format');
      return [{ data: `data:${mimeType};base64,${typedImage.b64_json}`, mimeType }];
    });
  },
};

const chatImageTransport: OpenRouterImageTransport = {
  path: '/chat/completions',
  buildBody(request, userMessage, capabilities) {
    const imageConfig = {
      ...(capabilities?.supportedAspectRatios.some(ratio => ratio !== 'auto')
        ? { aspect_ratio: request.aspectRatio } : {}),
      ...(request.resolution && capabilities?.supportedResolutions.length
        ? { image_size: request.resolution } : {}),
    };
    return {
      model: request.model,
      messages: request.mode === 'conversation' ? request.messages : [{ role: 'user', content: userMessage.content }],
      modalities: capabilities?.modalities ?? ['image'],
      stream: false,
      // OpenRouter returns usage/cost automatically; usage.include is deprecated.
      ...(capabilities?.supportsSeed && request.seed !== undefined ? { seed: request.seed } : {}),
      ...(Object.keys(imageConfig).length ? { image_config: imageConfig } : {}),
    };
  },
  parseImages(result, logger) {
    const images = (result as { choices?: { message?: { images?: unknown } }[] } | null)
      ?.choices?.[0]?.message?.images;
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('No images returned from OpenRouter chat image response');
    }
    return images.flatMap((image: unknown, index: number) => {
      const url = (image as { image_url?: { url?: unknown } } | null)?.image_url?.url;
      const mimeType = typeof url === 'string'
        ? /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,[A-Za-z0-9+/]+={0,2}$/.exec(url)?.[1]
        : undefined;
      if (!mimeType || typeof url !== 'string') {
        logger.warn(`Chat image ${index} is not a supported raster data URL`);
        return [];
      }
      // Normalize the common JPEG alias for saving and reference allowlists.
      return [{ data: mimeType === 'image/jpg' ? url.replace('data:image/jpg;', 'data:image/jpeg;') : url, mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType }];
    });
  },
  assistantMessage(result) {
    const message = (result as { choices?: { message?: ImageConversationMessage }[] } | null)?.choices?.[0]?.message;
    // The response remains opaque. In particular, do not rebuild content or
    // reasoning_details: provider signatures must survive the round trip.
    return message?.role === 'assistant' ? message : undefined;
  },
};

const transports: Record<NonNullable<ImageModelDefinition['transport']>, OpenRouterImageTransport> = {
  images: imageApiTransport,
  'chat-completions': chatImageTransport,
};

export function openRouterImageTransport(model?: Pick<ImageModelDefinition, 'transport'>): OpenRouterImageTransport {
  return transports[model?.transport ?? 'images'];
}
