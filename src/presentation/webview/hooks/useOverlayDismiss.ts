/**
 * useOverlayDismiss — the one implementation of "Escape closes me, and focus
 * behaves" for Pixel Minion overlays (the Settings overlay and the model
 * browser). Ported from Prose Minion's hook of the same name, which is the
 * family's reference; see its notes for why the bookkeeping is module-level.
 *
 * What it does for the overlay on top:
 * - Focus capture and return: the element that had focus before the FIRST
 *   overlay opened gets it back when the LAST one closes; an overlay opened
 *   over another returns focus to its own opener.
 * - Escape closes the top overlay only, so a model browser opened from the
 *   Settings overlay closes without taking Settings with it.
 * - Inert background (added here): everything outside the top overlay, up to
 *   `.app-container`, is marked `inert`, so neither the pointer nor assistive
 *   tech reaches the frame behind it.
 * - Focus trap (added here): Tab / Shift+Tab wrap inside the top overlay
 *   instead of walking out of the webview.
 *
 * Why module-level state: React flushes every passive-effect cleanup for a
 * commit before any setup. When one overlay closes as another opens, a
 * per-hook copy would restore page focus before the opener captured it. The
 * stack, the return target and the inert set are document state, so they
 * live here.
 */
import * as React from 'react';

/** One open overlay; both callbacks read the hook's latest values. */
interface OpenOverlay {
  close: () => void;
  container: () => HTMLElement | null;
}

/** The overlays using this hook that are currently open, oldest first. */
const openOverlays: OpenOverlay[] = [];

/**
 * The element focused before the FIRST overlay opened. Held across an
 * overlay-to-overlay handoff, when `document.activeElement` is transiently
 * `<body>` and would otherwise overwrite a perfectly good target.
 */
let focusBeforeFirstOverlay: HTMLElement | null = null;

/** Elements this module marked inert (and only those), for an exact undo. */
let inertedBehindOverlay: HTMLElement[] = [];

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function topOverlay(): OpenOverlay | undefined {
  return openOverlays[openOverlays.length - 1];
}

function isVisible(element: HTMLElement): boolean {
  // checkVisibility (Chromium 105+) skips display:none / content-visibility
  // subtrees; environments without it (jsdom) treat everything as visible.
  return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
}

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    element => element.tabIndex >= 0 && !element.closest('[inert], [hidden]') && isVisible(element)
  );
}

/** Re-point `inert` at the frame behind whichever overlay is now on top. */
function syncInertBackground(): void {
  for (const element of inertedBehindOverlay) {
    element.removeAttribute('inert');
  }
  inertedBehindOverlay = [];

  const root = topOverlay()?.container();
  if (!root || !root.isConnected) {
    return;
  }
  const boundary = root.closest('.app-container') ?? document.body;
  let node: Element = root;
  while (node !== boundary && node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling !== node && sibling instanceof HTMLElement && !sibling.hasAttribute('inert')) {
        sibling.setAttribute('inert', '');
        inertedBehindOverlay.push(sibling);
      }
    }
    node = node.parentElement;
  }
}

/** Escape closes the top overlay; Tab wraps within it. */
function handleOverlayKeydown(event: KeyboardEvent): void {
  const top = topOverlay();
  if (!top || event.isComposing) {
    return;
  }

  if (event.key === 'Escape') {
    if (!event.defaultPrevented) {
      top.close();
    }
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }
  const container = top.container();
  if (!container) {
    return;
  }
  const items = focusableIn(container);
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = active instanceof Node && container.contains(active);
  if (event.shiftKey ? !inside || active === first : !inside || active === last) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

function pushOverlay(overlay: OpenOverlay): void {
  if (openOverlays.length === 0) {
    window.addEventListener('keydown', handleOverlayKeydown);
  }
  openOverlays.push(overlay);
  syncInertBackground();
}

function removeOverlay(overlay: OpenOverlay): void {
  const index = openOverlays.indexOf(overlay);
  if (index >= 0) {
    openOverlays.splice(index, 1);
  }
  if (openOverlays.length === 0) {
    window.removeEventListener('keydown', handleOverlayKeydown);
  }
  // Synchronously, so the focus restore below never targets an inert element.
  syncInertBackground();
}

/** Whether any overlay using this hook is open. */
export function isAnyOverlayOpen(): boolean {
  return openOverlays.length > 0;
}

/** Test seam: overlay bookkeeping is module state, so it needs a reset. */
export function __resetOverlayStateForTests(): void {
  openOverlays.splice(0);
  window.removeEventListener('keydown', handleOverlayKeydown);
  focusBeforeFirstOverlay = null;
  syncInertBackground();
}

export interface UseOverlayDismissOptions {
  open: boolean;
  /** Called on Escape (top overlay only). */
  onClose: () => void;
  /**
   * The overlay's root element: the focus trap's boundary and the subtree
   * that stays interactive while everything around it is inert.
   */
  containerRef: React.RefObject<HTMLElement>;
}

/**
 * Returns the ref for the element that should take focus when the overlay
 * opens (a Close button, or a search field). Don't also give that element
 * `autoFocus`: it would move focus during the commit, before this hook has
 * recorded the opener to return to.
 */
export function useOverlayDismiss<T extends HTMLElement = HTMLButtonElement>({
  open,
  onClose,
  containerRef,
}: UseOverlayDismissOptions): React.RefObject<T> {
  const initialFocusRef = React.useRef<T>(null);

  /* Held in a ref so an unstable onClose identity cannot re-run the effect
     and yank focus back to the initial element mid-use. */
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    /* Only claim a return target if no overlay already has one: during a
       handoff the previous overlay has gone but not yet restored, and the
       live activeElement is <body>. */
    const focused =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    if (openOverlays.length === 0 && focusBeforeFirstOverlay === null) {
      focusBeforeFirstOverlay = focused;
    }
    /* An overlay opened over another remembers what it was opened from, so
       closing it returns focus there rather than to the page behind both. */
    const nestedOpener = openOverlays.length > 0 ? focused : null;
    const overlay: OpenOverlay = {
      close: () => onCloseRef.current(),
      container: () => containerRef.current,
    };
    pushOverlay(overlay);
    initialFocusRef.current?.focus();

    return () => {
      removeOverlay(overlay);
      const target = focusBeforeFirstOverlay;

      /* Decide on a microtask, not now: cleanups run before setups, so an
         overlay opening in this same commit has not been pushed yet. If one
         has by the time this runs, the page is not getting focus back. */
      queueMicrotask(() => {
        if (openOverlays.length === 0) {
          focusBeforeFirstOverlay = null;
          if (target?.isConnected) {
            target.focus();
          }
          return;
        }
        /* Another overlay is still open. Hand focus back to this one's
           opener only if focus fell out of the page: an overlay opening in
           the same commit has already taken it. */
        const lost = document.activeElement === null || document.activeElement === document.body;
        if (lost && nestedOpener?.isConnected) {
          nestedOpener.focus();
        }
      });
    };
    // containerRef is a stable ref object, so in practice `open` drives this.
  }, [open, containerRef]);

  return initialFocusRef;
}
