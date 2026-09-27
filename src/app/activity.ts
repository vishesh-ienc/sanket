/**
 * Sanket — Live Activity Feed model
 *
 * Turns pipeline state changes into short, human-readable events for the
 * dashboard feed. Each event snapshots the evidence at that moment so it can
 * be opened in full later. Pure TypeScript; no transcripts are stored (a
 * code-word event records that the phrase matched, never what was said).
 */

import type { RiskEvaluation, RiskLevel, SignalContribution, TemporalContext } from '@/analysis/types';

export type ActivityKind =
  'level-up' | 'level-down' | 'transient-filtered' | 'code-word' | 'incident' | 'incident-resolved' | 'source' | 'calibration' | 'speech';

export type ActivityTone = 'neutral' | 'normal' | 'elevated' | 'suspicious' | 'high' | 'info';

export interface ActivityEvent {
  id: string;
  timestamp: number;
  kind: ActivityKind;
  tone: ActivityTone;
  title: string;
  detail: string;
  score?: number;
  level?: RiskLevel;
  signals?: SignalContribution[];
  temporal?: Pick<TemporalContext, 'eventType' | 'sustainedFrames' | 'transientFrames' | 'multiSignalCorrelation' | 'explanation'>;
  incidentId?: string;
}

export const MAX_ACTIVITY_EVENTS = 60;

const LEVEL_ORDER: RiskLevel[] = ['NORMAL', 'ELEVATED', 'SUSPICIOUS', 'HIGH_RISK'];

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  NORMAL: 'Normal',
  ELEVATED: 'Elevated',
  SUSPICIOUS: 'Suspicious',
  HIGH_RISK: 'High risk',
};

export function levelTone(level: RiskLevel): ActivityTone {
  return level === 'HIGH_RISK' ? 'high' : level === 'SUSPICIOUS' ? 'suspicious' : level === 'ELEVATED' ? 'elevated' : 'normal';
}

let seq = 0;
export function makeEvent(e: Omit<ActivityEvent, 'id' | 'timestamp'> & { timestamp?: number }): ActivityEvent {
  seq = (seq + 1) % 1_000_000;
  return { id: `evt-${Date.now()}-${seq}`, timestamp: e.timestamp ?? Date.now(), ...e };
}

export function activeSignals(evaluation: RiskEvaluation | null): SignalContribution[] {
  return (evaluation?.contributingSignals ?? []).filter((s) => s.contribution > 0).sort((a, b) => b.contribution - a.contribution);
}

/** Level transition event, or null if the level did not change */
export function levelChangeEvent(prev: RiskLevel | null, evaluation: RiskEvaluation): ActivityEvent | null {
  const next = evaluation.riskLevel;
  if (prev === null || prev === next) return null;
  const up = LEVEL_ORDER.indexOf(next) > LEVEL_ORDER.indexOf(prev);
  const signals = activeSignals(evaluation);
  const names = signals.filter((s) => s.signal !== 'persistence').map((s) => SIGNAL_LABEL[s.signal] ?? s.signal);
  return makeEvent({
    kind: up ? 'level-up' : 'level-down',
    tone: up ? levelTone(next) : 'neutral',
    title: up ? `Risk rose to ${LEVEL_LABEL[next]}` : `Risk eased to ${LEVEL_LABEL[next]}`,
    detail: up
      ? names.length > 0
        ? `Driven by ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`
        : 'Signals building'
      : 'Signals returning toward baseline',
    score: evaluation.riskScore,
    level: next,
    signals,
  });
}

export function transientFilteredEvent(temporal: TemporalContext, evaluation: RiskEvaluation | null): ActivityEvent {
  return makeEvent({
    kind: 'transient-filtered',
    tone: 'info',
    title: 'Short spike filtered',
    detail: 'Isolated burst (cough, laugh, exclamation) — not treated as distress',
    score: evaluation?.riskScore,
    level: evaluation?.riskLevel,
    signals: activeSignals(evaluation),
    temporal: {
      eventType: temporal.eventType,
      sustainedFrames: temporal.sustainedFrames,
      transientFrames: temporal.transientFrames,
      multiSignalCorrelation: temporal.multiSignalCorrelation,
      explanation: temporal.explanation,
    },
  });
}

export const SIGNAL_LABEL: Record<string, string> = {
  pitch: 'Pitch',
  rms: 'Vocal intensity',
  silence: 'Silence',
  voiceActivity: 'Voice activity',
  spectral: 'Spectral strain',
  zcr: 'Breathiness',
  persistence: 'Persistence',
  codeWord: 'Code word',
};

export function appendEvent(list: ActivityEvent[], event: ActivityEvent): ActivityEvent[] {
  return [event, ...list].slice(0, MAX_ACTIVITY_EVENTS);
}

/** Tailwind classes for each activity tone */
export const TONE_CLASS: Record<ActivityTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info/12 text-info',
  normal: 'bg-risk-normal/12 text-risk-normal',
  elevated: 'bg-risk-elevated/15 text-risk-elevated',
  suspicious: 'bg-risk-suspicious/15 text-risk-suspicious',
  high: 'bg-risk-high/15 text-risk-high',
};

export function relativeTime(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
