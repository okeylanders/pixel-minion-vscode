/**
 * Roving-focus keyboard model for a horizontal tablist (WAI-ARIA APG tabs
 * pattern, automatic activation): Left/Right move to the previous/next tab
 * and wrap, Home/End jump to the first/last tab.
 *
 * Returns the index to focus and activate, or null when the key isn't a
 * tablist navigation key (so the caller leaves the event alone).
 */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) {
    return null;
  }
  const from = current >= 0 && current < count ? current : 0;
  switch (key) {
    case 'ArrowRight':
      return (from + 1) % count;
    case 'ArrowLeft':
      return (from - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
