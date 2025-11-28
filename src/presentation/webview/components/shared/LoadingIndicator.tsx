/**
 * LoadingIndicator - Unified loading state display component
 *
 * Features:
 * - Spinner animation
 * - Optional progress bar
 * - Optional ticker message (scrolling text)
 * - Optional cancel button
 */
import React from 'react';

export interface LoadingProgress {
  current: number;
  total: number;
  label?: string;
}

export interface LoadingIndicatorProps {
  isLoading: boolean;
  statusMessage?: string;
  defaultMessage?: string;
  tickerMessage?: string;
  progress?: LoadingProgress;
  onCancel?: () => void;
  className?: string;
}

export function LoadingIndicator({
  isLoading,
  statusMessage,
  defaultMessage = 'Loading...',
  tickerMessage,
  progress,
  onCancel,
  className = '',
}: LoadingIndicatorProps): JSX.Element | null {
  if (!isLoading) {
    return null;
  }

  const displayMessage = statusMessage || defaultMessage;
  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : undefined;

  return (
    <div className={`loading-indicator ${className}`}>
      <div className="loading-header">
        <div className="loading-spinner-row">
          <div className="spinner" />
          <span className="loading-text">{displayMessage}</span>
          {onCancel && (
            <button
              className="loading-cancel-button"
              onClick={onCancel}
              aria-label="Cancel"
            >
              ✕
            </button>
          )}
        </div>

        {tickerMessage && (
          <div className="ticker-container">
            <span className={`guide-ticker ${!tickerMessage ? 'empty' : ''}`}>
              {tickerMessage}
            </span>
          </div>
        )}
      </div>

      {progress && (
        <div className="progress-section">
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progress.label && (
            <span className="progress-label">{progress.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
