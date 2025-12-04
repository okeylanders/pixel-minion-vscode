/**
 * ArchitectDashboard - Status display for SVG Architect pipeline
 *
 * Pattern: Static status boxes that update in place
 * Sprint 6.4 - SVG Tab Components
 */
import React, { useState } from 'react';
import { SVGArchitectStatusType } from '@messages';

export interface ArchitectDashboardProps {
  status: SVGArchitectStatusType;
  iteration: number;
  maxIterations: number;
  blueprint: string | null;
  confidenceScore: number | null;
}

export function ArchitectDashboard({
  status,
  iteration,
  maxIterations,
  blueprint,
  confidenceScore,
}: ArchitectDashboardProps): JSX.Element {
  const [blueprintExpanded, setBlueprintExpanded] = useState(false);

  const getAgentStatus = (
    agent: 'analysis' | 'render' | 'validation'
  ): 'idle' | 'active' | 'complete' => {
    if (status === 'idle' || status === 'error' || status === 'complete') {
      return status === 'complete' ? 'complete' : 'idle';
    }

    switch (agent) {
      case 'analysis':
        return status === 'analyzing' ? 'active' : iteration > 0 ? 'complete' : 'idle';
      case 'render':
        return status === 'rendering' ? 'active' : iteration > 0 ? 'complete' : 'idle';
      case 'validation':
        return status === 'validating' || status === 'refining' ? 'active' : iteration > 0 ? 'complete' : 'idle';
      default:
        return 'idle';
    }
  };

  const getStatusLabel = (status: SVGArchitectStatusType): string => {
    switch (status) {
      case 'idle':
        return 'Idle';
      case 'analyzing':
        return 'Analyzing prompt...';
      case 'rendering':
        return 'Rendering SVG...';
      case 'validating':
        return 'Validating output...';
      case 'refining':
        return 'Refining SVG...';
      case 'awaiting_user':
        return 'Awaiting user input';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="architect-dashboard">
      {/* Progress indicator */}
      <div className="dashboard-section">
        <h3 className="section-title">Pipeline Status</h3>
        <div className="status-summary">
          <span className={`status-badge status-${status}`}>
            {getStatusLabel(status)}
          </span>
          {iteration > 0 && (
            <span className="iteration-counter">
              Iteration {iteration} of {maxIterations}
            </span>
          )}
        </div>
      </div>

      {/* Agent status boxes */}
      <div className="dashboard-section">
        <h3 className="section-title">Agent Status</h3>
        <div className="agent-status-grid">
          <div className={`agent-status-box agent-${getAgentStatus('analysis')}`}>
            <div className="agent-name">Analysis Agent</div>
            <div className="agent-status">{getAgentStatus('analysis')}</div>
          </div>
          <div className={`agent-status-box agent-${getAgentStatus('render')}`}>
            <div className="agent-name">Render LLM</div>
            <div className="agent-status">{getAgentStatus('render')}</div>
          </div>
          <div className={`agent-status-box agent-${getAgentStatus('validation')}`}>
            <div className="agent-name">Validation Agent</div>
            <div className="agent-status">{getAgentStatus('validation')}</div>
          </div>
        </div>
      </div>

      {/* Confidence score */}
      {confidenceScore !== null && (
        <div className="dashboard-section">
          <h3 className="section-title">Validation Confidence</h3>
          <div className="confidence-display">
            <div className="confidence-bar-container">
              <div
                className="confidence-bar"
                style={{ width: `${confidenceScore}%` }}
              />
            </div>
            <span className="confidence-score">{confidenceScore.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Blueprint preview */}
      {blueprint && (
        <div className="dashboard-section">
          <h3
            className="section-title blueprint-toggle"
            onClick={() => setBlueprintExpanded(!blueprintExpanded)}
          >
            Blueprint {blueprintExpanded ? '▼' : '▶'}
          </h3>
          {blueprintExpanded && (
            <pre className="blueprint-preview">{blueprint}</pre>
          )}
        </div>
      )}
    </div>
  );
}
