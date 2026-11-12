/**
 * CustomModelIdField - type any OpenRouter model id for a default model.
 *
 * The pickers list curated models; this is the way to choose one they
 * don't (ledger C14: free-text entry was lost when Settings moved to the
 * picker). The id is applied on "Use" or Enter, not per keystroke, so a
 * half-typed id never becomes the setting. The picker then shows it as
 * "Custom: <id>". Pixel-only; it borrows the picker's label and helper
 * styles so the two read as one field group. What it accepts:
 * `customModelIdFor` (format, length, curated-id case).
 */
import React, { useId, useState } from 'react';

export interface CustomModelIdFieldProps {
  /** e.g. "Custom image model id". */
  label: string;
  /** What a custom id does on this tab (shown under the field). */
  help: string;
  /** The tab's curated ids: a differently-cased copy of one is stored as the curated id. */
  catalogIds: readonly string[];
  /** Why a well-formed id still can't be used on this tab, or null (e.g. a raster model for SVG). */
  refusal?: (modelId: string) => string | null;
  onUse: (modelId: string) => void;
}

/** Longer than any OpenRouter id; a pasted paragraph is refused, not stored. */
export const MAX_CUSTOM_MODEL_ID_LENGTH = 200;

/**
 * An OpenRouter id: `vendor/model`, optionally `vendor/model:variant`. Each
 * part starts with a letter or digit and continues with letters, digits,
 * `.`, `_` or `-`; nothing else (no spaces, no further `/`, no `@`). The
 * classes exclude both separators, so matching is linear in the length.
 */
const PART = '[A-Za-z0-9][A-Za-z0-9._-]*';
const MODEL_ID = new RegExp(`^${PART}/${PART}(?::${PART})?$`);

const FORMAT_ERROR = 'Enter an OpenRouter model id such as vendor/model-name: letters, digits, dots, dashes and underscores, each part starting with a letter or digit.';

/**
 * The id to store for what was typed, or why it can't be one. Surrounding
 * spaces are dropped; a case-insensitive match for a curated id becomes
 * that id, so it keeps the curated routes and pricing instead of running as
 * a permissive custom id. The same holds for the model part of a
 * `model:variant` id; the variant is kept as typed.
 */
export function customModelIdFor(
  input: string,
  catalogIds: readonly string[]
): { id: string; error?: undefined } | { id?: undefined; error: string } {
  const id = input.trim();
  if (id.length > MAX_CUSTOM_MODEL_ID_LENGTH) {
    return { error: `Model ids are at most ${MAX_CUSTOM_MODEL_ID_LENGTH} characters.` };
  }
  if (!MODEL_ID.test(id)) return { error: FORMAT_ERROR };
  const [model, variant] = id.split(':');
  const lower = model.toLowerCase();
  const curated = catalogIds.find(candidate => candidate.toLowerCase() === lower);
  if (!curated) return { id };
  return { id: variant === undefined ? curated : `${curated}:${variant}` };
}

export const CustomModelIdField: React.FC<CustomModelIdFieldProps> = ({ label, help, catalogIds, refusal, onUse }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const helpId = `${inputId}-help`;

  const use = () => {
    const result = customModelIdFor(value, catalogIds);
    if (result.error !== undefined) {
      setError(result.error);
      return;
    }
    const refused = refusal?.(result.id);
    if (refused) {
      setError(refused);
      return;
    }
    setError(null);
    setValue('');
    onUse(result.id);
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
