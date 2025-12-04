/**
 * SVG Architect Components tests
 *
 * Basic render tests for SVG Architect UI components
 * Sprint 6.6 - Presentation Layer Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToggleSwitch } from '@/presentation/webview/components/common/ToggleSwitch';
import { OutputSubTabs } from '@/presentation/webview/components/svg/OutputSubTabs';
import { ArchitectDashboard } from '@/presentation/webview/components/svg/ArchitectDashboard';
import { ArchitectConversation } from '@/presentation/webview/components/svg/ArchitectConversation';
import { SVGArchitectStatusType } from '@messages';
import type { SvgArchitectConversationEntry } from '@/presentation/webview/hooks/domain/useSvgArchitect';

describe('ToggleSwitch', () => {
  it('should render with label', () => {
    const onChange = jest.fn();
    render(<ToggleSwitch checked={false} onChange={onChange} label="Enable Feature" />);

    expect(screen.getByText('Enable Feature')).toBeInTheDocument();
  });

  it('should call onChange when clicked', () => {
    const onChange = jest.fn();
    render(<ToggleSwitch checked={false} onChange={onChange} label="Test" />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('should toggle from checked to unchecked', () => {
    const onChange = jest.fn();
    render(<ToggleSwitch checked={true} onChange={onChange} label="Test" />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('should not call onChange when disabled', () => {
    const onChange = jest.fn();
    render(<ToggleSwitch checked={false} onChange={onChange} disabled={true} />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('OutputSubTabs', () => {
  it('should render all three tabs', () => {
    const onSubTabChange = jest.fn();
    render(
      <OutputSubTabs
        activeSubTab="svg"
        onSubTabChange={onSubTabChange}
        architectEnabled={true}
      />
    );

    expect(screen.getByText('SVG')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Conversation')).toBeInTheDocument();
  });

  it('should disable dashboard when architectEnabled is false', () => {
    const onSubTabChange = jest.fn();
    render(
      <OutputSubTabs
        activeSubTab="svg"
        onSubTabChange={onSubTabChange}
        architectEnabled={false}
      />
    );

    const dashboardTab = screen.getByText('Dashboard').closest('button');
    expect(dashboardTab).toBeDisabled();
  });

  it('should disable conversation when architectEnabled is false', () => {
    const onSubTabChange = jest.fn();
    render(
      <OutputSubTabs
        activeSubTab="svg"
        onSubTabChange={onSubTabChange}
        architectEnabled={false}
      />
    );

    const conversationTab = screen.getByText('Conversation').closest('button');
    expect(conversationTab).toBeDisabled();
  });

  it('should call onSubTabChange when tab is clicked', () => {
    const onSubTabChange = jest.fn();
    render(
      <OutputSubTabs
        activeSubTab="svg"
        onSubTabChange={onSubTabChange}
        architectEnabled={true}
      />
    );

    const dashboardTab = screen.getByText('Dashboard');
    fireEvent.click(dashboardTab);

    expect(onSubTabChange).toHaveBeenCalledWith('dashboard');
  });

  it('should mark active tab with aria-selected', () => {
    const onSubTabChange = jest.fn();
    render(
      <OutputSubTabs
        activeSubTab="dashboard"
        onSubTabChange={onSubTabChange}
        architectEnabled={true}
      />
    );

    const svgTab = screen.getByText('SVG').closest('button');
    const dashboardTab = screen.getByText('Dashboard').closest('button');

    expect(svgTab).toHaveAttribute('aria-selected', 'false');
    expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
  });
});

describe('ArchitectDashboard', () => {
  const defaultProps = {
    status: 'idle' as SVGArchitectStatusType,
    iteration: 0,
    maxIterations: 3,
    blueprint: null,
    confidenceScore: null,
  };

  it('should render status boxes', () => {
    render(<ArchitectDashboard {...defaultProps} />);

    expect(screen.getByText('Pipeline Status')).toBeInTheDocument();
    expect(screen.getByText('Agent Status')).toBeInTheDocument();
    expect(screen.getByText('Analysis Agent')).toBeInTheDocument();
    expect(screen.getByText('Render LLM')).toBeInTheDocument();
    expect(screen.getByText('Validation Agent')).toBeInTheDocument();
  });

  it('should show idle status initially', () => {
    render(<ArchitectDashboard {...defaultProps} />);

    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('should show analyzing status', () => {
    render(<ArchitectDashboard {...defaultProps} status="analyzing" />);

    expect(screen.getByText('Analyzing prompt...')).toBeInTheDocument();
  });

  it('should show iteration counter when iteration > 0', () => {
    render(<ArchitectDashboard {...defaultProps} status="rendering" iteration={2} />);

    expect(screen.getByText('Iteration 2 of 3')).toBeInTheDocument();
  });

  it('should show confidence score when provided', () => {
    render(<ArchitectDashboard {...defaultProps} confidenceScore={85} />);

    expect(screen.getByText('Validation Confidence')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('should show blueprint when provided', () => {
    render(
      <ArchitectDashboard
        {...defaultProps}
        blueprint="Create a blue circle with red border"
      />
    );

    expect(screen.getByText(/Blueprint/)).toBeInTheDocument();
  });

  it('should toggle blueprint expansion', () => {
    render(
      <ArchitectDashboard
        {...defaultProps}
        blueprint="Test blueprint content"
      />
    );

    const blueprintToggle = screen.getByText(/Blueprint/);

    // Initially collapsed
    expect(screen.queryByText('Test blueprint content')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(blueprintToggle);
    expect(screen.getByText('Test blueprint content')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(blueprintToggle);
    expect(screen.queryByText('Test blueprint content')).not.toBeInTheDocument();
  });
});

describe('ArchitectConversation', () => {
  const defaultProps = {
    entries: [] as SvgArchitectConversationEntry[],
    userNotes: '',
    onUserNotesChange: jest.fn(),
    onSubmitNotes: jest.fn(),
    showUserInput: false,
  };

  it('should render empty state when no entries', () => {
    render(<ArchitectConversation {...defaultProps} />);

    expect(
      screen.getByText(/No conversation entries yet/)
    ).toBeInTheDocument();
  });

  it('should render conversation entries', () => {
    const entries: SvgArchitectConversationEntry[] = [
      {
        timestamp: Date.now(),
        type: 'analysis',
        message: 'Analyzing prompt...',
      },
      {
        timestamp: Date.now(),
        type: 'render',
        message: 'Rendering SVG...',
      },
    ];

    render(<ArchitectConversation {...defaultProps} entries={entries} />);

    expect(screen.getByText('Analyzing prompt...')).toBeInTheDocument();
    expect(screen.getByText('Rendering SVG...')).toBeInTheDocument();
  });

  it('should show user input when showUserInput is true', () => {
    render(<ArchitectConversation {...defaultProps} showUserInput={true} />);

    expect(
      screen.getByPlaceholderText(/Enter your feedback/)
    ).toBeInTheDocument();
    expect(screen.getByText('Submit Feedback')).toBeInTheDocument();
  });

  it('should not show user input when showUserInput is false', () => {
    render(<ArchitectConversation {...defaultProps} showUserInput={false} />);

    expect(
      screen.queryByPlaceholderText(/Enter your feedback/)
    ).not.toBeInTheDocument();
  });

  it('should call onUserNotesChange when textarea changes', () => {
    const onUserNotesChange = jest.fn();
    render(
      <ArchitectConversation
        {...defaultProps}
        showUserInput={true}
        onUserNotesChange={onUserNotesChange}
      />
    );

    const textarea = screen.getByPlaceholderText(/Enter your feedback/);
    fireEvent.change(textarea, { target: { value: 'Make it darker' } });

    expect(onUserNotesChange).toHaveBeenCalledWith('Make it darker');
  });

  it('should call onSubmitNotes when button clicked', () => {
    const onSubmitNotes = jest.fn();
    render(
      <ArchitectConversation
        {...defaultProps}
        showUserInput={true}
        userNotes="Test feedback"
        onSubmitNotes={onSubmitNotes}
      />
    );

    const submitButton = screen.getByText('Submit Feedback');
    fireEvent.click(submitButton);

    expect(onSubmitNotes).toHaveBeenCalled();
  });

  it('should disable submit button when userNotes is empty', () => {
    render(
      <ArchitectConversation
        {...defaultProps}
        showUserInput={true}
        userNotes=""
      />
    );

    const submitButton = screen.getByText('Submit Feedback');
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when userNotes has content', () => {
    render(
      <ArchitectConversation
        {...defaultProps}
        showUserInput={true}
        userNotes="Test feedback"
      />
    );

    const submitButton = screen.getByText('Submit Feedback');
    expect(submitButton).not.toBeDisabled();
  });

  it('should show confidence score in entries', () => {
    const entries: SvgArchitectConversationEntry[] = [
      {
        timestamp: Date.now(),
        type: 'validation',
        message: 'Validation complete',
        confidenceScore: 92,
      },
    ];

    render(<ArchitectConversation {...defaultProps} entries={entries} />);

    expect(screen.getByText('Confidence: 92%')).toBeInTheDocument();
  });
});
