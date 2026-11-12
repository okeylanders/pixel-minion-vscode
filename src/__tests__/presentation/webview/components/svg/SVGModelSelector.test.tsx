/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SVGModelSelector } from '../../../../../presentation/webview/components/svg/SVGModelSelector';
import { ModelSelector } from '../../../../../presentation/webview/components/image/ModelSelector';
import { __resetOverlayStateForTests } from '../../../../../presentation/webview/hooks/useOverlayDismiss';
import { OPENROUTER_IMAGE_MODELS, OPENROUTER_SVG_MODELS } from '../../../../../shared/models';

const ruleLabels = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('.model-browser-rule span')).map((el) => el.textContent ?? '');

describe('model selectors', () => {
  afterEach(() => {
    __resetOverlayStateForTests();
  });

  it('groups the SVG catalog by how each model makes SVG', () => {
    render(<SVGModelSelector
      models={OPENROUTER_SVG_MODELS}
      selectedModel={OPENROUTER_SVG_MODELS[0].id}
      onModelChange={jest.fn()}
    />);
    fireEvent.click(screen.getByRole('button', { name: /Current model:/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'By Family' }));

    const dialog = screen.getByRole('dialog');
    expect(ruleLabels(dialog)).toEqual(['Native SVG', 'SVG code']);
    const codeCount = OPENROUTER_SVG_MODELS.filter((model) => model.kind === 'code').length;
    expect(within(dialog).getByRole('button', { name: `SVG code ${codeCount}` })).toBeTruthy();
  });

  it('keeps an off-list SVG selection visible, with helper text', () => {
    render(<SVGModelSelector
      models={OPENROUTER_SVG_MODELS}
      selectedModel="example/retired-coder"
      onModelChange={jest.fn()}
      unavailableLabel="Not in the curated list."
    />);
    expect(screen.getByRole('button', { name: /Current model: Custom: example\/retired-coder/ })).toBeTruthy();
    expect(screen.getByText('Not in the curated list.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Current model:/ }));
    const card = screen.getByRole('button', { name: 'Custom: example/retired-coder' });
    expect(card.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps an off-list image selection visible as a custom card', () => {
    render(<ModelSelector
      models={OPENROUTER_IMAGE_MODELS}
      selectedModel="example/custom-image"
      onModelChange={jest.fn()}
    />);
    fireEvent.click(screen.getByRole('button', { name: /Current model: Custom: example\/custom-image/ }));
    expect(screen.getByRole('button', { name: 'Custom: example/custom-image' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(`${OPENROUTER_IMAGE_MODELS.length + 1} models`)).toBeTruthy();
  });

  it('shows no helper text for a curated selection', () => {
    const { container } = render(<ModelSelector
      models={OPENROUTER_IMAGE_MODELS}
      selectedModel={OPENROUTER_IMAGE_MODELS[0].id}
      onModelChange={jest.fn()}
      unavailableLabel="Not in the curated list."
    />);
    expect(container.querySelector('.model-browser-helper')).toBeNull();
  });
});
