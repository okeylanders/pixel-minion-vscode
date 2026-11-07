import { outputDirectorySegments, plainSaveFileName } from '../../../application/handlers/saveFileName';

describe('plainSaveFileName', () => {
  it.each([
    'pixel-minion-2026-11-07T10-00-00-000Z.png', 'logo.svg', 'my icon (v2).svg', '  spaced.svg  ',
    // Look-alikes that are plain names, not paths.
    '%2e%2e%2fx.svg', 'x\u2215y.svg', 'console.svg', 'com10.svg', 'nullable.png',
  ])('accepts the plain name %p', (name) => {
    expect(plainSaveFileName(name)).toBe(name.trim());
  });

  it.each([
    '', '   ', '..', '../x.svg', 'a/../x.svg', 'dir/x.svg', 'dir\\x.svg', '/abs.svg', 'C:x.svg', 'x.svg:stream',
    '.hidden', 'a..b.svg', 'tab\there.svg', 'nul\u0000.svg', 'what?.svg', 'pipe|.svg', 'x'.repeat(201),
  ])('refuses %p', (name) => {
    expect(() => plainSaveFileName(name)).toThrow('plain name');
  });

  it.each([
    'CON', 'con', 'PRN.svg', 'aux.png', 'NUL.svg', 'nul.tar.gz', 'NUL .svg', 'COM1.png', 'com9', 'LPT1.svg',
    'lpt0.png', 'COM\u00b9.svg', 'CONIN$', 'conout$.svg',
  ])('refuses the Windows device name %p, with or without an extension', (name) => {
    expect(() => plainSaveFileName(name)).toThrow('plain name');
  });

  it.each(['x.svg.', 'x.svg. ', 'x.', 'x. .'])('refuses %p, which Windows would rename by dropping its trailing dots', (name) => {
    expect(() => plainSaveFileName(name)).toThrow('plain name');
  });

  it.each(['202a', '202b', '202c', '202d', '202e', '2066', '2067', '2068', '2069', '200e', '200f', '061c', '0085'])(
    'refuses a name containing the control character U+%s', (hex) => {
      const control = String.fromCodePoint(parseInt(hex, 16));
      expect(() => plainSaveFileName(`x${control}gvs.png`)).toThrow('plain name');
    }
  );
});

describe('outputDirectorySegments', () => {
  it.each([
    ['pixel-minion', ['pixel-minion']],
    ['assets/generated', ['assets', 'generated']],
    ['assets\\generated\\', ['assets', 'generated']],
    ['./out', ['out']],
    ['', []],
    [undefined, []],
  ] as const)('reads %p as a folder inside the workspace', (setting, expected) => {
    expect(outputDirectorySegments(setting)).toEqual(expected);
  });

  it.each([
    '..', '../outside', 'a/../../outside', 'a/..', '/etc', '\\\\server\\share', '\\outside', 'C:\\Users\\me', 'c:out',
    'out/CON', 'aux', 'out./x', 'x:stream', 'a\u202e', 'tab\there',
  ])('refuses %p', (setting) => {
    expect(() => outputDirectorySegments(setting)).toThrow('must be a folder inside the workspace');
  });
});
