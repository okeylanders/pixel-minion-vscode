/**
 * @jest-environment jsdom
 */
/// <reference lib="dom" />
/**
 * Tests for useOverlayDismiss: focus capture/return, top-only Escape, the
 * inert frame behind the top overlay, and the Tab focus trap.
 */
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  OVERLAY_Z_BASE,
  __resetOverlayStateForTests,
  isAnyOverlayOpen,
  useOverlayDismiss,
} from '../../../../presentation/webview/hooks/useOverlayDismiss';

const h = React.createElement;

interface OverlayProps {
  name: string;
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

function Overlay({ name, open, onClose, children }: OverlayProps): React.ReactElement | null {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const closeRef = useOverlayDismiss({ open, onClose, containerRef });
  if (!open) {
    return null;
  }
  return h(
    'div',
    { ref: containerRef, role: 'dialog', 'aria-label': name },
    h('button', { ref: closeRef, onClick: onClose }, `Close ${name}`),
    h('button', null, `Action ${name}`),
    children
  );
}

/** A frame with an opener for the outer overlay, which can open a nested one. */
function Frame(): React.ReactElement {
  const [outer, setOuter] = React.useState(false);
  const [inner, setInner] = React.useState(false);
  return h(
    'div',
    { className: 'app-container' },
    h('header', null, h('button', null, 'Header action')),
    h('button', { onClick: () => setOuter(true) }, 'Open outer'),
    h(
      Overlay,
      { name: 'outer', open: outer, onClose: () => setOuter(false) },
      h('button', { onClick: () => setInner(true) }, 'Open inner'),
      h(Overlay, { name: 'inner', open: inner, onClose: () => setInner(false) })
    )
  );
}

/** Let the hook's focus-restore microtask run. */
const flushMicrotasks = () => act(async () => undefined);

const button = (name: string) => screen.getByRole('button', { name });
const pressKey = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(window, { key, ...init });

beforeEach(() => {
  __resetOverlayStateForTests();
});

describe('useOverlayDismiss', () => {
  it('focuses the overlay on open and returns focus to the opener on close', async () => {
    render(h(Frame));
    const opener = button('Open outer');
    opener.focus();

    fireEvent.click(opener);
    expect(document.activeElement).toBe(button('Close outer'));
    expect(isAnyOverlayOpen()).toBe(true);

    fireEvent.click(button('Close outer'));
    await flushMicrotasks();
    expect(document.activeElement).toBe(opener);
    expect(isAnyOverlayOpen()).toBe(false);
  });

  it('closes only the top overlay on Escape and hands focus back to its opener', async () => {
    render(h(Frame));
    fireEvent.click(button('Open outer'));
    const innerOpener = button('Open inner');
    innerOpener.focus();
    fireEvent.click(innerOpener);
    expect(screen.getByRole('dialog', { name: 'inner' })).toBeTruthy();

    pressKey('Escape');
    await flushMicrotasks();
    expect(screen.queryByRole('dialog', { name: 'inner' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'outer' })).toBeTruthy();
    expect(document.activeElement).toBe(innerOpener);

    pressKey('Escape');
    expect(screen.queryByRole('dialog', { name: 'outer' })).toBeNull();
  });

  it('ignores an Escape another handler already consumed, and IME composition', () => {
    render(h(Frame));
    fireEvent.click(button('Open outer'));

    const consumed = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    consumed.preventDefault();
    act(() => {
      window.dispatchEvent(consumed);
    });
    pressKey('Escape', { isComposing: true });

    expect(screen.getByRole('dialog', { name: 'outer' })).toBeTruthy();
  });

  it('makes the frame behind the top overlay inert, and only that frame', async () => {
    const { container } = render(h(Frame));
    const header = container.querySelector('header') as HTMLElement;
    const outerOpener = button('Open outer');

    fireEvent.click(outerOpener);
    expect(header.hasAttribute('inert')).toBe(true);
    expect(outerOpener.hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('dialog', { name: 'outer' }).hasAttribute('inert')).toBe(false);

    fireEvent.click(button('Open inner'));
    const outerAction = button('Action outer');
    expect(outerAction.hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('dialog', { name: 'inner' }).closest('[inert]')).toBeNull();

    pressKey('Escape');
    await flushMicrotasks();
    expect(outerAction.hasAttribute('inert')).toBe(false);
    expect(header.hasAttribute('inert')).toBe(true);

    pressKey('Escape');
    await flushMicrotasks();
    expect(container.querySelector('[inert]')).toBeNull();
  });

  it('leaves alone an element that was already inert before the overlay opened', async () => {
    const { container } = render(h(Frame));
    const header = container.querySelector('header') as HTMLElement;
    header.setAttribute('inert', '');

    fireEvent.click(button('Open outer'));
    pressKey('Escape');
    await flushMicrotasks();

    expect(header.hasAttribute('inert')).toBe(true);
  });

  it('wraps Tab and Shift+Tab inside the top overlay', () => {
    render(h(Frame));
    fireEvent.click(button('Open outer'));
    const first = button('Close outer');
    const last = button('Open inner');

    last.focus();
    pressKey('Tab');
    expect(document.activeElement).toBe(first);

    pressKey('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);

    // Focus that fell out of the overlay is pulled back in.
    last.blur();
    expect(document.activeElement).toBe(document.body);
    pressKey('Tab');
    expect(document.activeElement).toBe(first);
  });

  describe('paint order follows the overlay stack', () => {
    /**
     * App's layout: the model browser renders inside .tab-content, and the
     * Settings overlay is a sibling of it. Settings can be opened by the host
     * (the view-title gear) while the picker is open, or open the picker
     * itself from one of its model fields.
     */
    function App({ hostOpensSettings }: { hostOpensSettings: boolean }): React.ReactElement {
      const [picker, setPicker] = React.useState(false);
      const [settingsPicker, setSettingsPicker] = React.useState(false);
      const [settings, setSettings] = React.useState(false);
      React.useEffect(() => {
        if (hostOpensSettings) {
          setSettings(true);
        }
      }, [hostOpensSettings]);
      return h(
        'div',
        { className: 'app-container' },
        h(
          'div',
          { className: 'tab-content' },
          h('button', { onClick: () => setPicker(true) }, 'Open picker'),
          h(Overlay, { name: 'picker', open: picker, onClose: () => setPicker(false) })
        ),
        h(
          Overlay,
          { name: 'settings', open: settings, onClose: () => setSettings(false) },
          h('button', { onClick: () => setSettingsPicker(true) }, 'Choose model'),
          h(Overlay, {
            name: 'settings picker',
            open: settingsPicker,
            onClose: () => setSettingsPicker(false),
          })
        )
      );
    }

    const dialog = (name: string) => screen.getByRole('dialog', { name });
    const zIndex = (element: HTMLElement) => Number(element.style.zIndex);

    it('puts Settings opened by the host above an open picker, then hands back to the picker', async () => {
      const { rerender } = render(h(App, { hostOpensSettings: false }));
      fireEvent.click(button('Open picker'));
      const pickerFocus = button('Close picker');
      expect(document.activeElement).toBe(pickerFocus);
      expect(zIndex(dialog('picker'))).toBe(OVERLAY_Z_BASE);

      rerender(h(App, { hostOpensSettings: true }));
      await flushMicrotasks();

      // Top in the hook's stack, and top on screen.
      expect(document.activeElement).toBe(button('Close settings'));
      expect(dialog('picker').closest('[inert]')).not.toBeNull();
      expect(dialog('settings').closest('[inert]')).toBeNull();
      expect(zIndex(dialog('settings'))).toBeGreaterThan(zIndex(dialog('picker')));

      pressKey('Escape');
      await flushMicrotasks();
      expect(screen.queryByRole('dialog', { name: 'settings' })).toBeNull();
      expect(dialog('picker').closest('[inert]')).toBeNull();
      expect(document.activeElement).toBe(pickerFocus);
      expect(zIndex(dialog('picker'))).toBe(OVERLAY_Z_BASE);

      pressKey('Escape');
      expect(screen.queryByRole('dialog', { name: 'picker' })).toBeNull();
    });

    it('puts a picker opened from Settings above Settings', async () => {
      const { rerender } = render(h(App, { hostOpensSettings: false }));
      rerender(h(App, { hostOpensSettings: true }));
      const opener = button('Choose model');
      opener.focus();
      fireEvent.click(opener);

      expect(document.activeElement).toBe(button('Close settings picker'));
      expect(zIndex(dialog('settings picker'))).toBeGreaterThan(zIndex(dialog('settings')));
      expect(button('Close settings').hasAttribute('inert')).toBe(true);

      pressKey('Escape');
      await flushMicrotasks();
      expect(screen.queryByRole('dialog', { name: 'settings picker' })).toBeNull();
      expect(dialog('settings')).toBeTruthy();
      expect(document.activeElement).toBe(opener);
      expect(zIndex(dialog('settings'))).toBe(OVERLAY_Z_BASE);
    });
  });
});
