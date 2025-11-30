/**
 * ImageGenerationView - Image generation interface
 *
 * Pattern: Composition of existing image generation components
 * Responsibilities:
 * - Compose ModelSelector, AspectRatioSelector, ImageUploader, ImageGallery
 * - Receive hook instance as prop (prose-minion pattern)
 * - Handle image save state tracking
 */
import React from 'react';
import { UseImageGenerationReturn } from '../../hooks/domain/useImageGeneration';
import { ModelSelector } from '../image/ModelSelector';
import { AspectRatioSelector } from '../image/AspectRatioSelector';
import { ImageUploader } from '../image/ImageUploader';
import { ConversationThread } from '../image/ConversationThread';
import { ContinueChatInput } from '../shared/ContinueChatInput';
import { LoadingIndicator } from '../shared/LoadingIndicator';
import { OPENROUTER_IMAGE_MODELS } from '../../../../infrastructure/ai/providers/OpenRouterProvider';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { GeneratedImage } from '@messages';
import '../../styles/components/image-generation-view.css';

export interface ImageGenerationViewProps {
  imageGeneration: UseImageGenerationReturn;
}

export const ImageGenerationView: React.FC<ImageGenerationViewProps> = ({
  imageGeneration,
}) => {
  const {
    prompt,
    setPrompt,
    model,
    setModel,
    aspectRatio,
    setAspectRatio,
    seedInput,
    setSeedInput,
    referenceImages,
    referenceSvgText,
    referenceSvgWarning,
    addReferenceImage,
    removeReferenceImage,
    clearReferenceImages,
    conversationHistory,
    conversationId,
    isLoading,
    isEnhancing,
    error,
    generate,
    continueChat,
    clearConversation,
    saveImage,
    enhancePrompt,
  } = imageGeneration;

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

  // Track which images are being saved/have been saved
  const [savingIds, setSavingIds] = React.useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = React.useState<Set<string>>(new Set());

  const handleSaveImage = React.useCallback((image: GeneratedImage) => {
    setSavingIds(prev => new Set(prev).add(image.id));
    saveImage(image);
    // Mark as saved after a delay (the actual save result comes via message)
    setTimeout(() => {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(image.id);
        return next;
      });
      setSavedIds(prev => new Set(prev).add(image.id));
    }, 1000);
  }, [saveImage]);

  return (
    <div className="image-generation-view">
      {/* Input well: Model, Aspect Ratio, Seed, Prompt, Reference Images, Generate button */}
      <div className="well">
        {/* Header: Model + Aspect Ratio + Seed selectors */}
        <div className="image-generation-header">
          <ModelSelector
            models={OPENROUTER_IMAGE_MODELS}
            selectedModel={model}
            onModelChange={setModel}
            disabled={isLoading}
          />
          <AspectRatioSelector
            selectedRatio={aspectRatio}
            onRatioChange={setAspectRatio}
            disabled={isLoading}
          />
          <Input
            type="text"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="Auto Generate"
            disabled={isLoading}
            label="Seed"
            className="seed-input"
          />
        </div>

        {/* Prompt input */}
        <div className="image-generation-prompt-section">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
            disabled={isLoading}
            rows={3}
          />

          <div className="image-generation-actions-row">
            <ImageUploader
              images={referenceImages}
              onAddImage={addReferenceImage}
              onRemoveImage={removeReferenceImage}
              onClear={clearReferenceImages}
              disabled={isLoading}
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
            <div className="image-generation-svg-note">
              {referenceSvgWarning ?? 'SVG will be sent as text context (not as image).'}
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
          <div className="image-generation-error">
            {error}
          </div>
        )}
      </div>

      {/* Output well: Conversation header and thread */}
      <div className="well image-generation-output-well">
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
              disabled={isLoading}
            >
              <span aria-hidden="true">&#128465;</span>
            </button>
          </div>
        )}

        {/* Scrollable conversation area */}
        <div className="image-generation-scroll-area">
          {/* Conversation thread - chat-style display of all turns */}
          <ConversationThread
            turns={conversationHistory}
            onSaveImage={handleSaveImage}
            savingImageIds={savingIds}
            savedImageIds={savedIds}
          />

          {/* Loading indicator - appears at bottom where new content will show */}
          <LoadingIndicator
            isLoading={isLoading}
            defaultMessage="Generating image..."
          />
        </div>
      </div>

      {/* Continue chat input - fixed at bottom (only show when we have a conversation) */}
      {conversationId && conversationHistory.length > 0 && (
        <ContinueChatInput
          onSubmit={continueChat}
          disabled={isLoading}
          isLoading={isLoading}
          placeholder="Refine: Make it more vibrant..."
        />
      )}
    </div>
  );
};
