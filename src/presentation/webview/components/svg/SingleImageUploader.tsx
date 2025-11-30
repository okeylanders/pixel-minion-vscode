import React, { useRef, useCallback } from 'react';
import '../../styles/components/single-image-uploader.css';

interface SingleImageUploaderProps {
  attachment: {
    preview: string | null;
    svgText: string | null;
  };
  onAttachmentChange: (data: { preview: string | null; svgText: string | null }) => void;
  disabled?: boolean;
}

export const SingleImageUploader: React.FC<SingleImageUploaderProps> = ({
  attachment,
  onAttachmentChange,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Always read as data URL for preview
    const dataUrlReader = new FileReader();
    dataUrlReader.onload = () => {
      if (typeof dataUrlReader.result === 'string') {
        // If SVG, also read text content to attach as prompt text
        if (file.type === 'image/svg+xml') {
          const textReader = new FileReader();
          textReader.onload = () => {
            const svgText = typeof textReader.result === 'string' ? textReader.result : null;
            onAttachmentChange({ preview: dataUrlReader.result as string, svgText });
          };
          textReader.readAsText(file);
        } else {
          onAttachmentChange({ preview: dataUrlReader.result as string, svgText: null });
        }
      }
    };
    dataUrlReader.readAsDataURL(file);

    if (inputRef.current) inputRef.current.value = '';
  }, [onAttachmentChange]);

  return (
    <div className="single-image-uploader">
      {attachment.preview ? (
        <div className="single-image-preview">
          <img src={attachment.preview} alt="Reference" />
          <button
            type="button"
            onClick={() => onAttachmentChange({ preview: null, svgText: null })}
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
