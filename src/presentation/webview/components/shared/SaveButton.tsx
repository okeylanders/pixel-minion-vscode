/**
 * SaveButton - Reusable save button for images and SVGs
 *
 * Features:
 * - Three states: default, saving, saved
 * - Visual feedback with icons
 * - Disabled state during save operations
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || saving}
      className={`save-button ${saved ? 'saved' : ''}`}
      title={saved ? 'Saved' : 'Save to workspace'}
    >
      {saving ? '...' : saved ? '✓' : '💾'}
    </button>
  );
};
