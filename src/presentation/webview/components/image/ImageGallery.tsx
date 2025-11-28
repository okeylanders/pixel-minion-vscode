/**
 * ImageGallery - Component for displaying a grid of generated images
 *
 * Pattern: Displays generated images using ImageCard in a responsive grid layout
 */
import React from 'react';
import { GeneratedImage } from '../../../../shared/types/messages/imageGeneration';
import { ImageCard } from './ImageCard';
import '../../styles/components/image-gallery.css';

export interface ImageGalleryProps {
  images: GeneratedImage[];
  onSaveImage: (image: GeneratedImage) => void;
  savingImageIds?: Set<string>;
  savedImageIds?: Set<string>;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  onSaveImage,
  savingImageIds = new Set(),
  savedImageIds = new Set(),
}) => {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="image-gallery">
      <h3 className="image-gallery-title">Generated Images</h3>
      <div className="image-gallery-grid">
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            onSave={onSaveImage}
            saving={savingImageIds.has(image.id)}
            saved={savedImageIds.has(image.id)}
          />
        ))}
      </div>
    </div>
  );
};
