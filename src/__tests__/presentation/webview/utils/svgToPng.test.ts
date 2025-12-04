/**
 * svgToPng utility tests
 *
 * Tests the SVG-to-PNG rendering utility using mocked browser APIs
 * Sprint 6.6 - Presentation Layer Tests
 */

import { renderSvgToPng } from '@/presentation/webview/utils/svgToPng';

describe('renderSvgToPng', () => {
  let mockCreateObjectURL: jest.Mock;
  let mockRevokeObjectURL: jest.Mock;
  let mockToDataURL: jest.Mock;
  let mockDrawImage: jest.Mock;
  let mockGetContext: jest.Mock;
  let mockImage: {
    onload: (() => void) | null;
    onerror: (() => void) | null;
    src: string;
  };

  beforeEach(() => {
    // Mock URL methods
    mockCreateObjectURL = jest.fn(() => 'blob:test-url');
    mockRevokeObjectURL = jest.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    // Mock canvas methods
    mockToDataURL = jest.fn(() => 'data:image/png;base64,test123');
    mockDrawImage = jest.fn();
    mockGetContext = jest.fn(() => ({
      drawImage: mockDrawImage,
    }));

    // Mock HTMLCanvasElement
    HTMLCanvasElement.prototype.getContext = mockGetContext;
    HTMLCanvasElement.prototype.toDataURL = mockToDataURL;

    // Mock Image constructor
    mockImage = {
      onload: null,
      onerror: null,
      src: '',
    };

    global.Image = jest.fn(() => mockImage) as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render simple SVG to PNG base64', async () => {
    const svgCode = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';

    const promise = renderSvgToPng(svgCode, 100, 100);

    // Trigger image load
    if (mockImage.onload) {
      mockImage.onload();
    }

    const result = await promise;

    // Should create object URL from SVG blob
    expect(mockCreateObjectURL).toHaveBeenCalled();

    // Should create canvas with specified dimensions
    expect(mockGetContext).toHaveBeenCalledWith('2d');

    // Should draw image to canvas
    expect(mockDrawImage).toHaveBeenCalled();

    // Should convert to data URL
    expect(mockToDataURL).toHaveBeenCalledWith('image/png');

    // Should cleanup blob URL
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');

    // Should return base64 without data URL prefix
    expect(result).toBe('test123');
  });

  it('should handle specified dimensions', async () => {
    const svgCode = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';

    const promise = renderSvgToPng(svgCode, 1024, 768);

    // Trigger image load
    if (mockImage.onload) {
      mockImage.onload();
    }

    await promise;

    // Should draw with specified dimensions
    expect(mockDrawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      1024,
      768
    );
  });

  it('should reject on malformed SVG (Image onerror)', async () => {
    const malformedSvg = '<svg><invalid';

    const promise = renderSvgToPng(malformedSvg, 100, 100);

    // Trigger image error
    if (mockImage.onerror) {
      mockImage.onerror();
    }

    await expect(promise).rejects.toThrow('Failed to load SVG for rendering - SVG may be malformed');

    // Should cleanup blob URL even on error
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('should timeout after 10 seconds', async () => {
    jest.useFakeTimers();

    const svgCode = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';

    const promise = renderSvgToPng(svgCode, 100, 100);

    // Fast-forward time by 10 seconds
    jest.advanceTimersByTime(10000);

    await expect(promise).rejects.toThrow('SVG rendering timed out after 10 seconds');

    // Should cleanup blob URL on timeout
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');

    jest.useRealTimers();
  });

  it('should cleanup blob URL after success', async () => {
    const svgCode = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';

    const promise = renderSvgToPng(svgCode, 100, 100);

    if (mockImage.onload) {
      mockImage.onload();
    }

    await promise;

    // Should have called revokeObjectURL exactly once
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('should cleanup blob URL after error', async () => {
    const svgCode = '<svg><invalid';

    const promise = renderSvgToPng(svgCode, 100, 100);

    if (mockImage.onerror) {
      mockImage.onerror();
    }

    await expect(promise).rejects.toThrow();

    // Should have called revokeObjectURL exactly once
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });
});
