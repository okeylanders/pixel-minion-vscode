import React from 'react';
import { ModelBrowserOption } from './modelBrowserTypes';
import '../../styles/components/model-browser.css';

export type { ModelBrowserBadge, ModelBrowserOption } from './modelBrowserTypes';

export interface ModelBrowserModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  options: ModelBrowserOption[];
  value?: string;
  onClose: () => void;
  onSelect: (modelId: string) => void;
}

type ModelBrowserPivot = 'provider' | 'family';

const groupLabel = (option: ModelBrowserOption, pivot: ModelBrowserPivot): string =>
  pivot === 'provider' ? option.provider : option.family;

const matchesSearch = (option: ModelBrowserOption, query: string): boolean =>
  !query || [
    option.id,
    option.label,
    option.description,
    option.narrative,
    option.provider,
    option.family,
    option.releaseDate,
    option.costLabel,
    option.estimateLabel,
    option.searchText,
    ...option.badges.map(badge => badge.label),
  ].map(value => value?.toLowerCase() ?? '').join(' ').includes(query);

const sortOptions = (a: ModelBrowserOption, b: ModelBrowserOption): number => {
  if (a.releaseDate && b.releaseDate) {
    const dateOrder = b.releaseDate.localeCompare(a.releaseDate);
    if (dateOrder !== 0) return dateOrder;
  } else if (a.releaseDate) {
    return -1;
  } else if (b.releaseDate) {
    return 1;
  }
  return a.label.localeCompare(b.label);
};

const formatReleaseDate = (releaseDate?: string): string => {
  if (!releaseDate) return 'Release unavailable';
  const date = new Date(`${releaseDate.slice(0, 7)}-01T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return `Released ${releaseDate}`;
  return `Released ${date.toLocaleString(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })}`;
};

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
  const [pivot, setPivot] = React.useState<ModelBrowserPivot>('provider');
  const [activeGroup, setActiveGroup] = React.useState('All');

  React.useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  React.useEffect(() => {
    setActiveGroup('All');
  }, [pivot]);

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = options.filter(option => matchesSearch(option, normalizedQuery)).sort(sortOptions);
  const groups = Array.from(new Set(filtered.map(option => groupLabel(option, pivot))))
    .sort((a, b) => a.localeCompare(b));
  const counts = new Map(groups.map(group => [
    group,
    filtered.filter(option => groupLabel(option, pivot) === group).length,
  ]));
  const effectiveGroup =
    activeGroup === 'All' || groups.includes(activeGroup) ? activeGroup : 'All';
  const visibleGroups =
    effectiveGroup === 'All' ? groups : groups.filter(group => group === effectiveGroup);

  return (
    <div className="model-browser-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="model-browser"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} browser`}
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="model-browser-head">
          <div>
            <div className="model-browser-eyebrow">MODEL</div>
            <h2>Choose a Model</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="model-browser-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <label className="model-browser-search">
          <SearchIcon />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search models, providers, families..."
            aria-label="Search models"
          />
        </label>

        <div className="model-browser-pivots" role="tablist" aria-label="Model grouping">
          <button
            type="button"
            role="tab"
            aria-selected={pivot === 'provider'}
            className={pivot === 'provider' ? 'active' : ''}
            onClick={() => setPivot('provider')}
          >
            By Provider
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pivot === 'family'}
            className={pivot === 'family' ? 'active' : ''}
            onClick={() => setPivot('family')}
          >
            By Family
          </button>
        </div>

        <div className="model-browser-chips" aria-label="Model groups">
          <button
            type="button"
            className={effectiveGroup === 'All' ? 'active' : ''}
            onClick={() => setActiveGroup('All')}
          >
            All <span>{filtered.length}</span>
          </button>
          {groups.map(group => (
            <button
              type="button"
              key={group}
              className={effectiveGroup === group ? 'active' : ''}
              onClick={() => setActiveGroup(group)}
            >
              {group} <span>{counts.get(group)}</span>
            </button>
          ))}
        </div>

        <div className="model-browser-list">
          {visibleGroups.length === 0 && (
            <div className="model-browser-empty">No models match that search.</div>
          )}
          {visibleGroups.map(group => {
            const groupedModels = filtered.filter(option => groupLabel(option, pivot) === group);
            return (
              <React.Fragment key={group}>
                <div className="model-browser-rule">
                  <span>{group}</span>
                  <em>{groupedModels.length}</em>
                  <hr />
                </div>
                <div className="model-browser-grid">
                  {groupedModels.map(option => {
                    const selected = option.id === value;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`model-browser-card${selected ? ' selected' : ''}`}
                        onClick={() => {
                          onSelect(option.id);
                          onClose();
                        }}
                      >
                        {selected && <span className="model-browser-selected"><CheckIcon /></span>}
                        <span className="model-browser-card-head">
                          <span className="model-browser-card-title">{option.label}</span>
                          {option.costLabel && <span className="model-browser-cost">{option.costLabel}</span>}
                        </span>
                        <span className="model-browser-badges">
                          <span className={`model-browser-badge ${option.releaseDate ? 'accent' : ''}`}>
                            {formatReleaseDate(option.releaseDate)}
                          </span>
                          {option.badges.map(badge => (
                            <span
                              key={`${option.id}-${badge.label}`}
                              className={`model-browser-badge ${badge.tone ?? ''}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </span>
                        {option.narrative && (
                          <span className="model-browser-narrative">{option.narrative}</span>
                        )}
                        {!option.narrative && option.description && (
                          <span className="model-browser-desc">{option.description}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <footer className="model-browser-foot">
          <span className="model-browser-live-dot" />
          <span>{options.length} models</span>
          <span>Curated by Pixel Minion</span>
        </footer>
      </section>
    </div>
  );
}
