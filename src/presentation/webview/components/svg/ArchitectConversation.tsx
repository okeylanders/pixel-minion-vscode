/**
 * ArchitectConversation - Conversation display for SVG Architect pipeline
 *
 * Pattern: Scrolling list of conversation entries with user input
 * Sprint 6.4 - SVG Tab Components
 */
import React, { useEffect, useRef, useState } from 'react';
import { SvgArchitectConversationEntry } from '../../hooks/domain/useSvgArchitect';
import { SVGPreview } from './SVGPreview';

export interface ArchitectConversationProps {
  entries: SvgArchitectConversationEntry[];
  userNotes: string;
  onUserNotesChange: (notes: string) => void;
  onSubmitNotes: () => void;
  showUserInput: boolean;
}

/**
 * Individual conversation entry with expandable details
 */
interface ConversationEntryItemProps {
  entry: SvgArchitectConversationEntry;
  formatTimestamp: (timestamp: number) => string;
  getEntryIcon: (type: SvgArchitectConversationEntry['type']) => string;
  getEntryLabel: (type: SvgArchitectConversationEntry['type']) => string;
}

function ConversationEntryItem({
  entry,
  formatTimestamp,
  getEntryIcon,
  getEntryLabel,
}: ConversationEntryItemProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!(
    entry.description ||
    entry.blueprint ||
    entry.issues?.length ||
    entry.corrections?.length ||
    entry.svgCode ||
    entry.renderedPng
  );

  return (
    <div className={`conversation-entry entry-${entry.type}`}>
      <div className="entry-header">
        <span className="entry-icon">{getEntryIcon(entry.type)}</span>
        <span className="entry-label">{getEntryLabel(entry.type)}</span>
        <span className="entry-timestamp">{formatTimestamp(entry.timestamp)}</span>
        {hasDetails && (
          <button
            type="button"
            className="entry-expand-button"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
      </div>
      <div className="entry-message">{entry.message}</div>

      {entry.confidenceScore !== undefined && (
        <div className="entry-confidence">
          Confidence: {entry.confidenceScore.toFixed(0)}%
        </div>
      )}

      {/* Expandable details section */}
      {expanded && hasDetails && (
        <div className="entry-details">
          {/* Analysis description */}
          {entry.description && (
            <div className="detail-section">
              <div className="detail-label">Description</div>
              <div className="detail-content">{entry.description}</div>
            </div>
          )}

          {/* Blueprint JSON */}
          {entry.blueprint && (
            <div className="detail-section">
              <div className="detail-label">Blueprint</div>
              <pre className="detail-code">{entry.blueprint}</pre>
            </div>
          )}

          {/* Validation issues */}
          {entry.issues && entry.issues.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">Issues Found</div>
              <ul className="detail-list">
                {entry.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Corrections */}
          {entry.corrections && entry.corrections.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">Corrections</div>
              <ul className="detail-list">
                {entry.corrections.map((correction, i) => (
                  <li key={i}>{correction}</li>
                ))}
              </ul>
            </div>
          )}

          {/* SVG Preview */}
          {entry.svgCode && (
            <div className="detail-section">
              <div className="detail-label">Generated SVG</div>
              <div className="detail-preview">
                <SVGPreview svgCode={entry.svgCode} aspectRatio="1:1" />
              </div>
            </div>
          )}

          {/* Rendered PNG */}
          {entry.renderedPng && (
            <div className="detail-section">
              <div className="detail-label">Rendered Output</div>
              <div className="detail-preview">
                <img
                  src={entry.renderedPng.startsWith('data:')
                    ? entry.renderedPng
                    : `data:image/png;base64,${entry.renderedPng}`}
                  alt="Rendered SVG"
                  className="rendered-preview-img"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
          <ConversationEntryItem
            key={index}
            entry={entry}
            formatTimestamp={formatTimestamp}
            getEntryIcon={getEntryIcon}
            getEntryLabel={getEntryLabel}
          />
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
