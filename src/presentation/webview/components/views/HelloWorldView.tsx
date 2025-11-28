/**
 * HelloWorldView - Main view demonstrating the Hello World pattern
 *
 * Features:
 * - Text input with markdown support
 * - Submit button to process text
 * - Rendered markdown output
 * - State persistence across webview reloads
 */
import React from 'react';
import { Textarea, Button, MarkdownRenderer } from '../common';
import { UseHelloWorldReturn } from '@hooks';

export interface HelloWorldViewProps {
  helloWorld: UseHelloWorldReturn;
}

export function HelloWorldView({ helloWorld }: HelloWorldViewProps): JSX.Element {
  const {
    text,
    renderedMarkdown,
    isLoading,
    setText,
    submitText,
    clearResult,
  } = helloWorld;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      submitText();
    }
  };

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h2 style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
          Hello World
        </h2>
        <p className="text-muted mb-md">
          Enter markdown text below and click "Render" to see it formatted.
          Press Ctrl+Enter to submit.
        </p>
      </div>

      <Textarea
        label="Enter Markdown"
        placeholder="# Hello World\n\nType your **markdown** here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={6}
      />

      <div className="flex gap-sm">
        <Button onClick={submitText} disabled={!text.trim() || isLoading}>
          {isLoading ? 'Rendering...' : 'Render Markdown'}
        </Button>
        {renderedMarkdown && (
          <Button variant="secondary" onClick={clearResult}>
            Clear
          </Button>
        )}
      </div>

      {renderedMarkdown && (
        <>
          <div className="divider" />
          <div>
            <h3 style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
              Output
            </h3>
            <MarkdownRenderer content={renderedMarkdown} />
          </div>
        </>
      )}
    </div>
  );
}
