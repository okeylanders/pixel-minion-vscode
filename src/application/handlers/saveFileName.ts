/**
 * The webview suggests a file name; the host decides where the file goes.
 * A suggestion is joined onto the output folder, so it must be a plain file
 * name: anything that could name another folder (separators, `..`, a drive
 * or stream `:`), a hidden file, control characters or characters Windows
 * forbids is refused rather than repaired, because the webview only ever
 * sends `pixel-minion-<timestamp>.<ext>`.
 */
const MAX_FILE_NAME_LENGTH = 200;
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f\u007f]/;

export function plainSaveFileName(suggested: string): string {
  const name = suggested.trim();
  if (
    name === '' ||
    name.length > MAX_FILE_NAME_LENGTH ||
    FORBIDDEN_CHARACTERS.test(name) ||
    name.includes('..') ||
    name.startsWith('.')
  ) {
    const shown = JSON.stringify(name.length > 60 ? `${name.slice(0, 57)}…` : name);
    throw new Error(`Can't save as ${shown}: the file name must be a plain name, without folders.`);
  }
  return name;
}
