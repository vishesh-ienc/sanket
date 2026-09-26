/**
 * Sanket Basic Audio Activity & RMS Level Meter
 * Displays real-time audio presence and RMS amplitude.
 */

import type { AudioActivityState } from '../audio/types';

interface AudioActivityMeterProps {
  activity: AudioActivityState;
  isActive: boolean;
}

export function AudioActivityMeter({ activity, isActive }: AudioActivityMeterProps) {
  const { rmsEnergy, isActive: isSpeechActive, threshold } = activity;

  // Scale RMS (typically 0.001 - 0.3 in normal speech) to a responsive visual percentage (0 - 100%)
  // Non-linear scaling gives a natural VU-meter feel
  const normalizedLevel = isActive
    ? Math.min(100, Math.round(Math.sqrt(rmsEnergy) * 160))
    : 0;

  const thresholdPercent = Math.min(100, Math.round(Math.sqrt(threshold) * 160));

  return (
    <div className="activity-meter-panel">
      <div className="activity-meter-top">
        <div className="activity-status-indicator">
          <span className="activity-label">Voice Activity:</span>
          {isActive ? (
            <span
              className={`activity-pill ${
                isSpeechActive ? 'activity-pill-active' : 'activity-pill-quiet'
              }`}
            >
              <span className="activity-pill-dot" />
              {isSpeechActive ? 'ACTIVE' : 'QUIET'}
            </span>
          ) : (
            <span className="activity-pill activity-pill-idle">
              <span className="activity-pill-dot" />
              STANDBY
            </span>
          )}
        </div>

        <div className="activity-rms-stat">
          <span className="activity-label">RMS Energy:</span>
          <span className="activity-value font-mono">
            {isActive ? rmsEnergy.toFixed(4) : '0.0000'}
          </span>
        </div>
      </div>

      {/* Visual Level Bar */}
      <div className="meter-track-container">
        <div className="meter-track">
          <div
            className={`meter-bar ${isSpeechActive ? 'meter-bar-active' : 'meter-bar-quiet'}`}
            style={{ width: `${normalizedLevel}%` }}
          />
          {/* Threshold marker tick */}
          <div
            className="meter-threshold-marker"
            style={{ left: `${thresholdPercent}%` }}
            title={`Active Threshold: ${threshold.toFixed(3)} RMS`}
          />
        </div>
        <div className="meter-labels">
          <span>0.0</span>
          <span className="threshold-legend">Threshold ({threshold.toFixed(2)})</span>
          <span>1.0</span>
        </div>
      </div>
    </div>
  );
}
