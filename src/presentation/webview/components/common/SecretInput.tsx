/**
 * SecretInput - Password-masked input for API keys
 *
 * Pattern: Secure input that never exposes the value
 * Features:
 * - Password masking (shows dots)
 * - Save/Clear buttons
 * - Status indicator
 */
import React, { useState } from 'react';
import { Button } from './Button';

export interface SecretInputProps {
  label?: string;
  description?: string;
  isConfigured: boolean;
  onSave: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export function SecretInput({
  label,
  description,
  isConfigured,
  onSave,
  onClear,
  placeholder = 'Enter API key...',
}: SecretInputProps): JSX.Element {
  const [value, setValue] = useState('');
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = () => {
    if (value.trim()) {
      onSave(value.trim());
      setValue('');
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    }
  };

  const handleClear = () => {
    onClear();
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}

      <div className="input-with-button">
        <input
          type="password"
          className="input input-secret"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <Button onClick={handleSave} disabled={!value.trim()}>
          Save
        </Button>
        {isConfigured && (
          <Button variant="secondary" onClick={handleClear}>
            Clear
          </Button>
        )}
      </div>

      <div className="mt-sm">
        {showSaved ? (
          <span className="text-success">✓ API key saved</span>
        ) : isConfigured ? (
          <span className="text-success">✓ API key configured</span>
        ) : (
          <span className="text-muted">No API key stored</span>
        )}
      </div>

      {description && (
        <span className="input-description">{description}</span>
      )}
    </div>
  );
}
