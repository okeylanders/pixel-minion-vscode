/**
 * Textarea - VSCode-styled textarea component
 *
 * Pattern: Reusable UI component with VSCode theme integration
 */
import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
}

export function Textarea({
  label,
  description,
  className = '',
  id,
  ...props
}: TextareaProps): JSX.Element {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  if (label) {
    return (
      <div className="input-group">
        <label htmlFor={textareaId} className="input-label">
          {label}
        </label>
        <textarea
          id={textareaId}
          className={`textarea ${className}`.trim()}
          {...props}
        />
        {description && (
          <span className="input-description">{description}</span>
        )}
      </div>
    );
  }

  return (
    <textarea
      id={textareaId}
      className={`textarea ${className}`.trim()}
      {...props}
    />
  );
}
