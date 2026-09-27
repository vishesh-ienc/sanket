/**
 * Display metadata for each detection signal (labels, icons, live readouts).
 */

import type { LucideIcon } from 'lucide-react';
import { AudioLines, Mic2, Pause, Activity, Sparkles, Wind, KeyRound, Timer } from 'lucide-react';
import type { FeatureSet, RiskLevel } from '@/analysis/types';
import type { SignalId } from '@/analysis/signalSettings';

export interface SignalMeta {
  id: SignalId | 'persistence' | 'codeWord';
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
  reference: string;
  read: (f: FeatureSet | null) => string;
}

const fmt = (v: number | null | undefined, digits = 0, unit = '') =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : `${v.toFixed(digits)}${unit}`;

export const SIGNAL_META: Record<SignalMeta['id'], SignalMeta> = {
  pitch: {
    id: 'pitch',
    label: 'Pitch deviation',
    short: 'Pitch',
    icon: AudioLines,
    description: 'Vocal-cord tension raises the fundamental frequency above your normal range.',
    reference: '≈165 Hz reference (or your baseline)',
    read: (f) => fmt(f?.pitchHz, 0, ' Hz'),
  },
  rms: {
    id: 'rms',
    label: 'Vocal intensity',
    short: 'Intensity',
    icon: Mic2,
    description: 'Sudden raised effort or a suppressed whisper compared with normal loudness.',
    reference: '≈6% RMS reference',
    read: (f) => (f ? `${(f.rmsEnergy * 100).toFixed(1)}%` : '—'),
  },
  silence: {
    id: 'silence',
    label: 'Prolonged silence',
    short: 'Silence',
    icon: Pause,
    description: 'A conversational freeze longer than your usual pauses.',
    reference: 'Scores after 1.5 s',
    read: (f) => fmt(f?.silenceDurationSec, 1, ' s'),
  },
  voiceActivity: {
    id: 'voiceActivity',
    label: 'Voice activity',
    short: 'Voicing',
    icon: Activity,
    description: 'Share of the session actually spent speaking; a collapse can signal being silenced.',
    reference: 'Expected ≥ 25% voiced',
    read: (f) => {
      if (!f) return '—';
      const total = f.speechActivityDurationSec + f.silenceDurationSec;
      return total > 0 ? `${Math.round((f.speechActivityDurationSec / total) * 100)}%` : '—';
    },
  },
  spectral: {
    id: 'spectral',
    label: 'Spectral strain',
    short: 'Strain',
    icon: Sparkles,
    description: 'Energy shifting to high frequencies — a sign of a tense, strained voice.',
    reference: 'Scores above 2.5 kHz',
    read: (f) => (f?.spectralCentroid ? `${(f.spectralCentroid / 1000).toFixed(1)} kHz` : '—'),
  },
  zcr: {
    id: 'zcr',
    label: 'Breathiness',
    short: 'Breath',
    icon: Wind,
    description: 'Zero-crossing rate rises with turbulent, breathy or whispered airflow.',
    reference: 'Scores above 20%',
    read: (f) => (f ? `${(f.zeroCrossingRate * 100).toFixed(0)}%` : '—'),
  },
  persistence: {
    id: 'persistence',
    label: 'Persistence',
    short: 'Persist',
    icon: Timer,
    description: 'Bonus when abnormal signals are sustained over consecutive frames.',
    reference: 'After 3 frames',
    read: () => '',
  },
  codeWord: {
    id: 'codeWord',
    label: 'Code word',
    short: 'Code word',
    icon: KeyRound,
    description: 'Your covert phrase was spoken — sustained context for ~15 s.',
    reference: 'Configured phrase',
    read: () => '',
  },
};

export const LEVEL_COLOR_VAR: Record<RiskLevel, string> = {
  NORMAL: 'var(--risk-normal)',
  ELEVATED: 'var(--risk-elevated)',
  SUSPICIOUS: 'var(--risk-suspicious)',
  HIGH_RISK: 'var(--risk-high)',
};

export const LEVEL_TEXT_CLASS: Record<RiskLevel, string> = {
  NORMAL: 'text-risk-normal',
  ELEVATED: 'text-risk-elevated',
  SUSPICIOUS: 'text-risk-suspicious',
  HIGH_RISK: 'text-risk-high',
};

export const LEVEL_SOFT_CLASS: Record<RiskLevel, string> = {
  NORMAL: 'bg-risk-normal/12 text-risk-normal ring-risk-normal/25',
  ELEVATED: 'bg-risk-elevated/14 text-risk-elevated ring-risk-elevated/30',
  SUSPICIOUS: 'bg-risk-suspicious/14 text-risk-suspicious ring-risk-suspicious/30',
  HIGH_RISK: 'bg-risk-high/14 text-risk-high ring-risk-high/30',
};
