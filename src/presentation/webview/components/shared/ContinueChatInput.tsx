/**
 * ContinueChatInput - Shared component for continuing conversations
 *
 * Used at the bottom of Image and SVG generation tabs for refining outputs.
 *
 * Features:
 * - Text input for prompt refinement
 * - Submit on Enter key
 * - Loading state handling
 * - Auto-clear on submit
 * - `submitLabel` names what Enter does (after frame-minion@40e7949
 *   ContinueChatInput: the Image tab says Generate for a Single Shot thread)
 */
import React, { useState, useCallback, KeyboardEvent } from 'react';
import './../../styles/components/continue-chat-input.css';

interface ContinueChatInputProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
  submitLabel?: string;
  /** Keep the draft mounted while another thread is being viewed. */
  hidden?: boolean;
}

export const ContinueChatInput: React.FC<ContinueChatInputProps> = ({
  onSubmit,
  disabled = false,
  placeholder = 'Refine: describe changes...',
  isLoading = false,
  submitLabel = 'Send',
  hidden = false,
}) => {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && !hidden && !disabled && !isLoading) {
      onSubmit(trimmed);
      setValue('');
    }
  }, [value, hidden, disabled, isLoading, onSubmit]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="continue-chat-input" hidden={hidden}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={disabled || isLoading}
        className="continue-chat-input-field"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || isLoading || !value.trim()}
        className="continue-chat-submit"
      >
        {isLoading ? '...' : submitLabel}
      </button>
    </div>
  );
};
