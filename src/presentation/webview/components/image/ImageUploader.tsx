/**
 * ImageUploader - Component for uploading and managing reference images
 *
 * Pattern: Controlled component for image-to-image generation workflow
 */
import React, { useRef, useCallback } from 'react';
import '../../styles/components/image-uploader.css';

export interface ImageUploaderProps {
  images: string[];  // Array of base64 data URLs
  onAddImage: (dataUrl: string) => void;
  onRemoveImage: (index: number) => void;
  onClear: () => void;
  disabled?: boolean;
  maxImages?: number;
}

export function ImageUploader({
  images,
  onAddImage,
  onRemoveImage,
  onClear,
  disabled = false,
  maxImages = 4,
}: ImageUploaderProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (images.length >= maxImages) break;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onAddImage(reader.result);
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
          className="add-image-button"
        >
          + Add Reference Image{images.length > 0 ? ` (${images.length}/${maxImages})` : ''}
        </button>
        {images.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="clear-images-button"
          >
            Clear All
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
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
