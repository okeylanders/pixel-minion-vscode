/**
 * SVGArchitectConversationManager - Manages SVG Architect multi-phase pipeline state
 *
 * Pattern: Conversation state manager for iterative refinement
 * Tracks: Analysis → Blueprint → Render → Validate → Refine cycles
 *
 * Reference: Sprint 4.2 - SVG Architect Pipeline
 */

import { TextMessage, TokenUsage } from '../clients/TextClient';
import { AspectRatio } from '@messages';
import { LoggingService } from '@logging';

/**
 * Status of an SVG Architect conversation
 */
export type SVGArchitectStatus =
  | 'analyzing'      // Blueprint agent analyzing input
  | 'rendering'      // Render LLM generating SVG
  | 'validating'     // Waiting for PNG from webview for validation
  | 'refining'       // Blueprint agent refining based on validation
  | 'needs_user'     // Stuck, waiting for user notes
  | 'complete'       // Reached confidence threshold
  | 'max_iterations' // Hit iteration limit
  | 'error';         // Failed

/**
 * A single iteration in the refinement loop
 */
export interface SVGArchitectIteration {
  iterationNumber: number;
  blueprintJson: string;        // The blueprint specification
  svgCode: string | null;       // Generated SVG (null if not yet rendered)
  renderedPngBase64: string | null;  // Rendered PNG (null if not yet validated)
  validationResult: {
    confidenceScore: number;    // 0-100
    issues: string[];           // Problems found
    corrections: string[];      // Suggested fixes
    recommendation: 'ACCEPT' | 'ITERATE' | 'NEEDS_USER';
  } | null;
  usage?: TokenUsage;           // Token usage for this iteration
  timestamp: number;
}

/**
 * Full conversation state
 */
export interface SVGArchitectConversationState {
  id: string;
  status: SVGArchitectStatus;
  originalInput: {
    prompt: string;
    referenceImageBase64?: string;
    referenceSvgText?: string;
  };
  description: string | null;   // Text description from analysis
  iterations: SVGArchitectIteration[];
  currentIteration: number;
  maxIterations: number;
  model: string;                // Blueprint model
  renderModel: string;          // Render model
  aspectRatio: AspectRatio;
  userNotes: string | null;     // User intervention notes
  totalUsage: TokenUsage;       // Accumulated across iterations
  createdAt: number;
  updatedAt: number;
}

/**
 * Re-hydration data from webview
 */
export interface SVGArchitectRehydrationData {
  originalInput: {
    prompt: string;
    referenceImageBase64?: string;
  };
  iterations: Array<{
    blueprintJson: string;
    svgCode: string;
    confidenceScore: number;
  }>;
  model: string;
  renderModel: string;
  aspectRatio: AspectRatio;
}

/**
 * SVGArchitectConversationManager
 *
 * Manages multi-phase pipeline conversations with iterative refinement.
 * Tracks blueprint specifications, rendered SVGs, validation results,
 * and accumulated token usage across iterations.
 */
export class SVGArchitectConversationManager {
  private readonly conversations: Map<string, SVGArchitectConversationState> = new Map();

  constructor(private readonly logger: LoggingService) {}

  /**
   * Create a new conversation
   */
  create(
    prompt: string,
    model: string,
    renderModel: string,
    aspectRatio: AspectRatio,
    maxIterations: number,
    referenceImageBase64?: string,
    referenceSvgText?: string
  ): SVGArchitectConversationState {
    const id = crypto.randomUUID();
    const now = Date.now();

    const state: SVGArchitectConversationState = {
      id,
      status: 'analyzing',
      originalInput: {
        prompt,
        referenceImageBase64,
        referenceSvgText,
      },
      description: null,
      iterations: [],
      currentIteration: 0,
      maxIterations,
      model,
      renderModel,
      aspectRatio,
      userNotes: null,
      totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      createdAt: now,
      updatedAt: now,
    };

    this.conversations.set(id, state);
    this.logger.debug(`Created SVG Architect conversation: ${id}`);
    return state;
  }

  /**
   * Get conversation by ID
   */
  get(conversationId: string): SVGArchitectConversationState | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Delete conversation
   */
  delete(conversationId: string): boolean {
    const deleted = this.conversations.delete(conversationId);
    if (deleted) {
      this.logger.debug(`Deleted SVG Architect conversation: ${conversationId}`);
    }
    return deleted;
  }

  /**
   * Update status
   */
  updateStatus(conversationId: string, status: SVGArchitectStatus): void {
    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.status = status;
      conv.updatedAt = Date.now();
    }
  }

  /**
   * Set description from analysis
   */
  setDescription(conversationId: string, description: string): void {
    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.description = description;
      conv.updatedAt = Date.now();
    }
  }

  /**
   * Add a new iteration
   */
  addIteration(
    conversationId: string,
    blueprintJson: string,
    usage?: TokenUsage
  ): SVGArchitectIteration {
    const conv = this.conversations.get(conversationId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conv.currentIteration++;
    const iteration: SVGArchitectIteration = {
      iterationNumber: conv.currentIteration,
      blueprintJson,
      svgCode: null,
      renderedPngBase64: null,
      validationResult: null,
      usage,
      timestamp: Date.now(),
    };

    conv.iterations.push(iteration);

    // Accumulate usage
    if (usage) {
      conv.totalUsage.promptTokens += usage.promptTokens;
      conv.totalUsage.completionTokens += usage.completionTokens;
      conv.totalUsage.totalTokens += usage.totalTokens;
      if (usage.costUsd) {
        conv.totalUsage.costUsd = (conv.totalUsage.costUsd ?? 0) + usage.costUsd;
      }
    }

    conv.updatedAt = Date.now();
    this.logger.debug(`Added iteration ${conv.currentIteration} to conversation ${conversationId}`);

    return iteration;
  }

  /**
   * Update current iteration with rendered SVG
   */
  setIterationSvg(conversationId: string, svgCode: string, usage?: TokenUsage): void {
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.iterations.length === 0) return;

    const current = conv.iterations[conv.iterations.length - 1];
    current.svgCode = svgCode;

    if (usage) {
      current.usage = current.usage ? {
        promptTokens: current.usage.promptTokens + usage.promptTokens,
        completionTokens: current.usage.completionTokens + usage.completionTokens,
        totalTokens: current.usage.totalTokens + usage.totalTokens,
        costUsd: (current.usage.costUsd ?? 0) + (usage.costUsd ?? 0),
      } : usage;

      // Also accumulate to total
      conv.totalUsage.promptTokens += usage.promptTokens;
      conv.totalUsage.completionTokens += usage.completionTokens;
      conv.totalUsage.totalTokens += usage.totalTokens;
      if (usage.costUsd) {
        conv.totalUsage.costUsd = (conv.totalUsage.costUsd ?? 0) + usage.costUsd;
      }
    }

    conv.updatedAt = Date.now();
  }

  /**
   * Update current iteration with rendered PNG
   */
  setIterationPng(conversationId: string, pngBase64: string): void {
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.iterations.length === 0) return;

    const current = conv.iterations[conv.iterations.length - 1];
    current.renderedPngBase64 = pngBase64;
    conv.updatedAt = Date.now();
  }

  /**
   * Update current iteration with validation result
   */
  setValidationResult(
    conversationId: string,
    confidenceScore: number,
    issues: string[],
    corrections: string[],
    recommendation: 'ACCEPT' | 'ITERATE' | 'NEEDS_USER',
    usage?: TokenUsage
  ): void {
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.iterations.length === 0) return;

    const current = conv.iterations[conv.iterations.length - 1];
    current.validationResult = {
      confidenceScore,
      issues,
      corrections,
      recommendation,
    };

    if (usage) {
      conv.totalUsage.promptTokens += usage.promptTokens;
      conv.totalUsage.completionTokens += usage.completionTokens;
      conv.totalUsage.totalTokens += usage.totalTokens;
      if (usage.costUsd) {
        conv.totalUsage.costUsd = (conv.totalUsage.costUsd ?? 0) + usage.costUsd;
      }
    }

    conv.updatedAt = Date.now();
  }

  /**
   * Set user notes for intervention
   */
  setUserNotes(conversationId: string, notes: string): void {
    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.userNotes = notes;
      conv.updatedAt = Date.now();
    }
  }

  /**
   * Get context images for API call (first + latest only for token optimization)
   */
  getContextImages(conversationId: string): string[] {
    const conv = this.conversations.get(conversationId);
    if (!conv) return [];

    const images: string[] = [];

    // Always include original reference if present
    if (conv.originalInput.referenceImageBase64) {
      images.push(conv.originalInput.referenceImageBase64);
    }

    // Include latest rendered PNG if different from original
    if (conv.iterations.length > 0) {
      const latestPng = conv.iterations[conv.iterations.length - 1].renderedPngBase64;
      if (latestPng) {
        images.push(latestPng);
      }
    }

    return images;
  }

  /**
   * Re-hydrate from webview history
   */
  rehydrate(
    conversationId: string,
    data: SVGArchitectRehydrationData
  ): SVGArchitectConversationState {
    const now = Date.now();

    // Build iterations from history
    const iterations: SVGArchitectIteration[] = data.iterations.map((iter, index) => ({
      iterationNumber: index + 1,
      blueprintJson: iter.blueprintJson,
      svgCode: iter.svgCode,
      renderedPngBase64: null, // Can't recover PNG from history
      validationResult: {
        confidenceScore: iter.confidenceScore,
        issues: [],
        corrections: [],
        recommendation: iter.confidenceScore >= 85 ? 'ACCEPT' : 'ITERATE',
      },
      timestamp: now,
    }));

    const state: SVGArchitectConversationState = {
      id: conversationId,
      status: 'analyzing', // Start fresh
      originalInput: data.originalInput,
      description: null,
      iterations,
      currentIteration: iterations.length,
      maxIterations: 5, // Default
      model: data.model,
      renderModel: data.renderModel,
      aspectRatio: data.aspectRatio,
      userNotes: null,
      totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      createdAt: now,
      updatedAt: now,
    };

    this.conversations.set(conversationId, state);
    this.logger.info(`Re-hydrated SVG Architect conversation ${conversationId} with ${iterations.length} iterations`);

    return state;
  }

  /**
   * Check if we've hit max iterations
   */
  hasReachedMaxIterations(conversationId: string): boolean {
    const conv = this.conversations.get(conversationId);
    return conv ? conv.currentIteration >= conv.maxIterations : true;
  }

  /**
   * Get latest SVG code
   */
  getLatestSvg(conversationId: string): string | null {
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.iterations.length === 0) return null;
    return conv.iterations[conv.iterations.length - 1].svgCode;
  }

  /**
   * Get latest confidence score
   */
  getLatestConfidence(conversationId: string): number | null {
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.iterations.length === 0) return null;
    return conv.iterations[conv.iterations.length - 1].validationResult?.confidenceScore ?? null;
  }
}
