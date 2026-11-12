// Ported from frame-minion@40e7949 packages/core/src/presentation/webview/components/shared/ModelBrowserSelect.tsx; keep in sync
/**
 * ModelBrowserSelect — the single-line model trigger plus its browser.
 *
 * Pixel deltas from Frame: the visible label is associated with the trigger
 * (`htmlFor`), the trigger announces its popup (`aria-haspopup`,
 * `aria-expanded`), and `footerLabel` passes through to the browser. The
 * trigger is styled as one of Pixel's fields (model-browser.css), not with
 * Frame's dropdown colours.
 */
import React from 'react';
import { ModelBrowserModal, ModelBrowserOption } from './ModelBrowserModal';

export interface ModelBrowserSelectProps {
  label: string;
  options: ModelBrowserOption[];
  value?: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  helperText?: string;
  subtitle?: string;
  loadingLabel?: string;
  footerLabel?: string;
}

function ChevronIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const ModelBrowserSelect: React.FC<ModelBrowserSelectProps> = ({
  label,
  options,
  value,
  onChange,
  disabled = false,
  helperText,
  subtitle,
  loadingLabel,
  footerLabel,
}) => {
  const [open, setOpen] = React.useState(false);
  const triggerId = React.useId();
  const selectedValue = value ?? options[0]?.id;
  const selected = options.find((option) => option.id === selectedValue);
  const selectedLabel = selected?.label ?? loadingLabel ?? (selectedValue ? `Custom: ${selectedValue}` : 'Choose a model');
  const canOpen = !disabled && options.length > 0;

  return (
    <div className="model-selector model-browser-select">
      <label className="model-selector-label" htmlFor={triggerId}>{label}</label>
      <button
        type="button"
        id={triggerId}
        className="model-browser-trigger"
        onClick={() => setOpen(true)}
        disabled={!canOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Browse ${label.toLowerCase()} options. Current model: ${selectedLabel}`}
        title={`Browse ${label.toLowerCase()} options`}
      >
        <span>{selectedLabel}</span>
        <ChevronIcon />
      </button>
      {helperText && <p className="model-browser-helper">{helperText}</p>}
      <ModelBrowserModal
        open={open}
        label={label}
        subtitle={subtitle}
        options={options}
        value={selectedValue}
        onClose={() => setOpen(false)}
        onSelect={onChange}
        footerLabel={footerLabel}
      />
    </div>
  );
};
