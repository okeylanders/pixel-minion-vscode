/**
 * @jest-environment jsdom
 */
/**
 * The first seven cases are ported from frame-minion@40e7949
 * (ModelBrowserModal.test.tsx; sample data renamed away from fal.ai). The
 * rest pin Pixel's deltas: overlay behaviour, ARIA states, scroll-into-view,
 * reset on close and the footer label.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ModelBrowserModal } from '../../../../../presentation/webview/components/shared/ModelBrowserModal';
import type { ModelBrowserOption } from '../../../../../presentation/webview/components/shared/ModelBrowserModal';
import { __resetOverlayStateForTests } from '../../../../../presentation/webview/hooks/useOverlayDismiss';

describe('ModelBrowserModal', () => {
  afterEach(() => {
    __resetOverlayStateForTests();
  });

  const groupedOptions: ModelBrowserOption[] = [
    {
      id: 'google/gemini',
      label: 'Gemini Flash',
      provider: 'Google',
      family: 'Gemini',
      releaseDate: '2026-06-30',
      narrative: 'Fast Google model.',
    },
    {
      id: 'recraft/vector',
      label: 'Vector Pro',
      provider: 'Recraft',
      family: 'Native SVG',
      releaseDate: '2026-05-20',
      narrative: 'Vector model.',
    },
  ];

  it('lists release dates, sorts newest first within a group, and keeps undated models last', () => {
    const onSelect = jest.fn();
    const { container } = render(
      <ModelBrowserModal
        open
        label="Image model"
        options={[
          {
            id: 'provider/older',
            label: 'Older',
            provider: 'Provider',
            family: 'Family',
            releaseDate: '2025-03-10',
            narrative: 'A reliable older model.',
          },
          {
            id: 'provider/unknown',
            label: 'Unknown',
            provider: 'Provider',
            family: 'Family',
            narrative: 'Useful when release data is unavailable.',
          },
          {
            id: 'provider/newer',
            label: 'Newer',
            provider: 'Provider',
            family: 'Family',
            releaseDate: '2026-06-30',
            narrative: 'The freshest model in this provider group.',
          },
        ]}
        value="provider/older"
        onClose={jest.fn()}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Released Jun 2026')).toBeTruthy();
    expect(screen.getByText('Released Mar 2025')).toBeTruthy();
    expect(screen.getByText('Release unavailable')).toBeTruthy();
    expect(screen.getByText('The freshest model in this provider group.')).toBeTruthy();

    const text = container.querySelector('.model-browser-grid')?.textContent ?? '';
    expect(text.indexOf('Newer')).toBeLessThan(text.indexOf('Older'));
    expect(text.indexOf('Older')).toBeLessThan(text.indexOf('Unknown'));

    fireEvent.click(screen.getByText('Newer'));
    expect(onSelect).toHaveBeenCalledWith('provider/newer');
  });

  it('shows pricing assumptions without requiring hover and keeps model selection working', () => {
    const onSelect = jest.fn();
    render(<ModelBrowserModal
      open label="Image model" onClose={jest.fn()} onSelect={onSelect}
      options={[{
        id: 'example/image', label: 'Example image', costLabel: '≈ $0.053 | image @ 1K · high',
        costDescription: 'High quality reference; prompt and reference-image charges are additional.',
      }]}
    />);
    const detail = screen.getByText('High quality reference; prompt and reference-image charges are additional.');
    expect(detail.hidden).toBe(false);
    fireEvent.click(detail);
    expect(onSelect).toHaveBeenCalledWith('example/image');
  });

  it('filters models by search query', () => {
    render(
      <ModelBrowserModal
        open
        label="Model"
        options={groupedOptions}
        value="google/gemini"
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Search models'), { target: { value: 'vector' } });

    expect(screen.getByText('Vector Pro')).toBeTruthy();
    expect(screen.queryByText('Gemini Flash')).toBeNull();
  });

  it('groups releases by month newest first, with missing and invalid dates last', () => {
    const onSelect = jest.fn();
    const { container } = render(<ModelBrowserModal
      open label="Model" onClose={jest.fn()} onSelect={onSelect}
      options={[
        { id: 'unknown', label: 'Undated' },
        { id: 'old', label: 'Old', releaseDate: '2025-12-01' },
        { id: 'earlier', label: 'Earlier', releaseDate: '2026-09-02' },
        { id: 'invalid', label: 'Invalid', releaseDate: '2026-02-30' },
        { id: 'latest', label: 'Latest', releaseDate: '2026-09-30' },
      ]}
    />);

    fireEvent.click(screen.getByRole('tab', { name: 'By Release Date' }));
    expect(screen.getByRole('tab', { name: 'By Release Date' }).getAttribute('aria-selected')).toBe('true');
    expect(Array.from(container.querySelectorAll('.model-browser-rule span')).map((el) => el.textContent))
      .toEqual(['September 2026', 'December 2025', 'Release date unavailable']);
    const cards = Array.from(container.querySelectorAll('.model-browser-card-title')).map((el) => el.textContent);
    expect(cards).toEqual(['Latest', 'Earlier', 'Old', 'Invalid', 'Undated']);

    fireEvent.click(screen.getByRole('button', { name: 'September 2026 2' }));
    expect(screen.queryByText('Old')).toBeNull();
    fireEvent.click(screen.getByText('Latest'));
    expect(onSelect).toHaveBeenCalledWith('latest');
  });

  it('resets month filtering on a pivot change and shows search results outside the selected month', () => {
    render(<ModelBrowserModal
      open label="Model" options={groupedOptions} onClose={jest.fn()} onSelect={jest.fn()}
    />);
    fireEvent.click(screen.getByRole('tab', { name: 'By Release Date' }));
    fireEvent.click(screen.getByRole('button', { name: 'June 2026 1' }));
    expect(screen.queryByText('Vector Pro')).toBeNull();
    fireEvent.change(screen.getByLabelText('Search models'), { target: { value: 'vector' } });
    expect(screen.getByText('Vector Pro')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search models'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('tab', { name: 'By Family' }));
    expect(screen.getByText('Vector Pro')).toBeTruthy();
    expect(screen.getByText('Gemini Flash')).toBeTruthy();
  });

  it('filters the visible cards by family group', () => {
    render(
      <ModelBrowserModal
        open
        label="Model"
        options={groupedOptions}
        value="google/gemini"
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('By Family'));
    fireEvent.click(screen.getByRole('button', { name: /Native SVG 1/i }));

    expect(screen.getByText('Vector Pro')).toBeTruthy();
    expect(screen.queryByText('Gemini Flash')).toBeNull();
  });

  it('visually highlights the OpenRouter provider section', () => {
    const { container } = render(
      <ModelBrowserModal
        open
        label="Model"
        options={[
          ...groupedOptions,
          {
            id: 'openrouter/auto-image',
            label: 'Auto image',
            provider: 'OpenRouter',
            family: 'Router',
          },
        ]}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />
    );

    const highlighted = container.querySelector('.model-browser-rule.provider-highlight');
    expect(highlighted?.textContent).toContain('OpenRouter');
    const recraftRule = Array.from(container.querySelectorAll('.model-browser-rule'))
      .find((rule) => rule.textContent?.includes('Recraft'));
    expect(recraftRule?.classList.contains('provider-highlight')).toBe(false);
  });

  // ── Pixel deltas ─────────────────────────────────────────────────────────

  it('is a labelled modal dialog that puts focus in the search field', () => {
    render(<ModelBrowserModal
      open label="Image model" options={groupedOptions} onClose={jest.fn()} onSelect={jest.fn()}
    />);
    const dialog = screen.getByRole('dialog', { name: 'Image model browser' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Search models'));
  });

  it('closes on Escape and on a backdrop press, but not on a press inside the panel', () => {
    const onClose = jest.fn();
    const { container } = render(<ModelBrowserModal
      open label="Model" options={groupedOptions} onClose={onClose} onSelect={jest.fn()}
    />);

    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(container.querySelector('.model-browser-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('exposes group chips as a group of toggle buttons', () => {
    render(<ModelBrowserModal
      open label="Model" options={groupedOptions} onClose={jest.fn()} onSelect={jest.fn()}
    />);
    const group = screen.getByRole('group', { name: 'Model groups' });
    const all = screen.getByRole('button', { name: 'All 2' });
    const google = screen.getByRole('button', { name: 'Google 1' });
    expect(group.contains(all)).toBe(true);
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(google.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(google);
    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(google.getAttribute('aria-pressed')).toBe('true');
  });

  it('names each card by its title, describes it by its details, and marks the current model pressed', () => {
    render(<ModelBrowserModal
      open label="Model"
      options={[{ ...groupedOptions[0], costLabel: '≈ $0.07 | image' }, groupedOptions[1]]}
      value="google/gemini"
      onClose={jest.fn()} onSelect={jest.fn()}
    />);
    const current = screen.getByRole('button', { name: 'Gemini Flash' });
    const other = screen.getByRole('button', { name: 'Vector Pro' });
    expect(current.getAttribute('aria-pressed')).toBe('true');
    expect(other.getAttribute('aria-pressed')).toBe('false');

    const describedBy = (current.getAttribute('aria-describedby') ?? '').split(' ');
    const description = describedBy.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    expect(description).toContain('≈ $0.07 | image');
    expect(description).toContain('Released Jun 2026');
    expect(description).toContain('Fast Google model.');
  });

  it('makes the pivots a tablist with one Tab stop, arrow-key navigation and a controlled panel', () => {
    render(<ModelBrowserModal
      open label="Model" options={groupedOptions} onClose={jest.fn()} onSelect={jest.fn()}
    />);
    const provider = screen.getByRole('tab', { name: 'By Provider' });
    const family = screen.getByRole('tab', { name: 'By Family' });
    const release = screen.getByRole('tab', { name: 'By Release Date' });
    expect([provider, family, release].map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);

    const panel = screen.getByRole('tabpanel');
    expect(provider.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(provider.id);

    act(() => provider.focus());
    fireEvent.keyDown(provider, { key: 'ArrowLeft' });
    expect(release.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(release);
    expect(panel.getAttribute('aria-labelledby')).toBe(release.id);

    fireEvent.keyDown(release, { key: 'Home' });
    expect(provider.getAttribute('aria-selected')).toBe('true');
    expect([provider, family, release].map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
  });

  it('scrolls the current model into view when it opens', () => {
    const scrollIntoView = jest.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      const { rerender } = render(<ModelBrowserModal
        open={false} label="Model" options={groupedOptions} value="recraft/vector"
        onClose={jest.fn()} onSelect={jest.fn()}
      />);
      expect(scrollIntoView).not.toHaveBeenCalled();

      rerender(<ModelBrowserModal
        open label="Model" options={groupedOptions} value="recraft/vector"
        onClose={jest.fn()} onSelect={jest.fn()}
      />);
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('button', { name: 'Vector Pro' }));
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('reopens on the full list: the query and group chip reset on close, the pivot stays', () => {
    const props = {
      label: 'Model', options: groupedOptions, onClose: jest.fn(), onSelect: jest.fn(),
    };
    const { rerender } = render(<ModelBrowserModal open {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: 'By Family' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gemini 1' }));
    fireEvent.change(screen.getByLabelText('Search models'), { target: { value: 'gemini' } });

    rerender(<ModelBrowserModal open={false} {...props} />);
    rerender(<ModelBrowserModal open {...props} />);

    expect((screen.getByLabelText('Search models') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'All 2' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('tab', { name: 'By Family' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Vector Pro')).toBeTruthy();
  });

  it('credits Pixel Minion in the footer unless told otherwise', () => {
    const { rerender } = render(<ModelBrowserModal
      open label="Model" options={groupedOptions} onClose={jest.fn()} onSelect={jest.fn()}
    />);
    expect(screen.getByText('Curated by Pixel Minion')).toBeTruthy();
    expect(screen.getByText('2 models')).toBeTruthy();

    rerender(<ModelBrowserModal
      open label="Model" options={groupedOptions} onClose={jest.fn()} onSelect={jest.fn()}
      footerLabel="Curated elsewhere"
    />);
    expect(screen.getByText('Curated elsewhere')).toBeTruthy();
  });

  it('renders a warn badge tone', () => {
    render(<ModelBrowserModal
      open label="Model" onClose={jest.fn()} onSelect={jest.fn()}
      options={[{ id: 'a/b', label: 'Retiring', badges: [{ label: 'retiring Dec 1, 2026', tone: 'warn' }] }]}
    />);
    expect(screen.getByText('retiring Dec 1, 2026').className).toContain('warn');
  });
});
