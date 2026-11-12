/**
 * ImageCard - Display a generated image with save functionality
 *
 * Features:
 * - The stage takes the image's own shape: its natural dimensions once it
 *   loads (providers may clamp a requested ratio), the requested ratio
 *   before that, square when neither is known; image-card.css caps its
 *   height, so a very tall image (1:8) is letterboxed instead of filling
 *   thousands of pixels
 * - Image preview with object-fit contain
 * - Truncated prompt display with full text on hover
 * - Seed chip only when the route took a seed
 * - Save button integration
 *
 * After frame-minion@40e7949 components/image/ImageCard.tsx (natural size,
 * seed visibility). Pixel deltas: natural dimensions win over the requested
 * ratio, and Frame's video/orchestrator action groups are not ported.
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
  const [naturalAspectRatio, setNaturalAspectRatio] = React.useState<string | null>(null);

  const handleSave = () => {
    onSave(image);
  };

  const handleCopySeed = () => {
    navigator.clipboard.writeText(String(image.seed)).then(() => {
      setSeedCopied(true);
      setTimeout(() => setSeedCopied(false), 2000);
    });
  };

  const requestedAspectRatio = image.aspectRatio && image.aspectRatio !== 'auto'
    ? image.aspectRatio.replace(':', ' / ')
    : null;
  const displayAspectRatio = naturalAspectRatio ?? requestedAspectRatio ?? '1 / 1';

  return (
    <div className="image-card">
      <div className="image-card-image-container" style={{ aspectRatio: displayAspectRatio }}>
        <img
          src={image.data}
          alt={image.prompt}
          className="image-card-image"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth > 0 && naturalHeight > 0) {
              setNaturalAspectRatio(`${naturalWidth} / ${naturalHeight}`);
            }
          }}
        />
      </div>
      <div className="image-card-footer">
        <div className="image-card-info">
          <span className="image-card-prompt" title={image.prompt}>
            {image.prompt.length > 50 ? `${image.prompt.slice(0, 50)}...` : image.prompt}
          </span>
          {image.seedSupported !== false && (
            <button
              type="button"
              className="image-card-seed"
              onClick={handleCopySeed}
              title={seedCopied ? 'Copied!' : `Seed: ${image.seed} (click to copy)`}
            >
              🎲 {image.seed}
            </button>
          )}
        </div>
        <SaveButton onClick={handleSave} saving={saving} saved={saved} />
      </div>
    </div>
  );
};
