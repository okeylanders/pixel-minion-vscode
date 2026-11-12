/**
 * The bounded webview snapshot. Ported from frame-minion@40e7949
 * imageHistoryPersistence.test.ts without the desktop-budget half (Pixel has
 * no desktop host); a smaller explicit budget stands in where Frame used it.
 */
import {
  boundedImageHistory,
  mergeImageHistoryDraft,
  MAX_IMAGE_HISTORY_STORAGE_BYTES,
  MAX_PERSISTED_IMAGE_ARCHIVES,
  IMAGE_HISTORY_DRAFT_RESERVE_BYTES,
  IMAGE_HISTORY_DRAFT_WARNING,
  IMAGE_HISTORY_STORAGE_WARNING,
  IMAGE_HISTORY_ARCHIVE_WARNING,
  IMAGE_HISTORY_ARCHIVE_AND_STORAGE_WARNING,
} from '../../../../../presentation/webview/hooks/domain/imageHistoryPersistence';
import type { ImageGenerationPersistence } from '../../../../../presentation/webview/hooks/domain/useImageGeneration';
import type { ConversationTurn, GeneratedImage, ImageThreadSettings } from '@messages';

const smallBudget = 2 * 1024 * 1024;
const image = (data: string): GeneratedImage => ({ id: 'image', data, mimeType: 'image/png', seed: 1, timestamp: 1, prompt: 'A tree' });
const turn = (id: number, data = 'data:image/png;base64,QUJD'): ConversationTurn => ({ id: `turn-${id}`, prompt: `Prompt ${id}`, turnNumber: id, timestamp: id, images: [image(data)] });
const settings: ImageThreadSettings = { mode: 'conversation', model: 'google/gemini-3.1-flash-image', aspectRatio: '1:1', resolution: 'auto' };
const state = (): ImageGenerationPersistence => ({
  mode: 'conversation', model: settings.model, aspectRatio: '1:1', resolution: 'auto', threadSettings: settings,
  archivedThreads: [], prompt: 'next', conversationId: 'img-current', generatedImages: [], conversationHistory: [],
});
const bytes = (value: unknown) => JSON.stringify(value).length * 2;

it('keeps the newest five persisted archives while leaving live history intact', () => {
  const live = state();
  live.archivedThreads = Array.from({ length: 6 }, (_, i) => ({ id: `img-${i}`, settings, turns: [turn(i)] }));
  const saved = boundedImageHistory(live, smallBudget);
  expect(saved.archivedThreads).toHaveLength(MAX_PERSISTED_IMAGE_ARCHIVES);
  expect(saved.archivedThreads?.map(thread => thread.id)).toEqual(['img-1', 'img-2', 'img-3', 'img-4', 'img-5']);
  expect(live.archivedThreads).toHaveLength(6);
  // Only the threads were left out: the note names only them.
  expect(saved.persistenceWarning).toBe(IMAGE_HISTORY_ARCHIVE_WARNING);
});

it('says nothing about Earlier threads while five or fewer are kept', () => {
  const live = state();
  live.archivedThreads = Array.from({ length: MAX_PERSISTED_IMAGE_ARCHIVES }, (_, i) => ({ id: `img-${i}`, settings, turns: [turn(i)] }));
  expect(boundedImageHistory(live, smallBudget).persistenceWarning).toBeUndefined();
});

it('bounds multi-megabyte images, preserves settings/counts/latest preview, and does not mutate the live result', () => {
  const live = state();
  const huge = `data:image/png;base64,${'A'.repeat(3 * 1024 * 1024)}`;
  live.archivedThreads = [{ id: 'img-old', settings, turns: [turn(1, huge)] }];
  live.conversationHistory = [turn(1, huge), turn(2)];
  live.generatedImages = live.conversationHistory[1].images;
  const saved = boundedImageHistory(live, smallBudget);
  expect(bytes(saved)).toBeLessThanOrEqual(smallBudget);
  expect(saved.threadSettings).toEqual(settings);
  expect(saved.conversationId).toBe('img-current');
  expect(saved.conversationHistory).toHaveLength(2);
  expect(saved.conversationHistory[0].imagesOmitted).toBe(true);
  expect(saved.conversationHistory[1].images).toEqual(live.generatedImages);
  expect(saved.generatedImages).toEqual([]); // no duplicate of the latest result
  // One archive, none dropped: only images were left out.
  expect(saved.persistenceWarning).toBe(IMAGE_HISTORY_STORAGE_WARNING);
  expect(live.conversationHistory[0].images[0].data).toBe(huge);
  expect(live.archivedThreads[0].turns[0].images).toHaveLength(1);
});

it('names both limits when a snapshot drops older threads and images', () => {
  const live = state();
  const big = `data:image/png;base64,${'A'.repeat(600 * 1024)}`;
  live.archivedThreads = Array.from({ length: 6 }, (_, i) => ({ id: `img-${i}`, settings, turns: [turn(i, big)] }));
  expect(boundedImageHistory(live, smallBudget).persistenceWarning).toBe(IMAGE_HISTORY_ARCHIVE_AND_STORAGE_WARNING);
});

it('drops archive images before the current thread’s', () => {
  const live = state();
  const big = `data:image/png;base64,${'A'.repeat(600 * 1024)}`;
  live.archivedThreads = [{ id: 'img-old', settings, turns: [turn(1, big)] }];
  live.conversationHistory = [turn(1, big)];
  // Room for one of the two images (each about 1.2 MB in UTF-16).
  const saved = boundedImageHistory(live, 1.5 * 1024 * 1024);
  expect(saved.archivedThreads?.[0].turns[0].imagesOmitted).toBe(true);
  expect(saved.conversationHistory[0].images).toHaveLength(1);
});

it('stores the latest images once when the thread has history', () => {
  const live = state();
  live.conversationHistory = [turn(1)];
  live.generatedImages = live.conversationHistory[0].images;
  expect(boundedImageHistory(live).generatedImages).toEqual([]);
  // Before the first turn lands there is no history to hold them.
  expect(boundedImageHistory({ ...state(), generatedImages: [image('data:image/png;base64,QUJD')] }).generatedImages).toHaveLength(1);
});

it('falls back to bounded draft state when text and SVG alone exceed the limit', () => {
  const live = state();
  live.prompt = 'prompt'.repeat(600000);
  live.conversationHistory = [{ ...turn(1), referenceSvgText: 'svg'.repeat(1000000) }];
  const saved = boundedImageHistory(live, smallBudget);
  expect(bytes(saved)).toBeLessThanOrEqual(smallBudget);
  expect(saved.model).toBe(live.model);
  expect(saved.conversationId).toBeNull();
  expect(saved.threadSettings).toBeNull();
  expect(saved.archivedThreads).toEqual([]);
  expect(saved.mode).toBe('conversation');
  expect(saved.persistenceWarning).toBeTruthy();
});

it('retains a three-megabyte image with the 48 MiB extension budget', () => {
  const live = state();
  live.conversationHistory = [turn(1, `data:image/png;base64,${'A'.repeat(4 * 1024 * 1024)}`)];
  const saved = boundedImageHistory(live);
  expect(saved.conversationHistory[0].images).toEqual(live.conversationHistory[0].images);
  expect(saved.persistenceWarning).toBeUndefined();
  expect(bytes(saved)).toBeLessThan(MAX_IMAGE_HISTORY_STORAGE_BYTES);
  expect(boundedImageHistory(live, smallBudget).conversationHistory[0].imagesOmitted).toBe(true);
});

it('reserves bounded draft space even for JSON-escaped input without dropping retained history', () => {
  const live = state();
  live.conversationHistory = [turn(1)];
  const history = boundedImageHistory(live, smallBudget - IMAGE_HISTORY_DRAFT_RESERVE_BYTES);
  const saved = mergeImageHistoryDraft(history, { mode: 'conversation', model: '\u0000'.repeat(100000), aspectRatio: '1:1', resolution: 'auto', prompt: '\u0000'.repeat(100000) });
  expect(bytes(saved)).toBeLessThanOrEqual(smallBudget);
  expect(saved.conversationHistory).toBe(history.conversationHistory);
  expect(saved.draftWarning).toBe(IMAGE_HISTORY_DRAFT_WARNING);
  // The draft note has its own field: the history warning stays what the bounding said.
  expect(saved.persistenceWarning).toBeUndefined();
});

it('warns only about what this snapshot leaves out, never carrying a warning it is given', () => {
  // A warning read back from an earlier snapshot (here, with the old
  // concatenated draft note) must not survive into the next one.
  const restored = { ...state(), persistenceWarning: `${IMAGE_HISTORY_STORAGE_WARNING} ${IMAGE_HISTORY_DRAFT_WARNING}`, draftWarning: IMAGE_HISTORY_DRAFT_WARNING };
  restored.conversationHistory = [turn(1)];
  const saved = boundedImageHistory(restored);
  expect(saved.persistenceWarning).toBeUndefined();
  expect(saved.draftWarning).toBeUndefined();
  expect(JSON.stringify(saved)).not.toContain('warning');

  const merged = mergeImageHistoryDraft(saved, { model: settings.model, aspectRatio: '1:1', resolution: 'auto', prompt: 'x'.repeat(40000) });
  expect(merged.draftWarning).toBe(IMAGE_HISTORY_DRAFT_WARNING);
  // Merging again (the next keystroke) gives the same note, not a longer one.
  expect(mergeImageHistoryDraft(merged, { model: settings.model, aspectRatio: '1:1', resolution: 'auto', prompt: 'y'.repeat(40001) }).draftWarning)
    .toBe(IMAGE_HISTORY_DRAFT_WARNING);
});
