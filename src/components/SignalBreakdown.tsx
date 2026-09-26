/**
 * Sanket Signal Breakdown Component
 * Displays real-time acoustic telemetry across all 6 independent detection channels,
 * showing live values, target baseline references, contribution score bars, and reasons.
 */

import {
  TrendingUp,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Wind,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { FeatureSet, RiskEvaluation } from '../analysis/types';

interface SignalBreakdownProps {
  features: FeatureSet | null;
  evaluation: RiskEvaluation | null;
  isMonitoring: boolean;
}

export function SignalBreakdown({
  features,
  evaluation,
  isMonitoring,
}: SignalBreakdownProps) {
  // Map contributions by signal key for easy lookup
  const contribMap = new Map<string, { contribution: number; reason: string }>();
  if (evaluation?.contributingSignals) {
    for (const c of evaluation.contributingSignals) {
      contribMap.set(c.signal, { contribution: c.contribution, reason: c.reason });
    }
  }

  // Channel definitions with prototype weights and threshold context
  const channels = [
    {
      key: 'pitch',
      label: 'Pitch Deviation',
      icon: TrendingUp,
      maxWeight: 20,
      currentValue:
        features?.pitchHz !== null && features?.pitchHz !== undefined
          ? `${Math.round(features.pitchHz)} Hz`
          : isMonitoring
            ? 'Unvoiced'
            : '—',
      reference: 'Ref: ~165 Hz (±40 Hz)',
      active: contribMap.has('pitch'),
      contribution: contribMap.get('pitch')?.contribution ?? 0,
      reason: contribMap.get('pitch')?.reason,
      accentColor: '#38bdf8',
    },
    {
      key: 'rms',
      label: 'Vocal Intensity',
      icon: Volume2,
      maxWeight: 15,
      currentValue:
        features !== null
          ? `${(features.rmsEnergy * 100).toFixed(1)}% RMS`
          : '—',
      reference: 'Ref: ~6.0% RMS',
      active: contribMap.has('rms'),
      contribution: contribMap.get('rms')?.contribution ?? 0,
      reason: contribMap.get('rms')?.reason,
      accentColor: '#818cf8',
    },
    {
      key: 'silence',
      label: 'Prolonged Silence',
      icon: VolumeX,
      maxWeight: 15,
      currentValue:
        features !== null
          ? `${features.silenceDurationSec.toFixed(1)}s`
          : '—',
      reference: 'Onset: >1.5s',
      active: contribMap.has('silence'),
      contribution: contribMap.get('silence')?.contribution ?? 0,
      reason: contribMap.get('silence')?.reason,
      accentColor: '#f59e0b',
    },
    {
      key: 'voiceActivity',
      label: 'Voice Activity Ratio',
      icon: Clock,
      maxWeight: 15,
      currentValue:
        features !== null
          ? `${(
              (features.speechActivityDurationSec /
                Math.max(
                  0.1,
                  features.speechActivityDurationSec + features.silenceDurationSec
                )) *
              100
            ).toFixed(0)}%`
          : '—',
      reference: 'Expected: ≥25% voiced',
      active: contribMap.has('voiceActivity'),
      contribution: contribMap.get('voiceActivity')?.contribution ?? 0,
      reason: contribMap.get('voiceActivity')?.reason,
      accentColor: '#ec4899',
    },
    {
      key: 'spectral',
      label: 'Spectral Strain',
      icon: Sparkles,
      maxWeight: 10,
      currentValue:
        features?.spectralCentroid !== null && features?.spectralCentroid !== undefined
          ? `${Math.round(features.spectralCentroid)} Hz`
          : '—',
      reference: 'Threshold: >2500 Hz',
      active: contribMap.has('spectral'),
      contribution: contribMap.get('spectral')?.contribution ?? 0,
      reason: contribMap.get('spectral')?.reason,
      accentColor: '#c084fc',
    },
    {
      key: 'zcr',
      label: 'Turbulence / ZCR',
      icon: Wind,
      maxWeight: 10,
      currentValue:
        features !== null
          ? `${(features.zeroCrossingRate * 100).toFixed(1)}%`
          : '—',
      reference: 'Threshold: >20.0%',
      active: contribMap.has('zcr'),
      contribution: contribMap.get('zcr')?.contribution ?? 0,
      reason: contribMap.get('zcr')?.reason,
      accentColor: '#2dd4bf',
    },
  ];

  return (
    <div className="signal-breakdown-card" id="signal-breakdown">
      <div className="breakdown-header">
        <div className="breakdown-title-group">
          <h2 className="breakdown-title">Acoustic Signal Breakdown</h2>
          <span className="breakdown-subtitle">
            Multi-signal heuristic channels & contribution weights
          </span>
        </div>
        <div className="breakdown-legend">
          <span className="legend-dot active" />
          <span className="legend-text">Active Contributor</span>
        </div>
      </div>

      {/* Grid of Signal Cards */}
      <div className="signal-grid">
        {channels.map((ch) => {
          const Icon = ch.icon;
          const percentage = Math.min(100, Math.round((ch.contribution / ch.maxWeight) * 100));

          return (
            <div
              key={ch.key}
              className={`signal-tile ${ch.active ? 'signal-tile-active' : 'signal-tile-idle'}`}
              id={`signal-tile-${ch.key}`}
            >
              <div className="tile-top-row">
                <div className="tile-label-group">
                  <div
                    className="tile-icon-wrap"
                    style={{
                      backgroundColor: ch.active
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(255, 255, 255, 0.04)',
                      color: ch.active ? '#f87171' : ch.accentColor,
                    }}
                  >
                    <Icon size={14} />
                  </div>
                  <span className="tile-label">{ch.label}</span>
                </div>

                <div className="tile-score-badge">
                  <span className="tile-score-pts">
                    +{Math.round(ch.contribution * 10) / 10}
                  </span>
                  <span className="tile-score-max">/{ch.maxWeight}</span>
                </div>
              </div>

              {/* Telemetry Readout */}
              <div className="tile-value-row">
                <span className="tile-current-value">{ch.currentValue}</span>
                <span className="tile-reference-tag">{ch.reference}</span>
              </div>

              {/* Contribution Progress Bar */}
              <div className="tile-progress-track">
                <div
                  className="tile-progress-fill"
                  style={{
                    width: `${ch.active ? Math.max(8, percentage) : 0}%`,
                    backgroundColor: ch.active ? '#ef4444' : ch.accentColor,
                    boxShadow: ch.active ? '0 0 8px rgba(239, 68, 68, 0.6)' : 'none',
                  }}
                />
              </div>

              {/* Reason / Status */}
              <div className="tile-status-row">
                {ch.active ? (
                  <div className="tile-reason-text">
                    <AlertTriangle size={11} className="tile-status-icon alert" />
                    <span>{ch.reason || 'Anomaly detected'}</span>
                  </div>
                ) : (
                  <div className="tile-calm-text">
                    <CheckCircle2 size={11} className="tile-status-icon calm" />
                    <span>Within expected range</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Persistence Row if active */}
      {evaluation && evaluation.persistenceFrames > 0 && (
        <div className="persistence-notice-bar">
          <div className="persistence-left">
            <Info size={13} />
            <span>
              <strong>Temporal Persistence Bonus:</strong> Sustained for{' '}
              {evaluation.persistenceFrames} consecutive frames (+
              {contribMap.get('persistence')?.contribution.toFixed(1) ?? '0.0'} pts).
            </span>
          </div>
          <span className="persistence-tag">
            {evaluation.isConfirmed ? 'CONFIRMED PATTERN' : 'EVALUATING CONFIRMATION'}
          </span>
        </div>
      )}
    </div>
  );
}
