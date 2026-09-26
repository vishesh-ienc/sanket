/**
 * Sanket Monitoring Status Panel
 * Displays hardware audio state, VAD classification, DSP analysis cadence,
 * cumulative session metrics, and local-first privacy security badges.
 */

import { Activity, Cpu, Lock, Mic, Radio, Volume2, Waves } from 'lucide-react';
import type { AudioActivityState } from '../audio/types';
import type { FeatureSet } from '../analysis/types';

interface MonitoringStatusProps {
  isMonitoring: boolean;
  activity: AudioActivityState;
  features: FeatureSet | null;
  sampleRate: number;
}

export function MonitoringStatus({
  isMonitoring,
  activity,
  features,
  sampleRate,
}: MonitoringStatusProps) {
  const isSpeaking = features?.isSpeech ?? activity.isActive;
  const rmsPercent = Math.min(100, Math.round(activity.rmsEnergy * 250)); // scaled for display

  return (
    <div className="monitoring-status-card" id="monitoring-status">
      <div className="status-panel-header">
        <div className="status-panel-title-group">
          <Activity size={16} className="status-panel-icon" />
          <h2 className="status-panel-title">Monitoring & Pipeline Status</h2>
        </div>
        <div
          className={`stream-pill ${isMonitoring ? 'stream-live' : 'stream-idle'}`}
        >
          <span className="stream-dot" />
          <span>{isMonitoring ? 'AUDIO STREAM LIVE' : 'STREAM STANDBY'}</span>
        </div>
      </div>

      <div className="status-grid">
        {/* Hardware & Web Audio Node Info */}
        <div className="status-metric-box">
          <div className="metric-box-header">
            <Mic size={14} className="metric-icon" />
            <span className="metric-label">Input Audio Layer</span>
          </div>
          <div className="metric-value-primary">
            {isMonitoring ? `${(sampleRate / 1000).toFixed(1)} kHz` : 'Inactive'}
          </div>
          <div className="metric-subtext">
            <span>Buffer: 2048 FFT</span>
            <span className="metric-sep">•</span>
            <span>Web Audio API</span>
          </div>
        </div>

        {/* Real-time Voice Activity Detection (VAD) */}
        <div className="status-metric-box">
          <div className="metric-box-header">
            <Radio size={14} className="metric-icon" />
            <span className="metric-label">Voice Activity (VAD)</span>
          </div>
          <div className="metric-value-primary">
            <span
              className={`vad-pill ${isSpeaking ? 'vad-speaking' : 'vad-ambient'}`}
            >
              <span className="vad-dot" />
              {isSpeaking ? 'VOICED SPEECH' : 'AMBIENT / QUIET'}
            </span>
          </div>
          <div className="metric-subtext">
            <span>RMS: {(activity.rmsEnergy * 100).toFixed(2)}%</span>
            <span className="metric-sep">•</span>
            <span>Gate: 1.5%</span>
          </div>
          {/* Mini RMS Energy Meter */}
          <div className="metric-mini-meter">
            <div
              className={`metric-mini-fill ${isSpeaking ? 'active' : ''}`}
              style={{ width: `${isMonitoring ? Math.max(4, rmsPercent) : 0}%` }}
            />
          </div>
        </div>

        {/* DSP Engine Cadence */}
        <div className="status-metric-box">
          <div className="metric-box-header">
            <Cpu size={14} className="metric-icon" />
            <span className="metric-label">Analysis Cadence</span>
          </div>
          <div className="metric-value-primary">10 Hz (100ms)</div>
          <div className="metric-subtext">
            <span>FeatureExtractor: 10Hz</span>
            <span className="metric-sep">•</span>
            <span>RiskEngine: 10Hz</span>
          </div>
        </div>

        {/* Session Temporal State */}
        <div className="status-metric-box">
          <div className="metric-box-header">
            <Waves size={14} className="metric-icon" />
            <span className="metric-label">Session Accumulation</span>
          </div>
          <div className="metric-value-primary">
            {features !== null
              ? `${features.speechActivityDurationSec.toFixed(1)}s speech`
              : '0.0s speech'}
          </div>
          <div className="metric-subtext">
            <span>Segments: {features?.speechSegmentCount ?? 0}</span>
            <span className="metric-sep">•</span>
            <span>Silence: {features?.silenceDurationSec.toFixed(1) ?? '0.0'}s</span>
          </div>
        </div>
      </div>

      {/* Security & Local-First Assurance Badge */}
      <div className="security-assurance-banner">
        <div className="security-assurance-item">
          <Lock size={13} className="security-icon" />
          <span>
            <strong>100% Local Processing:</strong> Audio PCM data never leaves this browser tab.
            Zero cloud transcription or external streaming.
          </span>
        </div>
        <div className="security-assurance-item">
          <Volume2 size={13} className="security-icon" />
          <span>
            <strong>Permitted Analysis:</strong> Analyzes authorized acoustic deviations only. No
            surreptitious background eavesdropping.
          </span>
        </div>
      </div>
    </div>
  );
}
