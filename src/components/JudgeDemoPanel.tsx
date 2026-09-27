/**
 * Sanket — Judge Demonstration Panel (Phase 9)
 *
 * Provides a structured, interactive 6-step walkthrough for hackathon judges:
 *   Step 1 — Personal Baseline
 *   Step 2 — Normal Voice
 *   Step 3 — Transient Event
 *   Step 4 — Multi-Signal Distress
 *   Step 5 — Silent Alert
 *   Step 6 — Forensic Review
 */

import React from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  CheckCircle2,
  Circle,
  Play,
  Lightbulb,
  Radio,
  Eye,
  Sliders,
} from 'lucide-react';
import type { DemoControllerState, DemoStepDefinition } from '../demo/types';

interface JudgeDemoPanelProps {
  controllerState: DemoControllerState;
  steps: DemoStepDefinition[];
  onStartDemo: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onGoToStep: (index: number) => void;
  onResetDemo: () => void;
  isMonitoring: boolean;
  onStartMonitoring: () => void;
}

export const JudgeDemoPanel: React.FC<JudgeDemoPanelProps> = ({
  controllerState,
  steps,
  onStartDemo,
  onNextStep,
  onPrevStep,
  onGoToStep,
  onResetDemo,
  isMonitoring,
  onStartMonitoring,
}) => {
  const { isActive, stepIndex, step, isFirst, isLast } = controllerState;

  return (
    <div className="console-card judge-demo-panel" id="judge-demo-panel">
      {/* Top Banner Header */}
      <div className="demo-header">
        <div className="demo-title-group">
          <div className="demo-sparkle-icon">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="demo-title">SANKET DEMONSTRATION</h2>
            <span className="demo-subtitle">
              Interactive 6-Step Hackathon Judge Evaluation Sequence
            </span>
          </div>
        </div>

        <div className="demo-header-actions">
          {!isMonitoring && (
            <button
              type="button"
              className="demo-mic-prompt-btn"
              onClick={onStartMonitoring}
              title="Start audio monitoring engine"
            >
              <Radio size={13} />
              <span>ENABLE MONITORING FIRST</span>
            </button>
          )}

          {isActive ? (
            <button
              type="button"
              className="demo-reset-btn"
              onClick={onResetDemo}
              title="Reset demonstration tour"
            >
              <RotateCcw size={13} />
              <span>RESET DEMO</span>
            </button>
          ) : (
            <button
              type="button"
              className="demo-start-btn"
              onClick={onStartDemo}
            >
              <Play size={13} fill="currentColor" />
              <span>START GUIDED TOUR</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Flow Indicator (Steps 1–6) */}
      <nav className="demo-progress-flow" aria-label="Demonstration steps">
        {steps.map((s, idx) => {
          const isCurrent = isActive && stepIndex === idx;
          const isCompleted = isActive && stepIndex > idx;

          return (
            <button
              key={s.id}
              type="button"
              className={`demo-step-chip ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => onGoToStep(idx)}
              title={`Jump to ${s.title}`}
            >
              <span className="chip-indicator">
                {isCompleted ? (
                  <CheckCircle2 size={12} className="check-icon" />
                ) : isCurrent ? (
                  <span className="active-dot" />
                ) : (
                  <Circle size={10} className="idle-icon" />
                )}
              </span>
              <span className="chip-text">{s.shortTitle}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      {isActive && step ? (
        <div className="demo-active-body">
          {/* Step Header */}
          <div className="demo-step-header">
            <div className="demo-step-meta">
              <span className="demo-badge">{step.badge}</span>
              <h3 className="demo-step-title">{step.title}</h3>
            </div>
            <div className="demo-view-pill">
              <Eye size={12} />
              <span>Focus: {step.recommendedView}</span>
            </div>
          </div>

          {/* Narration & Explanation */}
          <div className="demo-content-grid">
            <div className="demo-narration-box">
              <div className="box-label">
                <span className="label-dot" />
                <span>EXPLANATION</span>
              </div>
              <p className="narration-text">{step.narration}</p>
            </div>

            <div className="demo-differentiator-box">
              <div className="box-label highlight">
                <Lightbulb size={13} />
                <span>JUDGE HIGHLIGHT</span>
              </div>
              <p className="differentiator-text">{step.keyDifferentiator}</p>
            </div>
          </div>

          {/* Expected Outcome Bar */}
          <div className="demo-outcome-bar">
            <Sliders size={13} />
            <span className="outcome-label">Observed System Outcome:</span>
            <span className="outcome-value">{step.expectedOutcome}</span>
          </div>

          {/* Stepper Navigation Actions */}
          <div className="demo-footer-controls">
            <button
              type="button"
              className="demo-nav-btn prev"
              onClick={onPrevStep}
              disabled={isFirst}
            >
              <ChevronLeft size={16} />
              <span>PREVIOUS</span>
            </button>

            <span className="demo-counter-text">
              STEP {stepIndex + 1} OF {steps.length}
            </span>

            {isLast ? (
              <button
                type="button"
                className="demo-nav-btn complete"
                onClick={onResetDemo}
              >
                <CheckCircle2 size={16} />
                <span>FINISH TOUR</span>
              </button>
            ) : (
              <button
                type="button"
                className="demo-nav-btn next"
                onClick={onNextStep}
              >
                <span>NEXT STEP</span>
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Idle Overview State */
        <div className="demo-idle-body">
          <div className="demo-idle-icon-wrap">
            <Sparkles size={24} />
          </div>
          <div className="demo-idle-copy">
            <h4>Ready for Judge Presentation</h4>
            <p>
              Click <strong>START GUIDED TOUR</strong> to sequence through Sanket's 6 core architectural pillars:
              Personal Baseline Calibration, Normal Voice Reference, Transient Spike Filtering,
              Multi-Signal Distress Persistence, Silent Local Dispatch, and Forensic Audit Review.
            </p>
          </div>
          <button
            type="button"
            className="demo-start-hero-btn"
            onClick={onStartDemo}
          >
            <Play size={14} fill="currentColor" />
            <span>START DEMONSTRATION</span>
          </button>
        </div>
      )}
    </div>
  );
};
