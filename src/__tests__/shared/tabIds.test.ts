import { TAB_IDS, normalizeTabId } from '@messages';

describe('normalizeTabId', () => {
  it.each(TAB_IDS)('keeps the rendered tab %p', (id) => {
    expect(normalizeTabId(id)).toBe(id);
  });

  it.each([
    ['the legacy settings tab (now an overlay)', 'settings'],
    ['a removed or unknown tab', 'hello-world'],
    ['nothing saved', undefined],
    ['a non-string', 42],
  ])('falls back to the Image tab for %s', (_label, saved) => {
    expect(normalizeTabId(saved)).toBe('image');
  });
});
