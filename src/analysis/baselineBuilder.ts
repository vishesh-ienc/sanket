/**
 * Sanket — BaselineBuilder (Phase 6)
 *
 * Builds a personal voice BaselineProfile from a stream of FeatureSet
 * values during a calibration session using Welford's Online Algorithm.
 *
 * ═══════════════════════════════════════════════════════════
 * PRIVACY CONTRACT
 * ═══════════════════════════════════════════════════════════
 * - Zero raw audio storage. Only running statistics (count, mean, M2)
 *   are ever retained. No audio samples, no transcripts, no PCM buffers.
 * - The baseline is an ACOUSTIC BEHAVIOR baseline — NOT a medical,
 *   psychological, or emotional baseline. It describes the user's typical
 *   voice characteristics during normal conversational speech.
 * ═══════════════════════════════════════════════════════════
 *
 * Welford's Online Algorithm (stable, single-pass, O(1) per sample):
 *   - Accumulates (count, mean, M2) per feature channel.
 *   - stdDev = sqrt(M2 / (count - 1))  [sample standard deviation]
 *   - Avoids numerical catastrophic cancellation present in naive
 *     (sum of squares − square of sum) approach.
 *
 * No React, DOM, or browser globals.
 */

import type { FeatureSet, BaselineProfile } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Welford State per feature channel
// ─────────────────────────────────────────────────────────────────────────────

interface WelfordState {
  count: number;
  mean: number;
  /** M2 = sum of squared deviations from mean (Welford's accumulator) */
  m2: number;
}

function createWelfordState(): WelfordState {
  return { count: 0, mean: 0, m2: 0 };
}

/**
 * Adds one sample to a Welford accumulator.
 * Returns a new state object (immutable-friendly).
 */
function welfordUpdate(state: WelfordState, sample: number): WelfordState {
  const count = state.count + 1;
  const delta = sample - state.mean;
  const mean = state.mean + delta / count;
  const delta2 = sample - mean;
  const m2 = state.m2 + delta * delta2;
  return { count, mean, m2 };
}

/**
 * Extracts sample standard deviation from a Welford state.
 * Returns 0 when count < 2 (can't compute variance with fewer than 2 samples).
 */
function welfordStdDev(state: WelfordState): number {
  if (state.count < 2) return 0;
  return Math.sqrt(state.m2 / (state.count - 1));
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface BaselineBuilderConfig {
  /**
   * Minimum number of voiced frames required before a profile can be finalized.
   * Below this count, the profile is considered unreliable.
   * Default: 30 (≈3 seconds at 10Hz)
   */
  minVoicedFrames: number;

  /**
   * Maximum silence accumulation per voiced speech segment to qualify as
   * normal conversational silence (seconds). Frames where silence exceeds
   * this are included in the silence-duration distribution.
   * Default: 4.0s
   */
  maxSilenceCapSec: number;

  /**
   * Only accept pitch samples when estimated pitch is within a plausible
   * human voice range. Samples outside this range are discarded.
   * Default: [50, 600] Hz
   */
  pitchRangeHz: [number, number];
}

const DEFAULT_BUILDER_CONFIG: BaselineBuilderConfig = {
  minVoicedFrames: 30,
  maxSilenceCapSec: 4.0,
  pitchRangeHz: [50, 600],
};

// ─────────────────────────────────────────────────────────────────────────────
// BaselineBuilder Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accumulates acoustic statistics during a calibration session and
 * produces a BaselineProfile when sufficient data has been collected.
 *
 * Typical usage:
 *   const builder = new BaselineBuilder();
 *   builder.start();
 *   // ... call builder.addFrame(featureSet) for each 10Hz frame ...
 *   const profile = builder.finalize('user-01');
 *
 * Reset between sessions:
 *   builder.reset();
 */
export class BaselineBuilder {
  private config: BaselineBuilderConfig;

  // Welford states for each tracked feature channel
  private pitchState: WelfordState;
  private energyState: WelfordState;
  private silenceState: WelfordState;
  private zcrState: WelfordState;
  private spectralState: WelfordState;

  // Frame counters
  private totalFrames: number;
  private voicedFrames: number;

  /** Whether a calibration session is currently active */
  private active: boolean;

  constructor(config: Partial<BaselineBuilderConfig> = {}) {
    this.config = { ...DEFAULT_BUILDER_CONFIG, ...config };
    this.pitchState = createWelfordState();
    this.energyState = createWelfordState();
    this.silenceState = createWelfordState();
    this.zcrState = createWelfordState();
    this.spectralState = createWelfordState();
    this.totalFrames = 0;
    this.voicedFrames = 0;
    this.active = false;
  }

  /** Starts a new calibration session. Resets all accumulated state. */
  public start(): void {
    this.reset();
    this.active = true;
  }

  /** Stops accumulation. Call finalize() to extract the profile. */
  public stop(): void {
    this.active = false;
  }

  /**
   * Feeds one FeatureSet frame into the accumulator.
   * Silently ignores frames if not active.
   */
  public addFrame(features: FeatureSet): void {
    if (!this.active) return;

    this.totalFrames += 1;

    // ── A. Vocal Intensity (RMS) — all frames with VAD=true ─────────────────
    if (features.isSpeech) {
      this.voicedFrames += 1;
      this.energyState = welfordUpdate(this.energyState, features.rmsEnergy);
      this.zcrState = welfordUpdate(this.zcrState, features.zeroCrossingRate);

      // ── B. Pitch — only voiced frames with a valid estimate ───────────────
      if (
        features.pitchHz !== null &&
        features.pitchHz >= this.config.pitchRangeHz[0] &&
        features.pitchHz <= this.config.pitchRangeHz[1]
      ) {
        this.pitchState = welfordUpdate(this.pitchState, features.pitchHz);
      }

      // ── C. Spectral Centroid — only voiced frames with valid centroid ─────
      if (features.spectralCentroid !== null) {
        this.spectralState = welfordUpdate(this.spectralState, features.spectralCentroid);
      }
    } else {
      // ── D. Silence — only silent frames within cap ────────────────────────
      const cappedSilence = Math.min(features.silenceDurationSec, this.config.maxSilenceCapSec);
      if (cappedSilence > 0) {
        this.silenceState = welfordUpdate(this.silenceState, cappedSilence);
      }
    }
  }

  /**
   * Returns whether enough voiced frames have been collected to produce
   * a reliable baseline profile.
   */
  public isReady(): boolean {
    return this.voicedFrames >= this.config.minVoicedFrames;
  }

  /**
   * Returns the current voiced frame count. Used for progress indicators.
   */
  public getVoicedFrameCount(): number {
    return this.voicedFrames;
  }

  /**
   * Returns the minimum voiced frames required (for progress indicators).
   */
  public getMinVoicedFrames(): number {
    return this.config.minVoicedFrames;
  }

  /**
   * Returns progress as a 0.0–1.0 ratio (clamped).
   */
  public getProgress(): number {
    return Math.min(this.voicedFrames / this.config.minVoicedFrames, 1.0);
  }

  /**
   * Returns whether a calibration session is currently running.
   */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * Finalizes the calibration session and produces a BaselineProfile.
   *
   * @param userId   Opaque user identifier (never audio data; could be 'default').
   * @throws         If isReady() returns false (not enough voiced data).
   */
  public finalize(userId: string): BaselineProfile {
    if (!this.isReady()) {
      throw new Error(
        `Baseline not ready: only ${this.voicedFrames} voiced frames collected, ` +
          `need at least ${this.config.minVoicedFrames}.`
      );
    }

    // Compute final statistics
    const pitchMean = this.pitchState.count > 0 ? this.pitchState.mean : 165; // fallback: mid human-voice range
    const pitchStdDev = welfordStdDev(this.pitchState);

    const energyMean = this.energyState.count > 0 ? this.energyState.mean : 0.06;
    const energyStdDev = welfordStdDev(this.energyState);

    const silenceMean = this.silenceState.count > 0 ? this.silenceState.mean : 1.0;

    const zcrMean = this.zcrState.count > 0 ? this.zcrState.mean : 0.15;
    const zcrStdDev = welfordStdDev(this.zcrState);

    const spectralMean = this.spectralState.count > 0 ? this.spectralState.mean : 1500;
    const spectralStdDev = welfordStdDev(this.spectralState);

    this.active = false;

    return {
      userId,
      calibratedAt: Date.now(),
      pitchMean,
      pitchStdDev,
      energyMean,
      energyStdDev,
      normalSilenceThresholdSec: silenceMean,
      frameCount: this.voicedFrames,
      // Extended stats stored in the profile for deviation computation
      zcrMean,
      zcrStdDev,
      spectralMean,
      spectralStdDev,
    };
  }

  /** Resets all accumulated state. */
  public reset(): void {
    this.pitchState = createWelfordState();
    this.energyState = createWelfordState();
    this.silenceState = createWelfordState();
    this.zcrState = createWelfordState();
    this.spectralState = createWelfordState();
    this.totalFrames = 0;
    this.voicedFrames = 0;
    this.active = false;
  }

  /**
   * Returns a snapshot of current running statistics for live monitoring
   * during calibration (e.g. for showing real-time progress).
   */
  public getRunningStats(): {
    pitchMean: number | null;
    energyMean: number | null;
    totalFrames: number;
    voicedFrames: number;
    progress: number;
    isReady: boolean;
  } {
    return {
      pitchMean: this.pitchState.count >= 3 ? this.pitchState.mean : null,
      energyMean: this.energyState.count >= 3 ? this.energyState.mean : null,
      totalFrames: this.totalFrames,
      voicedFrames: this.voicedFrames,
      progress: this.getProgress(),
      isReady: this.isReady(),
    };
  }
}

// Export helpers for testing
export { welfordUpdate, welfordStdDev, createWelfordState };
export type { WelfordState };
