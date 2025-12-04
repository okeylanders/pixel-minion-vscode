/**
 * Renders SVG code to PNG format using canvas.
 *
 * @param svgCode - The SVG code as a string
 * @param width - The width of the output PNG in pixels
 * @param height - The height of the output PNG in pixels
 * @returns Promise resolving to base64-encoded PNG data (without data URL prefix)
 * @throws Error if SVG is malformed or rendering fails
 */
export async function renderSvgToPng(
  svgCode: string,
  width: number,
  height: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create blob from SVG code
    const blob = new Blob([svgCode], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    // Set timeout for image loading (10 seconds)
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG rendering timed out after 10 seconds'));
    }, 10000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        // Create canvas and get context
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas 2D context');
        }

        // Draw SVG image to canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export canvas to PNG data URL
        const dataUrl = canvas.toDataURL('image/png');

        // Remove data URL prefix to get raw base64
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

        // Cleanup blob URL
        URL.revokeObjectURL(url);

        resolve(base64);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG for rendering - SVG may be malformed'));
    };

    // Start loading the SVG
    img.src = url;
  });
}
