/**
 * ImageCard - Display a generated image with save functionality
 *
 * Features:
 * - Square aspect ratio container for consistent layout
 * - Image preview with object-fit contain
 * - Truncated prompt display with full text on hover
 * - Save button integration
 */
import React from 'react';
import { GeneratedImage } from '../../../../shared/types/messages/imageGeneration';
import { SaveButton } from '../shared/SaveButton';
import '../../styles/components/image-card.css';

export interface ImageCardProps {
  image: GeneratedImage;
  onSave: (image: GeneratedImage) => void;
  saving?: boolean;
  saved?: boolean;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  image,
  onSave,
  saving = false,
  saved = false,
}) => {
  const [seedCopied, setSeedCopied] = React.useState(false);

  const handleSave = () => {
    onSave(image);
  };

  const handleCopySeed = () => {
    navigator.clipboard.writeText(String(image.seed)).then(() => {
      setSeedCopied(true);
      setTimeout(() => setSeedCopied(false), 2000);
    });
  };

  return (
    <div className="image-card">
      <div className="image-card-image-container">
        <img
          src={image.data}
          alt={image.prompt}
          className="image-card-image"
        />
      </div>
      <div className="image-card-footer">
        <div className="image-card-info">
          <span className="image-card-prompt" title={image.prompt}>
            {image.prompt.length > 50 ? `${image.prompt.slice(0, 50)}...` : image.prompt}
          </span>
          <button
            type="button"
            className="image-card-seed"
            onClick={handleCopySeed}
            title={seedCopied ? 'Copied!' : `Seed: ${image.seed} (click to copy)`}
          >
            🎲 {image.seed}
          </button>
        </div>
        <SaveButton onClick={handleSave} saving={saving} saved={saved} />
      </div>
    </div>
  );
};
