/**
 * SVGGenerationView - SVG generation interface
 *
 * Pattern: Composition of existing SVG generation components
 * Responsibilities:
 * - Compose ModelSelector, AspectRatioSelector, SingleImageUploader, SVGPreview, SVGCodeView
 * - Receive hook instance as prop (prose-minion pattern)
 * - Handle SVG save state tracking
 *
 * Layout: generation-view.css (shared with the Image tab).
 */
import React from 'react';
import { UseSVGGenerationReturn } from '../../hooks/domain/useSVGGeneration';
import { ModelSelector } from '../image/ModelSelector';
import { AspectRatioSelector } from '../image/AspectRatioSelector';
import { SingleImageUploader } from '../svg/SingleImageUploader';
import { SVGPreview } from '../svg/SVGPreview';
import { SVGCodeView } from '../svg/SVGCodeView';
import { ContinueChatInput } from '../shared/ContinueChatInput';
import { LoadingIndicator } from '../shared/LoadingIndicator';
import { OPENROUTER_SVG_MODELS } from '../../../../infrastructure/ai/providers/OpenRouterProvider';
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

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Reset save states when a new SVG arrives
  React.useEffect(() => {
    setSaving(false);
    setSaved(false);
  }, [svgCode, conversationId]);

  const handleSave = React.useCallback(() => {
    setSaving(true);
    saveSVG();
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 1000);
  }, [saveSVG]);

  const renderSizedPreview = React.useCallback((size: number) => (
    <div key={size} className="svg-sized-preview">
      <div
        className="svg-sized-preview-box"
        style={{ width: size, height: size }}
      >
        <SVGPreview svgCode={svgCode ?? ''} aspectRatio={aspectRatio} />
      </div>
      <span className="svg-sized-label">{size}x{size}</span>
    </div>
  ), [svgCode, aspectRatio]);

  return (
    <div className="generation-view svg-generation-view">
      {/* Input well: Model, Aspect Ratio, Prompt, Reference Image, Generate button */}
      <div className="well">
        {/* Header: Model and Aspect Ratio, stacked full width */}
        <div className="generation-header">
          <ModelSelector
            models={OPENROUTER_SVG_MODELS}
            selectedModel={model}
            onModelChange={setModel}
            kind="svg"
            disabled={isLoading}
          />
          <AspectRatioSelector
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
                    <SVGPreview svgCode={svgCode} aspectRatio={aspectRatio} />
                  </div>
                </div>
                <div className="svg-result-actions">
                  <SaveButton onClick={handleSave} saving={saving} saved={saved} />
                </div>
              </div>
              <div className="svg-preview-grid">
                {[32, 64, 128].map(renderSizedPreview)}
              </div>
              <SVGPreview svgCode={svgCode} aspectRatio={aspectRatio} />
              <SVGCodeView svgCode={svgCode} onCopy={copySVG} />
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

      {/* Continue chat input - fixed at bottom. Recraft vector models don't
          support multi-turn refinement (they regenerate from scratch instead
          of iterating), so disable Refine and explain why. */}
      {conversationId && svgCode && (
        (() => {
          const isRecraftVector = model.startsWith('recraft/');
          return (
            <ContinueChatInput
              onSubmit={continueChat}
              disabled={isLoading || isRecraftVector}
              isLoading={isLoading}
              placeholder={
                isRecraftVector
                  ? 'Refine not supported for Recraft — start a new generation to iterate'
                  : 'Refine: Add a gradient fill...'
              }
            />
          );
        })()
      )}
    </div>
  );
};
