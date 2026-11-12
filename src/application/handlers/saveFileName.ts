/**
 * The webview suggests a file name; the host decides where the file goes.
 * A suggestion is joined onto the output folder, so it must be a plain file
 * name: anything that could name another folder (separators, `..`, a drive
 * or stream `:`), a hidden file, a Windows device name (`CON`, `NUL.svg`,
 * `COM1.png`…), a trailing dot or space (Windows drops them, so the file
 * would get another name), control characters, bidirectional or invisible
 * format controls (which can make `x‮gvs.exe` read as `xexe.svg`) or
 * characters Windows forbids is refused rather than repaired, because the
 * webview only ever sends `pixel-minion-<timestamp>.<ext>`.
 */
const MAX_FILE_NAME_LENGTH = 200;
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f\u007f-\u009f]/;
/** Bidirectional marks, embeddings, overrides and isolates. */
const FORMAT_CONTROLS = /[؜‎‏‪-‮⁦-⁩]/;
/** Reserved device names; Windows maps them to devices whatever the extension. */
const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])$/i;

/** Why a single path segment (file or folder name) is unsafe, or null when it is fine. */
function unsafeSegment(segment: string): string | null {
  if (segment === '' || segment.length > MAX_FILE_NAME_LENGTH) return 'empty or too long';
  if (FORBIDDEN_CHARACTERS.test(segment) || FORMAT_CONTROLS.test(segment)) return 'a forbidden character';
  if (segment.includes('..')) return '..';
  if (/[. ]$/.test(segment)) return 'a trailing dot or space';
  // `CON`, `con.svg`, `NUL .png`: the device part is the text before the first dot.
  if (WINDOWS_DEVICE_NAME.test(segment.split('.')[0].trimEnd())) return 'a reserved device name';
  return null;
}

function quoted(value: string): string {
  return JSON.stringify(value.length > 60 ? `${value.slice(0, 57)}…` : value);
}

export function plainSaveFileName(suggested: string): string {
  const name = suggested.trim();
  if (unsafeSegment(name) !== null || name.startsWith('.')) {
    throw new Error(`Can't save as ${quoted(name)}: the file name must be a plain name, without folders.`);
  }
  return name;
}

/**
 * The `pixelMinion.outputDirectory` setting as path segments under the
 * workspace folder. The setting can come from a repository's
 * `.vscode/settings.json`, and `Uri.joinPath` would resolve `..` in it, so a
 * value that isn't a relative path made of safe folder names (absolute, a
 * drive, `..`, a device name, …) is refused instead of followed. Empty means
 * the workspace folder itself.
 */
export function outputDirectorySegments(setting: string | undefined): string[] {
  const value = (setting ?? '').trim();
  const refuse = (): never => {
    throw new Error(
      `Can't save: the pixelMinion.outputDirectory setting (${quoted(value)}) must be a folder inside the workspace, such as "pixel-minion" or "assets/generated".`
    );
  };
  if (value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:/.test(value)) refuse();
  const segments = value.split(/[\\/]+/).filter((segment) => segment !== '' && segment !== '.');
  for (const segment of segments) {
    if (unsafeSegment(segment) !== null) refuse();
  }
  return segments;
}
