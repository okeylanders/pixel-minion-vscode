/**
 * ImageGenerationClient - Interface for image generation AI clients
 *
 * Separate from AIClient because image generation has fundamentally different:
 * - Request format (modalities, image_config, seed)
 * - Response format (images array instead of text content)
 * - Message structure (multimodal content with image_url)
 */
import { TokenUsage } from './TextClient';

/**
 * Multimodal message content for image generation
 */
export interface ImageMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

/**
 * Message in an image generation conversation
 */
export interface ImageConversationMessage {
  role: 'user' | 'assistant';
  content: ImageMessageContent[];
  /** Assistant messages may include generated images */
  images?: Array<{ image_url: { url: string } }>;
}

/**
 * Request to generate images
 */
export interface ImageGenerationRequest {
  messages: ImageConversationMessage[];
  model: string;
  aspectRatio: string;
  seed?: number;
}

/**
 * A single generated image result
 */
export interface GeneratedImageData {
  data: string;      // base64 data URL
  mimeType: string;  // 'image/png' | 'image/jpeg'
}

/**
 * Result from image generation
 */
export interface ImageGenerationResult {
  images: GeneratedImageData[];
  seed: number;
  usage?: TokenUsage;
}

/**
 * Interface for image generation clients
 *
 * Implementations handle:
 * - API authentication (via injected SecretStorageService)
 * - Request formatting for specific providers
 * - Response parsing
 */
export interface ImageGenerationClient {
  /**
   * Generate images from a conversation
   */
  generateImages(request: ImageGenerationRequest): Promise<ImageGenerationResult>;

  /**
   * Check if the client is configured (has API key)
   */
  isConfigured(): Promise<boolean>;
}
