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
import { ImageGallery } from '../image/ImageGallery';
import { ContinueChatInput } from '../shared/ContinueChatInput';
import { LoadingIndicator } from '../shared/LoadingIndicator';
import { OPENROUTER_IMAGE_MODELS } from '../../../../infrastructure/ai/providers/OpenRouterProvider';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
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
    referenceImages,
    addReferenceImage,
    removeReferenceImage,
    clearReferenceImages,
    generatedImages,
    conversationId,
    isLoading,
    error,
    generate,
    continueChat,
    saveImage,
  } = imageGeneration;

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
      {/* Header: Model + Aspect Ratio selectors */}
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

        <ImageUploader
          images={referenceImages}
          onAddImage={addReferenceImage}
          onRemoveImage={removeReferenceImage}
          onClear={clearReferenceImages}
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

      {/* Loading indicator */}
      <LoadingIndicator
        isLoading={isLoading}
        defaultMessage="Generating image..."
      />

      {/* Error display */}
      {error && (
        <div className="image-generation-error">
          {error}
        </div>
      )}

      {/* Generated images gallery */}
      <ImageGallery
        images={generatedImages}
        onSaveImage={handleSaveImage}
        savingImageIds={savingIds}
        savedImageIds={savedIds}
      />

      {/* Continue chat input (only show when we have a conversation) */}
      {conversationId && generatedImages.length > 0 && (
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
