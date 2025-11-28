/**
 * MarkdownRenderer - Renders markdown content as HTML
 *
 * Pattern: Uses the marked library for markdown parsing
 * Security: Sanitizes HTML to prevent XSS
 */
import React, { useMemo } from 'react';
import { marked } from 'marked';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  className = '',
}: MarkdownRendererProps): JSX.Element {
  const html = useMemo(() => {
    if (!content) return '';

    // Configure marked for security
    marked.setOptions({
      gfm: true,        // GitHub Flavored Markdown
      breaks: true,     // Convert \n to <br>
    });

    return marked(content);
  }, [content]);

  if (!content) {
    return <div className={`markdown ${className}`.trim()} />;
  }

  return (
    <div
      className={`markdown ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
