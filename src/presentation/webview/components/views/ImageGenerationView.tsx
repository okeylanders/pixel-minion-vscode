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
 * - Browse one thread at a time with results-pane navigation
 * - Receive hook instance as prop (prose-minion pattern)
 * - Show each image's save state, as reported by the host (via the hook)
 *
 * Layout: generation-view.css (shared with the SVG tab, after Frame's
 * sprint-06 Image tab): stacked controls card, then an output card that
 * grows with the conversation, then the sticky refine bar.
 */
import React, { useEffect, useRef, useState } from 'react';
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
import type { GeneratedImage, ImageGenerationMode } from '@messages';
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

const PROMPT_ID = 'image-generation-prompt';

/** Where focus goes once an action removes the element that had it. */
type FocusTarget = 'prompt' | 'results';

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
  // Browsing never changes the live conversation or its host transcript.
  // null follows the latest result (the current thread, or newest archive).
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const hasCurrentThread = conversationHistory.length > 0 || isLoading;
  const threadCount = archivedThreads.length + (hasCurrentThread ? 1 : 0);
  const selectedIndex = selectedArchiveId === null ? -1
    : archivedThreads.findIndex(thread => thread.id === selectedArchiveId);
  const visibleIndex = !isLoading && selectedIndex >= 0 ? selectedIndex : threadCount - 1;
  const visibleArchive = archivedThreads[visibleIndex];
  const visibleTurns = visibleArchive?.turns ?? conversationHistory;
  const visibleSettings = visibleArchive?.settings ?? threadSettings;
  const visibleMode = visibleSettings?.mode ?? mode;
  useEffect(() => { setSelectedArchiveId(null); }, [conversationId, isLoading]);
  const browseThread = (index: number) => {
    if (busy || index < 0 || index >= threadCount) return;
    setSelectedArchiveId(archivedThreads[index]?.id ?? null);
  };
  // "Start … from this image" and Delete thread remove the button that was
  // pressed (the thread it sat in moves or goes), so focus is moved on
  // purpose once the change renders, instead of falling to <body>.
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!focusTarget) return;
    const element = focusTarget === 'results' ? resultsHeadingRef.current : null;
    (element ?? document.getElementById(PROMPT_ID))?.focus();
    setFocusTarget(null);
  }, [focusTarget]);
  /** Show the next newer thread after deleting, or the previous one at the end. */
  const deleteVisibleThread = () => {
    if (busy) return;
    if (visibleArchive) {
      const next = archivedThreads[visibleIndex + 1];
      const previous = archivedThreads[visibleIndex - 1];
      setSelectedArchiveId(next?.id ?? (hasCurrentThread ? null : previous?.id ?? null));
      removeArchivedThread(visibleArchive.id);
    } else {
      clearConversation();
      setSelectedArchiveId(null);
    }
    setFocusTarget(threadCount > 1 ? 'results' : 'prompt');
  };
  // Starting from an image attaches it as the next thread's reference, so it
  // is offered only when the draft model has a route in the selected mode
  // that takes a reference (not text-only), and per image only in a format
  // that route accepts.
  const acceptsReference = !!referenceLimits && referenceLimits.max > 0;
  const onStartFromImage = busy || !acceptsReference ? undefined : (image: GeneratedImage) => {
    startFromImage(image);
    // The image waits in the uploader; the prompt is the next thing to fill in.
    setSelectedArchiveId(null);
    setFocusTarget('prompt');
  };
  const referenceMimeTypes = capabilities?.referenceMimeTypes;
  const canStartFromImage = (image: GeneratedImage) => !referenceMimeTypes
    || (referenceMimeTypes as readonly string[]).includes(image.mimeType === 'image/jpg' ? 'image/jpeg' : image.mimeType);
  const startFromImageLabel = `Start a ${imageModeLabel(mode).toLowerCase()} from this image`;
  // A Single Shot follow-up sends the latest image, which a text-only model can't take.
  const threadIsTextOnly = threadSettings?.mode === 'edit'
    && imageRouteCapabilities(threadSettings.model, 'edit')?.referenceImages?.max === 0;
  const visibleThreadIsTextOnly = visibleSettings?.mode === 'edit'
    && imageRouteCapabilities(visibleSettings.model, 'edit')?.referenceImages?.max === 0;
  const threadModelLabel = OPENROUTER_IMAGE_MODELS.find(entry => entry.id === visibleSettings?.model)?.displayName
    ?? visibleSettings?.model;
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
    if (visibleTurns.length === 0) return '';
    const firstPrompt = visibleTurns[0].prompt;
    return firstPrompt.length > 25 ? `${firstPrompt.slice(0, 25)}...` : firstPrompt;
  };

  return (
    <div className="generation-view image-generation-view">
      {/* The mode for the next thread: a segmented control (two toggle buttons) styled as a pill on
          the input card's top edge. Buttons, not radios: a switch keeps the current thread under
          Earlier threads, so it happens only on click, Enter or Space, never when arrow keys move
          focus. Each button is its own Tab stop; the pressed one is the mode. */}
      <fieldset className="image-mode-selector" disabled={busy} aria-label="Image generation mode">
        {MODES.map(value => (
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>
            {imageModeLabel(value)}
          </button>
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
          <br />Switching modes starts a new thread. Use the arrows in the results pane to browse previous threads.
        </p>

        {/* Prompt input */}
        <div className="generation-prompt-section">
          <Textarea
            id={PROMPT_ID}
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
      <section className="well generation-output-well" aria-label="Image results">
        {/* The thread's mode and own settings: follow-ups use these, not the controls above */}
        <div className="image-thread-description">
          <div className="image-results-toolbar">
            <h3 className="image-results-heading" ref={resultsHeadingRef} tabIndex={-1}>
              {imageModeLabel(visibleMode)}{visibleMode === 'edit' ? ' history' : ''}
            </h3>
            {threadCount > 0 && (
              <nav className="image-thread-navigation" aria-label="Result threads">
                <button type="button" className="image-thread-arrow" title="Previous thread" aria-label="Previous thread"
                  disabled={busy || visibleIndex <= 0} onClick={() => browseThread(visibleIndex - 1)}>
                  <LineGlyph size={16}><path d="M19 12H5m7-7-7 7 7 7" /></LineGlyph>
                </button>
                <span className="image-thread-position" role="status" aria-live="polite" aria-atomic="true">
                  <span aria-hidden="true">{visibleIndex + 1} / {threadCount}</span>
                  <span className="visually-hidden">Thread {visibleIndex + 1} of {threadCount}{visibleArchive ? ', earlier thread' : ', current thread'}</span>
                </span>
                <button type="button" className="image-thread-arrow" title="Next thread" aria-label="Next thread"
                  disabled={busy || visibleIndex >= threadCount - 1} onClick={() => browseThread(visibleIndex + 1)}>
                  <LineGlyph size={16}><path d="M5 12h14m-7-7 7 7-7 7" /></LineGlyph>
                </button>
              </nav>
            )}
          </div>
          <p className="generation-note">
            {visibleThreadIsTextOnly
              ? 'This model generates from text only. Start a new generation above to make another image.'
              : imageModeDescription(visibleMode)}
          </p>
          {visibleSettings && (
            <small className="image-thread-settings">
              {threadModelLabel} · {visibleSettings.aspectRatio === 'auto' ? 'Auto ratio' : visibleSettings.aspectRatio} · {visibleSettings.resolution === 'auto' ? 'Default resolution' : visibleSettings.resolution}
            </small>
          )}
          {visibleArchive && <p className="generation-note">Earlier thread. To make changes, start a new thread from an image below.</p>}
          {!visibleArchive && draftDiffersFromThread && (
            <p className="generation-note">Controls above apply to a new thread. Follow-ups keep this thread’s settings.</p>
          )}
        </div>
        {persistenceWarning && <div className="generation-warning" role="status">{persistenceWarning}</div>}
        {!visibleArchive && recoveryWarning && <div className="generation-warning" role="status">{recoveryWarning}</div>}

        {/* Conversation header - only show when we have a conversation */}
        {visibleTurns.length > 0 && (
          <div className="conversation-header">
            <div className="conversation-header-info">
              <span className="conversation-header-title">{getConversationTitle()}</span>
              <span className="conversation-header-date">
                {formatDateTime(visibleTurns[0].timestamp)}
              </span>
            </div>
            <button
              type="button"
              className="conversation-header-clear"
              onClick={deleteVisibleThread}
              title={visibleArchive ? 'Delete thread' : 'Clear thread'}
              aria-label={visibleArchive ? 'Delete thread' : 'Clear thread'}
              disabled={busy}
            >
              <TrashIcon />
            </button>
          </div>
        )}

        {/* Empty state until the first generation */}
        {visibleTurns.length === 0 && !isLoading && (
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
            turns={visibleTurns}
            onSaveImage={saveImage}
            onStartFromImage={onStartFromImage}
            canStartFromImage={canStartFromImage}
            startFromImageLabel={startFromImageLabel}
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
        {!visibleArchive && followUpSizeWarning && !threadIsTextOnly && (
          <div className="generation-warning" role="status">⚠️ {followUpSizeWarning}</div>
        )}
      </section>

      {/* Continue chat input - fixed at bottom (only show when we have a conversation) */}
      {conversationId && conversationHistory.length > 0 && !threadIsTextOnly && (
        <ContinueChatInput
          key={conversationId}
          hidden={!!visibleArchive}
          submitLabel={activeMode === 'edit' ? 'Generate' : 'Send'}
          onSubmit={continueChat}
          disabled={busy || !!visibleArchive}
          isLoading={isLoading}
          placeholder={activeMode === 'edit'
            ? 'Write a prompt using the latest image...'
            : 'Continue the conversation...'}
        />
      )}
    </div>
  );
};
