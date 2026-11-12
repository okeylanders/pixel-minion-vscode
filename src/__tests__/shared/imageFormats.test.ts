import { imageExtensionForMime, sniffImageMime } from '../../shared/media/imageFormats';

const bytes = (...values: Array<number | string>) => Uint8Array.from(
  values.flatMap((value) => typeof value === 'string' ? Array.from(value, (c) => c.charCodeAt(0)) : [value])
);

describe('imageFormats', () => {
  it.each([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/jpg', 'jpg'],
    ['image/webp', 'webp'],
    ['IMAGE/GIF', 'gif'],
  ])('saves %s as .%s', (mime, extension) => {
    expect(imageExtensionForMime(mime)).toBe(extension);
  });

  it.each([undefined, '', 'image/tiff', 'image/svg+xml', 'application/octet-stream'])(
    'has no raster extension for %p', (mime) => {
      expect(imageExtensionForMime(mime)).toBeUndefined();
    }
  );

  it('identifies PNG, JPEG, GIF and WebP from their leading bytes', () => {
    expect(sniffImageMime(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffImageMime(bytes('GIF89a'))).toBe('image/gif');
    expect(sniffImageMime(bytes('GIF87a'))).toBe('image/gif');
    expect(sniffImageMime(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('image/webp');
  });

  it('identifies nothing else', () => {
    expect(sniffImageMime(bytes())).toBeUndefined();
    expect(sniffImageMime(bytes('<svg'))).toBeUndefined();
    expect(sniffImageMime(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBeUndefined();
    expect(sniffImageMime(bytes(0x89, 'PN'))).toBeUndefined();
  });
});
