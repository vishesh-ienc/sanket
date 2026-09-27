/**
 * Sanket — Baseline Deviation Calculator (Phase 6)
 *
 * Transforms a FeatureSet into a set of Z-score-based deviation signals
 * relative to a personal BaselineProfile.
 *
 * ═══════════════════════════════════════════════════════════
 * IMPORTANT DISCLAIMER
 * ═══════════════════════════════════════════════════════════
 * Z-scores measure acoustic deviation from the user's calibrated normal.
 * They do NOT constitute medical diagnosis or clinical distress assessment.
 * High deviation scores indicate statistical departure from baseline only.
 * Context and multi-signal co-occurrence are required before raising risk.
 * ═══════════════════════════════════════════════════════════
 *
 * Z-score = (observed − mean) / stdDev
 *   - |Z| < 1.0 → within normal range (68% of normal distribution)
 *   - |Z| ≥ 2.0 → meaningfully unusual (outside ~95% of normal)
 *   - |Z| ≥ 3.0 → strongly deviant (outside ~99.7% of normal)
 *
 * When stdDev is near-zero (highly consistent speaker), we fall back to
 * a small floor (STDDEV_FLOOR) to prevent division-by-zero and unrealistic
 * Z-score inflation.
 *
 * No React, DOM, or browser globals.
 */

import type { FeatureSet, BaselineProfile } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimum standard deviation floor applied before computing Z-scores.
 * Prevents division-by-zero and excessive sensitivity for very consistent
 * speakers. Expressed in each channel's native units.
 */
const PITCH_STDDEV_FLOOR = 8;      // Hz — minimum expected pitch variability
const ENERGY_STDDEV_FLOOR = 0.005; // RMS amplitude — minimum expected RMS variability
const ZCR_STDDEV_FLOOR = 0.02;     // ZCR fraction
const SPECTRAL_STDDEV_FLOOR = 150; // Hz — minimum expected spectral centroid variability

/**
 * Maximum absolute Z-score used for clamping before converting to a risk contribution.
 * Prevents extreme outliers from fully saturating the score.
 */
const Z_SCORE_CAP = 4.0;

// ─────────────────────────────────────────────────────────────────────────────
// Output Type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-channel deviation signals computed relative to a personal baseline.
 * All Z-scores are absolute values (sign dropped): only magnitude matters here.
 * The RiskEngine uses these to replace or augment its prototype heuristics.
 */
export interface BaselineDeviationResult {
  /**
   * |Z-score| for pitch deviation. null when no pitch estimate was available
   * this frame or when baseline had no voiced pitch samples.
   */
  pitchZScore: number | null;

  /**
   * |Z-score| for vocal intensity (RMS) deviation.
   * Only computed on voiced frames (isSpeech=true).
   */
  energyZScore: number | null;

  /**
   * Silence onset relative to personal normal silence duration.
   * Expressed as a ratio: silenceDurationSec / normalSilenceThresholdSec.
   * > 1.0 means silence is longer than the user's normal threshold.
   * Null when normalSilenceThresholdSec is 0.
   */
  silenceExcessRatio: number | null;

  /**
   * |Z-score| for ZCR deviation on voiced frames.
   * High ZCR deviation indicates breathiness or vocal strain change.
   */
  zcrZScore: number | null;

  /**
   * |Z-score| for spectral centroid deviation on voiced frames.
   */
  spectralZScore: number | null;

  /**
   * Whether a personal baseline was available for this calculation.
   * When false, all scores are null and the risk engine should use
   * its prototype heuristics instead.
   */
  baselineAvailable: true;
}

export interface NoBaselineResult {
  baselineAvailable: false;
}

export type BaselineDeviationOutput = BaselineDeviationResult | NoBaselineResult;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a Z-score for a single sample against (mean, stdDev).
 * Applies a minimum stdDev floor to prevent division-by-zero.
 * Returns the absolute value, clamped to Z_SCORE_CAP.
 */
function zScore(sample: number, mean: number, stdDev: number, floor: number): number {
  const effectiveStdDev = Math.max(stdDev, floor);
  const raw = Math.abs(sample - mean) / effectiveStdDev;
  return Math.min(raw, Z_SCORE_CAP);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes baseline deviation signals for a single FeatureSet frame.
 *
 * @param features   Current acoustic feature frame from FeatureExtractor.
 * @param baseline   Personal voice baseline from a completed calibration session.
 *                   Pass null/undefined when no baseline exists — returns NoBaselineResult.
 * @returns          Per-channel Z-score deviations, or NoBaselineResult if uncalibrated.
 */
export function calculateBaselineDeviation(
  features: FeatureSet,
  baseline: BaselineProfile | null | undefined
): BaselineDeviationOutput {
  if (!baseline) {
    return { baselineAvailable: false };
  }

  // ── A. Pitch deviation ────────────────────────────────────────────────────
  let pitchZScore: number | null = null;
  if (features.pitchHz !== null && baseline.pitchStdDev !== undefined) {
    pitchZScore = zScore(features.pitchHz, baseline.pitchMean, baseline.pitchStdDev, PITCH_STDDEV_FLOOR);
  }

  // ── B. Vocal intensity (RMS) deviation ────────────────────────────────────
  let energyZScore: number | null = null;
  if (features.isSpeech) {
    energyZScore = zScore(
      features.rmsEnergy,
      baseline.energyMean,
      baseline.energyStdDev,
      ENERGY_STDDEV_FLOOR
    );
  }

  // ── C. Silence excess ratio ───────────────────────────────────────────────
  let silenceExcessRatio: number | null = null;
  if (!features.isSpeech && baseline.normalSilenceThresholdSec > 0) {
    silenceExcessRatio = features.silenceDurationSec / baseline.normalSilenceThresholdSec;
  }

  // ── D. ZCR deviation ─────────────────────────────────────────────────────
  let zcrZScore: number | null = null;
  if (features.isSpeech && baseline.zcrMean !== undefined) {
    zcrZScore = zScore(
      features.zeroCrossingRate,
      baseline.zcrMean,
      baseline.zcrStdDev ?? 0,
      ZCR_STDDEV_FLOOR
    );
  }

  // ── E. Spectral centroid deviation ────────────────────────────────────────
  let spectralZScore: number | null = null;
  if (features.isSpeech && features.spectralCentroid !== null && baseline.spectralMean !== undefined) {
    spectralZScore = zScore(
      features.spectralCentroid,
      baseline.spectralMean,
      baseline.spectralStdDev ?? 0,
      SPECTRAL_STDDEV_FLOOR
    );
  }

  return {
    baselineAvailable: true,
    pitchZScore,
    energyZScore,
    silenceExcessRatio,
    zcrZScore,
    spectralZScore,
  };
}

/**
 * Converts baseline deviation Z-scores into RiskEngine-compatible
 * config overrides (pitchBaselineRef, rmsBaselineRef, silenceOnsetSec).
 *
 * When a personal baseline exists, the risk engine prototype heuristics
 * (hardcoded population references) are replaced with personal measurements.
 * This produces significantly more accurate per-user sensitivity.
 *
 * Only non-zero fields are included in the returned partial config.
 */
export function baselineToRiskEngineConfig(
  baseline: BaselineProfile
): {
  pitchBaselineRef: number;
  rmsBaselineRef: number;
  silenceOnsetSec: number;
} {
  return {
    pitchBaselineRef: baseline.pitchMean,
    rmsBaselineRef: baseline.energyMean,
    // Personal silence onset: use their mean + 1 stdDev of silence, minimum 1s
    silenceOnsetSec: Math.max(baseline.normalSilenceThresholdSec * 1.5, 1.0),
  };
}

// Export Z_SCORE_CAP for tests
export { Z_SCORE_CAP, PITCH_STDDEV_FLOOR, ENERGY_STDDEV_FLOOR };
