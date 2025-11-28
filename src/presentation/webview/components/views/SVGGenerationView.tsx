/**
 * SVGGenerationView - SVG generation interface
 *
 * Pattern: Composition of existing SVG generation components
 * Responsibilities:
 * - Compose ModelSelector, AspectRatioSelector, SingleImageUploader, SVGPreview, SVGCodeView
 * - Use useSVGGeneration hook for state and actions
 * - Handle SVG save state tracking
 */
import React from 'react';
import { useSVGGeneration } from '../../hooks/domain/useSVGGeneration';
import { ModelSelector } from '../image/ModelSelector';
import { AspectRatioSelector } from '../image/AspectRatioSelector';
import { SingleImageUploader } from '../svg/SingleImageUploader';
import { SVGPreview } from '../svg/SVGPreview';
import { SVGCodeView } from '../svg/SVGCodeView';
import { ContinueChatInput } from '../shared/ContinueChatInput';
import { OPENROUTER_SVG_MODELS } from '../../../../infrastructure/ai/providers/OpenRouterProvider';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { SaveButton } from '../shared/SaveButton';
import '../../styles/components/svg-generation-view.css';

export const SVGGenerationView: React.FC = () => {
  const {
    prompt,
    setPrompt,
    model,
    setModel,
    aspectRatio,
    setAspectRatio,
    referenceImage,
    setReferenceImage,
    svgCode,
    conversationId,
    isLoading,
    error,
    generate,
    continueChat,
    saveSVG,
    copySVG,
  } = useSVGGeneration();

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

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
          image={referenceImage}
          onImageChange={setReferenceImage}
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
        </div>
      )}

      {/* Continue chat input */}
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
