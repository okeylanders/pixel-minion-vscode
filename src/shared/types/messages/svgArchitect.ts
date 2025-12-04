/**
 * SVG Architect Message Payloads
 *
 * Message types for the SVG Architect multi-agent pipeline.
 * Sprint 5.1 - Application Layer Message Types
 */
import { AspectRatio } from './imageGeneration';
import { TokenUsage } from './tokenUsage';

/**
 * Status values for SVG Architect pipeline
 */
export type SVGArchitectStatusType =
  | 'idle'
  | 'analyzing'
  | 'rendering'
  | 'validating'
  | 'refining'
  | 'awaiting_user'
  | 'complete'
  | 'error';

/**
 * Request payload to start SVG Architect generation
 */
export interface SVGArchitectRequestPayload {
  prompt: string;
  blueprintModel: string;
  renderModel: string;
  aspectRatio: AspectRatio;
  maxIterations: number;
  referenceImage?: string;      // base64 encoded
  referenceSvgText?: string;    // raw SVG text
  conversationId?: string;      // for resuming
}

/**
 * Progress update payload - sent during generation
 */
export interface SVGArchitectProgressPayload {
  conversationId: string;
  status: SVGArchitectStatusType;
  iteration: number;
  maxIterations: number;
  message: string;
  svgCode?: string;             // Latest SVG if available
  confidenceScore?: number;     // Validation confidence (0-100)
  // Detailed information for conversation thread
  description?: string;         // Analysis description
  blueprint?: string;           // Current blueprint JSON
  issues?: string[];            // Validation issues found
  corrections?: string[];       // Corrections to apply
  renderedPng?: string;         // Rendered PNG base64 (for display)
}

/**
 * PNG ready payload - webview sends rendered PNG back for validation
 */
export interface SVGArchitectPngPayload {
  conversationId: string;
  pngBase64: string;            // Rendered PNG of current SVG
}

/**
 * Resume payload - user provides notes to help refine
 */
export interface SVGArchitectResumePayload {
  conversationId: string;
  userNotes: string;            // User feedback/guidance
}

/**
 * Final result payload
 */
export interface SVGArchitectResultPayload {
  conversationId: string;
  status: SVGArchitectStatusType;
  svgCode: string | null;
  finalConfidence: number | null;
  iterations: number;
  totalUsage: TokenUsage;
}

/**
 * Cancel payload - abort current generation
 */
export interface SVGArchitectCancelPayload {
  conversationId: string;
}
