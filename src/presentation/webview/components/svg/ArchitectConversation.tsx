/**
 * ArchitectConversation - Conversation display for SVG Architect pipeline
 *
 * Pattern: Scrolling list of conversation entries with user input
 * Sprint 6.4 - SVG Tab Components
 */
import React, { useEffect, useRef } from 'react';
import { SvgArchitectConversationEntry } from '../../hooks/domain/useSvgArchitect';

export interface ArchitectConversationProps {
  entries: SvgArchitectConversationEntry[];
  userNotes: string;
  onUserNotesChange: (notes: string) => void;
  onSubmitNotes: () => void;
  showUserInput: boolean;
}

export function ArchitectConversation({
  entries,
  userNotes,
  onUserNotesChange,
  onSubmitNotes,
  showUserInput,
}: ArchitectConversationProps): JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries]);

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getEntryIcon = (type: SvgArchitectConversationEntry['type']): string => {
    switch (type) {
      case 'analysis':
        return '🔍';
      case 'render':
        return '🎨';
      case 'validation':
        return '✓';
      case 'user_notes':
        return '💬';
      case 'result':
        return '✨';
      default:
        return '•';
    }
  };

  const getEntryLabel = (type: SvgArchitectConversationEntry['type']): string => {
    switch (type) {
      case 'analysis':
        return 'Analysis Agent';
      case 'render':
        return 'Render LLM';
      case 'validation':
        return 'Validation Agent';
      case 'user_notes':
        return 'User Notes';
      case 'result':
        return 'Result';
      default:
        return 'Unknown';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmitNotes();
    }
  };

  return (
    <div className="architect-conversation">
      {/* Scrolling entries list */}
      <div className="conversation-entries" ref={scrollContainerRef}>
        {entries.length === 0 && (
          <div className="empty-state">
            No conversation entries yet. Start a generation to see the pipeline progress.
          </div>
        )}
        {entries.map((entry, index) => (
          <div key={index} className={`conversation-entry entry-${entry.type}`}>
            <div className="entry-header">
              <span className="entry-icon">{getEntryIcon(entry.type)}</span>
              <span className="entry-label">{getEntryLabel(entry.type)}</span>
              <span className="entry-timestamp">{formatTimestamp(entry.timestamp)}</span>
            </div>
            <div className="entry-message">{entry.message}</div>
            {entry.confidenceScore !== undefined && (
              <div className="entry-confidence">
                Confidence: {entry.confidenceScore.toFixed(0)}%
              </div>
            )}
          </div>
        ))}
      </div>

      {/* User input (only shown when status is 'awaiting_user') */}
      {showUserInput && (
        <div className="user-input-section">
          <div className="user-input-header">
            <span className="user-input-icon">💬</span>
            <span className="user-input-label">Provide feedback to guide refinement</span>
          </div>
          <textarea
            className="user-notes-input"
            value={userNotes}
            onChange={(e) => onUserNotesChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your feedback or suggestions to help refine the SVG..."
            rows={3}
          />
          <div className="user-input-actions">
            <button
              className="submit-notes-button"
              onClick={onSubmitNotes}
              disabled={!userNotes.trim()}
            >
              Submit Feedback
            </button>
            <span className="keyboard-hint">Cmd/Ctrl + Enter</span>
          </div>
        </div>
      )}
    </div>
  );
}
