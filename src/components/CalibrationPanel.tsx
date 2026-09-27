/**
 * Sanket — CalibrationPanel Component (Phase 6)
 *
 * UI panel for the Personal Voice Baseline & Calibration feature.
 *
 * States displayed:
 *   IDLE       → "Calibrate Your Voice" prompt + Start button
 *   CALIBRATING → Live progress ring, voiced frame count, elapsed time, Cancel button
 *   COMPLETE    → Profile summary card (mean pitch, energy, silence threshold,
 *                 calibration date) + Re-calibrate / Clear buttons
 *   ERROR       → Error explanation + Retry button
 *
 * Strict product positioning:
 *   This panel describes the baseline as an ACOUSTIC BEHAVIOR BASELINE —
 *   not a medical, physiological, or psychological baseline.
 */

import { UserCheck, Activity, RefreshCw, Trash2, AlertTriangle, Mic } from 'lucide-react';
import type { CalibrationState } from '../analysis/useCalibration';

interface CalibrationPanelProps {
  calibrationState: CalibrationState;
  isMonitoring: boolean;
  onStart: () => void;
  onCancel: () => void;
  onFinalize: () => void;
  onClear: () => void;
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${s}s`;
}

export function CalibrationPanel({
  calibrationState,
  isMonitoring,
  onStart,
  onCancel,
  onFinalize,
  onClear,
}: CalibrationPanelProps) {
  const { status, profile, progress, voicedFrames, minVoicedFrames, elapsedMs, errorMessage } =
    calibrationState;

  const progressPercent = Math.round(progress * 100);
  const isReady = voicedFrames >= minVoicedFrames;

  // SVG ring for progress
  const RING_R = 36;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const ringOffset = RING_CIRC * (1 - progress);

  return (
    <div className="console-card calibration-card" id="calibration-panel">
      {/* Header */}
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-icon-dot calibration-dot" />
          <h2 className="card-title">Personal Voice Baseline</h2>
        </div>
        <span className={`card-badge calibration-badge-${status.toLowerCase()}`}>
          {status === 'IDLE' && 'NOT CALIBRATED'}
          {status === 'CALIBRATING' && 'CALIBRATING…'}
          {status === 'COMPLETE' && 'BASELINE ACTIVE'}
          {status === 'ERROR' && 'CALIBRATION ERROR'}
        </span>
      </div>

      <p className="calibration-description">
        Sanket learns your normal voice acoustics (pitch, intensity, rhythm) so that deviations
        become more meaningful. This is an <strong>acoustic behavior baseline</strong> only —
        not a medical or psychological assessment.
      </p>

      {/* ── IDLE STATE ──────────────────────────────────────────────────── */}
      {status === 'IDLE' && (
        <div className="calibration-idle">
          <div className="calibration-idle-icon">
            <UserCheck size={40} strokeWidth={1.5} />
          </div>
          <p className="calibration-idle-hint">
            Speak naturally for ~30 seconds to build your personal voice baseline.
            Monitoring must be active first.
          </p>
          <button
            type="button"
            className="calibration-btn calibration-btn-start"
            id="calibrate-start-btn"
            disabled={!isMonitoring}
            onClick={onStart}
          >
            <Mic size={15} />
            <span>{isMonitoring ? 'Start Calibration' : 'Start Monitoring First'}</span>
          </button>
        </div>
      )}

      {/* ── CALIBRATING STATE ────────────────────────────────────────────── */}
      {status === 'CALIBRATING' && (
        <div className="calibration-active">
          {/* Progress Ring */}
          <div className="calibration-ring-wrap">
            <svg className="calibration-ring-svg" viewBox="0 0 88 88" width="88" height="88">
              <circle
                cx="44"
                cy="44"
                r={RING_R}
                fill="none"
                stroke="var(--surface-2)"
                strokeWidth="6"
              />
              <circle
                cx="44"
                cy="44"
                r={RING_R}
                fill="none"
                stroke="var(--accent-teal)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={ringOffset}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.4s ease' }}
              />
              <text x="44" y="49" textAnchor="middle" className="calibration-ring-label">
                {progressPercent}%
              </text>
            </svg>
          </div>

          <div className="calibration-stats">
            <div className="calibration-stat">
              <span className="calibration-stat-label">Voiced Frames</span>
              <span className="calibration-stat-value">{voicedFrames} / {minVoicedFrames}</span>
            </div>
            <div className="calibration-stat">
              <span className="calibration-stat-label">Elapsed</span>
              <span className="calibration-stat-value">
                {elapsedMs !== null ? formatElapsed(elapsedMs) : '—'}
              </span>
            </div>
          </div>

          <p className="calibration-speaking-hint">
            <Activity size={13} />
            Speak naturally — count aloud, describe your day, read text aloud…
          </p>

          <div className="calibration-actions">
            {isReady && (
              <button
                type="button"
                className="calibration-btn calibration-btn-finalize"
                id="calibrate-finalize-btn"
                onClick={onFinalize}
              >
                <UserCheck size={14} />
                <span>Save Baseline Now</span>
              </button>
            )}
            <button
              type="button"
              className="calibration-btn calibration-btn-cancel"
              id="calibrate-cancel-btn"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── COMPLETE STATE ───────────────────────────────────────────────── */}
      {status === 'COMPLETE' && profile && (
        <div className="calibration-complete">
          <div className="calibration-profile-grid">
            <div className="calib-stat-card">
              <span className="calib-stat-label">Baseline Pitch</span>
              <span className="calib-stat-value">{profile.pitchMean.toFixed(1)} Hz</span>
              <span className="calib-stat-sub">±{profile.pitchStdDev.toFixed(1)} Hz</span>
            </div>
            <div className="calib-stat-card">
              <span className="calib-stat-label">Voice Intensity</span>
              <span className="calib-stat-value">{(profile.energyMean * 100).toFixed(2)}%</span>
              <span className="calib-stat-sub">±{(profile.energyStdDev * 100).toFixed(2)}%</span>
            </div>
            <div className="calib-stat-card">
              <span className="calib-stat-label">Normal Silence</span>
              <span className="calib-stat-value">{profile.normalSilenceThresholdSec.toFixed(1)} s</span>
              <span className="calib-stat-sub">personal onset</span>
            </div>
            <div className="calib-stat-card">
              <span className="calib-stat-label">Calibrated</span>
              <span className="calib-stat-value calib-stat-date">{formatTimestamp(profile.calibratedAt)}</span>
              <span className="calib-stat-sub">{profile.frameCount} voiced frames</span>
            </div>
          </div>

          <p className="calibration-active-note">
            Risk engine references are now personalized to your voice. Deviation from these values
            contributes to the distress-risk score.
          </p>

          <div className="calibration-actions">
            <button
              type="button"
              className="calibration-btn calibration-btn-recal"
              id="calibrate-recalibrate-btn"
              disabled={!isMonitoring}
              onClick={onStart}
            >
              <RefreshCw size={14} />
              <span>Re-Calibrate</span>
            </button>
            <button
              type="button"
              className="calibration-btn calibration-btn-clear"
              id="calibrate-clear-btn"
              onClick={onClear}
            >
              <Trash2 size={14} />
              <span>Clear Baseline</span>
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR STATE ──────────────────────────────────────────────────── */}
      {status === 'ERROR' && (
        <div className="calibration-error">
          <AlertTriangle size={28} className="calibration-error-icon" />
          <p className="calibration-error-msg">{errorMessage ?? 'An unknown error occurred.'}</p>
          <button
            type="button"
            className="calibration-btn calibration-btn-start"
            id="calibrate-retry-btn"
            disabled={!isMonitoring}
            onClick={onStart}
          >
            <RefreshCw size={14} />
            <span>Retry Calibration</span>
          </button>
        </div>
      )}
    </div>
  );
}
