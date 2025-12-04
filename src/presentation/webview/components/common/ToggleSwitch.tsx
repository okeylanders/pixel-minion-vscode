/**
 * ToggleSwitch - VSCode-styled toggle switch component
 *
 * Pattern: Reusable UI component for boolean settings
 */
import React from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: ToggleSwitchProps): JSX.Element {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className="toggle-switch-container">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle-switch ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        <span className="toggle-slider" />
      </button>
      {label && (
        <span className={`toggle-label ${disabled ? 'disabled' : ''}`}>
          {label}
        </span>
      )}
    </div>
  );
}
