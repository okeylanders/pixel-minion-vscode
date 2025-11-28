/**
 * Header - App header with title and actions
 *
 * Pattern: Layout component for consistent header styling
 */
import React from 'react';

export interface HeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps): JSX.Element {
  return (
    <header className="app-header">
      <h1 style={{ fontSize: 'var(--vscode-font-size)', fontWeight: 600, margin: 0 }}>
        {title}
      </h1>
      {children && <div className="flex gap-sm">{children}</div>}
    </header>
  );
}
