/**
 * Sanket — Alert History Component (Phase 7)
 *
 * Displays a chronological list of recent distress incidents and simulated alerts.
 * Allows clicking on any event to inspect full forensic metadata in the ForensicEventModal.
 */

import React from 'react';
import { History, Trash2, ExternalLink, Radio, Sparkles, ShieldAlert } from 'lucide-react';
import type { DistressIncident } from '../analysis/types';

interface AlertHistoryProps {
  history: DistressIncident[];
  onSelectIncident: (incident: DistressIncident) => void;
  onClearHistory: () => void;
}

export const AlertHistory: React.FC<AlertHistoryProps> = ({
  history,
  onSelectIncident,
  onClearHistory,
}) => {
  return (
    <div className="console-card alert-history-card" id="alert-history-panel">
      {/* Header */}
      <div className="card-header">
        <div className="card-title-group">
          <History size={16} className="card-icon" />
          <h2 className="card-title">Incident & Alert History</h2>
          <span className="card-badge">{history.length} Recorded</span>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            className="history-clear-btn"
            id="clear-history-btn"
            onClick={onClearHistory}
            title="Clear all recorded history"
          >
            <Trash2 size={13} />
            <span>Clear History</span>
          </button>
        )}
      </div>

      <p className="history-desc">
        Local audit log of confirmed distress incidents. Stored locally on this device.
      </p>

      {/* Incident List */}
      <div className="history-list-wrap">
        {history.length === 0 ? (
          <div className="history-empty-state" id="history-empty-state">
            <ShieldAlert size={28} className="empty-icon" />
            <p className="empty-main">No distress events recorded in this session.</p>
            <p className="empty-sub">
              When a confirmed HIGH_RISK threshold is sustained, local simulated alerts and
              forensic metadata will appear here.
            </p>
          </div>
        ) : (
          <ul className="history-list" id="history-list-items">
            {history.map((item) => {
              const isSimulated = item.source === 'SIMULATION';
              const timeFormatted = new Date(item.timestamp).toLocaleTimeString();
              const dateFormatted = new Date(item.timestamp).toLocaleDateString();

              return (
                <li
                  key={item.id}
                  className="history-item"
                  onClick={() => onSelectIncident(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectIncident(item);
                    }
                  }}
                >
                  <div className="item-left">
                    <span className="item-score-pill score-high">
                      {item.riskScore}
                    </span>

                    <div className="item-meta">
                      <div className="item-top-row">
                        <span className="item-level">{item.riskLevel}</span>
                        <span
                          className={`item-source-badge ${
                            isSimulated ? 'source-simulated' : 'source-microphone'
                          }`}
                        >
                          {isSimulated ? (
                            <>
                              <Sparkles size={10} /> DEMO SIMULATION
                            </>
                          ) : (
                            <>
                              <Radio size={10} /> MICROPHONE
                            </>
                          )}
                        </span>
                        <span className={`item-status-pill status-${item.status.toLowerCase()}`}>
                          {item.status}
                        </span>
                      </div>

                      <div className="item-bottom-row">
                        <span className="item-signals">
                          {item.confirmedSignals.length} signals active (
                          {item.confirmedSignals.join(', ') || 'multi-channel'})
                        </span>
                        <span className="item-time" title={`${dateFormatted} ${timeFormatted}`}>
                          {timeFormatted}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="item-right">
                    <button
                      type="button"
                      className="item-view-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectIncident(item);
                      }}
                      title="Inspect forensic metadata"
                    >
                      <span>Inspect</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer notice */}
      <div className="history-footer">
        <span className="history-footer-tag">
          Local Storage: <code>sanket_alert_history_v1</code> (Max 50)
        </span>
        <span className="history-footer-guarantee">
          Zero raw audio retention • Metadata only
        </span>
      </div>
    </div>
  );
};
