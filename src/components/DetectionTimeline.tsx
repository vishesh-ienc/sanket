/**
 * Sanket Detection Timeline Component
 * Tracks real-time score trajectory and logs significant acoustic risk transitions,
 * multi-signal detections, and recovery events.
 */

import { useEffect, useRef, useState } from 'react';
import { History, ArrowUpRight, ArrowDownRight, ShieldAlert, Sparkles, CheckCircle2, KeyRound } from 'lucide-react';
import type { RiskEvaluation, RiskLevel, CodeWordDetection } from '../analysis/types';

interface TimelineEvent {
  id: string;
  timeStr: string;
  timestamp: number;
  score: number;
  level: RiskLevel;
  type: 'LEVEL_UP' | 'LEVEL_DOWN' | 'MULTI_SIGNAL' | 'CODE_WORD' | 'RECOVERY' | 'SESSION_START';
  summary: string;
  signals: string[];
}

interface DetectionTimelineProps {
  currentEvaluation: RiskEvaluation | null;
  isMonitoring: boolean;
  codeWordDetection?: CodeWordDetection | null;
}

export function DetectionTimeline({
  currentEvaluation,
  isMonitoring,
  codeWordDetection,
}: DetectionTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const prevLevelRef = useRef<RiskLevel>('NORMAL');
  const prevScoreRef = useRef<number>(0);
  const eventCounterRef = useRef<number>(0);
  const prevCodeWordTsRef = useRef<number | null>(null);

  // Maintain rolling score history for mini-sparkline (last 30 samples)
  useEffect(() => {
    if (!isMonitoring) {
      const timer = setTimeout(() => {
        setScoreHistory([]);
        setEvents([]);
        prevLevelRef.current = 'NORMAL';
        prevScoreRef.current = 0;
      }, 0);
      return () => clearTimeout(timer);
    }

    if (currentEvaluation) {
      const timer = setTimeout(() => {
        const currentScore = currentEvaluation.riskScore;
        const currentLevel = currentEvaluation.riskLevel;
        const prevLevel = prevLevelRef.current;
        const prevScore = prevScoreRef.current;

        setScoreHistory((prev) => {
          const next = [...prev, currentScore];
          return next.length > 30 ? next.slice(next.length - 30) : next;
        });

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        // Detect notable level transitions
        if (currentLevel !== prevLevel) {
          eventCounterRef.current += 1;
          const isEscalation = currentScore > prevScore;
          const newEvent: TimelineEvent = {
            id: `ev-${eventCounterRef.current}-${Date.now()}`,
            timeStr,
            timestamp: Date.now(),
            score: Math.round(currentScore),
            level: currentLevel,
            type: isEscalation ? 'LEVEL_UP' : 'LEVEL_DOWN',
            summary: isEscalation
              ? `Risk escalated: ${prevLevel} → ${currentLevel}`
              : `Risk de-escalated: ${prevLevel} → ${currentLevel}`,
            signals: currentEvaluation.contributingSignals.map((c) => c.signal),
          };

          setEvents((prev) => [newEvent, ...prev.slice(0, 19)]);
          prevLevelRef.current = currentLevel;
        } else if (
          currentEvaluation.confirmedSignals >= 3 &&
          Math.abs(currentScore - prevScore) >= 15
        ) {
          // Multi-signal co-occurrence surge
          eventCounterRef.current += 1;
          const newEvent: TimelineEvent = {
            id: `ev-${eventCounterRef.current}-${Date.now()}`,
            timeStr,
            timestamp: Date.now(),
            score: Math.round(currentScore),
            level: currentLevel,
            type: 'MULTI_SIGNAL',
            summary: `Multi-signal co-occurrence: ${currentEvaluation.confirmedSignals} active channels`,
            signals: currentEvaluation.contributingSignals.map((c) => c.signal),
          };
          setEvents((prev) => [newEvent, ...prev.slice(0, 19)]);
        }

        prevScoreRef.current = currentScore;
      }, 0);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentEvaluation, isMonitoring]);

  // Record code word detections in the event log (does not leak full phrase)
  useEffect(() => {
    if (!isMonitoring || !codeWordDetection || !codeWordDetection.detected) return;

    if (codeWordDetection.timestamp !== prevCodeWordTsRef.current) {
      prevCodeWordTsRef.current = codeWordDetection.timestamp;
      eventCounterRef.current += 1;

      const now = new Date(codeWordDetection.timestamp);
      const timeStr = now.toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const newEvent: TimelineEvent = {
        id: `ev-cw-${eventCounterRef.current}-${Date.now()}`,
        timeStr,
        timestamp: codeWordDetection.timestamp,
        score: Math.round(currentEvaluation?.riskScore ?? 25),
        level: currentEvaluation?.riskLevel ?? 'ELEVATED',
        type: 'CODE_WORD',
        summary: 'Configured code word detected',
        signals: ['codeWord'],
      };

      const timer = setTimeout(() => {
        setEvents((prev) => [newEvent, ...prev.slice(0, 19)]);
      }, 0);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [codeWordDetection, isMonitoring, currentEvaluation]);

  const getLevelColor = (level: RiskLevel) => {
    switch (level) {
      case 'HIGH_RISK':
        return '#ef4444';
      case 'SUSPICIOUS':
        return '#f97316';
      case 'ELEVATED':
        return '#f59e0b';
      case 'NORMAL':
      default:
        return '#10b981';
    }
  };

  return (
    <div className="detection-timeline-card" id="detection-timeline">
      <div className="timeline-header">
        <div className="timeline-title-group">
          <History size={16} className="timeline-icon" />
          <h2 className="timeline-title">Detection Timeline & Sparkline</h2>
        </div>
        <span className="timeline-badge">
          {events.length} event{events.length === 1 ? '' : 's'} recorded
        </span>
      </div>

      {/* Mini Real-time Score Trajectory Sparkline */}
      <div className="sparkline-wrapper">
        <div className="sparkline-labels">
          <span>Recent Score Trend</span>
          <span className="sparkline-legend-text">
            {scoreHistory.length > 0
              ? `Latest: ${Math.round(scoreHistory[scoreHistory.length - 1])} pts`
              : 'Waiting for stream...'}
          </span>
        </div>
        <div className="sparkline-bars">
          {scoreHistory.length === 0 ? (
            <div className="sparkline-placeholder">Stream idle</div>
          ) : (
            scoreHistory.map((val, idx) => {
              const heightPct = Math.max(6, Math.min(100, (val / 100) * 100));
              const barColor =
                val >= 70
                  ? '#ef4444'
                  : val >= 50
                    ? '#f97316'
                    : val >= 30
                      ? '#f59e0b'
                      : '#10b981';
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: Fixed-size rolling sparkline index
                  key={idx}
                  className="sparkline-bar"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: barColor,
                    boxShadow: val >= 50 ? `0 0 6px ${barColor}` : 'none',
                  }}
                  title={`Score: ${Math.round(val)}`}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Log Entries */}
      <div className="timeline-feed">
        {events.length === 0 ? (
          <div className="timeline-empty-state">
            <CheckCircle2 size={24} className="timeline-empty-icon" />
            <p className="timeline-empty-text">
              {isMonitoring
                ? 'Monitoring active. Timeline will record risk transitions and multi-signal anomalies.'
                : 'System ready. Start monitoring to begin acoustic distress surveillance.'}
            </p>
          </div>
        ) : (
          <div className="timeline-list">
            {events.map((ev) => {
              const color = getLevelColor(ev.level);
              return (
                <div key={ev.id} className="timeline-item">
                  <div
                    className="timeline-item-beacon"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                  />
                  <div className="timeline-item-body">
                    <div className="timeline-item-top">
                      <span className="timeline-item-time">{ev.timeStr}</span>
                      <span
                        className="timeline-item-level-tag"
                        style={{
                          color,
                          borderColor: `${color}40`,
                          backgroundColor: `${color}15`,
                        }}
                      >
                        {ev.type === 'CODE_WORD' ? (
                          <KeyRound size={10} />
                        ) : ev.type === 'LEVEL_UP' ? (
                          <ArrowUpRight size={10} />
                        ) : ev.type === 'LEVEL_DOWN' ? (
                          <ArrowDownRight size={10} />
                        ) : (
                          <ShieldAlert size={10} />
                        )}
                        {ev.level}
                      </span>
                      <span className="timeline-item-score">{ev.score} pts</span>
                    </div>

                    <div className="timeline-item-summary">{ev.summary}</div>

                    {ev.signals.length > 0 && (
                      <div className="timeline-item-signals">
                        <Sparkles size={10} />
                        <span>Signals: {ev.signals.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
