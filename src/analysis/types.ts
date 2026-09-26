/**
 * Sanket Feature Extraction, Baseline, & Risk Engine Contracts
 * Pure TypeScript interfaces decoupled from browser DOM/React UI
 */

/**
 * A single analysis frame's extracted acoustic features.
 *
 * Design rules:
 * - Features that cannot be reliably computed MUST be null, never 0.
 *   (A pitch of 0 Hz and "pitch unavailable" are different states.)
 * - No distress interpretation is performed at this layer.
 *   FeatureSet answers "what is happening acoustically", not "is this person in danger".
 */
export interface FeatureSet {
  /** Timestamp in milliseconds (from performance.now() origin) */
  timestamp: number;

  /**
   * Root-Mean-Square amplitude of the audio frame (0.0 – ~1.0).
   * Represents vocal intensity / loudness.
   * IMPORTANT: This is a raw amplitude ratio from the browser microphone,
   * NOT a calibrated SPL measurement in dB. Values are hardware-dependent.
   */
  rmsEnergy: number;

  /**
   * Zero-Crossing Rate: fraction of consecutive sample pairs that cross zero per frame.
   * Higher ZCR typically indicates unvoiced fricatives, breath, or noise.
   * Lower ZCR on voiced speech correlates with strong fundamental frequency.
   * NOT itself a distress indicator — context and deviation from baseline are required.
   */
  zeroCrossingRate: number;

  /**
   * Spectral Centroid in Hz: the "center of mass" of the frequency spectrum.
   * A brighter, higher-pitched sound has a higher spectral centroid.
   * Computed as the weighted mean of frequency bin magnitudes.
   * Null when the frame contains only silence/noise (all magnitudes near floor).
   */
  spectralCentroid: number | null;

  /**
   * Estimated fundamental frequency (F0 / pitch) in Hz.
   * Computed via autocorrelation over the time-domain PCM buffer.
   * Search range: 80 Hz – 500 Hz (covers human male and female speech).
   * Null when:
   *   - The frame is unvoiced (noise, silence, breath)
   *   - No clear periodic peak was found above the confidence threshold
   *   - RMS is below the voice-activity threshold
   * IMPORTANT: This is an acoustic approximation using a single-frame heuristic.
   * It is NOT a medically validated physiological measurement.
   */
  pitchHz: number | null;

  /**
   * Voice Activity Detection result.
   * True when the frame is classified as containing meaningful speech/vocal audio.
   * Based on a simple RMS-energy threshold heuristic; not a neural VAD model.
   */
  isSpeech: boolean;

  /**
   * Continuous silence duration in seconds at the time this frame was analysed.
   * Counts up whenever isSpeech is false, resets to 0 when isSpeech returns true.
   * Intended as a future input to the multi-signal distress risk engine (Phase 3).
   */
  silenceDurationSec: number;

  /**
   * Cumulative duration of speech/voice activity during this monitoring session (seconds).
   * Increments by the inter-frame interval on every voiced frame.
   */
  speechActivityDurationSec: number;

  /**
   * Number of discrete speech segments observed since monitoring started.
   * A segment begins when isSpeech transitions false→true.
   * A segment ends when isSpeech transitions true→false.
   * Provides a rough proxy for conversational turn count / utterance count.
   */
  speechSegmentCount: number;
}

export interface BaselineProfile {
  userId: string;
  calibratedAt: number;
  pitchMean: number;
  pitchStdDev: number;
  energyMean: number;
  energyStdDev: number;
  normalSilenceThresholdSec: number;
  frameCount: number;
}

export type RiskLevel = 'NORMAL' | 'ELEVATED' | 'SUSPECTED' | 'CRITICAL';

export interface RiskEvent {
  id: string;
  timestamp: number;
  score: number;
  level: RiskLevel;
  contributingSignals: string[];
  details: {
    pitchZScore?: number;
    silenceDurationSec?: number;
    energyShiftRatio?: number;
    codeWordMatched?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Configuration for FeatureExtractor.
 * All thresholds are deliberately configurable rather than hard-coded
 * to support future personal baseline calibration.
 */
export interface FeatureExtractorConfig {
  /**
   * Minimum RMS to be classified as voiced speech (default: 0.015).
   * Below this, VAD returns false and pitch is not estimated.
   */
  voiceActivityRmsThreshold: number;

  /** Minimum F0 search frequency in Hz (default: 80 Hz) */
  pitchMinHz: number;

  /** Maximum F0 search frequency in Hz (default: 500 Hz) */
  pitchMaxHz: number;

  /**
   * Minimum autocorrelation peak value (0–1) required to accept a pitch estimate.
   * Lower values accept weaker periodicity. (default: 0.25)
   */
  pitchConfidenceThreshold: number;

  /**
   * Minimum frequency bin magnitude (linear) required for spectral centroid to be
   * considered non-trivial. Prevents near-zero noise from distorting the centroid.
   * (default: 0.001)
   */
  spectralCentroidMinMagnitude: number;
}
