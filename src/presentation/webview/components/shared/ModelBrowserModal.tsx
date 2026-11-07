// Ported from frame-minion@40e7949 packages/core/src/presentation/webview/components/shared/ModelBrowserModal.tsx; keep in sync
/**
 * ModelBrowserModal — the family model browser: search, three grouping
 * pivots (provider, family, release month), group chips with counts, and
 * cards with cost, badges, cost basis, narrative and description.
 *
 * Pixel deltas from Frame (upstream candidates):
 *   - Overlay behaviour comes from useOverlayDismiss: Escape closes the top
 *     overlay only, focus moves to search on open and returns to the opener
 *     on close, the frame behind is inert, and Tab is trapped. (Don't add
 *     `autoFocus`: it would move focus before the opener is recorded.)
 *   - `role="dialog"` sits on the panel; the backdrop is presentational and
 *     closes on mousedown, so a drag that ends outside doesn't close it.
 *   - The query and group chip reset when the browser closes, so it reopens
 *     on the full list with the current model in view.
 *   - Pivots are a real tablist (roving Tab stop, arrow keys) controlling the
 *     list panel; group chips are a labelled group of toggle buttons
 *     (`aria-pressed`); cards are toggle buttons named by their title.
 *   - The selected card is scrolled into view when the browser opens.
 *   - `footerLabel` replaces Frame's hard-coded "Curated by Frame Minion".
 *   - The option types live in modelBrowserTypes.ts (re-exported here).
 */
import React from 'react';
import { useOverlayDismiss } from '../../hooks/useOverlayDismiss';
import { nextTabIndex } from '../layout/tabKeyboard';
import type { ModelBrowserOption } from './modelBrowserTypes';
import '../../styles/components/model-browser.css';

export type { ModelBrowserBadge, ModelBrowserBadgeTone, ModelBrowserOption } from './modelBrowserTypes';

export interface ModelBrowserModalProps {
  open: boolean;
  label: string;
  subtitle?: string;
  options: ModelBrowserOption[];
  value?: string;
  onClose: () => void;
  onSelect: (modelId: string) => void;
  /** Footer attribution. */
  footerLabel?: string;
}

type ModelBrowserPivot = 'provider' | 'family' | 'release-date';

const PIVOTS: ReadonlyArray<{ id: ModelBrowserPivot; label: string }> = [
  { id: 'provider', label: 'By Provider' },
  { id: 'family', label: 'By Family' },
  { id: 'release-date', label: 'By Release Date' },
];

const RELEASE_DATE_UNAVAILABLE = 'Release date unavailable';

const releaseDateValue = (releaseDate?: string): Date | undefined => {
  if (!releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return undefined;
  const date = new Date(`${releaseDate}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === releaseDate
    ? date
    : undefined;
};

const providerLabel = (option: ModelBrowserOption): string =>
  option.provider ?? option.id.split('/')[0] ?? 'Custom';

const familyLabel = (option: ModelBrowserOption): string =>
  option.family ?? providerLabel(option);

const normalize = (value: string | undefined): string => value?.toLowerCase() ?? '';

const matchesSearch = (option: ModelBrowserOption, query: string): boolean => {
  if (!query) return true;
  const haystack = [
    option.id,
    option.label,
    option.description,
    option.narrative,
    option.provider,
    option.family,
    option.releaseDate,
    option.costLabel,
    option.costDescription,
    option.metaLabel,
    option.searchText,
    ...(option.badges ?? []).map((badge) => badge.label),
  ].map(normalize).join(' ');
  return haystack.includes(query);
};

const groupLabel = (option: ModelBrowserOption, pivot: ModelBrowserPivot): string => {
  if (pivot === 'release-date') {
    return releaseDateValue(option.releaseDate)?.toLocaleString('en-US', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    }) ?? RELEASE_DATE_UNAVAILABLE;
  }
  return pivot === 'provider' ? providerLabel(option) : familyLabel(option);
};

const sortOptions = (a: ModelBrowserOption, b: ModelBrowserOption): number => {
  const dateCompare = (releaseDateValue(b.releaseDate)?.getTime() ?? -Infinity) -
    (releaseDateValue(a.releaseDate)?.getTime() ?? -Infinity);
  if (dateCompare && !Number.isNaN(dateCompare)) return dateCompare;
  return a.label.localeCompare(b.label);
};

const formatReleaseDate = (releaseDate?: string): string => {
  const date = releaseDateValue(releaseDate);
  if (!date) return 'Release unavailable';
  return `Released ${date.toLocaleString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
};

const supportingDescriptionFor = (option: ModelBrowserOption): string | undefined => {
  if (!option.narrative) return option.description ?? option.id;
  if (!option.description) return undefined;
  if (option.description === option.narrative || option.description === option.id) {
    return undefined;
  }
  return option.description;
};

function SearchIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const ModelBrowserModal: React.FC<ModelBrowserModalProps> = ({
  open,
  label,
  subtitle,
  options,
  value,
  onClose,
  onSelect,
  footerLabel = 'Curated by Pixel Minion',
}) => {
  const [query, setQuery] = React.useState('');
  const [pivot, setPivot] = React.useState<ModelBrowserPivot>('provider');
  const [activeGroup, setActiveGroup] = React.useState('All');
  const domId = React.useId();
  const pivotRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Escape (top overlay only), focus capture/return, inert frame, focus trap.
  const backdropRef = React.useRef<HTMLDivElement>(null);
  const searchRef = useOverlayDismiss<HTMLInputElement>({ open, onClose, containerRef: backdropRef });

  React.useEffect(() => {
    setActiveGroup('All');
  }, [pivot]);

  React.useEffect(() => {
    if (open) {
      // Bring the current model into view; jsdom has no scrollIntoView.
      const selected = listRef.current?.querySelector<HTMLElement>('.model-browser-card.selected');
      if (typeof selected?.scrollIntoView === 'function') {
        selected.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
      return;
    }
    setQuery('');
    setActiveGroup('All');
  }, [open]);

  if (!open) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options
    .filter((option) => matchesSearch(option, normalizedQuery))
    .sort(sortOptions);
  const groups = Array.from(new Set(filteredOptions.map((option) => groupLabel(option, pivot))));
  // Date groups inherit newest-first order from the already sorted options.
  if (pivot !== 'release-date') groups.sort((a, b) => a.localeCompare(b));
  const groupCounts = new Map<string, number>();
  filteredOptions.forEach((option) => {
    const group = groupLabel(option, pivot);
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
  });

  const effectiveActiveGroup =
    activeGroup === 'All' || groups.includes(activeGroup) ? activeGroup : 'All';
  const visibleGroups =
    effectiveActiveGroup === 'All'
      ? groups
      : groups.filter((group) => group === effectiveActiveGroup);

  const selectModel = (modelId: string) => {
    onSelect(modelId);
    onClose();
  };

  const pivotIndex = PIVOTS.findIndex((entry) => entry.id === pivot);
  const pivotDomId = (id: ModelBrowserPivot) => `${domId}-pivot-${id}`;
  const listDomId = `${domId}-list`;
  const handlePivotKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const focused = pivotRefs.current.findIndex((tab) => tab === event.target);
    const next = nextTabIndex(event.key, focused >= 0 ? focused : pivotIndex, PIVOTS.length);
    if (next === null) return;
    event.preventDefault();
    setPivot(PIVOTS[next].id);
    pivotRefs.current[next]?.focus();
  };

  // Stable per-render card ids for aria-labelledby / aria-describedby.
  const cardIndex = new Map(filteredOptions.map((option, index) => [option.id, index]));

  return (
    <div ref={backdropRef} className="model-browser-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="model-browser"
        role="dialog"
        aria-modal="true"
        aria-label={`${label} browser`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="model-browser-head">
          <div>
            <div className="model-browser-eyebrow">{label}</div>
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
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search models, providers, families..."
            aria-label="Search models"
          />
        </label>

        <div
          className="model-browser-pivots"
          role="tablist"
          aria-label="Model grouping"
          onKeyDown={handlePivotKeyDown}
        >
          {PIVOTS.map((entry, index) => (
            <button
              type="button"
              key={entry.id}
              ref={(element) => {
                pivotRefs.current[index] = element;
              }}
              id={pivotDomId(entry.id)}
              role="tab"
              aria-selected={pivot === entry.id}
              aria-controls={listDomId}
              tabIndex={pivot === entry.id ? 0 : -1}
              className={pivot === entry.id ? 'active' : ''}
              onClick={() => setPivot(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="model-browser-chips" role="group" aria-label="Model groups">
          <button
            type="button"
            aria-pressed={effectiveActiveGroup === 'All'}
            className={effectiveActiveGroup === 'All' ? 'active' : ''}
            onClick={() => setActiveGroup('All')}
          >
            All <span>{filteredOptions.length}</span>
          </button>
          {groups.map((group) => (
            <button
              type="button"
              key={group}
              aria-pressed={effectiveActiveGroup === group}
              className={effectiveActiveGroup === group ? 'active' : ''}
              onClick={() => setActiveGroup(group)}
            >
              {group} <span>{groupCounts.get(group) ?? 0}</span>
            </button>
          ))}
        </div>

        <div
          ref={listRef}
          id={listDomId}
          className="model-browser-list"
          role="tabpanel"
          aria-labelledby={pivotDomId(pivot)}
        >
          {visibleGroups.length === 0 && (
            <div className="model-browser-empty">No models match that search.</div>
          )}
          {visibleGroups.map((group) => {
            const models = filteredOptions.filter((option) => groupLabel(option, pivot) === group);
            const highlightProvider = pivot === 'provider' && group === 'OpenRouter';
            return (
              <React.Fragment key={group}>
                <div className={`model-browser-rule${highlightProvider ? ' provider-highlight' : ''}`}>
                  <span>{group}</span>
                  <em>{models.length}</em>
                  <hr />
                </div>
                <div className="model-browser-grid">
                  {models.map((option) => {
                    const selected = option.id === value;
                    const supportingDescription = supportingDescriptionFor(option);
                    const cardId = `${domId}-card-${cardIndex.get(option.id)}`;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`model-browser-card${selected ? ' selected' : ''}`}
                        aria-pressed={selected}
                        aria-labelledby={`${cardId}-title`}
                        aria-describedby={option.costLabel ? `${cardId}-cost ${cardId}-details` : `${cardId}-details`}
                        onClick={() => selectModel(option.id)}
                      >
                        {selected && <span className="model-browser-selected"><CheckIcon /></span>}
                        <span className="model-browser-card-head">
                          <span id={`${cardId}-title`} className="model-browser-card-title">{option.label}</span>
                          {option.costLabel && (
                            <span id={`${cardId}-cost`} className="model-browser-cost">{option.costLabel}</span>
                          )}
                        </span>
                        <span id={`${cardId}-details`} className="model-browser-card-details">
                          <span className="model-browser-badges">
                            <span className={`model-browser-badge ${option.releaseDate ? 'accent' : ''}`}>
                              {formatReleaseDate(option.releaseDate)}
                            </span>
                            {option.metaLabel && <span className="model-browser-badge accent">{option.metaLabel}</span>}
                            {option.badges?.map((badge) => (
                              <span
                                key={`${option.id}-${badge.label}`}
                                className={`model-browser-badge ${badge.tone ?? ''}`}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </span>
                          {option.costDescription && (
                            <span className="model-browser-desc">{option.costDescription}</span>
                          )}
                          {option.narrative && (
                            <span className="model-browser-narrative">{option.narrative}</span>
                          )}
                          {supportingDescription && (
                            <span className="model-browser-desc">{supportingDescription}</span>
                          )}
                        </span>
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
          <span>{footerLabel}</span>
        </footer>
      </section>
    </div>
  );
};
