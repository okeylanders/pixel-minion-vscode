/**
 * ImageGenerationView - Image generation interface
 *
 * Pattern: Composition of existing image generation components
 * Responsibilities:
 * - Compose ModelSelector, AspectRatioSelector, ResolutionSelector,
 *   ImageUploader, ConversationThread
 * - Show only the controls the selected model's route supports
 *   (imageRouteCapabilities), and block Generate while the attached
 *   references don't fit the model
 * - Receive hook instance as prop (prose-minion pattern)
 * - Show each image's save state, as reported by the host (via the hook)
 *
 * Layout: generation-view.css (shared with the SVG tab, after Frame's
 * sprint-06 Image tab): stacked controls card, then an output card that
 * grows with the conversation, then the sticky refine bar.
 */
import React from 'react';
import { UseImageGenerationReturn, referenceRequirementNote } from '../../hooks/domain/useImageGeneration';
import { ModelSelector } from '../image/ModelSelector';
import { AspectRatioSelector } from '../image/AspectRatioSelector';
import { ResolutionSelector } from '../image/ResolutionSelector';
import { ImageUploader } from '../image/ImageUploader';
import { ConversationThread } from '../image/ConversationThread';
import { ContinueChatInput } from '../shared/ContinueChatInput';
import { LoadingIndicator } from '../shared/LoadingIndicator';
import {
  OPENROUTER_IMAGE_MODELS,
  imageModeDescription,
  imageModeLabel,
  imageRouteCapabilities,
} from '@shared/models';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { LineGlyph } from '../common/LineGlyph';
import { TabImageIcon } from '../layout/tabIcons';
import { OFF_LIST_MODEL_HELP } from '../shared/modelBrowserOptions';
import '../../styles/components/generation-view.css';
import '../../styles/components/image-generation-view.css';

const TrashIcon: React.FC = () => (
  <LineGlyph size={16}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V4h6v3" />
  </LineGlyph>
);

/** Helper under the picker for an id the catalog doesn't list. */
const CUSTOM_IMAGE_MODEL_HELP = `${OFF_LIST_MODEL_HELP} It runs as Single Shot through /images with automatic dimensions.`;

export interface ImageGenerationViewProps {
  imageGeneration: UseImageGenerationReturn;
}

export const ImageGenerationView: React.FC<ImageGenerationViewProps> = ({
  imageGeneration,
}) => {
  const {
    mode,
    prompt,
    setPrompt,
    model,
    setModel,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    seedInput,
    setSeedInput,
    referenceImages,
    referenceSvgText,
    referenceSvgIndex,
    referenceSvgWarning,
    referenceImageSizeWarning,
    followUpSizeWarning,
    referenceIssue,
    addReferenceImage,
    removeReferenceImage,
    clearReferenceImages,
    conversationHistory,
    conversationId,
    threadSettings,
    recoveryWarning,
    persistenceWarning,
    draftWarning,
    savingImageIds,
    savedImageIds,
    isLoading,
    isEnhancing,
    error,
    generate,
    continueChat,
    clearConversation,
    saveImage,
    enhancePrompt,
  } = imageGeneration;
  const capabilities = imageRouteCapabilities(model, mode);
  const referenceLimits = capabilities?.referenceImages;
  const requirementNote = referenceRequirementNote(capabilities);
  // A Single Shot follow-up sends the latest image, which a text-only model can't take.
  const threadIsTextOnly = threadSettings?.mode === 'edit'
    && imageRouteCapabilities(threadSettings.model, 'edit')?.referenceImages?.max === 0;
  const threadModelLabel = OPENROUTER_IMAGE_MODELS.find(entry => entry.id === threadSettings?.model)?.displayName
    ?? threadSettings?.model;
  const draftDiffersFromThread = !!threadSettings && (
    threadSettings.model !== model
    || threadSettings.aspectRatio !== aspectRatio
    || threadSettings.resolution !== resolution
  );

  // Format the conversation start time
  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get conversation title from first prompt
  const getConversationTitle = () => {
    if (conversationHistory.length === 0) return '';
    const firstPrompt = conversationHistory[0].prompt;
    return firstPrompt.length > 25 ? `${firstPrompt.slice(0, 25)}...` : firstPrompt;
  };

  return (
    <div className="generation-view image-generation-view">
      {/* Input well: Model, Aspect Ratio, Seed, Prompt, Reference Images, Generate button */}
      <div className="well">
        {/* Header: Model, then only the controls this model's route supports */}
        <div className="generation-header">
          <ModelSelector
            models={OPENROUTER_IMAGE_MODELS}
            selectedModel={model}
            onModelChange={setModel}
            unavailableLabel={CUSTOM_IMAGE_MODEL_HELP}
            disabled={isLoading}
          />
          {capabilities?.supportedAspectRatios.some(ratio => ratio !== 'auto') && (
            <AspectRatioSelector
              model={model}
              mode={mode}
              selectedRatio={aspectRatio}
              onRatioChange={setAspectRatio}
              disabled={isLoading}
            />
          )}
          {capabilities?.supportedResolutions.length ? (
            <ResolutionSelector
              model={model}
              mode={mode}
              selectedResolution={resolution}
              onResolutionChange={setResolution}
              disabled={isLoading}
            />
          ) : null}
          {capabilities?.supportsSeed && (
            <Input
              type="text"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="Auto Generate"
              disabled={isLoading}
              label="Seed"
              className="seed-input"
            />
          )}
        </div>

        {/* Prompt input */}
        <div className="generation-prompt-section">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
            disabled={isLoading}
            rows={3}
          />
          {draftWarning && <div className="generation-warning" role="status">{draftWarning}</div>}

          <div className="image-generation-actions-row">
            <ImageUploader
              images={referenceImages}
              svgIndex={referenceSvgIndex}
              onAddImage={addReferenceImage}
              onRemoveImage={removeReferenceImage}
              onClear={clearReferenceImages}
              disabled={isLoading}
              maxImages={referenceLimits?.max ?? 4}
              accept={capabilities?.referenceMimeTypes?.join(',')}
            />
            <Button
              onClick={enhancePrompt}
              disabled={isLoading || isEnhancing || !prompt.trim()}
              variant="secondary"
              className="enhance-prompt-button"
            >
              {isEnhancing ? 'Enhancing...' : '🤖 Enhance Prompt'}
            </Button>
          </div>
          {referenceSvgText && (
            <div className="generation-note">
              {referenceSvgWarning ?? 'SVG will be sent as text context (not as image).'}
            </div>
          )}
          {conversationId && referenceImages.length > 0 && (
            <div className="generation-note">
              References apply to the next Generate. Refine continues from the latest image.
            </div>
          )}
          {referenceImageSizeWarning && (
            <div className="generation-warning" role="status">
              ⚠️ {referenceImageSizeWarning}
            </div>
          )}
          {requirementNote && <div className="generation-note">{requirementNote}</div>}
          {referenceIssue && (
            <div className="generation-warning" role="status">
              {referenceIssue}
            </div>
          )}
          {!capabilities && (
            <div className="generation-warning" role="status">
              The selected model is unavailable in {imageModeLabel(mode)}. Choose a supported model above.
            </div>
          )}

          <Button
            onClick={generate}
            disabled={isLoading || !capabilities || !!referenceIssue || !prompt.trim()}
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

      {/* Output well: Conversation header and thread */}
      <div className="well generation-output-well">
        {/* The thread's own settings: follow-ups use these, not the controls above */}
        {threadSettings && (
          <div className="image-thread-description">
            <strong>{imageModeLabel(threadSettings.mode)}{threadSettings.mode === 'edit' ? ' history' : ''}</strong>
            <p className="generation-note">
              {threadIsTextOnly
                ? 'This model generates from text only. Start a new generation above to make another image.'
                : imageModeDescription(threadSettings.mode)}
            </p>
            <small className="image-thread-settings">
              {threadModelLabel} · {threadSettings.aspectRatio === 'auto' ? 'Auto ratio' : threadSettings.aspectRatio} · {threadSettings.resolution === 'auto' ? 'Default resolution' : threadSettings.resolution}
            </small>
            {draftDiffersFromThread && (
              <p className="generation-note">Controls above apply to a new thread. Follow-ups keep this thread’s settings.</p>
            )}
          </div>
        )}
        {persistenceWarning && <div className="generation-warning" role="status">{persistenceWarning}</div>}
        {recoveryWarning && <div className="generation-warning" role="status">{recoveryWarning}</div>}

        {/* Conversation header - only show when we have a conversation */}
        {conversationHistory.length > 0 && (
          <div className="conversation-header">
            <div className="conversation-header-info">
              <span className="conversation-header-title">{getConversationTitle()}</span>
              <span className="conversation-header-date">
                {formatDateTime(conversationHistory[0].timestamp)}
              </span>
            </div>
            <button
              type="button"
              className="conversation-header-clear"
              onClick={clearConversation}
              title="Clear conversation"
              aria-label="Clear conversation"
              disabled={isLoading}
            >
              <TrashIcon />
            </button>
          </div>
        )}

        {/* Empty state until the first generation */}
        {conversationHistory.length === 0 && !isLoading && (
          <div className="generation-empty">
            <span className="generation-empty-icon" aria-hidden="true">
              <TabImageIcon size={22} />
            </span>
            <p className="generation-empty-title">Your images appear here</p>
            <p className="generation-empty-hint">
              Describe one above and press Generate, then refine it with follow-up prompts.
            </p>
          </div>
        )}

        {/* Conversation (the tab content is the scroller) */}
        <div className="generation-output">
          {/* Conversation thread - chat-style display of all turns */}
          <ConversationThread
            turns={conversationHistory}
            onSaveImage={saveImage}
            savingImageIds={savingImageIds}
            savedImageIds={savedImageIds}
          />

          {/* Loading indicator - appears at bottom where new content will show */}
          <LoadingIndicator
            isLoading={isLoading}
            defaultMessage="Generating image..."
          />
        </div>
        {/* Beside the refine bar: what a follow-up would send */}
        {followUpSizeWarning && !threadIsTextOnly && (
          <div className="generation-warning" role="status">⚠️ {followUpSizeWarning}</div>
        )}
      </div>

      {/* Continue chat input - fixed at bottom (only show when we have a conversation) */}
      {conversationId && conversationHistory.length > 0 && !threadIsTextOnly && (
        <ContinueChatInput
          key={conversationId}
          onSubmit={continueChat}
          disabled={isLoading}
          isLoading={isLoading}
          placeholder={threadSettings?.mode === 'edit'
            ? 'Write a prompt using the latest image...'
            : 'Continue the conversation...'}
        />
      )}
    </div>
  );
};
