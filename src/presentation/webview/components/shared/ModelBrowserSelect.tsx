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

  return (
    <div className={`model-browser-select${compact ? ' compact' : ''}`}>
      <label>{label}</label>
      <button
        type="button"
        className="model-browser-trigger"
        onClick={() => setOpen(true)}
        disabled={disabled || options.length === 0}
        aria-haspopup="dialog"
      >
        <span>
          <strong>{selected?.label ?? `Custom: ${value}`}</strong>
          {!compact && <small>{selected?.estimateLabel ?? selected?.costLabel ?? value}</small>}
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
