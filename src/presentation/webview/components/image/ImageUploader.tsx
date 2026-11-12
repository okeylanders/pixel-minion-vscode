// Ported from frame-minion@40e7949 packages/core/src/presentation/webview/components/image/ImageUploader.tsx; keep in sync
/**
 * ImageUploader - Component for uploading and managing reference images
 *
 * Pattern: Controlled component for image-to-image generation workflow
 *
 * `maxImages` and `accept` come from the selected model's route and bound the
 * raster references only. An SVG attachment is sent as text context (its
 * markup is appended to the prompt), never as an image, so it takes no
 * reference slot and the picker always offers it: on a text-only model, or
 * once the raster slots are full, the button adds SVG context only.
 *
 * Pixel deltas: the family button classes (`btn btn-secondary`), the
 * text-only note is a `generation-note`, and the SVG attachment is kept out
 * of the raster count (Frame counts it; flag upstream).
 */
import React, { useRef, useCallback } from 'react';
import '../../styles/components/image-uploader.css';

const SVG_MIME = 'image/svg+xml';

export interface ImageUploaderProps {
  images: string[];  // Array of base64 data URLs (for preview)
  /** Index in `images` of the SVG attachment (sent as text, not as an image), or null. */
  svgIndex?: number | null;
  onAddImage: (dataUrl: string, svgText?: string | null) => void;
  onRemoveImage: (index: number) => void;
  onClear: () => void;
  disabled?: boolean;
  /** Raster references the route takes. */
  maxImages?: number;
  /** Raster MIME types the file picker offers; SVG is always offered as well. */
  accept?: string;
}

export function ImageUploader({
  images,
  svgIndex = null,
  onAddImage,
  onRemoveImage,
  onClear,
  disabled = false,
  maxImages = 4,
  accept = 'image/png,image/jpeg,image/webp,image/gif',
}: ImageUploaderProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSvg = svgIndex !== null && svgIndex >= 0 && svgIndex < images.length;
  const rasterCount = images.length - (hasSvg ? 1 : 0);
  const rasterSlots = Math.max(0, maxImages - rasterCount);
  const pickerAccept = rasterSlots > 0 ? `${accept},${SVG_MIME}` : SVG_MIME;

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    let slotsLeft = rasterSlots;
    for (const file of Array.from(files)) {
      const isSvg = file.type === SVG_MIME;
      // Rasters beyond the route's limit are dropped; an SVG never takes a slot.
      if (!isSvg) {
        if (slotsLeft <= 0) continue;
        slotsLeft--;
      }

      // Always read data URL for preview
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const dataUrl = reader.result;
          if (isSvg) {
            const textReader = new FileReader();
            textReader.onload = () => {
              // Without its markup an SVG has nothing to send: skip it rather
              // than let it go to the model as an image.
              if (typeof textReader.result === 'string' && textReader.result.trim()) {
                onAddImage(dataUrl, textReader.result);
              }
            };
            textReader.readAsText(file);
          } else {
            onAddImage(dataUrl);
          }
        }
      };
      reader.readAsDataURL(file);
    }

    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [rasterSlots, onAddImage]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="image-uploader">
      <div className="image-uploader-header">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="btn btn-secondary add-image-button"
        >
          {rasterSlots > 0 ? '+ Add Reference Image' : '+ Add SVG Context'}
          {maxImages > 0 && rasterCount > 0 ? ` (${rasterCount}/${maxImages})` : ''}
        </button>
        {maxImages === 0 && (
          <span className="generation-note">This model accepts text prompts only. An SVG can still go in as text context.</span>
        )}
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
        accept={pickerAccept}
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {images.length > 0 && (
        <div className="image-thumbnails">
          {images.map((dataUrl, index) => (
            <div key={index} className="thumbnail-container">
              <img
                src={dataUrl}
                alt={hasSvg && index === svgIndex ? 'SVG text context' : `Reference ${index + 1}`}
                className="thumbnail"
              />
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
