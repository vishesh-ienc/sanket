/**
 * Sanket — Temporal Context & Stability Card (Phase 8)
 *
 * Displays real-time temporal stability, transient spike detection,
 * cross-signal correlation, and voice-derived pause regularity.
 *
 * Prototype Invariant:
 * Voice-derived pause regularity is a prosodic proxy, NOT medical respiratory sensing.
 */

import React from 'react';
import {
  Activity,
  Layers,
  AlertCircle,
  CheckCircle2,
  Wind,
  ShieldCheck,
} from 'lucide-react';
import type { TemporalContext, TemporalEventType } from '../analysis/types';

interface TemporalContextCardProps {
  temporalContext: TemporalContext | null;
  isMonitoring: boolean;
}

export const TemporalContextCard: React.FC<TemporalContextCardProps> = ({
  temporalContext,
  isMonitoring,
}) => {
  const eventType: TemporalEventType = temporalContext?.eventType ?? 'NONE';
  const isTransient = temporalContext?.isTransient ?? false;
  const isSustained = temporalContext?.isSustained ?? false;
  const isMultiSignal = temporalContext?.isMultiSignal ?? false;
  const sustainedFrames = temporalContext?.sustainedFrames ?? 0;
  const transientFrames = temporalContext?.transientFrames ?? 0;
  const breathing = temporalContext?.breathingPattern;
  const explanation =
    temporalContext?.explanation ??
    (isMonitoring
      ? 'Acoustic patterns stable within normal baseline range.'
      : 'Monitoring inactive — start audio access to evaluate temporal stability.');

  // Status badge styling and label
  const getBadgeDetails = () => {
    switch (eventType) {
      case 'MULTI_SIGNAL_CORRELATION':
        return {
          label: 'MULTI-SIGNAL CORRELATED',
          className: 't-badge-multisignal',
          icon: Layers,
        };
      case 'SUSTAINED_ANOMALY':
        return {
          label: 'SUSTAINED ANOMALY',
          className: 't-badge-sustained',
          icon: Activity,
        };
      case 'TRANSIENT_SPIKE':
        return {
          label: 'TRANSIENT SPIKE (SUPPRESSED)',
          className: 't-badge-transient',
          icon: AlertCircle,
        };
      case 'BREATHING_PATTERN_ANOMALY':
        return {
          label: 'PAUSE PATTERN IRREGULAR',
          className: 't-badge-breathing',
          icon: Wind,
        };
      default:
        return {
          label: 'TEMPORALLY STABLE',
          className: 't-badge-stable',
          icon: CheckCircle2,
        };
    }
  };

  const badge = getBadgeDetails();
  const BadgeIcon = badge.icon;

  return (
    <div className="console-card temporal-context-card" id="temporal-context-panel">
      {/* Header */}
      <div className="card-header">
        <div className="card-title-group">
          <Activity size={16} className="card-icon" />
          <h2 className="card-title">Temporal Stability & Correlation</h2>
          <span className="card-badge">Phase 8 False-Positive Filter</span>
        </div>

        <div className={`temporal-status-badge ${badge.className}`}>
          <BadgeIcon size={12} />
          <span>{badge.label}</span>
        </div>
      </div>

      <p className="temporal-desc">
        Evaluates short-term temporal stability across a rolling 30-frame window to suppress
        transient spikes (coughs, laughter, exclamations) while verifying multi-signal distress.
      </p>

      {/* 4-Stat Grid */}
      <div className="temporal-grid">
        <div className={`t-metric-card ${isSustained ? 'active-metric' : ''}`}>
          <span className="t-metric-label">Sustained Frames</span>
          <strong className="t-metric-val">{sustainedFrames} Frames</strong>
          <span className="t-metric-sub">
            {isSustained ? 'Persistent deviation active' : 'Below 3-frame threshold'}
          </span>
        </div>

        <div className={`t-metric-card ${isTransient ? 'warning-metric' : ''}`}>
          <span className="t-metric-label">Transient Burst</span>
          <strong className="t-metric-val">{transientFrames} Frames</strong>
          <span className="t-metric-sub">
            {isTransient ? 'Short spike (Alert suppressed)' : 'No isolated spike'}
          </span>
        </div>

        <div className={`t-metric-card ${isMultiSignal ? 'active-metric' : ''}`}>
          <span className="t-metric-label">Cross-Signal Status</span>
          <strong className="t-metric-val">
            {isMultiSignal ? 'MULTI-CHANNEL' : 'SINGLE / NONE'}
          </strong>
          <span className="t-metric-sub">
            {Math.round((temporalContext?.multiSignalCorrelation ?? 0) * 100)}% Co-occurrence
          </span>
        </div>

        <div className={`t-metric-card ${breathing?.isIrregular ? 'warning-metric' : ''}`}>
          <span className="t-metric-label">Pause / Speech Prosody</span>
          <strong className="t-metric-val">
            {breathing?.isIrregular ? 'IRREGULAR' : 'RHYTHMIC'}
          </strong>
          <span className="t-metric-sub">
            {breathing ? `${Math.round(breathing.regularityScore * 100)}% Regularity` : 'Calibrating'}
          </span>
        </div>
      </div>

      {/* Explainability Bar */}
      <div className="temporal-explain-banner">
        <div className="explain-left">
          <ShieldCheck size={15} className="explain-icon" />
          <span className="explain-text">{explanation}</span>
        </div>
        <span className="explain-note">Voice-derived prosody proxy • Non-medical</span>
      </div>
    </div>
  );
};
