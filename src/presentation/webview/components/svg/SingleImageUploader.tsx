import React, { useRef, useCallback } from 'react';
import '../../styles/components/single-image-uploader.css';

interface SingleImageUploaderProps {
  image: string | null;
  onImageChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

export const SingleImageUploader: React.FC<SingleImageUploaderProps> = ({
  image,
  onImageChange,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImageChange(reader.result);
      }
    };
    reader.readAsDataURL(file);

    if (inputRef.current) inputRef.current.value = '';
  }, [onImageChange]);

  return (
    <div className="single-image-uploader">
      {image ? (
        <div className="single-image-preview">
          <img src={image} alt="Reference" />
          <button
            type="button"
            onClick={() => onImageChange(null)}
            disabled={disabled}
            className="remove-image"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="add-reference-button"
        >
          + Add Reference Image (optional)
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden-file-input"
        disabled={disabled}
        aria-label="Upload reference image"
      />
    </div>
  );
};
