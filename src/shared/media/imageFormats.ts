/**
 * Raster image formats Pixel Minion can save, and how to recognise them.
 *
 * Shared by the webview (suggested file name) and the host (the file that is
 * actually written), so both agree on one allowlist. Anything outside it is
 * rejected rather than saved under a guessed extension: a WebP written as
 * `.jpg` opens as a broken file in most viewers.
 */

/** File extension for each raster MIME type we accept for saving. */
const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg', // non-standard alias some providers emit
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** The save extension for a raster MIME type, or undefined when unsupported. */
export function imageExtensionForMime(mimeType: string | undefined): string | undefined {
  if (!mimeType) return undefined;
  return EXTENSION_BY_MIME[mimeType.trim().toLowerCase()];
}

/**
 * Identify a raster image from its leading bytes. The bytes, not the label a
 * provider attached to the data URL, decide what is written to disk.
 */
export function sniffImageMime(bytes: Uint8Array): string | undefined {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...Array.from(bytes.subarray(start, end)));

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && ascii(1, 4) === 'PNG' &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(ascii(0, 6))) {
    return 'image/gif';
  }
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return undefined;
}
