/**
 * SVGGenerationView - SVG generation interface
 *
 * Pattern: Composition of existing SVG generation components
 * Responsibilities:
 * - Compose ModelSelector, AspectRatioSelector, SingleImageUploader, SVGPreview, SVGCodeView
 * - Receive hook instance as prop (prose-minion pattern)
 * - Handle SVG save state tracking
 */
import React, { useState, useEffect } from 'react';
import { UseSVGGenerationReturn } from '../../hooks/domain/useSVGGeneration';
import { UseSvgArchitectReturn } from '../../hooks/domain/useSvgArchitect';
import { ModelSelector } from '../image/ModelSelector';
import { AspectRatioSelector } from '../image/AspectRatioSelector';
import { SingleImageUploader } from '../svg/SingleImageUploader';
import { SVGPreview } from '../svg/SVGPreview';
import { SVGCodeView } from '../svg/SVGCodeView';
import { OutputSubTabs, ArchitectDashboard, ArchitectConversation, OutputSubTab } from '../svg';
import { ContinueChatInput } from '../shared/ContinueChatInput';
import { LoadingIndicator } from '../shared/LoadingIndicator';
import { OPENROUTER_SVG_MODELS } from '../../../../infrastructure/ai/providers/OpenRouterProvider';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { ToggleSwitch } from '../common';
import { SaveButton } from '../shared/SaveButton';
import '../../styles/components/svg-generation-view.css';

export interface SVGGenerationViewProps {
  svgGeneration: UseSVGGenerationReturn;
  svgArchitect: UseSvgArchitectReturn;
  svgBlueprintModel: string;
  svgArchitectMaxIterations: number;
}

export const SVGGenerationView: React.FC<SVGGenerationViewProps> = ({
  svgGeneration,
  svgArchitect,
  svgBlueprintModel,
  svgArchitectMaxIterations,
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

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outputSubTab, setOutputSubTab] = useState<OutputSubTab>('svg');

  // Reset save states when a new SVG arrives
  useEffect(() => {
    setSaving(false);
    setSaved(false);
  }, [svgCode, conversationId]);

  // Auto-switch to dashboard when architect starts
  useEffect(() => {
    if (svgArchitect.status === 'analyzing' && outputSubTab !== 'dashboard') {
      setOutputSubTab('dashboard');
    }
  }, [svgArchitect.status, outputSubTab]);

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

  const handleGenerate = React.useCallback(() => {
    if (svgArchitect.isEnabled) {
      // Use architect for high-quality generation
      svgArchitect.generate(prompt, {
        blueprintModel: svgBlueprintModel,
        renderModel: model,
        aspectRatio,
        maxIterations: svgArchitectMaxIterations,
        referenceImage: referenceImage ?? undefined,
        referenceSvgText: referenceSvgText ?? undefined,
      });
    } else {
      // Use standard generation
      generate();
    }
  }, [
    svgArchitect,
    prompt,
    model,
    aspectRatio,
    svgBlueprintModel,
    svgArchitectMaxIterations,
    referenceImage,
    referenceSvgText,
    generate,
  ]);

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
            disabled={isLoading || svgArchitect.status !== 'idle'}
          />
          <AspectRatioSelector
            selectedRatio={aspectRatio}
            onRatioChange={setAspectRatio}
            disabled={isLoading || svgArchitect.status !== 'idle'}
          />
          <ToggleSwitch
            checked={svgArchitect.isEnabled}
            onChange={svgArchitect.setEnabled}
            label="High Quality"
            disabled={isLoading || svgArchitect.status !== 'idle'}
          />
        </div>

        {/* Prompt input */}
        <div className="svg-generation-prompt-section">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the SVG you want to create..."
            disabled={isLoading || svgArchitect.status !== 'idle'}
            rows={3}
          />

          <SingleImageUploader
            attachment={{ preview: referenceImage, svgText: referenceSvgText }}
            onAttachmentChange={setReferenceAttachment}
            disabled={isLoading || svgArchitect.status !== 'idle'}
          />

          <Button
            onClick={handleGenerate}
            disabled={isLoading || svgArchitect.status !== 'idle' || !prompt.trim()}
            variant="primary"
          >
            {(isLoading || svgArchitect.status !== 'idle') ? 'Generating...' : '⚡ Generate'}
          </Button>
        </div>

        {/* Error display */}
        {(error || svgArchitect.error) && (
          <div className="svg-generation-error">
            {error || svgArchitect.error}
          </div>
        )}
      </div>

      {/* Output well: Scrollable result area */}
      <div className="well svg-generation-output-well">
        {/* Output sub-tabs */}
        <OutputSubTabs
          activeSubTab={outputSubTab}
          onSubTabChange={setOutputSubTab}
          architectEnabled={svgArchitect.isEnabled}
        />

        <div className="svg-generation-scroll-area">
          {/* SVG tab - standard output */}
          {outputSubTab === 'svg' && (
            <>
              {/* Generated SVG preview and code */}
              {(svgCode || svgArchitect.svgCode) && (
                <div className="svg-generation-result">
                  <div className="svg-result-header">
                    <div className="svg-result-title">
                      <h3>Generated SVG</h3>
                      <div className="svg-inline-preview">
                        <SVGPreview svgCode={svgCode || svgArchitect.svgCode || ''} aspectRatio={aspectRatio} />
                      </div>
                    </div>
                    <div className="svg-result-actions">
                      <SaveButton onClick={handleSave} saving={saving} saved={saved} />
                    </div>
                  </div>
                  <div className="svg-preview-grid">
                    {[32, 64, 128].map(renderSizedPreview)}
                  </div>
                  <SVGPreview svgCode={svgCode || svgArchitect.svgCode || ''} aspectRatio={aspectRatio} />
                  <SVGCodeView svgCode={svgCode || svgArchitect.svgCode || ''} onCopy={copySVG} />
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
            </>
          )}

          {/* Dashboard tab - architect progress */}
          {outputSubTab === 'dashboard' && (
            <ArchitectDashboard
              status={svgArchitect.status}
              iteration={svgArchitect.iteration}
              maxIterations={svgArchitect.maxIterations}
              blueprint={svgArchitect.blueprint}
              confidenceScore={svgArchitect.confidenceScore}
            />
          )}

          {/* Conversation tab - architect log */}
          {outputSubTab === 'conversation' && (
            <ArchitectConversation
              entries={svgArchitect.conversationEntries}
              userNotes={svgArchitect.userNotes}
              onUserNotesChange={svgArchitect.setUserNotes}
              onSubmitNotes={() => svgArchitect.submitUserNotes(svgArchitect.userNotes)}
              showUserInput={svgArchitect.status === 'awaiting_user'}
            />
          )}
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
