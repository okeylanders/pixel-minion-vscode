// Ported from frame-minion@40e7949 packages/core/src/presentation/webview/components/image/ImageUploader.tsx; keep in sync
/**
 * ImageUploader - Component for uploading and managing reference images
 *
 * Pattern: Controlled component for image-to-image generation workflow
 *
 * `maxImages` and `accept` come from the selected model's route; a model that
 * takes no reference images gets a disabled button and says so.
 *
 * Pixel deltas: the family button classes (`btn btn-secondary`), and the
 * text-only note is a `generation-note`.
 */
import React, { useRef, useCallback } from 'react';
import '../../styles/components/image-uploader.css';

export interface ImageUploaderProps {
  images: string[];  // Array of base64 data URLs (for preview)
  onAddImage: (dataUrl: string, svgText?: string | null) => void;
  onRemoveImage: (index: number) => void;
  onClear: () => void;
  disabled?: boolean;
  maxImages?: number;
  /** MIME types the file picker offers; defaults to every raster format plus SVG. */
  accept?: string;
}

export function ImageUploader({
  images,
  onAddImage,
  onRemoveImage,
  onClear,
  disabled = false,
  maxImages = 4,
  accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml',
}: ImageUploaderProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files).slice(0, Math.max(0, maxImages - images.length))) {

      // Always read data URL for preview
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          if (file.type === 'image/svg+xml') {
            const textReader = new FileReader();
            textReader.onload = () => {
              const svgText = typeof textReader.result === 'string' ? textReader.result : null;
              onAddImage(reader.result as string, svgText);
            };
            textReader.readAsText(file);
          } else {
            onAddImage(reader.result);
          }
        }
      };
      reader.readAsDataURL(file);
    }

    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [images.length, maxImages, onAddImage]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="image-uploader">
      <div className="image-uploader-header">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || images.length >= maxImages}
          className="btn btn-secondary add-image-button"
        >
          + Add Reference Image{images.length > 0 ? ` (${images.length}/${maxImages})` : ''}
        </button>
        {maxImages === 0 && <span className="generation-note">This model accepts text prompts only.</span>}
        {images.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="btn btn-secondary clear-images-button"
          >
            Clear All
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {images.length > 0 && (
        <div className="image-thumbnails">
          {images.map((dataUrl, index) => (
            <div key={index} className="thumbnail-container">
              <img src={dataUrl} alt={`Reference ${index + 1}`} className="thumbnail" />
              <button
                type="button"
                onClick={() => onRemoveImage(index)}
                disabled={disabled}
                className="remove-thumbnail"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
