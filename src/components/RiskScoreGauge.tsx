/**
 * Sanket Risk Score Gauge Component
 * High-tech circular HUD gauge displaying real-time composite distress risk score,
 * risk level badge, confirmation status, and persistence telemetry.
 */

import { useId } from 'react';
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import type { RiskLevel } from '../analysis/types';

interface RiskScoreGaugeProps {
  score: number;
  level: RiskLevel;
  isConfirmed: boolean;
  persistenceFrames: number;
  confirmedSignals: number;
  isMonitoring: boolean;
}

export function RiskScoreGauge({
  score,
  level,
  isConfirmed,
  persistenceFrames,
  confirmedSignals,
  isMonitoring,
}: RiskScoreGaugeProps) {
  const gradientId = useId();
  const glowId = useId();

  // Color config based on RiskLevel
  const getColorConfig = () => {
    switch (level) {
      case 'HIGH_RISK':
        return {
          primary: '#ef4444',
          secondary: '#f43f5e',
          glow: 'rgba(239, 68, 68, 0.55)',
          bg: 'rgba(239, 68, 68, 0.12)',
          border: 'rgba(239, 68, 68, 0.3)',
          label: 'HIGH RISK',
          badgeClass: 'risk-badge-high',
        };
      case 'SUSPICIOUS':
        return {
          primary: '#f97316',
          secondary: '#fb923c',
          glow: 'rgba(249, 115, 22, 0.45)',
          bg: 'rgba(249, 115, 22, 0.1)',
          border: 'rgba(249, 115, 22, 0.3)',
          label: 'SUSPICIOUS',
          badgeClass: 'risk-badge-suspicious',
        };
      case 'ELEVATED':
        return {
          primary: '#f59e0b',
          secondary: '#fbbf24',
          glow: 'rgba(245, 158, 11, 0.4)',
          bg: 'rgba(245, 158, 11, 0.08)',
          border: 'rgba(245, 158, 11, 0.25)',
          label: 'ELEVATED',
          badgeClass: 'risk-badge-elevated',
        };
      case 'NORMAL':
      default:
        return {
          primary: '#10b981',
          secondary: '#34d399',
          glow: 'rgba(16, 185, 129, 0.35)',
          bg: 'rgba(16, 185, 129, 0.08)',
          border: 'rgba(16, 185, 129, 0.2)',
          label: 'NORMAL',
          badgeClass: 'risk-badge-normal',
        };
    }
  };

  const colors = getColorConfig();

  // Gauge geometry: 260-degree arc
  const size = 240;
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2;
  const center = size / 2;
  const arcDegree = 260;
  const arcLength = (arcDegree / 360) * (2 * Math.PI * radius);
  const strokeDashoffset = arcLength - (Math.min(100, Math.max(0, score)) / 100) * arcLength;

  return (
    <div className={`risk-gauge-container ${colors.badgeClass}`} id="risk-score-gauge">
      {/* HUD Header */}
      <div className="gauge-header">
        <span className="gauge-title-badge">DISTRESS RISK EVALUATION</span>
        <span className="gauge-cadence">10Hz Telemetry</span>
      </div>

      {/* Main Gauge Graphic */}
      <div className="gauge-svg-wrapper">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="gauge-svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.secondary} />
              <stop offset="100%" stopColor={colors.primary} />
            </linearGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer decorative ring */}
          <circle
            cx={center}
            cy={center}
            r={radius + 10}
            fill="none"
            stroke="rgba(255, 255, 255, 0.04)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />

          {/* Background track arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.07)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${2 * Math.PI * radius}`}
            strokeLinecap="round"
            transform={`rotate(140 ${center} ${center})`}
          />

          {/* Animated active score arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${2 * Math.PI * radius}`}
            strokeDashoffset={isMonitoring ? strokeDashoffset : arcLength}
            strokeLinecap="round"
            filter={`url(#${glowId})`}
            transform={`rotate(140 ${center} ${center})`}
            style={{
              transition: 'stroke-dashoffset 0.25s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease',
            }}
          />

          {/* Tick marks on arc */}
          {[0, 30, 50, 70, 100].map((tickValue) => {
            const angle = 140 + (tickValue / 100) * arcDegree;
            const rad = (angle * Math.PI) / 180;
            const tickR1 = radius - strokeWidth / 2 - 4;
            const tickR2 = radius - strokeWidth / 2 - 10;
            const x1 = center + tickR1 * Math.cos(rad);
            const y1 = center + tickR1 * Math.sin(rad);
            const x2 = center + tickR2 * Math.cos(rad);
            const y2 = center + tickR2 * Math.sin(rad);
            return (
              <line
                key={tickValue}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>

        {/* Center Score & Status Display */}
        <div className="gauge-center-content">
          <div className="gauge-score-row">
            <span className="gauge-score-number" id="risk-score-value">
              {isMonitoring ? Math.round(score) : '—'}
            </span>
            <span className="gauge-score-total">/100</span>
          </div>

          <div
            className="gauge-level-badge"
            id="risk-level-badge"
            style={{
              backgroundColor: colors.bg,
              borderColor: colors.border,
              color: colors.primary,
              boxShadow: `0 0 16px ${colors.glow}`,
            }}
          >
            <span
              className="gauge-beacon-dot"
              style={{ backgroundColor: colors.primary, boxShadow: `0 0 8px ${colors.primary}` }}
            />
            <span className="gauge-level-text">{colors.label}</span>
          </div>
        </div>
      </div>

      {/* Confirmation & Persistence Badges */}
      <div className="gauge-meta-row">
        <div className={`gauge-meta-pill ${isConfirmed ? 'confirmed' : 'observing'}`}>
          {isConfirmed ? (
            <>
              <ShieldAlert size={13} />
              <span>CONFIRMED DISTRESS PATTERN</span>
            </>
          ) : (
            <>
              <ShieldCheck size={13} />
              <span>{isMonitoring ? 'OBSERVING STREAM' : 'SYSTEM IDLE'}</span>
            </>
          )}
        </div>

        <div className="gauge-meta-pill persistence">
          <Shield size={12} />
          <span>
            {persistenceFrames > 0
              ? `${persistenceFrames} frames sustained`
              : '0 persistence frames'}
          </span>
        </div>

        <div className="gauge-meta-pill signals">
          <span>{confirmedSignals} active channels</span>
        </div>
      </div>
    </div>
  );
}
