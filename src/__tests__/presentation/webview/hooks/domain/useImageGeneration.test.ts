/**
 * Tests for useImageGeneration utility functions
 */
import {
  isSourcefulModel,
  calculateBase64Size,
} from '../../../../../presentation/webview/hooks/domain/useImageGeneration';

describe('isSourcefulModel', () => {
  it('returns true for Sourceful Riverflow V2 Max Preview', () => {
    expect(isSourcefulModel('sourceful/riverflow-v2-max-preview')).toBe(true);
  });

  it('returns true for Sourceful Riverflow V2 Standard Preview', () => {
    expect(isSourcefulModel('sourceful/riverflow-v2-standard-preview')).toBe(true);
  });

  it('returns true for Sourceful Riverflow V2 Fast Preview', () => {
    expect(isSourcefulModel('sourceful/riverflow-v2-fast-preview')).toBe(true);
  });

  it('returns false for Google Gemini models', () => {
    expect(isSourcefulModel('google/gemini-2.5-flash-image')).toBe(false);
  });

  it('returns false for OpenAI models', () => {
    expect(isSourcefulModel('openai/gpt-5-image')).toBe(false);
  });

  it('returns false for Black Forest Labs models', () => {
    expect(isSourcefulModel('black-forest-labs/flux.2-max')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSourcefulModel('')).toBe(false);
  });

  it('is case-sensitive (lowercase only)', () => {
    expect(isSourcefulModel('Sourceful/riverflow-v2-max-preview')).toBe(false);
    expect(isSourcefulModel('SOURCEFUL/riverflow-v2-max-preview')).toBe(false);
  });
});

describe('calculateBase64Size', () => {
  it('returns 0 for empty array', () => {
    expect(calculateBase64Size([])).toBe(0);
  });

  it('returns 0 for data URL with no base64 content', () => {
    expect(calculateBase64Size(['data:image/png;base64,'])).toBe(0);
  });

  it('calculates approximate decoded size for single image', () => {
    // 100 base64 characters decode to approximately 75 bytes
    const dataUrl = 'data:image/png;base64,' + 'A'.repeat(100);
    expect(calculateBase64Size([dataUrl])).toBe(75);
  });

  it('calculates size for multiple images', () => {
    const dataUrl1 = 'data:image/png;base64,' + 'A'.repeat(100); // 75 bytes
    const dataUrl2 = 'data:image/jpeg;base64,' + 'B'.repeat(200); // 150 bytes
    expect(calculateBase64Size([dataUrl1, dataUrl2])).toBe(225);
  });

  it('handles data URLs without comma gracefully', () => {
    expect(calculateBase64Size(['invalid-data-url'])).toBe(0);
  });

  it('handles mixed valid and empty data URLs', () => {
    const validUrl = 'data:image/png;base64,' + 'A'.repeat(100);
    const emptyUrl = 'data:image/png;base64,';
    expect(calculateBase64Size([validUrl, emptyUrl])).toBe(75);
  });

  it('calculates realistic image size correctly', () => {
    // A 1MB base64 string (after the comma) decodes to ~750KB
    const oneMBBase64 = 'data:image/png;base64,' + 'A'.repeat(1024 * 1024);
    const result = calculateBase64Size([oneMBBase64]);
    // Should be approximately 786,432 bytes (1MB * 0.75)
    expect(result).toBe(Math.ceil(1024 * 1024 * 0.75));
  });

  it('exceeds 4.5MB threshold with large images', () => {
    // 6.1MB of base64 data should decode to ~4.575MB (> 4.5MB limit)
    const largBase64 = 'data:image/png;base64,' + 'A'.repeat(6.1 * 1024 * 1024);
    const result = calculateBase64Size([largBase64]);
    const fourPointFiveMB = 4.5 * 1024 * 1024;
    expect(result).toBeGreaterThan(fourPointFiveMB);
  });
});
