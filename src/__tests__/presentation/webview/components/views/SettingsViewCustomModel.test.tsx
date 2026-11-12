/**
 * @jest-environment jsdom
 */
/**
 * Ledger C14: Settings accepts a model id the curated pickers don't list.
 * The id is applied only on Use/Enter, is validated, and stays visible in
 * the picker afterwards.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsView } from '../../../../../presentation/webview/components/views/SettingsView';
import type { UseSettingsReturn } from '../../../../../presentation/webview/hooks';

function settings(overrides: Partial<UseSettingsReturn> = {}): UseSettingsReturn {
  return {
    maxConversationTurns: 10,
    imageModel: 'google/gemini-2.5-flash-image',
    svgModel: 'google/gemini-3-pro-preview',
    apiKeyConfigured: true,
    isLoading: false,
    updateSetting: jest.fn(),
    saveApiKey: jest.fn(),
    clearApiKey: jest.fn(),
    ...overrides,
  } as unknown as UseSettingsReturn;
}

describe('SettingsView custom model ids', () => {
  it('applies a custom image id on Use, not per keystroke', () => {
    const value = settings();
    render(<SettingsView settings={value} />);
    const field = screen.getByLabelText('Custom image model id');
    fireEvent.change(field, { target: { value: '  acme/pixel-v9  ' } });
    expect(value.updateSetting).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Use' })[0]);
    expect(value.updateSetting).toHaveBeenCalledWith('imageModel', 'acme/pixel-v9');
    expect((field as HTMLInputElement).value).toBe('');
  });

  it('applies a custom SVG id on Enter', () => {
    const value = settings();
    render(<SettingsView settings={value} />);
    const field = screen.getByLabelText('Custom SVG model id');
    fireEvent.change(field, { target: { value: 'recraft/recraft-v9-vector' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(value.updateSetting).toHaveBeenCalledWith('svgModel', 'recraft/recraft-v9-vector');
  });

  it('refuses an id that is not vendor/model and says why', () => {
    const value = settings();
    render(<SettingsView settings={value} />);
    const field = screen.getByLabelText('Custom image model id');
    for (const bad of ['gpt-image-2', 'acme/ pixel', 'https://openrouter.ai/acme/pixel']) {
      fireEvent.change(field, { target: { value: bad } });
      fireEvent.keyDown(field, { key: 'Enter' });
    }
    expect(value.updateSetting).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/vendor\/model-name/);
    expect(field.getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps Use disabled while the field is empty', () => {
    render(<SettingsView settings={settings()} />);
    for (const button of screen.getAllByRole('button', { name: 'Use' })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('explains what a custom id does on each tab', () => {
    render(<SettingsView settings={settings()} />);
    expect(screen.getByLabelText('Custom image model id').getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText(/runs as Single Shot with automatic dimensions/)).toBeTruthy();
    expect(screen.getByText(/recraft\/ makes native vector SVG/)).toBeTruthy();
  });

  it('shows a saved custom id in the picker rather than hiding it', () => {
    render(<SettingsView settings={settings({ imageModel: 'acme/pixel-v9' } as Partial<UseSettingsReturn>)} />);
    expect(document.body.textContent).toContain('acme/pixel-v9');
  });
});
