/**
 * ViewContainer - Container for tab content
 *
 * Pattern: Wrapper component with consistent styling
 */
import React from 'react';

export interface ViewContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function ViewContainer({
  children,
  className = ''
}: ViewContainerProps): JSX.Element {
  return (
    <div className={`tab-content ${className}`.trim()}>
      {children}
    </div>
  );
}
