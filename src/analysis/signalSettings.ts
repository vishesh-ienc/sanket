/**
 * Sanket, Customisable Signal Settings
 *
 * User-facing model for tuning which acoustic signals the RiskEngine uses and
 * how much each one matters. Maps onto `RiskEngine.updateConfig()` without
 * touching baseline-derived references (pitch/RMS/silence refs belong to the
 * personal calibration).
 *
 * Safety invariant (DECISION 011, single-signal ceiling): every per-signal
 * weight is clamped to MAX_SIGNAL_WEIGHT and the alert threshold to at least
 * MIN_ALERT_THRESHOLD, so one signal plus the persistence bonus can never
 * reach HIGH_RISK on its own:
 *     MAX_SIGNAL_WEIGHT + persistence(15) = 50 < MIN_ALERT_THRESHOLD (60)
 */

import type { RiskEngineConfig } from './types';

export type SignalId = 'pitch' | 'rms' | 'silence' | 'voiceActivity' | 'spectral' | 'zcr';

export interface SignalSetting {
  enabled: boolean;
  weight: number;
}

export interface SignalSettings {
  signals: Record<SignalId, SignalSetting>;
  /** Hz above the pitch reference before pitch starts to score */
  pitchDeviationThreshold: number;
  /** Composite score at which a confirmed event becomes HIGH_RISK */
  alertThreshold: number;
  /** Points a detected code word contributes as sustained context */
  codeWordBoost: number;
}

export const SIGNAL_IDS: SignalId[] = ['pitch', 'rms', 'silence', 'voiceActivity', 'spectral', 'zcr'];

export const MAX_SIGNAL_WEIGHT = 35;
export const PERSISTENCE_WEIGHT = 15;
export const MIN_ALERT_THRESHOLD = 60;
export const MAX_ALERT_THRESHOLD = 90;
export const MAX_CODE_WORD_BOOST = 35;

export const DEFAULT_SIGNAL_SETTINGS: SignalSettings = {
  signals: {
    pitch: { enabled: true, weight: 20 },
    rms: { enabled: true, weight: 15 },
    silence: { enabled: true, weight: 15 },
    voiceActivity: { enabled: true, weight: 15 },
    spectral: { enabled: true, weight: 10 },
    zcr: { enabled: true, weight: 10 },
  },
  pitchDeviationThreshold: 40,
  alertThreshold: 70,
  codeWordBoost: 25,
};

export const SIGNAL_SETTINGS_STORAGE_KEY = 'sanket_signal_settings_v1';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Coerces any (possibly stale or hand-edited) object into valid settings */
export function sanitizeSignalSettings(input: unknown): SignalSettings {
  const src = (input && typeof input === 'object' ? input : {}) as Partial<SignalSettings>;
  const signals = {} as Record<SignalId, SignalSetting>;
  for (const id of SIGNAL_IDS) {
    const s = (src.signals?.[id] ?? {}) as Partial<SignalSetting>;
    const def = DEFAULT_SIGNAL_SETTINGS.signals[id];
    signals[id] = {
      enabled: typeof s.enabled === 'boolean' ? s.enabled : def.enabled,
      weight: clamp(Math.round(num(s.weight, def.weight)), 0, MAX_SIGNAL_WEIGHT),
    };
  }
  return {
    signals,
    pitchDeviationThreshold: clamp(Math.round(num(src.pitchDeviationThreshold, 40)), 10, 120),
    alertThreshold: clamp(Math.round(num(src.alertThreshold, 70)), MIN_ALERT_THRESHOLD, MAX_ALERT_THRESHOLD),
    codeWordBoost: clamp(Math.round(num(src.codeWordBoost, 25)), 0, MAX_CODE_WORD_BOOST),
  };
}

/** RiskEngine overrides for these settings (weights, pitch sensitivity, alert threshold) */
export function toRiskEngineOverrides(
  settings: SignalSettings,
): Partial<Omit<RiskEngineConfig, 'weights'>> & { weights: Partial<RiskEngineConfig['weights']> } {
  const s = sanitizeSignalSettings(settings);
  const weights: Partial<RiskEngineConfig['weights']> = { persistence: PERSISTENCE_WEIGHT };
  for (const id of SIGNAL_IDS) {
    weights[id] = s.signals[id].enabled ? s.signals[id].weight : 0;
  }
  const high = s.alertThreshold;
  return {
    weights,
    pitchDeviationThreshold: s.pitchDeviationThreshold,
    highRiskThreshold: high,
    // Keep level bands ordered below the alert threshold
    suspiciousThreshold: Math.min(50, high - 10),
    elevatedThreshold: Math.min(30, high - 30),
  };
}

/** Largest score a single enabled signal (+ persistence) can reach */
export function singleSignalCeiling(settings: SignalSettings): number {
  const s = sanitizeSignalSettings(settings);
  const maxWeight = Math.max(0, ...SIGNAL_IDS.map((id) => (s.signals[id].enabled ? s.signals[id].weight : 0)));
  return Math.max(maxWeight, s.codeWordBoost) + PERSISTENCE_WEIGHT;
}

export function enabledSignalCount(settings: SignalSettings): number {
  return SIGNAL_IDS.filter((id) => settings.signals[id].enabled && settings.signals[id].weight > 0).length;
}

interface SimpleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): SimpleStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadSignalSettings(storage: SimpleStorage | null = defaultStorage()): SignalSettings {
  if (!storage) return sanitizeSignalSettings(DEFAULT_SIGNAL_SETTINGS);
  try {
    const raw = storage.getItem(SIGNAL_SETTINGS_STORAGE_KEY);
    return sanitizeSignalSettings(raw ? JSON.parse(raw) : DEFAULT_SIGNAL_SETTINGS);
  } catch {
    return sanitizeSignalSettings(DEFAULT_SIGNAL_SETTINGS);
  }
}

export function saveSignalSettings(settings: SignalSettings, storage: SimpleStorage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SIGNAL_SETTINGS_STORAGE_KEY, JSON.stringify(sanitizeSignalSettings(settings)));
    return true;
  } catch {
    return false;
  }
}
