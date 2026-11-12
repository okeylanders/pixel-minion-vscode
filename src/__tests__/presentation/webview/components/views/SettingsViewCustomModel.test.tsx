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
import { customModelIdFor, MAX_CUSTOM_MODEL_ID_LENGTH } from '../../../../../presentation/webview/components/shared/CustomModelIdField';
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

  it('stores the curated id when a custom id differs from one only in case', () => {
    const value = settings();
    render(<SettingsView settings={value} />);
    fireEvent.change(screen.getByLabelText('Custom image model id'), { target: { value: 'Google/Gemini-3-Pro-Image' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Use' })[0]);
    expect(value.updateSetting).toHaveBeenCalledWith('imageModel', 'google/gemini-3-pro-image');
    // Each field matches its own tab's catalog.
    fireEvent.change(screen.getByLabelText('Custom SVG model id'), { target: { value: 'Recraft/Recraft-V4.1-Vector' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Use' })[1]);
    expect(value.updateSetting).toHaveBeenCalledWith('svgModel', 'recraft/recraft-v4.1-vector');
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

describe('customModelIdFor (review P4-n1)', () => {
  const catalog = ['google/gemini-3-pro-image', 'recraft/recraft-v4.1'];

  it('accepts vendor/model ids, with an optional :variant, trimming surrounding spaces', () => {
    for (const id of ['acme/pixel-v9', 'black-forest-labs/flux.2-pro', 'x-ai/grok_image', 'openai/gpt-image-2:free', '01-ai/yi-2', 'a/b']) {
      expect(customModelIdFor(`  ${id} `, catalog)).toEqual({ id });
    }
  });

  it('refuses parts that start with punctuation, extra separators, other characters, and over-long ids', () => {
    for (const bad of ['../..', './.', '-/-', '_/@', 'a/:::', 'a/b:', 'a/:b', 'a/b/c', 'a//b', '/model', 'vendor/', 'a/b c',
      'a/b@1', 'a/b+c', 'acme/pïxel', 'https://openrouter.ai/acme/pixel', '']) {
      expect({ bad, result: customModelIdFor(bad, catalog).error }).toEqual({ bad, result: expect.stringMatching(/vendor\/model-name/) });
    }
    const long = `acme/${'p'.repeat(MAX_CUSTOM_MODEL_ID_LENGTH)}`;
    expect(customModelIdFor(long, catalog).error).toBe(`Model ids are at most ${MAX_CUSTOM_MODEL_ID_LENGTH} characters.`);
    expect(customModelIdFor(long.slice(0, MAX_CUSTOM_MODEL_ID_LENGTH), catalog)).toEqual({ id: long.slice(0, MAX_CUSTOM_MODEL_ID_LENGTH) });
  });

  it('turns a case-insensitive copy of a curated id into the curated id, and keeps other ids as typed', () => {
    expect(customModelIdFor('GOOGLE/gemini-3-PRO-image', catalog)).toEqual({ id: 'google/gemini-3-pro-image' });
    expect(customModelIdFor('Acme/Pixel-V9', catalog)).toEqual({ id: 'Acme/Pixel-V9' });
  });

  it('refuses a huge paste by its length before matching it', () => {
    expect(customModelIdFor(`a/${'b'.repeat(100_000)}`, catalog).error).toMatch(/at most/);
  });
});
