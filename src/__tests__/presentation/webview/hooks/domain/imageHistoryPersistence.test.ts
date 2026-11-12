/**
 * The bounded webview snapshot. Ported from frame-minion@40e7949
 * imageHistoryPersistence.test.ts without the archive and desktop-budget
 * cases (Pixel has no earlier-thread archives until P4, and no desktop host).
 * A smaller explicit budget stands in where Frame used the desktop one.
 */
import {
  boundedImageHistory,
  mergeImageHistoryDraft,
  MAX_IMAGE_HISTORY_STORAGE_BYTES,
  IMAGE_HISTORY_DRAFT_RESERVE_BYTES,
  IMAGE_HISTORY_DRAFT_WARNING,
  IMAGE_HISTORY_STORAGE_WARNING,
} from '../../../../../presentation/webview/hooks/domain/imageHistoryPersistence';
import type { ImageGenerationPersistence } from '../../../../../presentation/webview/hooks/domain/useImageGeneration';
import type { ConversationTurn, GeneratedImage, ImageThreadSettings } from '@messages';

const smallBudget = 2 * 1024 * 1024;
const image = (data: string): GeneratedImage => ({ id: 'image', data, mimeType: 'image/png', seed: 1, timestamp: 1, prompt: 'A tree' });
const turn = (id: number, data = 'data:image/png;base64,QUJD'): ConversationTurn => ({ id: `turn-${id}`, prompt: `Prompt ${id}`, turnNumber: id, timestamp: id, images: [image(data)] });
const settings: ImageThreadSettings = { mode: 'conversation', model: 'google/gemini-3.1-flash-image', aspectRatio: '1:1', resolution: 'auto' };
const state = (): ImageGenerationPersistence => ({
  model: settings.model, aspectRatio: '1:1', resolution: 'auto', threadSettings: settings,
  prompt: 'next', conversationId: 'img-current', generatedImages: [], conversationHistory: [],
});
const bytes = (value: unknown) => JSON.stringify(value).length * 2;

it('bounds multi-megabyte images, preserves settings/counts/latest preview, and does not mutate the live result', () => {
  const live = state();
  const huge = `data:image/png;base64,${'A'.repeat(3 * 1024 * 1024)}`;
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
  expect(saved.persistenceWarning).toMatch(/Some images will not survive reload/);
  expect(live.conversationHistory[0].images[0].data).toBe(huge);
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
  const saved = mergeImageHistoryDraft(history, { model: '\u0000'.repeat(100000), aspectRatio: '1:1', resolution: 'auto', prompt: '\u0000'.repeat(100000) });
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
