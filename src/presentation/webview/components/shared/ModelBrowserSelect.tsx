import React from 'react';
import { ModelBrowserModal } from './ModelBrowserModal';
import { ModelBrowserOption } from './modelBrowserTypes';

export interface ModelBrowserSelectProps {
  label: string;
  subtitle: string;
  options: ModelBrowserOption[];
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ModelBrowserSelect({
  label,
  subtitle,
  options,
  value,
  onChange,
  disabled = false,
  compact = false,
}: ModelBrowserSelectProps): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const selected = options.find(option => option.id === value);
  const triggerId = React.useId();
  const labelId = React.useId();
  const valueId = React.useId();

  return (
    <div className={`model-browser-select${compact ? ' compact' : ''}`}>
      <label id={labelId} htmlFor={triggerId}>{label}</label>
      <button
        type="button"
        id={triggerId}
        className="model-browser-trigger"
        onClick={() => setOpen(true)}
        disabled={disabled || options.length === 0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${valueId}`}
      >
        <span id={valueId}>
          <strong>{selected?.label ?? `Custom: ${value}`}</strong>
          {/* Space keeps name and price apart in the accessible name; flex layout ignores it. */}
          {!compact && <>{' '}<small>{selected?.estimateLabel ?? selected?.costLabel ?? value}</small></>}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      <ModelBrowserModal
        open={open}
        title={label}
        subtitle={subtitle}
        options={options}
        value={value}
        onClose={() => setOpen(false)}
        onSelect={onChange}
      />
    </div>
  );
}
