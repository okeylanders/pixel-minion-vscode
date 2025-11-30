/**
 * OpenRouterAlert - Warning banner when API key is not configured
 *
 * Shows instructions on how to configure OpenRouter API key.
 * Design matches Prose Minion "Analysis Result" alert pattern.
 */
import React from 'react';

export interface OpenRouterAlertProps {
  /** Callback to open settings overlay */
  onOpenSettings: () => void;
}

export const OpenRouterAlert: React.FC<OpenRouterAlertProps> = ({
  onOpenSettings,
}) => {
  return (
    <div className="openrouter-alert">
      <div className="openrouter-alert-header">
        <span className="openrouter-alert-icon">⚠️</span>
        <span className="openrouter-alert-title">OpenRouter API key not configured</span>
      </div>
      <p className="openrouter-alert-description">
        To use AI-powered generation tools, you need to configure your OpenRouter API key:
      </p>
      <ol className="openrouter-alert-steps">
        <li>
          Get an API key from{' '}
          <a href="https://openrouter.ai/" target="_blank" rel="noopener noreferrer">
            https://openrouter.ai/
          </a>
        </li>
        <li>
          Click the{' '}
          <button
            type="button"
            className="openrouter-alert-link"
            onClick={onOpenSettings}
          >
            ⚙️ gear icon
          </button>
          {' '}at the top of the Pixel Minion view
        </li>
        <li>Enter your API key in the "OpenRouter API Key" field</li>
        <li>Click Save</li>
      </ol>
    </div>
  );
};
