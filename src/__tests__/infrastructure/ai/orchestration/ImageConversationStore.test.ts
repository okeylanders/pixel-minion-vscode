/**
 * FileImageConversationStore on its own (orchestrator-level recovery is in
 * ImageConversationModes.test.ts): tombstones are final, clearing writes only
 * when there is a record to retire, and a record must belong to the thread
 * whose file it is in.
 */
import { FileImageConversationStore } from '../../../../infrastructure/ai/orchestration/ImageConversationStore';
import type { ImageConversationState } from '../../../../infrastructure/ai/orchestration/ImageConversationManager';
import { memoryGlobalStorage } from '../../../helpers/memoryGlobalStorage';

const state = (id: string, turnNumber = 1): ImageConversationState => ({
  id, mode: 'conversation', model: 'google/gemini-3-pro-image', aspectRatio: '1:1', turnNumber,
  messages: [{ role: 'user', content: [{ type: 'text', text: 'A knight' }] }, { role: 'assistant', content: [{ type: 'text', text: 'ok' }] }],
  lastImages: ['data:image/png;base64,QUJD'],
});

function harness() {
  const { files, storage } = memoryGlobalStorage();
  const store = new FileImageConversationStore(storage, ['file:///project']);
  const json = () => JSON.parse(Buffer.from([...files.values()][0]).toString('utf8'));
  return { files, storage, store, json };
}

describe('tombstones', () => {
  it('refuses to write over a cleared thread, so a late turn cannot resurrect it', async () => {
    const { store, json } = harness();
    await store.write(state('img-a'));
    await store.clear('img-a');
    await expect(store.write(state('img-a', 2))).rejects.toThrow('was cleared');
    expect(json()).toEqual({ version: 1, deleted: true });
    expect(await store.read('img-a')).toBeUndefined();
  });

  it('writes nothing when clearing a thread that has no record', async () => {
    const { store, storage, files } = harness();
    await store.clear('img-never-saved');
    expect(storage.write).not.toHaveBeenCalled();
    expect(files.size).toBe(0);
  });

  it('writes a tombstone once: clearing an already cleared thread changes nothing', async () => {
    const { store, storage } = harness();
    await store.write(state('img-a'));
    await store.clear('img-a');
    const writes = storage.write.mock.calls.length;
    await store.clear('img-a');
    expect(storage.write).toHaveBeenCalledTimes(writes);
  });

  it('retires a small record that is not a tombstone (it may be corrupt) rather than leaving it', async () => {
    const { store, files, json } = harness();
    await store.write(state('img-a'));
    files.set([...files.keys()][0], Buffer.from('{"version":1}'));
    await store.clear('img-a');
    expect(json()).toEqual({ version: 1, deleted: true });
  });
});

describe('record ownership', () => {
  it('refuses a record whose thread id is not the one its file is named for', async () => {
    const { store, files } = harness();
    await store.write(state('img-a'));
    await store.write(state('img-b'));
    const [fileA, fileB] = [...files.keys()];
    // img-b's (valid) record copied into img-a's file.
    files.set(fileA, files.get(fileB)!);
    await expect(store.read('img-a')).rejects.toThrow('Saved image conversation is invalid.');
    expect((await store.read('img-b'))?.id).toBe('img-b');
  });
});
