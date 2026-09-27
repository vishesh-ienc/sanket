/**
 * Sanket — Incident Banner Component (Phase 7)
 *
 * Prominent visual distress alert bar displayed when a confirmed HIGH_RISK
 * incident is active.
 *
 * Strict prototype guarantee: Completely silent. No audio alerts, no OS popups,
 * and no emergency service dispatch claims.
 */

import React from 'react';
import { AlertTriangle, Eye, CheckCircle2, Radio, Sparkles } from 'lucide-react';
import type { DistressIncident } from '../analysis/types';

interface IncidentBannerProps {
  incident: DistressIncident | null;
  onViewEvent: () => void;
  onAcknowledge: () => void;
  /** Number of trusted contacts the (simulated) alert is addressed to */
  recipientCount?: number;
}

export const IncidentBanner: React.FC<IncidentBannerProps> = ({
  incident,
  onViewEvent,
  onAcknowledge,
  recipientCount = 0,
}) => {
  if (!incident) return null;

  const isSimulated = incident.source === 'SIMULATION';
  const isAcknowledged = incident.status === 'ACKNOWLEDGED';
  const timeFormatted = new Date(incident.timestamp).toLocaleTimeString();

  return (
    <aside
      className={`incident-alert-banner ${isAcknowledged ? 'banner-acknowledged' : 'banner-active'}`}
      id="incident-alert-banner"
      role="alert"
      aria-live="assertive"
    >
      <div className="banner-glow-strip" />

      <div className="banner-content">
        {/* Left: Icon & Badge */}
        <div className="banner-icon-cluster">
          <div className="banner-alert-icon pulse-soft">
            <AlertTriangle size={22} strokeWidth={2.5} />
          </div>
          <div className="banner-title-group">
            <div className="banner-badge-row">
              <span className="banner-tag-urgent">
                SILENT DISTRESS ALERT
              </span>
              <span className="banner-status-tag">
                {isAcknowledged ? 'STATUS: ACKNOWLEDGED' : 'STATUS: CONFIRMED HIGH-RISK EVENT'}
              </span>
              <span
                className={`banner-source-tag ${
                  isSimulated ? 'source-simulated' : 'source-microphone'
                }`}
              >
                {isSimulated ? (
                  <>
                    <Sparkles size={11} /> DEMO SOURCE
                  </>
                ) : (
                  <>
                    <Radio size={11} /> MICROPHONE
                  </>
                )}
              </span>
            </div>
            <p className="banner-subtext">
              Alert generated after sustained multi-signal confirmation • Simulated local alert
              {recipientCount > 0
                ? ` prepared for ${recipientCount} trusted contact${recipientCount === 1 ? '' : 's'} (not sent)`
                : ''}{' '}
              • Zero external transmission • {timeFormatted}
            </p>
          </div>
        </div>

        {/* Center: Live Metrics */}
        <div className="banner-metrics">
          <div className="banner-metric-pill">
            <span className="metric-label">Risk Score</span>
            <span className="metric-value score-high">{incident.riskScore}/100</span>
          </div>
          <div className="banner-metric-pill">
            <span className="metric-label">Level</span>
            <span className="metric-value level-high">{incident.riskLevel}</span>
          </div>
          <div className="banner-metric-pill">
            <span className="metric-label">Confirmed Signals</span>
            <span className="metric-value">{incident.confirmedSignals.length} Active</span>
          </div>
          <div className="banner-metric-pill">
            <span className="metric-label">Persistence</span>
            <span className="metric-value">{incident.persistenceFrames} Frames</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="banner-actions">
          <button
            type="button"
            className="banner-cta-primary"
            id="view-forensic-event-btn"
            onClick={onViewEvent}
          >
            <Eye size={15} />
            <span>VIEW EVIDENCE</span>
          </button>

          {!isAcknowledged && (
            <button
              type="button"
              className="banner-cta-secondary"
              id="acknowledge-incident-btn"
              onClick={onAcknowledge}
              title="Acknowledge alert"
            >
              <CheckCircle2 size={15} />
              <span>ACKNOWLEDGE</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
