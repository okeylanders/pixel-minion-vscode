/**
 * SVGGenerationView - SVG generation interface
 *
 * Pattern: Composition of existing SVG generation components
 * Responsibilities:
 * - Compose ModelSelector, AspectRatioSelector, SingleImageUploader, SVGPreview, SVGCodeView
 * - Receive hook instance as prop (prose-minion pattern)
 * - Handle SVG save state tracking
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

  return (
    <div className="svg-generation-view">
      {/* Input well: Model, Aspect Ratio, Prompt, Reference Image, Generate button */}
      <div className="well">
        {/* Header: Model + Aspect Ratio selectors */}
        <div className="svg-generation-header">
          <ModelSelector
            models={OPENROUTER_SVG_MODELS}
            selectedModel={model}
            onModelChange={setModel}
            disabled={isLoading}
          />
          <AspectRatioSelector
            selectedRatio={aspectRatio}
            onRatioChange={setAspectRatio}
            disabled={isLoading}
          />
        </div>

        {/* Prompt input */}
        <div className="svg-generation-prompt-section">
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
            {isLoading ? 'Generating...' : 'Generate'}
          </Button>
        </div>

        {/* Error display */}
        {error && (
          <div className="svg-generation-error">
            {error}
          </div>
        )}
      </div>

      {/* Output well: Scrollable result area */}
      <div className="well svg-generation-output-well">
        <div className="svg-generation-scroll-area">
          {/* Generated SVG preview and code */}
          {svgCode && (
            <div className="svg-generation-result">
              <div className="svg-result-header">
                <h3>Generated SVG</h3>
                <div className="svg-result-actions">
                  <SaveButton onClick={handleSave} saving={saving} saved={saved} />
                </div>
              </div>
              <SVGPreview svgCode={svgCode} aspectRatio={aspectRatio} />
              <SVGCodeView svgCode={svgCode} onCopy={copySVG} />
              {latestUsage && (
                <div className="svg-usage-display">
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

      {/* Continue chat input - fixed at bottom */}
      {conversationId && svgCode && (
        <ContinueChatInput
          onSubmit={continueChat}
          disabled={isLoading}
          isLoading={isLoading}
          placeholder="Refine: Add a gradient fill..."
        />
      )}
    </div>
  );
};
