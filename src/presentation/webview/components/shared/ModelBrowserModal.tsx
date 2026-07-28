import React from 'react';
import { ModelBrowserOption } from './modelBrowserTypes';
import '../../styles/components/model-browser.css';

export type { ModelBrowserBadge, ModelBrowserOption } from './modelBrowserTypes';

export interface ModelBrowserModalProps {
  open: boolean;
  title: string;
  subtitle: string;
  options: ModelBrowserOption[];
  value: string;
  onClose: () => void;
  onSelect: (modelId: string) => void;
}

const matches = (option: ModelBrowserOption, query: string): boolean =>
  [
    option.id,
    option.label,
    option.description,
    option.provider,
    option.family,
    option.costLabel,
    option.estimateLabel,
    ...option.badges.map(badge => badge.label),
  ].join(' ').toLowerCase().includes(query);

export function ModelBrowserModal({
  open,
  title,
  subtitle,
  options,
  value,
  onClose,
  onSelect,
}: ModelBrowserModalProps): JSX.Element | null {
  const [query, setQuery] = React.useState('');
  const [provider, setProvider] = React.useState('All');

  React.useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setProvider('All');
    }
  }, [open]);

  if (!open) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const matched = options.filter(option => matches(option, normalizedQuery));
  const providers = Array.from(new Set(matched.map(option => option.provider))).sort();
  const visible = matched.filter(option => provider === 'All' || option.provider === provider);

  return (
    <div className="model-browser-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="model-browser"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="model-browser-head">
          <div>
            <span className="model-browser-eyebrow">MODEL BROWSER</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="model-browser-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <label className="model-browser-search">
          <span aria-hidden="true">⌕</span>
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by model, provider, family, or capability…"
          />
        </label>

        <div className="model-browser-body">
          <nav className="model-browser-pivots" aria-label="Providers">
            {['All', ...providers].map(item => (
              <button
                type="button"
                key={item}
                className={provider === item ? 'active' : ''}
                onClick={() => setProvider(item)}
              >
                <span>{item}</span>
                <small>{item === 'All' ? matched.length : matched.filter(option => option.provider === item).length}</small>
              </button>
            ))}
          </nav>

          <div className="model-browser-results">
            {visible.length === 0 && <div className="model-browser-empty">No models match that search.</div>}
            {visible.map(option => (
              <button
                type="button"
                key={option.id}
                className={`model-browser-card${value === option.id ? ' selected' : ''}`}
                onClick={() => {
                  onSelect(option.id);
                  onClose();
                }}
              >
                <div className="model-browser-card-main">
                  <div className="model-browser-card-title">
                    <strong>{option.label}</strong>
                    {value === option.id && <span className="model-browser-check">✓</span>}
                  </div>
                  <p>{option.description}</p>
                  <code>{option.id}</code>
                </div>
                <div className="model-browser-card-meta">
                  <div className="model-browser-badges">
                    {option.badges.map(badge => (
                      <span key={badge.label} className={badge.tone === 'accent' ? 'accent' : ''}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  {option.costLabel && <span>{option.costLabel}</span>}
                  {option.estimateLabel && <strong>{option.estimateLabel}</strong>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
