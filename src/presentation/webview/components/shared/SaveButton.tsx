/**
 * SaveButton - Reusable save button for images and SVGs
 *
 * Frame Minion's approve tile: a green check tile in every state (the
 * `.saved` class deepens the fill), with a spinner during the save
 * round-trip. Icon-only, so it carries an aria-label.
 */
import React from 'react';
import '../../styles/components/save-button.css';

export interface SaveButtonProps {
  onClick: () => void;
  disabled?: boolean;
  saving?: boolean;
  saved?: boolean;
}

export const SaveButton: React.FC<SaveButtonProps> = ({
  onClick,
  disabled = false,
  saving = false,
  saved = false,
}) => {
  const label = saving ? 'Saving…' : saved ? 'Saved' : 'Save to workspace';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || saving}
      className={`save-button${saved ? ' saved' : ''}`}
      title={label}
      aria-label={label}
    >
      {saving ? (
        <span className="save-button-spinner" aria-hidden="true" />
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12l5 5 9-11" />
        </svg>
      )}
    </button>
  );
};
