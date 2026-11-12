/**
 * ImageGenerationView - Image generation interface
 *
 * Pattern: Composition of existing image generation components
 * Responsibilities:
 * - Compose ModelSelector, AspectRatioSelector, ResolutionSelector,
 *   ImageUploader, ConversationThread
 * - The Conversation | Single Shot toggle for the next thread, the model
 *   list filtered to that mode, and copy explaining which endpoint it uses
 * - Show only the controls the selected model's route supports
 *   (imageRouteCapabilities), and block Generate while the attached
 *   references don't fit the model
 * - Earlier threads (browse, save, start a new thread from an image, delete)
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
  imageModeEndpointDescription,
  imageModeLabel,
  imageRouteCapabilities,
} from '@shared/models';
import type { ImageGenerationMode } from '@messages';
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

const MODES: readonly ImageGenerationMode[] = ['conversation', 'edit'];

/** Why the selected model sits outside the mode's list (helper text under the picker). */
function unavailableModelHelp(model: string, mode: ImageGenerationMode): string {
  if (imageRouteCapabilities(model, mode)) return CUSTOM_IMAGE_MODEL_HELP;
  return OPENROUTER_IMAGE_MODELS.some(entry => entry.id === model)
    ? `This model has no verified ${imageModeLabel(mode)} route. Choose a listed model, or switch to Single Shot.`
    : 'A custom model id runs in Single Shot only, until a Conversation route is verified for it.';
}

export interface ImageGenerationViewProps {
  imageGeneration: UseImageGenerationReturn;
}

export const ImageGenerationView: React.FC<ImageGenerationViewProps> = ({
  imageGeneration,
}) => {
  const {
    mode,
    setMode,
    archivedThreads,
    startFromImage,
    removeArchivedThread,
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
  // Why Generate can't run with these controls: shown as a warning, and
  // always attached to the button as its description, so assistive tech
  // says why it is disabled (an empty prompt has no visible warning).
  const generateBlockedReason = !capabilities
    ? `The selected model is unavailable in ${imageModeLabel(mode)}. Choose a supported model above.`
    : referenceIssue;
  const generateDescription = generateBlockedReason
    ?? (!isLoading && !prompt.trim() ? 'Enter a prompt to generate.' : '');
  const busy = isLoading || isEnhancing;
  // The thread on screen keeps its own mode; the toggle sets the next one's.
  const activeMode = threadSettings?.mode ?? mode;
  const supportedModels = OPENROUTER_IMAGE_MODELS.filter(entry => imageRouteCapabilities(entry.id, mode));
  // Starting from an image attaches it to the next thread, which a text-only model can't take.
  const onStartFromImage = busy || referenceLimits?.max === 0 ? undefined : startFromImage;
  const startFromImageLabel = `Start a ${imageModeLabel(mode).toLowerCase()} from this image`;
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
      {/* The mode for the next thread: native radios styled as a pill on the input card's top edge */}
      <fieldset className="image-mode-selector" disabled={busy} aria-label="Image generation mode">
        {MODES.map(value => (
          <label key={value}>
            <input
              type="radio"
              name="image-generation-mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            <span>{imageModeLabel(value)}</span>
          </label>
        ))}
      </fieldset>
      {/* Input well: Model, Aspect Ratio, Resolution, Seed, Prompt, Reference Images, Generate button */}
      <div className="well">
        {/* Header: Model, then only the controls this model's route supports (two columns from 480 px) */}
        <div className="generation-header image-generation-header">
          <ModelSelector
            models={supportedModels}
            catalog={OPENROUTER_IMAGE_MODELS}
            selectedModel={model}
            onModelChange={setModel}
            unavailableLabel={unavailableModelHelp(model, mode)}
            disabled={busy}
          />
          {capabilities?.supportedAspectRatios.some(ratio => ratio !== 'auto') && (
            <AspectRatioSelector
              model={model}
              mode={mode}
              selectedRatio={aspectRatio}
              onRatioChange={setAspectRatio}
              disabled={busy}
            />
          )}
          {capabilities?.supportedResolutions.length ? (
            <ResolutionSelector
              model={model}
              mode={mode}
              selectedResolution={resolution}
              onResolutionChange={setResolution}
              disabled={busy}
            />
          ) : null}
          {capabilities?.supportsSeed && (
            <Input
              type="text"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="Auto Generate"
              disabled={busy}
              label="Seed"
              className="seed-input"
            />
          )}
        </div>

        <p className="generation-note image-mode-description">
          {imageModeEndpointDescription(mode, model)}{mode === 'conversation' && ' Longer conversations may cost more.'}
          <br />Switching modes starts a new thread and keeps earlier threads below.
        </p>

        {/* Prompt input */}
        <div className="generation-prompt-section">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
            disabled={busy}
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
              disabled={busy}
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
          {generateBlockedReason && (
            <div className="generation-warning" role="status">
              {generateBlockedReason}
            </div>
          )}

          {/* Always rendered (out of the layout): Generate's description. */}
          <span id="image-generate-description" className="visually-hidden">{generateDescription}</span>
          <Button
            onClick={generate}
            disabled={busy || !!generateBlockedReason || !prompt.trim()}
            aria-describedby="image-generate-description"
            variant="primary"
          >
            {isLoading ? 'Generating...' : mode === 'conversation' ? '⚡ Start Conversation' : '⚡ Generate'}
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
        {/* The thread's mode and own settings: follow-ups use these, not the controls above */}
        <div className="image-thread-description">
          <strong>{imageModeLabel(activeMode)}{activeMode === 'edit' ? ' history' : ''}</strong>
          <p className="generation-note">
            {threadIsTextOnly
              ? 'This model generates from text only. Start a new generation above to make another image.'
              : imageModeDescription(activeMode)}
          </p>
          {threadSettings && (
            <small className="image-thread-settings">
              {threadModelLabel} · {threadSettings.aspectRatio === 'auto' ? 'Auto ratio' : threadSettings.aspectRatio} · {threadSettings.resolution === 'auto' ? 'Default resolution' : threadSettings.resolution}
            </small>
          )}
          {draftDiffersFromThread && (
            <p className="generation-note">Controls above apply to a new thread. Follow-ups keep this thread’s settings.</p>
          )}
        </div>
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
              title="Clear thread"
              aria-label="Clear thread"
              disabled={busy}
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
              {activeMode === 'conversation'
                ? 'Describe one above and start a conversation, then refine it with follow-up prompts.'
                : referenceLimits?.max === 0
                  ? 'Describe one above and press Generate. This model works from text only.'
                  : 'Describe one above and press Generate. A follow-up prompt works from the latest image.'}
            </p>
          </div>
        )}

        {/* Conversation (the tab content is the scroller) */}
        <div className="generation-output">
          {/* Conversation thread - chat-style display of all turns */}
          <ConversationThread
            turns={conversationHistory}
            onSaveImage={saveImage}
            onStartFromImage={onStartFromImage}
            startFromImageLabel={startFromImageLabel}
            savingImageIds={savingImageIds}
            savedImageIds={savedImageIds}
          />

          {/* Earlier threads: browse, save, start again; they don't continue */}
          {archivedThreads.length > 0 && (
            <section className="image-archived-threads" aria-labelledby="image-archived-threads-title">
              <h3 id="image-archived-threads-title" className="image-archived-threads-title">Earlier threads</h3>
              {[...archivedThreads].reverse().map(thread => (
                <details key={thread.id} className="image-archived-thread">
                  <summary>
                    {imageModeLabel(thread.settings.mode)} · {thread.turns[0]?.prompt.slice(0, 40)} · {thread.turns.length} {thread.turns.length === 1 ? 'turn' : 'turns'}
                  </summary>
                  <p className="generation-note">{imageModeDescription(thread.settings.mode)}</p>
                  <ConversationThread
                    turns={thread.turns}
                    onSaveImage={saveImage}
                    onStartFromImage={onStartFromImage}
                    startFromImageLabel={startFromImageLabel}
                    savingImageIds={savingImageIds}
                    savedImageIds={savedImageIds}
                  />
                  <Button variant="secondary" onClick={() => removeArchivedThread(thread.id)} disabled={busy}>
                    Delete thread
                  </Button>
                </details>
              ))}
            </section>
          )}

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
          submitLabel={activeMode === 'edit' ? 'Generate' : 'Send'}
          onSubmit={continueChat}
          disabled={busy}
          isLoading={isLoading}
          placeholder={activeMode === 'edit'
            ? 'Write a prompt using the latest image...'
            : 'Continue the conversation...'}
        />
      )}
    </div>
  );
};
