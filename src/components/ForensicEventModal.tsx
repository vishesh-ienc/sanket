/**
 * Sanket — Forensic Event Modal (Phase 7)
 *
 * Detailed forensic inspection modal presenting complete event metadata,
 * signal breakdown, baseline deviations, and privacy guarantees.
 *
 * Prototype Invariant:
 * Clearly notes that this is a simulated local dispatch with zero external
 * contacts and zero raw audio storage.
 */

import React, { useEffect } from 'react';
import {
  ShieldAlert,
  X,
  Lock,
  Radio,
  Sparkles,
  Activity,
  CheckCircle2,
  Clock,
  KeyRound,
  Layers,
} from 'lucide-react';
import type { DistressIncident } from '../analysis/types';

interface ForensicEventModalProps {
  isOpen: boolean;
  incident: DistressIncident | null;
  onClose: () => void;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
}

export const ForensicEventModal: React.FC<ForensicEventModalProps> = ({
  isOpen,
  incident,
  onClose,
  onAcknowledge,
  onResolve,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !incident) return null;

  const isSimulated = incident.source === 'SIMULATION';
  const isoTime = new Date(incident.timestamp).toISOString();
  const localTime = new Date(incident.timestamp).toLocaleString();

  // Helper to format baseline deviation for a specific signal
  const getDeviationString = (signalName: string): string | null => {
    if (!incident.baselineAvailable || !incident.baselineDeviations) return null;
    const devs = incident.baselineDeviations;
    switch (signalName) {
      case 'pitch':
        return devs.pitch !== undefined ? `${devs.pitch.toFixed(1)}σ from personal baseline` : null;
      case 'rms':
        return devs.rms !== undefined ? `${devs.rms.toFixed(1)}σ from personal baseline` : null;
      case 'silence':
        return devs.silence !== undefined ? `${devs.silence.toFixed(1)}x normal pause threshold` : null;
      case 'spectral':
        return devs.spectral !== undefined ? `${devs.spectral.toFixed(1)}σ from personal baseline` : null;
      case 'zcr':
        return devs.zcr !== undefined ? `${devs.zcr.toFixed(1)}σ from personal baseline` : null;
      default:
        return null;
    }
  };

  return (
    <div
      className="modal-overlay"
      id="forensic-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forensic-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-container"
        id="forensic-event-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <header className="modal-header">
          <div className="modal-header-left">
            <div className="modal-header-icon pulse-soft">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="modal-header-title-row">
                <h2 className="modal-title" id="forensic-modal-title">
                  FORENSIC INCIDENT METADATA
                </h2>
                <span className={`status-tag status-${incident.status.toLowerCase()}`}>
                  {incident.status}
                </span>
              </div>
              <span className="modal-incident-id">Incident ID: {incident.id}</span>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            id="forensic-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </header>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Section 1: Event Summary Grid */}
          <section className="forensic-section">
            <h3 className="section-label">1. Event Summary</h3>
            <div className="forensic-summary-grid">
              <div className="summary-item">
                <span className="summary-item-label">Timestamp</span>
                <span className="summary-item-val" title={isoTime}>
                  <Clock size={12} /> {localTime}
                </span>
              </div>

              <div className="summary-item">
                <span className="summary-item-label">Source</span>
                <span
                  className={`summary-item-val ${
                    isSimulated ? 'source-simulated' : 'source-microphone'
                  }`}
                >
                  {isSimulated ? <Sparkles size={12} /> : <Radio size={12} />}
                  {isSimulated ? 'DEMO SIMULATION' : 'LIVE MICROPHONE'}
                </span>
              </div>

              <div className="summary-item">
                <span className="summary-item-label">Risk Classification</span>
                <span className="summary-item-val val-danger">{incident.riskLevel}</span>
              </div>

              <div className="summary-item">
                <span className="summary-item-label">Composite Risk Score</span>
                <span className="summary-item-val val-score">{incident.riskScore} / 100</span>
              </div>
            </div>
          </section>

          {/* Section 2: Why It Triggered (Contributing Signals Breakdown) */}
          <section className="forensic-section">
            <h3 className="section-label">2. Trigger Evidence & Contributing Signals</h3>
            <p className="section-hint">
              Explainable breakdown of corroborating acoustic channels contributing to this incident.
            </p>

            <div className="signals-table-wrap">
              <table className="signals-table">
                <thead>
                  <tr>
                    <th>Signal Channel</th>
                    <th>Score Added</th>
                    <th>Baseline Comparison</th>
                    <th>Heuristic Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {incident.contributingSignals.map((sig, idx) => {
                    const dev = getDeviationString(sig.signal);
                    return (
                      <tr key={`${sig.signal}-${idx}`}>
                        <td className="signal-cell-name">
                          <span className="signal-name-badge">{sig.signal}</span>
                        </td>
                        <td className="signal-cell-contribution">
                          +{sig.contribution.toFixed(0)} pts
                        </td>
                        <td className="signal-cell-deviation">
                          {dev ? (
                            <span className="dev-pill active-dev">{dev}</span>
                          ) : (
                            <span className="dev-pill proto-dev">Prototype heuristic reference</span>
                          )}
                        </td>
                        <td className="signal-cell-reason">{sig.reason}</td>
                      </tr>
                    );
                  })}
                  {incident.contributingSignals.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty-signals-cell">
                        No individual signals recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Confirmation & Multi-Signal Telemetry */}
          <section className="forensic-section">
            <h3 className="section-label">3. Multi-Signal Confirmation & Persistence</h3>
            <div className="confirmation-grid">
              <div className="conf-card">
                <span className="conf-label">Temporal Persistence</span>
                <strong className="conf-val">{incident.persistenceFrames} Frames</strong>
                <span className="conf-sub">Sustained abnormal window</span>
              </div>

              <div className="conf-card">
                <span className="conf-label">Corroborating Channels</span>
                <strong className="conf-val">{incident.confirmedSignals.length} Channels</strong>
                <span className="conf-sub">Co-occurring acoustic anomalies</span>
              </div>

              <div className="conf-card">
                <span className="conf-label">Covert Code-Word</span>
                <strong
                  className={`conf-val ${
                    incident.codeWordDetected ? 'code-word-active' : 'code-word-none'
                  }`}
                >
                  <KeyRound size={14} />
                  {incident.codeWordDetected ? 'DETECTED' : 'NONE DETECTED'}
                </strong>
                <span className="conf-sub">
                  {incident.codeWordDetected
                    ? 'Contextual phrase boost active'
                    : 'Acoustic-only trigger'}
                </span>
              </div>

              <div className="conf-card">
                <span className="conf-label">Personal Baseline</span>
                <strong className="conf-val">
                  <Layers size={14} />
                  {incident.baselineAvailable ? 'CALIBRATED' : 'DEFAULT PROTOTYPE'}
                </strong>
                <span className="conf-sub">
                  {incident.baselineAvailable ? 'Personalized thresholds' : 'Static references'}
                </span>
              </div>
            </div>

            {/* Phase 8 Temporal Stability & Correlation Telemetry */}
            {incident.temporalContext && (
              <div className="modal-temporal-box">
                <div className="modal-temporal-header">
                  <span className="temporal-box-label">Temporal Correlation Analysis</span>
                  <span className="temporal-box-type">{incident.temporalContext.eventType}</span>
                </div>
                <p className="modal-temporal-desc">
                  {incident.temporalContext.explanation}
                </p>
                <div className="modal-temporal-stats">
                  <span>Sustained Window: <strong>{incident.temporalContext.sustainedFrames} frames</strong></span>
                  <span>•</span>
                  <span>Cross-Signal Correlation: <strong>{Math.round(incident.temporalContext.multiSignalCorrelation * 100)}%</strong></span>
                  {incident.temporalContext.breathingPattern && (
                    <>
                      <span>•</span>
                      <span>Pause Regularity: <strong>{Math.round(incident.temporalContext.breathingPattern.regularityScore * 100)}%</strong></span>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Section 4: Feature Snapshot at Confirmation Moment */}
          {incident.featureSnapshot && (
            <section className="forensic-section">
              <h3 className="section-label">4. Acoustic Snapshot at Dispatch Moment</h3>
              <div className="snapshot-grid">
                <div className="snapshot-item">
                  <span className="snap-k">Pitch (F0)</span>
                  <span className="snap-v">
                    {incident.featureSnapshot.pitchHz !== null
                      ? `${incident.featureSnapshot.pitchHz.toFixed(1)} Hz`
                      : 'Unvoiced'}
                  </span>
                </div>
                <div className="snapshot-item">
                  <span className="snap-k">RMS Energy</span>
                  <span className="snap-v">{incident.featureSnapshot.rms.toFixed(4)}</span>
                </div>
                <div className="snapshot-item">
                  <span className="snap-k">Silence Duration</span>
                  <span className="snap-v">
                    {incident.featureSnapshot.silenceDurationSec.toFixed(2)}s
                  </span>
                </div>
                <div className="snapshot-item">
                  <span className="snap-k">Spectral Centroid</span>
                  <span className="snap-v">
                    {incident.featureSnapshot.spectralCentroid !== null
                      ? `${incident.featureSnapshot.spectralCentroid.toFixed(0)} Hz`
                      : 'N/A'}
                  </span>
                </div>
                <div className="snapshot-item">
                  <span className="snap-k">Zero-Crossing Rate</span>
                  <span className="snap-v">
                    {incident.featureSnapshot.zeroCrossingRate.toFixed(3)}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Section 5: Alert Status & Privacy Guarantees */}
          <section className="forensic-section modal-safety-box">
            <div className="safety-row">
              <div className="safety-bullet">
                <Activity size={16} />
                <div>
                  <strong>Silent Alert: SIMULATED LOCAL DISPATCH</strong>
                  <p>
                    Prototype demonstration workflow only. No telephone, SMS, police, or emergency
                    personnel were contacted.
                  </p>
                </div>
              </div>

              <div className="safety-bullet">
                <Lock size={16} />
                <div>
                  <strong>Privacy Guarantee: Zero Raw Audio Retention</strong>
                  <p>
                    Raw audio was not stored. Only derived event metadata, statistical scores, and
                    timestamps are retained locally on this device.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Modal Footer Controls */}
        <footer className="modal-footer">
          <div className="modal-footer-left">
            {incident.status === 'ACTIVE' && onAcknowledge && (
              <button
                type="button"
                className="modal-btn modal-btn-ack"
                id="modal-ack-btn"
                onClick={() => onAcknowledge(incident.id)}
              >
                <CheckCircle2 size={15} />
                <span>ACKNOWLEDGE EVENT</span>
              </button>
            )}

            {incident.status !== 'RESOLVED' && onResolve && (
              <button
                type="button"
                className="modal-btn modal-btn-resolve"
                id="modal-resolve-btn"
                onClick={() => onResolve(incident.id)}
              >
                <span>MARK RESOLVED</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="modal-btn modal-btn-close"
            id="modal-footer-close-btn"
            onClick={onClose}
          >
            CLOSE
          </button>
        </footer>
      </div>
    </div>
  );
};
