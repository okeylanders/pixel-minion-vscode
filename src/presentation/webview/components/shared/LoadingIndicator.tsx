/**
 * LoadingIndicator - Unified loading state display component
 *
 * Features:
 * - Spinner animation
 * - Loading message
 * - Animated loading gif (vertically stacked); a still image when the user
 *   prefers reduced motion
 * - Optional progress bar
 * - Optional ticker message (scrolling text)
 * - Optional cancel button
 */
import React from 'react';
import { getWebviewGlobals } from '../../webviewGlobals';
import { useReducedMotion } from '../../hooks/useReducedMotion';

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
  // Before the early return: hooks run on every render.
  const reducedMotion = useReducedMotion();

  if (!isLoading) {
    return null;
  }

  const displayMessage = statusMessage || defaultMessage;
  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : undefined;

  // Get loading animation URI from global config
  const { loadingAnimationUri, loadingStillUri } = getWebviewGlobals();
  const loadingImageUri = reducedMotion ? loadingStillUri : loadingAnimationUri;

  return (
    <div className={`loading-indicator ${className}`} role="status">
      {/* Vertically stacked: Spinner + Message + Animation */}
      <div className="loading-stack">
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

        {/* Animated loading gif (still image under reduced motion) */}
        {loadingImageUri && (
          <img
            src={loadingImageUri}
            alt=""
            className={`loading-animation${reducedMotion ? ' loading-still' : ''}`}
          />
        )}

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
