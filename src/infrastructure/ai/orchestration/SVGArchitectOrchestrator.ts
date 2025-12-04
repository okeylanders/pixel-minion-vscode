/**
 * SVGArchitectOrchestrator - Coordinates the multi-phase SVG Architect pipeline
 *
 * Pattern: Orchestrator that coordinates Analysis → Blueprint → Render → Validate cycles
 * Pipeline: User Input → Blueprint Agent (analyze) → Render LLM → Validation Agent → Iterate
 *
 * Reference: Sprint 4.3 - SVG Architect Orchestrator
 */
import { OpenRouterDynamicTextClient } from '../clients/OpenRouterDynamicTextClient';
import { TextMessageContent } from '../clients/TextClient';
import {
  SVGArchitectConversationManager,
  SVGArchitectConversationState,
  SVGArchitectStatus
} from './SVGArchitectConversationManager';
import { PromptLoader } from '../../resources/PromptLoader';
import { LoggingService } from '@logging';
import { AspectRatio, TokenUsage } from '@messages';

/**
 * Input for starting SVG Architect generation
 */
export interface SVGArchitectInput {
  prompt: string;
  referenceImageBase64?: string;
  referenceSvgText?: string;
}

/**
 * Options for generation
 */
export interface SVGArchitectOptions {
  blueprintModel: string;
  renderModel: string;
  aspectRatio: AspectRatio;
  maxIterations: number;
}

/**
 * Progress callback payload
 */
export interface SVGArchitectProgress {
  conversationId: string;
  status: SVGArchitectStatus;
  iteration: number;
  maxIterations: number;
  message: string;
  svgCode?: string;        // Latest SVG if available
  confidenceScore?: number; // Latest confidence if available
}

/**
 * Final result
 */
export interface SVGArchitectResult {
  conversationId: string;
  status: SVGArchitectStatus;
  svgCode: string | null;
  finalConfidence: number | null;
  iterations: number;
  totalUsage: TokenUsage;
}

/**
 * SVGArchitectOrchestrator
 *
 * Coordinates the multi-phase pipeline for SVG generation using the SVG Architect pattern:
 * 1. Analysis - Blueprint Agent analyzes input and creates structured blueprint
 * 2. Render - Render LLM generates SVG code from blueprint
 * 3. Validate - Blueprint Agent validates rendered output (requires PNG from webview)
 * 4. Refine - Blueprint Agent refines blueprint based on validation
 * 5. Repeat 2-4 until confidence threshold met or max iterations reached
 */
export class SVGArchitectOrchestrator {
  private readonly conversationManager: SVGArchitectConversationManager;
  private blueprintClient: OpenRouterDynamicTextClient | null = null;
  private renderClient: OpenRouterDynamicTextClient | null = null;
  private promptLoader: PromptLoader | null = null;

  constructor(private readonly logger: LoggingService) {
    this.conversationManager = new SVGArchitectConversationManager(logger);
  }

  /**
   * Set the Blueprint Agent client
   */
  setBlueprintClient(client: OpenRouterDynamicTextClient): void {
    this.blueprintClient = client;
    this.logger.debug('SVGArchitectOrchestrator blueprint client configured');
  }

  /**
   * Set the Render LLM client
   */
  setRenderClient(client: OpenRouterDynamicTextClient): void {
    this.renderClient = client;
    this.logger.debug('SVGArchitectOrchestrator render client configured');
  }

  /**
   * Set the PromptLoader
   */
  setPromptLoader(loader: PromptLoader): void {
    this.promptLoader = loader;
    this.logger.debug('SVGArchitectOrchestrator prompt loader configured');
  }

  /**
   * Check if fully configured
   */
  isConfigured(): boolean {
    return this.blueprintClient !== null &&
           this.renderClient !== null &&
           this.promptLoader !== null;
  }

  /**
   * Start a new generation
   */
  async startGeneration(
    input: SVGArchitectInput,
    options: SVGArchitectOptions,
    onProgress: (progress: SVGArchitectProgress) => void
  ): Promise<SVGArchitectResult> {
    if (!this.isConfigured()) {
      throw new Error('SVGArchitectOrchestrator not fully configured');
    }

    // Create conversation
    const conversation = this.conversationManager.create(
      input.prompt,
      options.blueprintModel,
      options.renderModel,
      options.aspectRatio,
      options.maxIterations,
      input.referenceImageBase64,
      input.referenceSvgText
    );

    this.logger.info(`Starting SVG Architect generation: ${conversation.id}`);

    try {
      // Phase 1: Analysis
      onProgress({
        conversationId: conversation.id,
        status: 'analyzing',
        iteration: 0,
        maxIterations: options.maxIterations,
        message: 'Analyzing input and generating blueprint...',
      });

      const { description, blueprintJson } = await this.analyzeAndGenerateBlueprint(
        conversation.id,
        input,
        options.blueprintModel
      );

      this.conversationManager.setDescription(conversation.id, description);
      this.conversationManager.addIteration(conversation.id, blueprintJson);

      // Phase 2: Initial Render
      onProgress({
        conversationId: conversation.id,
        status: 'rendering',
        iteration: 1,
        maxIterations: options.maxIterations,
        message: 'Rendering SVG from blueprint...',
      });

      const svgCode = await this.renderSvg(
        conversation.id,
        description,
        blueprintJson,
        options.renderModel
      );

      this.conversationManager.setIterationSvg(conversation.id, svgCode);
      this.conversationManager.updateStatus(conversation.id, 'validating');

      // Return for webview to render PNG
      onProgress({
        conversationId: conversation.id,
        status: 'validating',
        iteration: 1,
        maxIterations: options.maxIterations,
        message: 'Waiting for PNG rendering for validation...',
        svgCode,
      });

      // The validation loop continues via continueWithRenderedPng()
      return {
        conversationId: conversation.id,
        status: 'validating',
        svgCode,
        finalConfidence: null,
        iterations: 1,
        totalUsage: this.conversationManager.get(conversation.id)!.totalUsage,
      };
    } catch (error) {
      this.conversationManager.updateStatus(conversation.id, 'error');
      throw error;
    }
  }

  /**
   * Continue validation loop with rendered PNG from webview
   */
  async continueWithRenderedPng(
    conversationId: string,
    pngBase64: string,
    onProgress: (progress: SVGArchitectProgress) => void
  ): Promise<SVGArchitectResult> {
    const conversation = this.conversationManager.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Store the PNG
    this.conversationManager.setIterationPng(conversationId, pngBase64);

    // Validate
    onProgress({
      conversationId,
      status: 'validating',
      iteration: conversation.currentIteration,
      maxIterations: conversation.maxIterations,
      message: 'Validating rendered output...',
    });

    const validation = await this.validateAndAnnotate(
      conversationId,
      pngBase64,
      conversation.model
    );

    this.conversationManager.setValidationResult(
      conversationId,
      validation.confidenceScore,
      validation.issues,
      validation.corrections,
      validation.recommendation
    );

    // Check if we're done
    if (validation.recommendation === 'ACCEPT') {
      this.conversationManager.updateStatus(conversationId, 'complete');
      const finalConv = this.conversationManager.get(conversationId)!;

      onProgress({
        conversationId,
        status: 'complete',
        iteration: finalConv.currentIteration,
        maxIterations: finalConv.maxIterations,
        message: `Complete! Confidence: ${validation.confidenceScore}%`,
        svgCode: this.conversationManager.getLatestSvg(conversationId) ?? undefined,
        confidenceScore: validation.confidenceScore,
      });

      return {
        conversationId,
        status: 'complete',
        svgCode: this.conversationManager.getLatestSvg(conversationId),
        finalConfidence: validation.confidenceScore,
        iterations: finalConv.currentIteration,
        totalUsage: finalConv.totalUsage,
      };
    }

    if (validation.recommendation === 'NEEDS_USER') {
      this.conversationManager.updateStatus(conversationId, 'needs_user');
      const finalConv = this.conversationManager.get(conversationId)!;

      onProgress({
        conversationId,
        status: 'needs_user',
        iteration: finalConv.currentIteration,
        maxIterations: finalConv.maxIterations,
        message: 'Need user guidance to proceed',
        svgCode: this.conversationManager.getLatestSvg(conversationId) ?? undefined,
        confidenceScore: validation.confidenceScore,
      });

      return {
        conversationId,
        status: 'needs_user',
        svgCode: this.conversationManager.getLatestSvg(conversationId),
        finalConfidence: validation.confidenceScore,
        iterations: finalConv.currentIteration,
        totalUsage: finalConv.totalUsage,
      };
    }

    // Check iteration limit
    if (this.conversationManager.hasReachedMaxIterations(conversationId)) {
      this.conversationManager.updateStatus(conversationId, 'max_iterations');
      const finalConv = this.conversationManager.get(conversationId)!;

      onProgress({
        conversationId,
        status: 'max_iterations',
        iteration: finalConv.currentIteration,
        maxIterations: finalConv.maxIterations,
        message: `Reached max iterations. Best confidence: ${validation.confidenceScore}%`,
        svgCode: this.conversationManager.getLatestSvg(conversationId) ?? undefined,
        confidenceScore: validation.confidenceScore,
      });

      return {
        conversationId,
        status: 'max_iterations',
        svgCode: this.conversationManager.getLatestSvg(conversationId),
        finalConfidence: validation.confidenceScore,
        iterations: finalConv.currentIteration,
        totalUsage: finalConv.totalUsage,
      };
    }

    // Continue iterating - refine blueprint
    onProgress({
      conversationId,
      status: 'refining',
      iteration: conversation.currentIteration + 1,
      maxIterations: conversation.maxIterations,
      message: 'Refining blueprint based on validation...',
    });

    const refinedBlueprint = await this.refineBlueprint(
      conversationId,
      validation.corrections,
      conversation.model
    );

    this.conversationManager.addIteration(conversationId, refinedBlueprint);

    // Render new SVG
    onProgress({
      conversationId,
      status: 'rendering',
      iteration: conversation.currentIteration + 1,
      maxIterations: conversation.maxIterations,
      message: 'Rendering refined SVG...',
    });

    const newSvg = await this.renderSvg(
      conversationId,
      conversation.description!,
      refinedBlueprint,
      conversation.renderModel
    );

    this.conversationManager.setIterationSvg(conversationId, newSvg);
    this.conversationManager.updateStatus(conversationId, 'validating');

    const updatedConv = this.conversationManager.get(conversationId)!;

    onProgress({
      conversationId,
      status: 'validating',
      iteration: updatedConv.currentIteration,
      maxIterations: updatedConv.maxIterations,
      message: 'Waiting for PNG rendering for validation...',
      svgCode: newSvg,
    });

    return {
      conversationId,
      status: 'validating',
      svgCode: newSvg,
      finalConfidence: null,
      iterations: updatedConv.currentIteration,
      totalUsage: updatedConv.totalUsage,
    };
  }

  /**
   * Resume with user notes
   */
  async resumeWithUserNotes(
    conversationId: string,
    notes: string,
    onProgress: (progress: SVGArchitectProgress) => void
  ): Promise<SVGArchitectResult> {
    const conversation = this.conversationManager.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    this.conversationManager.setUserNotes(conversationId, notes);
    this.conversationManager.updateStatus(conversationId, 'refining');

    onProgress({
      conversationId,
      status: 'refining',
      iteration: conversation.currentIteration + 1,
      maxIterations: conversation.maxIterations,
      message: 'Refining based on user guidance...',
    });

    // Refine with user notes
    const refinedBlueprint = await this.refineBlueprint(
      conversationId,
      [notes],
      conversation.model
    );

    this.conversationManager.addIteration(conversationId, refinedBlueprint);

    // Render
    const newSvg = await this.renderSvg(
      conversationId,
      conversation.description!,
      refinedBlueprint,
      conversation.renderModel
    );

    this.conversationManager.setIterationSvg(conversationId, newSvg);
    this.conversationManager.updateStatus(conversationId, 'validating');

    // Clear user notes after use
    this.conversationManager.setUserNotes(conversationId, '');

    const updatedConv = this.conversationManager.get(conversationId)!;

    onProgress({
      conversationId,
      status: 'validating',
      iteration: updatedConv.currentIteration,
      maxIterations: updatedConv.maxIterations,
      message: 'Waiting for PNG rendering...',
      svgCode: newSvg,
    });

    return {
      conversationId,
      status: 'validating',
      svgCode: newSvg,
      finalConfidence: null,
      iterations: updatedConv.currentIteration,
      totalUsage: updatedConv.totalUsage,
    };
  }

  /**
   * Get conversation state
   */
  getConversation(conversationId: string): SVGArchitectConversationState | undefined {
    return this.conversationManager.get(conversationId);
  }

  // ==================== Internal Methods ====================

  private async analyzeAndGenerateBlueprint(
    conversationId: string,
    input: SVGArchitectInput,
    model: string
  ): Promise<{ description: string; blueprintJson: string }> {
    const systemPrompt = await this.promptLoader!.load('svg-architect', 'blueprint-analysis');

    // Build multimodal content
    const content: TextMessageContent[] = [];

    content.push({ type: 'text', text: `Generate an SVG for: ${input.prompt}` });

    if (input.referenceImageBase64) {
      // Handle both raw base64 and data URLs
      const imageUrl = input.referenceImageBase64.startsWith('data:')
        ? input.referenceImageBase64
        : `data:image/png;base64,${input.referenceImageBase64}`;
      content.push({
        type: 'image_url',
        image_url: { url: imageUrl }
      });
    }

    if (input.referenceSvgText) {
      content.push({ type: 'text', text: `Reference SVG:\n${input.referenceSvgText}` });
    }

    const result = await this.blueprintClient!.createCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content }
    ], { model });

    // Parse response - expect description and blueprint sections
    const response = result.content;

    // Extract description (between ### Description and ### Blueprint)
    const descMatch = response.match(/### Description\s*([\s\S]*?)(?=### Blueprint|$)/i);
    const description = descMatch ? descMatch[1].trim() : input.prompt;

    // Extract blueprint (after ### Blueprint)
    const blueprintMatch = response.match(/### Blueprint\s*([\s\S]*?)(?=### Confidence|$)/i);
    const blueprintJson = blueprintMatch ? blueprintMatch[1].trim() : response;

    if (result.usage) {
      const conv = this.conversationManager.get(conversationId);
      if (conv) {
        conv.totalUsage.promptTokens += result.usage.promptTokens;
        conv.totalUsage.completionTokens += result.usage.completionTokens;
        conv.totalUsage.totalTokens += result.usage.totalTokens;
        if (result.usage.costUsd) {
          conv.totalUsage.costUsd = (conv.totalUsage.costUsd ?? 0) + result.usage.costUsd;
        }
      }
    }

    return { description, blueprintJson };
  }

  private async renderSvg(
    conversationId: string,
    description: string,
    blueprintJson: string,
    model: string
  ): Promise<string> {
    const systemPrompt = await this.promptLoader!.load('svg-architect', 'blueprint-render');
    const conv = this.conversationManager.get(conversationId)!;

    const userContent = `
## Description
${description}

## Blueprint
${blueprintJson}

## Aspect Ratio
${conv.aspectRatio}

Generate the SVG code now.
`;

    const result = await this.renderClient!.createCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ], { model });

    // Extract SVG from response
    const svgMatch = result.content.match(/<svg[\s\S]*<\/svg>/i);
    if (!svgMatch) {
      throw new Error('Render LLM did not produce valid SVG');
    }

    if (result.usage) {
      this.conversationManager.setIterationSvg(conversationId, svgMatch[0], result.usage);
    }

    return svgMatch[0];
  }

  private async validateAndAnnotate(
    conversationId: string,
    pngBase64: string,
    model: string
  ): Promise<{
    confidenceScore: number;
    issues: string[];
    corrections: string[];
    recommendation: 'ACCEPT' | 'ITERATE' | 'NEEDS_USER';
  }> {
    const systemPrompt = await this.promptLoader!.load('svg-architect', 'blueprint-validation');
    const conv = this.conversationManager.get(conversationId)!;
    const contextImages = this.conversationManager.getContextImages(conversationId);

    // Build multimodal content with original + rendered
    const content: TextMessageContent[] = [];

    content.push({ type: 'text', text: 'Compare the original input to the rendered output.' });

    // Original reference if available
    if (contextImages.length > 0) {
      content.push({ type: 'text', text: 'Original input:' });
      // Handle both raw base64 and data URLs
      const originalImageUrl = contextImages[0].startsWith('data:')
        ? contextImages[0]
        : `data:image/png;base64,${contextImages[0]}`;
      content.push({
        type: 'image_url',
        image_url: { url: originalImageUrl }
      });
    }

    content.push({ type: 'text', text: 'Rendered SVG output:' });
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${pngBase64}` }
    });

    content.push({
      type: 'text',
      text: `Current blueprint:\n${conv.iterations[conv.iterations.length - 1].blueprintJson}`
    });

    const result = await this.blueprintClient!.createCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content }
    ], { model });

    // Parse validation response
    const response = result.content;

    // Extract confidence score
    const scoreMatch = response.match(/### Confidence Score\s*(\d+)/i) ||
                       response.match(/Confidence[:\s]*(\d+)/i);
    const confidenceScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 50;

    // Extract issues
    const issuesMatch = response.match(/### Issues Found\s*([\s\S]*?)(?=### Blueprint|### Recommendation|$)/i);
    const issuesText = issuesMatch ? issuesMatch[1] : '';
    const issues = issuesText.split('\n')
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(line => line.length > 0);

    // Extract corrections
    const correctionsMatch = response.match(/### Blueprint Corrections\s*([\s\S]*?)(?=### Confidence|### Recommendation|$)/i);
    const correctionsText = correctionsMatch ? correctionsMatch[1] : '';
    const corrections = correctionsText.split('\n')
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(line => line.length > 0);

    // Extract recommendation
    const recMatch = response.match(/### Recommendation\s*(ACCEPT|ITERATE|NEEDS_USER)/i);
    let recommendation: 'ACCEPT' | 'ITERATE' | 'NEEDS_USER' = 'ITERATE';
    if (recMatch) {
      recommendation = recMatch[1].toUpperCase() as 'ACCEPT' | 'ITERATE' | 'NEEDS_USER';
    } else if (confidenceScore >= 85) {
      recommendation = 'ACCEPT';
    }

    if (result.usage) {
      this.conversationManager.setValidationResult(
        conversationId,
        confidenceScore,
        issues,
        corrections,
        recommendation,
        result.usage
      );
    }

    return { confidenceScore, issues, corrections, recommendation };
  }

  private async refineBlueprint(
    conversationId: string,
    corrections: string[],
    model: string
  ): Promise<string> {
    const conv = this.conversationManager.get(conversationId)!;
    const lastIteration = conv.iterations[conv.iterations.length - 1];

    const systemPrompt = await this.promptLoader!.load('svg-architect', 'blueprint-analysis');

    const userContent = `
Refine this blueprint based on the following corrections:

## Current Blueprint
${lastIteration.blueprintJson}

## Corrections Needed
${corrections.map(c => `- ${c}`).join('\n')}

${conv.userNotes ? `## User Guidance\n${conv.userNotes}` : ''}

Generate an updated blueprint.
`;

    const result = await this.blueprintClient!.createCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ], { model });

    const blueprintMatch = result.content.match(/### Blueprint\s*([\s\S]*?)(?=### Confidence|$)/i);
    const refinedBlueprint = blueprintMatch ? blueprintMatch[1].trim() : result.content;

    if (result.usage) {
      const conv = this.conversationManager.get(conversationId);
      if (conv) {
        conv.totalUsage.promptTokens += result.usage.promptTokens;
        conv.totalUsage.completionTokens += result.usage.completionTokens;
        conv.totalUsage.totalTokens += result.usage.totalTokens;
        if (result.usage.costUsd) {
          conv.totalUsage.costUsd = (conv.totalUsage.costUsd ?? 0) + result.usage.costUsd;
        }
      }
    }

    return refinedBlueprint;
  }
}
