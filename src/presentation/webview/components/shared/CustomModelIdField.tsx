/**
 * CustomModelIdField - type any OpenRouter model id for a default model.
 *
 * The pickers list curated models; this is the way to choose one they
 * don't (ledger C14: free-text entry was lost when Settings moved to the
 * picker). The id is applied on "Use" or Enter, not per keystroke, so a
 * half-typed id never becomes the setting. The picker then shows it as
 * "Custom: <id>". Pixel-only; it borrows the picker's label and helper
 * styles so the two read as one field group.
 */
import React, { useId, useState } from 'react';

export interface CustomModelIdFieldProps {
  /** e.g. "Custom image model id". */
  label: string;
  /** What a custom id does on this tab (shown under the field). */
  help: string;
  onUse: (modelId: string) => void;
}

/** OpenRouter ids are `vendor/model`, optionally with a `:variant`; no spaces. */
const MODEL_ID = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._:@+-]+$/;

export const CustomModelIdField: React.FC<CustomModelIdFieldProps> = ({ label, help, onUse }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const helpId = `${inputId}-help`;

  const use = () => {
    const id = value.trim();
    if (!MODEL_ID.test(id)) {
      setError('Enter an OpenRouter model id such as vendor/model-name.');
      return;
    }
    setError(null);
    setValue('');
    onUse(id);
  };

  return (
    <div className="custom-model-id">
      <label className="model-selector-label" htmlFor={inputId}>{label}</label>
      <div className="custom-model-id-row">
        <input
          id={inputId}
          type="text"
          className="settings-input"
          value={value}
          placeholder="vendor/model-name"
          spellCheck={false}
          autoComplete="off"
          aria-describedby={helpId}
          aria-invalid={error ? true : undefined}
          onChange={(event) => { setValue(event.target.value); setError(null); }}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); use(); } }}
        />
        <button type="button" className="btn btn-secondary" onClick={use} disabled={!value.trim()}>
          Use
        </button>
      </div>
      {error && <p className="model-browser-helper custom-model-id-error" role="alert">{error}</p>}
      <p id={helpId} className="model-browser-helper">{help}</p>
    </div>
  );
};
