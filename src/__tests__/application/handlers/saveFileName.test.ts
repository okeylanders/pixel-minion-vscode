import { plainSaveFileName } from '../../../application/handlers/saveFileName';

describe('plainSaveFileName', () => {
  it.each(['pixel-minion-2026-11-07T10-00-00-000Z.png', 'logo.svg', 'my icon (v2).svg', '  spaced.svg  '])(
    'accepts the plain name %p', (name) => {
      expect(plainSaveFileName(name)).toBe(name.trim());
    }
  );

  it.each([
    '', '   ', '..', '../x.svg', 'a/../x.svg', 'dir/x.svg', 'dir\\x.svg', '/abs.svg', 'C:x.svg', 'x.svg:stream',
    '.hidden', 'a..b.svg', 'tab\there.svg', 'nul\u0000.svg', 'what?.svg', 'pipe|.svg', 'x'.repeat(201),
  ])('refuses %p', (name) => {
    expect(() => plainSaveFileName(name)).toThrow('plain name');
  });
});
