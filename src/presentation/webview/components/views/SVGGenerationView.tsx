/**
 * SVGGenerationView - SVG generation interface
 *
 * Pattern: Composition of existing SVG generation components
 * Responsibilities:
 * - Compose SVGModelSelector, SVGAspectRatioSelector, SingleImageUploader, SVGPreview, SVGCodeView
 * - Receive hook instance as prop (prose-minion pattern)
 * - Show the save state the host reported (via the hook)
 *
 * Layout: generation-view.css (shared with the Image tab).
 */
import React from 'react';
import { UseSVGGenerationReturn } from '../../hooks/domain/useSVGGeneration';
import { SVGModelSelector } from '../svg/SVGModelSelector';
import { SVGAspectRatioSelector } from '../svg/SVGAspectRatioSelector';
import { SingleImageUploader } from '../svg/SingleImageUploader';
import { SVGPreview } from '../svg/SVGPreview';
import { SVGCodeView } from '../svg/SVGCodeView';
import { svgPreviewSource } from '../svg/svgPreviewSource';
import { svgModelSupportsRefinement } from '../../../../shared/svg/svgRoutes';
import { ContinueChatInput } from '../shared/ContinueChatInput';
import { LoadingIndicator } from '../shared/LoadingIndicator';
import { OPENROUTER_SVG_MODELS } from '@shared/models';
import { OFF_LIST_MODEL_HELP } from '../shared/modelBrowserOptions';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { SaveButton } from '../shared/SaveButton';
import { TabSvgIcon } from '../layout/tabIcons';
import '../../styles/components/generation-view.css';
import '../../styles/components/svg-generation-view.css';

export interface SVGGenerationViewProps {
  svgGeneration: UseSVGGenerationReturn;
}

export const SVGGenerationView: React.FC<SVGGenerationViewProps> = ({
  svgGeneration,
}) => {
  const {
    prompt,
    setPrompt,
    model,
    setModel,
    aspectRatio,
    setAspectRatio,
    referenceImage,
    referenceSvgText,
    setReferenceAttachment,
    svgCode,
    conversationHistory,
    conversationId,
    threadSettings,
    isSaving,
    isSaved,
    isLoading,
    error,
    generate,
    continueChat,
    saveSVG,
    copySVG,
  } = svgGeneration;

  // Get the latest turn's usage for display
  const latestUsage = conversationHistory.length > 0
    ? conversationHistory[conversationHistory.length - 1].usage
    : undefined;

  // The result belongs to its conversation: its own aspect ratio frames the
  // previews, and its own model decides whether it can be refined.
  const resultAspectRatio = threadSettings?.aspectRatio ?? aspectRatio;
  const canRefine = threadSettings ? svgModelSupportsRefinement(threadSettings.model) : false;
  const verdict = svgCode ? svgPreviewSource(svgCode).verdict : null;
  const rejectedReason = verdict && !verdict.accepted ? verdict.reason : null;

  const renderSizedPreview = React.useCallback((size: number) => (
    <div key={size} className="svg-sized-preview">
      <div
        className="svg-sized-preview-box"
        style={{ width: size, height: size }}
      >
        <SVGPreview
          svgCode={svgCode ?? ''}
          aspectRatio={resultAspectRatio}
          alt={`${size}×${size} preview`}
          variant="thumbnail"
        />
      </div>
      <span className="svg-sized-label">{size}x{size}</span>
    </div>
  ), [svgCode, resultAspectRatio]);

  return (
    <div className="generation-view svg-generation-view">
      {/* Input well: Model, Aspect Ratio, Prompt, Reference Image, Generate button */}
      <div className="well">
        {/* Header: Model and Aspect Ratio, stacked full width */}
        <div className="generation-header">
          <SVGModelSelector
            models={OPENROUTER_SVG_MODELS}
            selectedModel={model}
            onModelChange={setModel}
            unavailableLabel={OFF_LIST_MODEL_HELP}
            disabled={isLoading}
          />
          <SVGAspectRatioSelector
            selectedRatio={aspectRatio}
            onRatioChange={setAspectRatio}
            disabled={isLoading}
          />
        </div>

        {/* Prompt input */}
        <div className="generation-prompt-section">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the SVG you want to create..."
            disabled={isLoading}
            rows={3}
          />

          <SingleImageUploader
            attachment={{ preview: referenceImage, svgText: referenceSvgText }}
            onAttachmentChange={setReferenceAttachment}
            disabled={isLoading}
          />
          {conversationId && (referenceImage || referenceSvgText) && (
            <div className="generation-note">
              The attachment applies to the next Generate. Refine keeps this conversation&apos;s context.
            </div>
          )}

          <Button
            onClick={generate}
            disabled={isLoading || !prompt.trim()}
            variant="primary"
          >
            {isLoading ? 'Generating...' : '⚡ Generate'}
          </Button>
        </div>

        {/* Error display */}
        {error && (
          <div className="generation-error" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* Output well: result area (the tab content is the scroller) */}
      <div className="well generation-output-well">
        {!svgCode && !isLoading && (
          <div className="generation-empty">
            <span className="generation-empty-icon" aria-hidden="true">
              <TabSvgIcon size={22} />
            </span>
            <p className="generation-empty-title">Your SVG appears here</p>
            <p className="generation-empty-hint">
              Describe an icon or illustration above. You get a live preview, 32–128 px sizes,
              and code to copy or refine.
            </p>
          </div>
        )}
        <div className="generation-output">
          {/* Generated SVG preview and code */}
          {svgCode && (
            <div className="svg-generation-result">
              <div className="svg-result-header">
                <div className="svg-result-title">
                  <h3>Generated SVG</h3>
                  <div className="svg-inline-preview">
                    <SVGPreview svgCode={svgCode} aspectRatio={resultAspectRatio} alt="Thumbnail" variant="thumbnail" />
                  </div>
                </div>
                <div className="svg-result-actions">
                  <SaveButton
                    onClick={saveSVG}
                    saving={isSaving}
                    saved={isSaved}
                    disabled={rejectedReason !== null}
                  />
                </div>
              </div>
              {rejectedReason && (
                <div className="generation-warning" role="status">
                  ⚠️ Preview and Save are off because this SVG {rejectedReason}. The code is below, so you
                  can inspect or copy it.
                </div>
              )}
              <div className="svg-preview-grid">
                {[32, 64, 128].map(renderSizedPreview)}
              </div>
              <SVGPreview svgCode={svgCode} aspectRatio={resultAspectRatio} />
              <SVGCodeView
                key={rejectedReason ? 'rejected' : 'accepted'}
                svgCode={svgCode}
                onCopy={copySVG}
                initiallyExpanded={rejectedReason !== null}
              />
              {latestUsage && (
                <div className="generation-usage">
                  {latestUsage.totalTokens.toLocaleString()} tokens
                  {latestUsage.costUsd !== undefined && (
                    <> · {latestUsage.costUsd < 0.01
                      ? `$${latestUsage.costUsd.toFixed(4)}`
                      : `$${latestUsage.costUsd.toFixed(2)}`}</>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Loading indicator - appears at bottom where new content will show */}
          <LoadingIndicator
            isLoading={isLoading}
            defaultMessage="Generating SVG..."
          />
        </div>
      </div>

      {/* Continue chat input - fixed at bottom. Native vector (Recraft)
          conversations can't be refined (the model regenerates from scratch
          instead of iterating), so Refine is disabled with an explanation.
          The conversation's model decides, not the picker's current value. */}
      {conversationId && svgCode && (
        <ContinueChatInput
          onSubmit={continueChat}
          disabled={isLoading || !canRefine}
          isLoading={isLoading}
          placeholder={
            canRefine
              ? 'Refine: Add a gradient fill...'
              : 'Refine not supported for Recraft — start a new generation to iterate'
          }
        />
      )}
    </div>
  );
};
