/**
 * Tab2View - Placeholder for second tab
 *
 * This is an empty placeholder tab. Replace with your domain-specific view.
 */
import React from 'react';

export function Tab2View(): JSX.Element {
  return (
    <div className="flex flex-col gap-md">
      <div>
        <h2 style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
          Tab 2
        </h2>
        <p className="text-muted mb-md">
          This is a placeholder tab. Replace this component with your own domain-specific view.
        </p>
      </div>

      <div className="card">
        <p className="text-muted">
          Your content goes here.
        </p>
      </div>
    </div>
  );
}
