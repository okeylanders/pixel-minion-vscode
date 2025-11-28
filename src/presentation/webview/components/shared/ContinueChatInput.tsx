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
 */
import React, { useState, useCallback, KeyboardEvent } from 'react';
import './../../styles/components/continue-chat-input.css';

interface ContinueChatInputProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
}

export const ContinueChatInput: React.FC<ContinueChatInputProps> = ({
  onSubmit,
  disabled = false,
  placeholder = 'Refine: describe changes...',
  isLoading = false,
}) => {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && !disabled && !isLoading) {
      onSubmit(trimmed);
      setValue('');
    }
  }, [value, disabled, isLoading, onSubmit]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="continue-chat-input">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        className="continue-chat-input-field"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || isLoading || !value.trim()}
        className="continue-chat-submit"
      >
        {isLoading ? '...' : 'Send'}
      </button>
    </div>
  );
};
