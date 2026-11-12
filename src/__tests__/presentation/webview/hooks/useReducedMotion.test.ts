/**
 * @jest-environment jsdom
 */
/// <reference lib="dom" />
/**
 * Tests for useReducedMotion: the OS media query OR VS Code's
 * `vscode-reduce-motion` body class, re-read when either changes.
 */
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import { prefersReducedMotion, useReducedMotion } from '../../../../presentation/webview/hooks/useReducedMotion';

type ChangeListener = () => void;

/** A controllable matchMedia for the reduced-motion query. */
function mockMatchMedia(initial: boolean) {
  const listeners = new Set<ChangeListener>();
  const media = {
    matches: initial,
    addEventListener: (_type: string, listener: ChangeListener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: ChangeListener) => listeners.delete(listener),
  };
  window.matchMedia = jest.fn(() => media) as unknown as typeof window.matchMedia;
  return {
    set(matches: boolean) {
      media.matches = matches;
      listeners.forEach(listener => listener());
    },
    listenerCount: () => listeners.size,
  };
}

function Probe(): React.ReactElement {
  return React.createElement('span', { 'data-testid': 'probe' }, useReducedMotion() ? 'reduced' : 'full');
}

const probe = () => screen.getByTestId('probe').textContent;

afterEach(() => {
  document.body.className = '';
});

describe('prefersReducedMotion', () => {
  it('follows the OS media query', () => {
    mockMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    mockMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("follows VS Code's reduce-motion body class when the OS doesn't ask", () => {
    mockMatchMedia(false);
    document.body.classList.add('vscode-reduce-motion');
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe('useReducedMotion', () => {
  it('re-renders when the OS setting changes', () => {
    const media = mockMatchMedia(false);
    render(React.createElement(Probe));
    expect(probe()).toBe('full');

    act(() => media.set(true));
    expect(probe()).toBe('reduced');
  });

  it("re-renders when VS Code toggles its body class", async () => {
    mockMatchMedia(false);
    render(React.createElement(Probe));

    await act(async () => {
      document.body.classList.add('vscode-reduce-motion');
    });
    expect(probe()).toBe('reduced');

    await act(async () => {
      document.body.classList.remove('vscode-reduce-motion');
    });
    expect(probe()).toBe('full');
  });

  it('shares one media listener between consumers and drops it when the last unmounts', () => {
    const media = mockMatchMedia(false);
    const view = render(React.createElement(React.Fragment, null, React.createElement(Probe), React.createElement(Probe)));
    expect(media.listenerCount()).toBe(1);

    view.unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
