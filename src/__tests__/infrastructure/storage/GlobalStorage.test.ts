/**
 * VsCodeGlobalStorage: the seam the transcript store writes through. What an
 * adapter must guarantee (and a future one must copy): a missing file reads
 * as `undefined` size rather than an error, any other failure surfaces, and
 * a write creates the parent folders first, because `workspace.fs.writeFile`
 * fails on a missing parent.
 */
import * as vscode from 'vscode';
import { VsCodeGlobalStorage } from '../../../infrastructure/storage/GlobalStorage';

const fs = vscode.workspace.fs as unknown as Record<'stat' | 'readFile' | 'writeFile' | 'createDirectory', jest.Mock>;
const root = { fsPath: '/global', path: '/global' } as unknown as vscode.Uri;

beforeEach(() => {
  for (const mock of Object.values(fs)) mock.mockReset();
});

it('reports the size of a stored file under the storage root', async () => {
  fs.stat.mockResolvedValue({ size: 42 });
  await expect(new VsCodeGlobalStorage(root).size('image-conversations/abc/img-1.json')).resolves.toBe(42);
  expect(fs.stat.mock.calls[0][0].path).toBe('/global/image-conversations/abc/img-1.json');
});

it.each([
  [{ code: 'FileNotFound' }],
  [{ code: 'ENOENT' }],
  [{ name: 'EntryNotFound (FileSystemError)' }],
])('reads a missing file as no size (%j)', async (failure) => {
  fs.stat.mockRejectedValue(Object.assign(new Error('missing'), failure));
  await expect(new VsCodeGlobalStorage(root).size('a/b.json')).resolves.toBeUndefined();
});

it('surfaces any other failure', async () => {
  fs.stat.mockRejectedValue(Object.assign(new Error('permission denied'), { code: 'NoPermissions' }));
  await expect(new VsCodeGlobalStorage(root).size('a/b.json')).rejects.toThrow('permission denied');
});

it('creates the parent folders before writing', async () => {
  const order: string[] = [];
  fs.createDirectory.mockImplementation(async (uri: vscode.Uri) => { order.push(`mkdir ${uri.path}`); });
  fs.writeFile.mockImplementation(async (uri: vscode.Uri) => { order.push(`write ${uri.path}`); });
  await new VsCodeGlobalStorage(root).write('image-conversations/abc/img-1.json', new Uint8Array([1]));
  expect(order).toEqual([
    'mkdir /global/image-conversations/abc',
    'write /global/image-conversations/abc/img-1.json',
  ]);
});

it('reads bytes back through workspace.fs', async () => {
  fs.readFile.mockResolvedValue(new Uint8Array([7]));
  await expect(new VsCodeGlobalStorage(root).read('a/b.json')).resolves.toEqual(new Uint8Array([7]));
});
