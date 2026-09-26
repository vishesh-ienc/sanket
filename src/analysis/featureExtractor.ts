/**
 * Sanket — FeatureExtractor
 *
 * Stateful analysis component that:
 *   1. Accepts AudioFrame objects from the audio input layer.
 *   2. Calls pure DSP functions from featureFunctions.ts.
 *   3. Maintains cross-frame temporal state (silence duration, speech timing).
 *   4. Emits a complete FeatureSet for each processed frame.
 *
 * Architectural rules:
 *   - No React imports, no DOM references, no browser globals except
 *     performance.now() for timing.
 *   - No distress scoring or risk classification — this layer measures,
 *     it does NOT interpret safety implications.
 *   - The FeatureExtractor is consumed by the Phase 3 risk engine via
 *     its processFrame() method or the higher-level React hook.
 *
 * Analysis interval:
 *   processFrame() is called at ~10Hz from the React hook (every 100ms).
 *   This is intentionally decoupled from the 60fps canvas draw loop and
 *   the 20Hz UI state update loop from Phase 1. Feature extraction is
 *   computationally heavier than simple RMS reads, so a lower rate is appropriate.
 */

import type { AudioFrame } from '../audio/types';
import type { FeatureSet, FeatureExtractorConfig } from './types';
import {
  calculateRms,
  calculateZeroCrossingRate,
  calculateSpectralCentroid,
  estimatePitch,
  detectVoiceActivity,
} from './featureFunctions';

const DEFAULT_CONFIG: FeatureExtractorConfig = {
  voiceActivityRmsThreshold: 0.015,
  pitchMinHz: 80,
  pitchMaxHz: 500,
  pitchConfidenceThreshold: 0.25,
  spectralCentroidMinMagnitude: 0.001,
};

// ─────────────────────────────────────────────────────────────────────────────
// Temporal State (cross-frame)
// ─────────────────────────────────────────────────────────────────────────────

interface TemporalState {
  /** Timestamp (ms) when the last voiced frame was observed */
  lastVoiceTimestamp: number | null;
  /** Continuous silence duration in seconds at the current moment */
  silenceDurationSec: number;
  /** Cumulative voiced/speech duration since extractor was reset (seconds) */
  speechActivityDurationSec: number;
  /** Number of discrete speech segments (voice ON transitions) */
  speechSegmentCount: number;
  /** Whether the previous frame was voiced (for segment transition detection) */
  wasVoicedPrevFrame: boolean;
  /** Timestamp of the previous processFrame() call (ms), for inter-frame interval */
  lastFrameTimestamp: number | null;
}

function createInitialTemporalState(): TemporalState {
  return {
    lastVoiceTimestamp: null,
    silenceDurationSec: 0,
    speechActivityDurationSec: 0,
    speechSegmentCount: 0,
    wasVoicedPrevFrame: false,
    lastFrameTimestamp: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FeatureExtractor Class
// ─────────────────────────────────────────────────────────────────────────────

export class FeatureExtractor {
  private config: FeatureExtractorConfig;
  private state: TemporalState;

  constructor(config: Partial<FeatureExtractorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = createInitialTemporalState();
  }

  /**
   * Processes a single AudioFrame and returns a FeatureSet.
   *
   * This method is the primary integration point for the Phase 3 risk engine
   * and the React hook. Call it at a fixed analysis interval (e.g. 100ms / 10Hz).
   */
  public processFrame(frame: AudioFrame): FeatureSet {
    const now = frame.timestamp;
    const { timeDomainData, frequencyData, sampleRate } = frame;

    // ── Compute inter-frame interval for temporal tracking ───────────────────
    const dtSec =
      this.state.lastFrameTimestamp !== null
        ? (now - this.state.lastFrameTimestamp) / 1000
        : 0;

    // ── A. RMS (re-use pre-calculated value from AudioFrame) ─────────────────
    // AudioFrame already carries rmsEnergy computed by AudioInputService.
    // We re-calculate here to keep FeatureExtractor self-contained and testable
    // with synthetic frames that may not have rmsEnergy pre-filled.
    const rmsEnergy = calculateRms(timeDomainData);

    // ── B. Zero-Crossing Rate ────────────────────────────────────────────────
    const zeroCrossingRate = calculateZeroCrossingRate(timeDomainData);

    // ── C. Spectral Centroid ─────────────────────────────────────────────────
    const spectralCentroid = calculateSpectralCentroid(
      frequencyData,
      sampleRate,
      this.config.spectralCentroidMinMagnitude
    );

    // ── D. Voice Activity Detection ──────────────────────────────────────────
    const isSpeech = detectVoiceActivity(rmsEnergy, this.config.voiceActivityRmsThreshold);

    // ── E. Pitch Estimation (only on voiced frames for performance) ──────────
    // Autocorrelation is O(N²) for our lag range; skip on silence to reduce CPU.
    const pitchHz = isSpeech
      ? estimatePitch(
          timeDomainData,
          sampleRate,
          this.config.pitchMinHz,
          this.config.pitchMaxHz,
          this.config.pitchConfidenceThreshold
        )
      : null;

    // ── F & G. Temporal State Updates ───────────────────────────────────────
    this.updateTemporalState(isSpeech, now, dtSec);

    // ── Assemble FeatureSet ──────────────────────────────────────────────────
    const features: FeatureSet = {
      timestamp: now,
      rmsEnergy,
      zeroCrossingRate,
      spectralCentroid,
      pitchHz,
      isSpeech,
      silenceDurationSec: this.state.silenceDurationSec,
      speechActivityDurationSec: this.state.speechActivityDurationSec,
      speechSegmentCount: this.state.speechSegmentCount,
    };

    this.state.lastFrameTimestamp = now;
    return features;
  }

  /**
   * Updates the cross-frame temporal state based on current voice activity.
   * Called once per processFrame().
   */
  private updateTemporalState(isSpeech: boolean, now: number, dtSec: number): void {
    if (isSpeech) {
      // Voice is present this frame
      if (!this.state.wasVoicedPrevFrame) {
        // Transition: SILENCE → VOICE
        // A new speech segment has started
        this.state.speechSegmentCount += 1;
      }

      // Reset silence counter and accumulate speech duration
      this.state.silenceDurationSec = 0;
      this.state.lastVoiceTimestamp = now;
      this.state.speechActivityDurationSec += dtSec;
      this.state.wasVoicedPrevFrame = true;
    } else {
      // Voice is absent this frame
      if (this.state.wasVoicedPrevFrame) {
        // Transition: VOICE → SILENCE — silence just started
        // silenceDurationSec starts accumulating from next frame
        this.state.silenceDurationSec = 0;
      } else {
        // Continuing silence — accumulate duration
        this.state.silenceDurationSec += dtSec;
      }

      this.state.wasVoicedPrevFrame = false;
    }
  }

  /** Resets all temporal tracking state (e.g. when monitoring restarts) */
  public reset(): void {
    this.state = createInitialTemporalState();
  }

  /** Returns current temporal state snapshot (useful for testing & inspection) */
  public getTemporalState(): Readonly<TemporalState> {
    return { ...this.state };
  }

  /** Returns the active configuration */
  public getConfig(): Readonly<FeatureExtractorConfig> {
    return { ...this.config };
  }

  /** Updates a specific threshold without recreating the extractor */
  public updateConfig(partial: Partial<FeatureExtractorConfig>): void {
    this.config = { ...this.config, ...partial };
  }
}
