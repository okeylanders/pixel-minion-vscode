/**
 * Image Generation Message Payloads
 */

export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3';

export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
  '3:2': { width: 1024, height: 683 },
  '2:3': { width: 683, height: 1024 },
};

export interface ImageGenerationRequestPayload {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceImages?: string[];  // base64 encoded
  conversationId?: string;     // for continuation
}

export interface ImageGenerationContinuePayload {
  prompt: string;
  conversationId: string;
}

export interface GeneratedImage {
  id: string;
  data: string;          // base64
  mimeType: string;      // 'image/png' | 'image/jpeg'
  prompt: string;        // prompt that generated it
  timestamp: number;
}

export interface ImageGenerationResponsePayload {
  conversationId: string;
  images: GeneratedImage[];
  turnNumber: number;
}

export interface ImageSaveRequestPayload {
  imageId: string;
  data: string;              // base64
  mimeType: string;
  suggestedFilename: string;
}

export interface ImageSaveResultPayload {
  success: boolean;
  imageId: string;
  filePath?: string;
  error?: string;
}
