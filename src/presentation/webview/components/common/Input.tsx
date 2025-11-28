/**
 * Input - VSCode-styled input component
 *
 * Pattern: Reusable UI component with VSCode theme integration
 */
import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

export function Input({
  label,
  description,
  className = '',
  id,
  ...props
}: InputProps): JSX.Element {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  if (label) {
    return (
      <div className="input-group">
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
        <input
          id={inputId}
          className={`input ${className}`.trim()}
          {...props}
        />
        {description && (
          <span className="input-description">{description}</span>
        )}
      </div>
    );
  }

  return (
    <input
      id={inputId}
      className={`input ${className}`.trim()}
      {...props}
    />
  );
}
