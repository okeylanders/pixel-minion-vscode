/**
 * ConversationThread - Chat-style display of conversation history
 *
 * Displays each turn as a prompt bubble followed by generated images.
 * Supports saving images and copying seeds from within the thread.
 */
import React from 'react';
import { ConversationTurn, GeneratedImage } from '@messages';
import { ImageCard } from './ImageCard';
import '../../styles/components/conversation-thread.css';

export interface ConversationThreadProps {
  turns: ConversationTurn[];
  onSaveImage: (image: GeneratedImage) => void;
  savingImageIds?: Set<string>;
  savedImageIds?: Set<string>;
}

/**
 * Format token usage for display
 */
function formatUsage(usage: ConversationTurn['usage']): string | null {
  if (!usage) return null;
  const tokens = usage.totalTokens.toLocaleString();
  if (usage.costUsd !== undefined) {
    const cost = usage.costUsd < 0.01
      ? `$${usage.costUsd.toFixed(4)}`
      : `$${usage.costUsd.toFixed(2)}`;
    return `${tokens} tokens · ${cost}`;
  }
  return `${tokens} tokens`;
}

export const ConversationThread: React.FC<ConversationThreadProps> = ({
  turns,
  onSaveImage,
  savingImageIds = new Set(),
  savedImageIds = new Set(),
}) => {
  if (turns.length === 0) {
    return null;
  }

  return (
    <div className="conversation-thread">
      {turns.map((turn) => (
        <div key={turn.id} className="conversation-turn">
          {/* User prompt bubble */}
          <div className="conversation-prompt">
            <div className="conversation-prompt-label">You</div>
            <div className="conversation-prompt-text">{turn.prompt}</div>
          </div>

          {/* Generated images */}
          <div className="conversation-images">
            {turn.images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                onSave={onSaveImage}
                saving={savingImageIds.has(image.id)}
                saved={savedImageIds.has(image.id)}
              />
            ))}
          </div>

          {/* Token usage */}
          {turn.usage && (
            <div className="conversation-turn-usage">
              {formatUsage(turn.usage)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
