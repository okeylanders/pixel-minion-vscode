/**
 * Tests for the tablist roving-focus keyboard model.
 */
import { nextTabIndex } from '../../../../presentation/webview/components/layout/tabKeyboard';

describe('nextTabIndex', () => {
  it('moves right and wraps from the last tab to the first', () => {
    expect(nextTabIndex('ArrowRight', 0, 2)).toBe(1);
    expect(nextTabIndex('ArrowRight', 1, 2)).toBe(0);
  });

  it('moves left and wraps from the first tab to the last', () => {
    expect(nextTabIndex('ArrowLeft', 1, 3)).toBe(0);
    expect(nextTabIndex('ArrowLeft', 0, 3)).toBe(2);
  });

  it('jumps to the ends with Home and End', () => {
    expect(nextTabIndex('Home', 2, 3)).toBe(0);
    expect(nextTabIndex('End', 0, 3)).toBe(2);
  });

  it('ignores keys that are not tablist navigation', () => {
    expect(nextTabIndex('Enter', 0, 2)).toBeNull();
    expect(nextTabIndex('ArrowDown', 0, 2)).toBeNull();
    expect(nextTabIndex('Tab', 0, 2)).toBeNull();
  });

  it('treats an unknown current tab as the first and an empty list as nothing to do', () => {
    expect(nextTabIndex('ArrowRight', -1, 2)).toBe(1);
    expect(nextTabIndex('ArrowRight', 0, 0)).toBeNull();
  });
});
