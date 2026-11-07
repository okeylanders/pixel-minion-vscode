/**
 * @jest-environment jsdom
 */
/**
 * The first two cases are ported from frame-minion@40e7949
 * (ModelBrowserSelect.test.tsx); the rest pin Pixel's trigger deltas.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ModelBrowserSelect } from '../../../../../presentation/webview/components/shared/ModelBrowserSelect';
import { __resetOverlayStateForTests } from '../../../../../presentation/webview/hooks/useOverlayDismiss';

describe('ModelBrowserSelect', () => {
  afterEach(() => {
    __resetOverlayStateForTests();
  });

  const options = [
    {
      id: 'provider/known',
      label: 'Known Model',
      provider: 'Provider',
      family: 'Known',
    },
  ];

  it('labels off-menu values as custom instead of showing a bare model id', () => {
    render(
      <ModelBrowserSelect
        label="Model"
        options={options}
        value="legacy/provider-model"
        onChange={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Current model: Custom: legacy\/provider-model/i })).toBeTruthy();
    expect(screen.getByText('Custom: legacy/provider-model')).toBeTruthy();
  });

  it('shows the loading label and keeps the trigger closed when no options are available', () => {
    render(
      <ModelBrowserSelect
        label="Model"
        options={[]}
        value="provider/loading"
        loadingLabel="Loading models..."
        onChange={jest.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /Current model: Loading models/i });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // ── Pixel deltas ─────────────────────────────────────────────────────────

  it('is a single-line trigger named by its label and current model, tied to its visible label', () => {
    render(<ModelBrowserSelect label="Image model" options={options} value="provider/known" onChange={jest.fn()} />);
    const trigger = screen.getByRole('button', {
      name: 'Browse image model options. Current model: Known Model',
    });
    expect(trigger.textContent).toBe('Known Model');
    expect(screen.getByText('Image model').getAttribute('for')).toBe(trigger.id);
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('reports whether its browser is open, and selects through it', () => {
    const onChange = jest.fn();
    render(<ModelBrowserSelect
      label="Model"
      options={[...options, { id: 'provider/other', label: 'Other Model' }]}
      value="provider/known"
      onChange={onChange}
    />);
    const trigger = screen.getByRole('button', { name: /Current model: Known Model/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Model browser' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Other Model' }));
    expect(onChange).toHaveBeenCalledWith('provider/other');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows helper text under the trigger when given', () => {
    render(<ModelBrowserSelect
      label="Model" options={options} value="provider/known" onChange={jest.fn()}
      helperText="Not in the curated list."
    />);
    expect(screen.getByText('Not in the curated list.').className).toBe('model-browser-helper');
  });
});
