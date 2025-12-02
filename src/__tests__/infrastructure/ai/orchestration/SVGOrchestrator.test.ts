import { SVGOrchestrator } from '@ai';
import { LoggingService } from '@logging';

describe('SVGOrchestrator', () => {
  let orchestrator: SVGOrchestrator;
  let mockLogger: jest.Mocked<LoggingService>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    orchestrator = new SVGOrchestrator(mockLogger);
  });

  describe('extractSVG', () => {
    // Access private method for testing
    const callExtractSVG = (content: string) => {
      return (orchestrator as any).extractSVG(content);
    };

    describe('valid SVG extraction', () => {
      it('should extract valid SVG from markdown code block', () => {
        const content = '```svg\n<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>\n```';
        const result = callExtractSVG(content);
        expect(result).toBe('<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>');
      });

      it('should extract valid SVG from xml code block', () => {
        const content = '```xml\n<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80"/></svg>\n```';
        const result = callExtractSVG(content);
        expect(result).toBe('<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80"/></svg>');
      });

      it('should extract valid SVG from code block without language tag', () => {
        const content = '```\n<svg><path d="M10 10 L90 90"/></svg>\n```';
        const result = callExtractSVG(content);
        expect(result).toBe('<svg><path d="M10 10 L90 90"/></svg>');
      });

      it('should extract valid SVG without markdown (raw SVG)', () => {
        const content = '<svg width="200" height="200"><ellipse cx="100" cy="100" rx="80" ry="60"/></svg>';
        const result = callExtractSVG(content);
        expect(result).toBe(content);
      });

      it('should extract SVG with attributes and nested elements', () => {
        const content = `\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <linearGradient id="grad1">
      <stop offset="0%" stop-color="rgb(255,255,0)" />
      <stop offset="100%" stop-color="rgb(255,0,0)" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="500" height="500" fill="url(#grad1)" />
  <circle cx="250" cy="250" r="100" fill="white" />
</svg>
\`\`\``;
        const result = callExtractSVG(content);
        expect(result).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
        expect(result).toContain('</svg>');
        expect(result).toContain('<linearGradient');
        expect(result).toContain('<circle');
      });

      it('should extract SVG with whitespace and newlines', () => {
        const content = `\`\`\`svg

<svg width="100" height="100">
  <circle cx="50" cy="50" r="40"/>
</svg>

\`\`\``;
        const result = callExtractSVG(content);
        expect(result).toContain('<svg width="100" height="100">');
        expect(result).toContain('</svg>');
      });
    });

    describe('invalid content - should throw errors', () => {
      it('should throw error when code block has no SVG tags', () => {
        const content = '```svg\nThis is not SVG code\n```';
        expect(() => callExtractSVG(content)).toThrow('No valid SVG code found in response');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'SVG extraction failed - no valid SVG tags found in response',
          expect.objectContaining({
            contentLength: expect.any(Number),
            contentPreview: expect.any(String)
          })
        );
      });

      it('should throw error when response is plain text with no SVG', () => {
        const content = 'I cannot generate SVG for that request. Please try a different prompt.';
        expect(() => callExtractSVG(content)).toThrow('No valid SVG code found in response');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'SVG extraction failed - no valid SVG tags found in response',
          expect.objectContaining({
            contentLength: content.length,
            contentPreview: content
          })
        );
      });

      it('should throw error when response is empty', () => {
        const content = '';
        expect(() => callExtractSVG(content)).toThrow('No valid SVG code found in response');
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should throw error when code block contains HTML but not SVG', () => {
        const content = '```xml\n<div><p>This is HTML, not SVG</p></div>\n```';
        expect(() => callExtractSVG(content)).toThrow('No valid SVG code found in response');
      });

      it('should throw error when SVG tag is incomplete', () => {
        const content = '<svg width="100" height="100"><circle cx="50" cy="50" r="40"/>'; // Missing </svg>
        expect(() => callExtractSVG(content)).toThrow('No valid SVG code found in response');
      });

      it('should log content preview when extraction fails', () => {
        const longContent = 'A'.repeat(300);
        expect(() => callExtractSVG(longContent)).toThrow();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'SVG extraction failed - no valid SVG tags found in response',
          expect.objectContaining({
            contentLength: 300,
            contentPreview: expect.stringMatching(/^A{200}\.\.\.$/)
          })
        );
      });

      it('should provide full content preview when content is short', () => {
        const shortContent = 'Short error message';
        expect(() => callExtractSVG(shortContent)).toThrow();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'SVG extraction failed - no valid SVG tags found in response',
          expect.objectContaining({
            contentLength: shortContent.length,
            contentPreview: shortContent
          })
        );
      });
    });

    describe('edge cases', () => {
      it('should handle SVG with case variations', () => {
        const content = '<SVG width="100" height="100"><CIRCLE cx="50" cy="50" r="40"/></SVG>';
        const result = callExtractSVG(content);
        expect(result).toBe(content);
      });

      it('should handle SVG with self-closing tag', () => {
        const content = '<svg width="100" height="100"/>';
        // This is technically invalid SVG (no closing tag), should throw
        expect(() => callExtractSVG(content)).toThrow('No valid SVG code found in response');
      });

      it('should extract first SVG when multiple present', () => {
        const content = '<svg id="first"><circle r="10"/></svg><svg id="second"><rect/></svg>';
        const result = callExtractSVG(content);
        expect(result).toContain('id="first"');
        expect(result).toContain('</svg>');
        // The regex should capture from first <svg to last </svg>, getting both
        expect(result).toContain('id="second"');
      });
    });
  });
});
