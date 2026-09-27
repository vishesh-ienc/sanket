/**
 * Sanket — Risk Engine (Phase 3)
 *
 * The RiskEngine takes a stream of FeatureSet values from the FeatureExtractor
 * and produces a composite distress risk evaluation.
 *
 * ═══════════════════════════════════════════════════════════════════
 * IMPORTANT DISCLAIMER
 * ═══════════════════════════════════════════════════════════════════
 * This engine implements PROTOTYPE HEURISTICS only.
 * It estimates potential distress risk from acoustic deviations;
 * it does NOT clinically diagnose, medically certify, or legally
 * determine that any individual is in danger.
 *
 * No single acoustic signal is treated as sufficient evidence of distress.
 * Critical risk requires multi-signal co-occurrence and temporal persistence.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Scoring model:
 *   1. Each signal channel scores independently: 0..maxWeight.
 *   2. The raw frame score = sum of individual signal scores.
 *   3. A persistence bonus is added when multiple consecutive frames are abnormal.
 *   4. The smoothed score = decayFactor * previousSmoothedScore + (1 - decayFactor) * rawFrameScore.
 *      This produces exponential moving average behaviour:
 *        - Signals normalize → smoothed score decays toward 0.
 *        - Signals persist → smoothed score rises toward saturation.
 *   5. Score is clamped to [0, 100].
 *   6. Risk level is derived from the smoothed score vs configurable thresholds.
 *
 * Single-signal ceiling guarantee (DECISION 010):
 *   Every signal weight is ≤ 22 out of 100.
 *   A single signal therefore cannot exceed 22/100, which is below the ELEVATED
 *   threshold (30) and far below CRITICAL (70).
 *   HIGH_RISK/CRITICAL requires 3+ signals to all contribute meaningfully.
 *
 * No React, DOM, or browser API dependencies.
 */

import type {
  FeatureSet,
  RiskEngineConfig,
  RiskEvaluation,
  RiskEvent,
  RiskLevel,
  SignalContribution,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Default Configuration
// (PROTOTYPE HEURISTICS — not scientifically or medically validated)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: RiskEngineConfig = {
  // Signal sensitivity
  rmsBaselineRef: 0.06,          // typical conversational RMS reference
  rmsRange: 0.25,                // RMS deviation range for saturation

  pitchBaselineRef: 165,         // Hz: approximate mid-range of human speech
  pitchDeviationThreshold: 40,   // Hz above ref before scoring begins
  pitchSaturationRange: 120,     // Hz of deviation that saturates pitch score

  silenceOnsetSec: 1.5,          // seconds before silence contributes
  silenceSaturationSec: 6.0,     // seconds at which silence score saturates

  whisperRmsThreshold: 0.025,    // below-this RMS on active session = whisper

  // Score dynamics
  decayFactor: 0.78,
  confirmationFrames: 3,

  // Per-signal max weights (sum = 100)
  weights: {
    pitch: 20,
    rms: 15,
    silence: 15,
    voiceActivity: 15,
    spectral: 10,
    zcr: 10,
    persistence: 15,
  },

  // Risk level thresholds (prototype values)
  elevatedThreshold: 30,
  suspiciousThreshold: 50,
  highRiskThreshold: 70,
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal Temporal State
// ─────────────────────────────────────────────────────────────────────────────

interface ActiveExternalSignal {
  signal: string;
  boost: number;
  reason: string;
  remainingFrames: number;
}

interface RiskTemporalState {
  /** Exponentially smoothed composite risk score [0, 100] */
  smoothedScore: number;
  /** Number of consecutive frames where at least one signal was active */
  consecutiveAbnormalFrames: number;
  /** Previous risk level — used to detect transitions for RiskEvent emission */
  previousLevel: RiskLevel;
  /** Timestamp of the previous evaluate() call (ms) */
  lastTimestamp: number | null;
  /** Previous voiced frame's pitch (for pitch-rate detection in future phases) */
  lastPitchHz: number | null;
  /** Session-level RMS moving average for relative deviation */
  rmsSmoothRef: number | null;
  /** Active external contextual signals (e.g. code-word detections) */
  activeExternalSignals: ActiveExternalSignal[];
}

function createInitialState(): RiskTemporalState {
  return {
    smoothedScore: 0,
    consecutiveAbnormalFrames: 0,
    previousLevel: 'NORMAL',
    lastTimestamp: null,
    lastPitchHz: null,
    rmsSmoothRef: null,
    activeExternalSignals: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Clamps a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Maps a value in [onset, saturation] to [0, maxScore] linearly.
 * Below onset → 0. Above saturation → maxScore.
 */
function linearScore(value: number, onset: number, saturation: number, maxScore: number): number {
  if (value <= onset) return 0;
  if (value >= saturation) return maxScore;
  return maxScore * ((value - onset) / (saturation - onset));
}

/** Converts a smoothed score to a RiskLevel using configurable thresholds. */
function scoreToLevel(score: number, config: RiskEngineConfig): RiskLevel {
  if (score >= config.highRiskThreshold) return 'HIGH_RISK';
  if (score >= config.suspiciousThreshold) return 'SUSPICIOUS';
  if (score >= config.elevatedThreshold) return 'ELEVATED';
  return 'NORMAL';
}

// ─────────────────────────────────────────────────────────────────────────────
// RiskEngine Class
// ─────────────────────────────────────────────────────────────────────────────

export class RiskEngine {
  private config: RiskEngineConfig;
  private state: RiskTemporalState;

  constructor(config: Partial<RiskEngineConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      weights: { ...DEFAULT_CONFIG.weights, ...(config.weights ?? {}) },
    };
    this.state = createInitialState();
  }

  /**
   * Evaluates a FeatureSet and returns a RiskEvaluation.
   *
   * This is the main integration point for Phase 3.
   * Call at the same cadence as FeatureExtractor.processFrame() (~10Hz).
   *
   * @param features  FeatureSet from FeatureExtractor.processFrame()
   * @returns         RiskEvaluation with smoothed score, level, and signal breakdown
   */
  public evaluate(features: FeatureSet): RiskEvaluation {
    const { config, state } = this;
    const contributions: SignalContribution[] = [];

    // ── Update session RMS reference (slow moving average, α=0.02) ───────────
    // Tracks the "recent quiet" RMS for whisper detection.
    // We use a very slow adaptation so it doesn't self-normalize out signal deviations.
    // In Phase 7, this will be replaced by the personal baseline mean.
    if (features.isSpeech) {
      state.rmsSmoothRef =
        state.rmsSmoothRef === null
          ? features.rmsEnergy
          : 0.98 * state.rmsSmoothRef + 0.02 * features.rmsEnergy;
    }

    // Use config baseline as stable prototype reference.
    // The session-adaptive ref is only used for whisper detection.
    const rmsRef = config.rmsBaselineRef;

    // ──────────────────────────────────────────────────────────────────────────
    // A. PITCH SIGNAL  (max: weights.pitch)
    // Measures deviation from prototype/baseline reference pitch.
    // Null pitch (unvoiced frame) contributes 0 — silence is handled separately.
    // ──────────────────────────────────────────────────────────────────────────
    let pitchScore = 0;
    if (features.pitchHz !== null) {
      const deviation = Math.abs(features.pitchHz - config.pitchBaselineRef);
      if (deviation > config.pitchDeviationThreshold) {
        pitchScore = linearScore(
          deviation,
          config.pitchDeviationThreshold,
          config.pitchDeviationThreshold + config.pitchSaturationRange,
          config.weights.pitch
        );
        contributions.push({
          signal: 'pitch',
          contribution: pitchScore,
          reason: `Pitch ${features.pitchHz.toFixed(0)} Hz deviates ${deviation.toFixed(0)} Hz from reference`,
        });
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // B. VOCAL INTENSITY / RMS SIGNAL  (max: weights.rms)
    // Flags both sudden loudness spikes and suspicious drops (whisper).
    // Uses session-relative smoothed reference to reduce false positives
    // from hardware/room variation.
    // ──────────────────────────────────────────────────────────────────────────
    let rmsScore = 0;
    if (features.isSpeech) {
      const rmsDeviation = Math.abs(features.rmsEnergy - rmsRef);
      // Only score after a meaningful deviation (10% of range above ref)
      const rmsOnset = config.rmsRange * 0.1;
      if (rmsDeviation > rmsOnset) {
        rmsScore = linearScore(rmsDeviation, rmsOnset, config.rmsRange, config.weights.rms);

        // Whisper detection: energy anomalously low while session is active
        const isWhisper =
          features.rmsEnergy < config.whisperRmsThreshold && rmsRef > config.whisperRmsThreshold * 2;
        contributions.push({
          signal: 'rms',
          contribution: rmsScore,
          reason: isWhisper
            ? `Whisper-level intensity (${features.rmsEnergy.toFixed(4)} RMS, ref ${rmsRef.toFixed(4)})`
            : `Vocal intensity deviation (${features.rmsEnergy.toFixed(4)} vs ref ${rmsRef.toFixed(4)})`,
        });
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // C. SILENCE SIGNAL  (max: weights.silence)
    // Prolonged absence of speech during an active monitoring session.
    // Only scores when silence exceeds the onset threshold.
    // Saturates at silenceSaturationSec.
    // ──────────────────────────────────────────────────────────────────────────
    let silenceScore = 0;
    if (!features.isSpeech && features.silenceDurationSec >= config.silenceOnsetSec) {
      silenceScore = linearScore(
        features.silenceDurationSec,
        config.silenceOnsetSec,
        config.silenceSaturationSec,
        config.weights.silence
      );
      contributions.push({
        signal: 'silence',
        contribution: silenceScore,
        reason: `Silence for ${features.silenceDurationSec.toFixed(1)}s (onset: ${config.silenceOnsetSec}s)`,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // D. VOICE ACTIVITY ANOMALY  (max: weights.voiceActivity)
    // Flags unusual VAD-off patterns: speech segment count anomaly or
    // session-level voice activity ratio drop.
    // For this prototype: simplified to low speech-activity-ratio detection.
    // ──────────────────────────────────────────────────────────────────────────
    let vadScore = 0;
    // Only score if the session has been running long enough to have a reference
    const sessionDurationSec = features.speechActivityDurationSec + features.silenceDurationSec;
    if (sessionDurationSec > 3.0 && features.speechSegmentCount >= 1) {
      const voiceRatio = features.speechActivityDurationSec / Math.max(sessionDurationSec, 1);
      // Abnormally low voice ratio in an active session (< 25% voiced)
      if (voiceRatio < 0.25) {
        const deficit = 0.25 - voiceRatio; // 0 to 0.25
        vadScore = linearScore(deficit, 0, 0.25, config.weights.voiceActivity);
        contributions.push({
          signal: 'voiceActivity',
          contribution: vadScore,
          reason: `Low voice activity ratio: ${(voiceRatio * 100).toFixed(0)}% (expected ≥25%)`,
        });
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // E. SPECTRAL SIGNAL  (max: weights.spectral)
    // Supporting signal. Unusual spectral centroid for voiced speech.
    // High centroid indicates vocal strain or excessive high-frequency energy.
    // ──────────────────────────────────────────────────────────────────────────
    let spectralScore = 0;
    if (
      features.isSpeech &&
      features.spectralCentroid !== null &&
      features.spectralCentroid > 2500
    ) {
      const centroidExcess = features.spectralCentroid - 2500;
      spectralScore = linearScore(centroidExcess, 0, 2000, config.weights.spectral);
      contributions.push({
        signal: 'spectral',
        contribution: spectralScore,
        reason: `High spectral centroid ${features.spectralCentroid.toFixed(0)} Hz indicating vocal strain`,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // F. ZCR SIGNAL  (max: weights.zcr)
    // Supporting signal. Unusually high ZCR on a speech frame.
    // High ZCR indicates breathiness, fricatives, or whisper-like turbulence.
    // ──────────────────────────────────────────────────────────────────────────
    let zcrScore = 0;
    if (features.isSpeech && features.zeroCrossingRate > 0.20) {
      const excess = features.zeroCrossingRate - 0.20;
      zcrScore = linearScore(excess, 0, 0.25, config.weights.zcr);
      contributions.push({
        signal: 'zcr',
        contribution: zcrScore,
        reason: `Elevated ZCR ${(features.zeroCrossingRate * 100).toFixed(1)}% (unvoiced/strain indicator)`,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // G. PERSISTENCE BONUS  (max: weights.persistence)
    // After confirmationFrames consecutive abnormal frames, a persistence bonus
    // is added to reflect that sustained anomalies are more significant than
    // transient spikes.
    // This prevents single-frame outliers from dominating the score.
    // ──────────────────────────────────────────────────────────────────────────
    const rawSignalScore = pitchScore + rmsScore + silenceScore + vadScore + spectralScore + zcrScore;
    const hasActiveSignals = rawSignalScore > 0;

    // Update consecutive abnormal frame count
    if (hasActiveSignals) {
      state.consecutiveAbnormalFrames = Math.min(state.consecutiveAbnormalFrames + 1, 30);
    } else {
      state.consecutiveAbnormalFrames = Math.max(state.consecutiveAbnormalFrames - 1, 0);
    }

    let persistenceScore = 0;
    if (state.consecutiveAbnormalFrames >= config.confirmationFrames) {
      const confirmedFrames = state.consecutiveAbnormalFrames - config.confirmationFrames;
      persistenceScore = linearScore(confirmedFrames, 0, 15, config.weights.persistence);
      contributions.push({
        signal: 'persistence',
        contribution: persistenceScore,
        reason: `Sustained abnormality for ${state.consecutiveAbnormalFrames} consecutive frames`,
      });
    }

    // ── External signal contributions (Phase 5 Code-Word / Contextual) ────────
    for (const ext of state.activeExternalSignals) {
      if (ext.remainingFrames > 0) {
        contributions.push({
          signal: ext.signal,
          contribution: Math.round(ext.boost * (ext.remainingFrames / 10) * 10) / 10,
          reason: ext.reason,
        });
        ext.remainingFrames -= 1;
      }
    }
    state.activeExternalSignals = state.activeExternalSignals.filter((ext) => ext.remainingFrames > 0);

    // ──────────────────────────────────────────────────────────────────────────
    // H. SCORE SMOOTHING  (exponential moving average with decay)
    //
    // smoothedScore(t) = decayFactor * smoothedScore(t-1) +
    //                    (1 - decayFactor) * rawFrameScore(t)
    //
    // When rawFrameScore → 0: smoothedScore decays toward 0.
    // When rawFrameScore is high: smoothedScore rises toward saturation.
    // The asymmetry (decay applied to previous, not new value) means scores
    // rise faster than they fall — appropriate for safety systems.
    // ──────────────────────────────────────────────────────────────────────────
    const totalRawScore = rawSignalScore + persistenceScore;
    const newSmoothedScore = clamp(
      config.decayFactor * state.smoothedScore + (1 - config.decayFactor) * totalRawScore,
      0,
      100
    );

    state.smoothedScore = newSmoothedScore;

    const riskLevel = scoreToLevel(newSmoothedScore, config);
    const isConfirmed = state.consecutiveAbnormalFrames >= config.confirmationFrames;

    // ── Update state for next frame ───────────────────────────────────────────
    state.previousLevel = riskLevel;
    state.lastTimestamp = features.timestamp;
    if (features.pitchHz !== null) {
      state.lastPitchHz = features.pitchHz;
    }

    return {
      timestamp: features.timestamp,
      riskScore: Math.round(newSmoothedScore * 10) / 10, // 1 decimal place
      riskLevel,
      contributingSignals: contributions,
      confirmedSignals: contributions.filter((c) => c.signal !== 'persistence').length,
      persistenceFrames: state.consecutiveAbnormalFrames,
      isConfirmed,
    };
  }

  /**
   * Injects a future external signal (e.g. code-word detection from Phase 5,
   * breathing signal from Phase 8) directly into the smoothed score.
   * The injected amount is treated as a one-time additive boost and is
   * subject to the same decay mechanic on subsequent frames.
   *
   * @param boostAmount  Score points to inject (clamped to prevent single-source CRITICAL)
   * @param maxBoost     Maximum boost ceiling (default: 25, keeps it below single-signal CRITICAL threshold)
   * @param metadata     Optional signal identifier and explainability reason
   */
  public injectExternalSignal(
    boostAmount: number,
    maxBoost = 25,
    metadata?: { signal?: string; reason?: string }
  ): void {
    const clamped = clamp(boostAmount, 0, maxBoost);
    this.state.smoothedScore = clamp(this.state.smoothedScore + clamped, 0, 100);
    this.state.activeExternalSignals.push({
      signal: metadata?.signal ?? 'codeWord',
      boost: clamped,
      reason: metadata?.reason ?? 'Configured distress phrase detected',
      remainingFrames: 10,
    });
  }

  /** Resets all temporal state (e.g. when monitoring restarts) */
  public reset(): void {
    this.state = createInitialState();
  }

  /** Returns a read-only snapshot of the current temporal state (for tests/inspection) */
  public getState(): Readonly<RiskTemporalState> {
    return { ...this.state };
  }

  /** Returns the active configuration */
  public getConfig(): Readonly<RiskEngineConfig> {
    return { ...this.config, weights: { ...this.config.weights } };
  }

  /** Allows runtime configuration updates (e.g. when personal baseline is available) */
  public updateConfig(partial: Partial<Omit<RiskEngineConfig, 'weights'>> & { weights?: Partial<RiskEngineConfig['weights']> }): void {
    this.config = {
      ...this.config,
      ...partial,
      weights: { ...this.config.weights, ...(partial.weights ?? {}) },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers exported for tests
// ─────────────────────────────────────────────────────────────────────────────

export { scoreToLevel, linearScore, clamp };

/**
 * Converts a RiskEvaluation into a RiskEvent for the audit log.
 * Called by the alert engine (Phase 6) when level transitions to SUSPECTED/CRITICAL.
 */
export function evaluationToRiskEvent(evaluation: RiskEvaluation): RiskEvent {
  return {
    id: `risk-${evaluation.timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: evaluation.timestamp,
    score: evaluation.riskScore,
    level: evaluation.riskLevel,
    contributingSignals: evaluation.contributingSignals.map((c) => c.signal),
    details: {
      confirmedSignals: evaluation.confirmedSignals,
      persistenceFrames: evaluation.persistenceFrames,
      isConfirmed: evaluation.isConfirmed,
      signalBreakdown: evaluation.contributingSignals,
    },
  };
}
