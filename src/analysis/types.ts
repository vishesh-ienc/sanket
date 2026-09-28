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
   * NOT itself a distress indicator, context and deviation from baseline are required.
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
  /** Opaque user identifier (never contains audio or biometric data) */
  userId: string;
  /** Unix epoch ms when calibration was completed */
  calibratedAt: number;

  // ── Pitch (F0) statistics ──────────────────────────────────────────────────
  /** Mean fundamental frequency (Hz) during calibration voiced frames */
  pitchMean: number;
  /** Sample standard deviation of pitch (Hz). 0 if < 2 voiced pitch samples. */
  pitchStdDev: number;

  // ── Vocal Intensity statistics ─────────────────────────────────────────────
  /** Mean RMS amplitude during calibration voiced frames */
  energyMean: number;
  /** Sample standard deviation of RMS energy. 0 if < 2 voiced energy samples. */
  energyStdDev: number;

  // ── Silence statistics ────────────────────────────────────────────────────
  /** Mean silence duration (seconds) during calibration. Used as personal silence onset. */
  normalSilenceThresholdSec: number;

  // ── ZCR statistics ────────────────────────────────────────────────────────
  /** Mean zero-crossing rate during calibration voiced frames */
  zcrMean: number;
  /** Sample standard deviation of ZCR. 0 if < 2 voiced ZCR samples. */
  zcrStdDev: number;

  // ── Spectral Centroid statistics ──────────────────────────────────────────
  /** Mean spectral centroid (Hz) during calibration voiced frames */
  spectralMean: number;
  /** Sample standard deviation of spectral centroid (Hz). 0 if < 2 samples. */
  spectralStdDev: number;

  /** Number of voiced frames used to build this profile */
  frameCount: number;
}

export type RiskLevel = 'NORMAL' | 'ELEVATED' | 'SUSPICIOUS' | 'HIGH_RISK';

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
 * Configuration for the CodeWordDetector.
 */
export interface CodeWordDetectorConfig {
  /** The target phrase to detect (e.g. "Remember to feed the cat") */
  phrase: string;
  /** Whether code-word monitoring is active */
  enabled: boolean;
  /** Cooldown window in ms to suppress duplicate detections from speech recognition bursts (default: 5000ms) */
  cooldownMs: number;
  /** Whether to permit minor inflections (e.g. plurals 'cat' vs 'cats') */
  fuzzyTolerance: boolean;
  /** Minimum similarity threshold for fuzzy matching (0.0 to 1.0, default: 0.85) */
  fuzzyThreshold: number;
}

/**
 * Result emitted by CodeWordDetector.processTranscript().
 */
export interface CodeWordDetection {
  /** Whether a configured code word was detected */
  detected: boolean;
  /** The matched phrase snippet, or null if not detected */
  matchedPhrase: string | null;
  /** Normalized representation of the configured target phrase */
  normalizedPhrase: string | null;
  /** Match confidence / similarity (0.0 to 1.0) */
  confidence: number;
  /** Millisecond timestamp when the evaluation took place */
  timestamp: number;
  /** Explanatory reason or suppression status */
  reason?: string;
  /** Optional source identifier (e.g. 'manual', 'browser-speech', 'mock-source') */
  sourceId?: string;
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: Risk Engine Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Describes the contribution of one signal to the composite risk score.
 * Exposed so the dashboard can explain WHY the score changed.
 */
export interface SignalContribution {
  /** Identifier for the signal channel (e.g. 'pitch', 'silence', 'rms') */
  signal: string;
  /** Numeric contribution added to the composite score this evaluation (0–max weight) */
  contribution: number;
  /** Human-readable reason string for UI / audit log display */
  reason: string;
}

/**
 * The complete result of one RiskEngine.evaluate() call.
 * Replaces or extends RiskEvent for live risk telemetry.
 *
 * Design note:
 * - riskScore is the SMOOTHED score after decay/persistence, not a raw frame score.
 * - contributingSignals lists only signals that contributed > 0 this frame.
 * - confirmedSignals is the count of simultaneously active signals.
 * - A separate RiskEvent is emitted only when level transitions.
 */
export interface RiskEvaluation {
  /** Monotonically-incrementing millisecond timestamp */
  timestamp: number;
  /** Smoothed composite risk score [0, 100] */
  riskScore: number;
  /** Discrete risk level derived from riskScore */
  riskLevel: RiskLevel;
  /** Per-signal breakdown, only signals with contribution > 0 */
  contributingSignals: SignalContribution[];
  /** Number of distinct signals with positive contribution this frame */
  confirmedSignals: number;
  /** Number of consecutive evaluation frames where any signal was active */
  persistenceFrames: number;
  /** Whether the engine considers the current elevated risk confirmed (multi-frame) */
  isConfirmed: boolean;
}

/**
 * Configuration for the RiskEngine.
 *
 * All values are PROTOTYPE heuristics. They are NOT scientifically or
 * medically validated distress thresholds. They are starting points
 * for demonstration and should be calibrated against a personal baseline
 * in Phase 7.
 */
export interface RiskEngineConfig {
  // ── Signal sensitivity thresholds ──────────────────────────────────────────

  /**
   * RMS deviation ratio above which vocal intensity is flagged.
   * Example: 0.08 means RMS increased by 0.08 above the prototype reference.
   * Prototype reference value (Phase 7 will replace with personal baseline mean).
   */
  rmsBaselineRef: number;
  /** Maximum expected RMS range for scoring saturation (default: 0.25) */
  rmsRange: number;

  /**
   * Prototype reference pitch in Hz. Used until personal baseline is available.
   * Covers approximate mid-range of male + female speech (default: 165 Hz).
   */
  pitchBaselineRef: number;
  /** Hz deviation from reference above which pitch is considered elevated (default: 40 Hz) */
  pitchDeviationThreshold: number;
  /** Hz of deviation that saturates pitch score (default: 120 Hz) */
  pitchSaturationRange: number;

  /** Seconds of silence that begins contributing to the silence signal (default: 1.5s) */
  silenceOnsetSec: number;
  /** Seconds of silence where the silence signal saturates (default: 6.0s) */
  silenceSaturationSec: number;

  /** RMS below which a VAD=true frame with dropping energy is flagged (default: 0.025) */
  whisperRmsThreshold: number;

  // ── Score dynamics ─────────────────────────────────────────────────────────

  /**
   * Exponential decay factor applied to the carry-over score each frame.
   * Range: (0, 1). Lower = faster decay. (default: 0.78)
   * This makes the score decay toward 0 when signals normalize,
   * rather than snapping instantly to 0.
   */
  decayFactor: number;

  /**
   * Number of consecutive abnormal frames before confirming elevated risk.
   * Prevents single-frame spikes from triggering high-risk levels. (default: 3)
   */
  confirmationFrames: number;

  /**
   * Per-signal maximum contributions (sum of all weights = 100).
   * These define the ceiling contribution from each independent signal.
   * PROTOTYPE WEIGHTS, not scientifically validated.
   */
  weights: {
    pitch: number;        // default: 22
    rms: number;          // default: 18
    silence: number;      // default: 20
    voiceActivity: number;// default: 15
    spectral: number;     // default: 10
    zcr: number;          // default:  5
    persistence: number;  // default: 10
  };

  // ── Risk level thresholds ──────────────────────────────────────────────────
  /** Score at or above which level = ELEVATED (default: 30) */
  elevatedThreshold: number;
  /** Score at or above which level = SUSPICIOUS (default: 50) */
  suspiciousThreshold: number;
  /** Score at or above which level = HIGH_RISK (default: 70) */
  highRiskThreshold: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7: Incident & Silent Alert Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Baseline deviation snapshot attached to a distress incident.
 * Expressed as statistical Z-scores or deviation ratios.
 */
export interface IncidentBaselineDeviations {
  pitch?: number;
  rms?: number;
  silence?: number;
  voiceActivity?: number;
  spectral?: number;
  zcr?: number;
}

/**
 * Compact snapshot of acoustic features observed at the moment of alert dispatch.
 * Does not retain raw audio buffers or time-domain waveforms.
 */
export interface IncidentFeatureSnapshot {
  pitchHz: number | null;
  rms: number;
  voiceActivity: number;
  silenceDurationSec: number;
  spectralCentroid: number | null;
  zeroCrossingRate: number;
}

/**
 * Contextual metadata supplied when evaluating or creating a distress incident.
 */
export interface IncidentContext {
  /** Execution source: live microphone vs preset demo simulation */
  source: 'MICROPHONE' | 'SIMULATION';
  /** Whether a personal voice baseline was active */
  baselineAvailable: boolean;
  /** Deviation magnitudes from baseline at event trigger */
  baselineDeviations?: IncidentBaselineDeviations;
  /** Whether a covert code-word was matched in this session */
  codeWordDetected: boolean;
  /** Acoustic feature snapshot at incident creation */
  featureSnapshot?: IncidentFeatureSnapshot;
  /** Temporal stability and correlation assessment (Phase 8) */
  temporalContext?: TemporalContext;
}

/**
 * Lifecycle status of a recorded distress incident.
 */
export type IncidentStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

/**
 * Structured incident model representing a confirmed distress event.
 */
export interface DistressIncident {
  /** Unique incident identifier (e.g. "inc-1727438100000-abcd") */
  id: string;
  /** Unix epoch ms timestamp when the incident was created */
  timestamp: number;

  /** Composite risk score [0, 100] at confirmation */
  riskScore: number;
  /** Risk classification (always 'HIGH_RISK' at dispatch) */
  riskLevel: RiskLevel;

  /** Detailed list of contributing signals with scores and explanations */
  contributingSignals: SignalContribution[];
  /** Array of active confirmed signal channel names (e.g. ['pitch', 'rms', 'silence']) */
  confirmedSignals: string[];

  /** Number of consecutive abnormal frames sustained */
  persistenceFrames: number;

  /** Whether personal voice baseline was active */
  baselineAvailable: boolean;
  /** Deviation metrics relative to baseline */
  baselineDeviations?: IncidentBaselineDeviations;

  /** Whether a covert code-word was part of the incident evidence */
  codeWordDetected: boolean;

  /** Compact feature snapshot at time of confirmation */
  featureSnapshot?: IncidentFeatureSnapshot;

  /** Operational status of the incident */
  status: IncidentStatus;

  /** Origin of the detection */
  source: 'MICROPHONE' | 'SIMULATION';

  /** Whether the simulated silent alert has been dispatched */
  alertDispatched: boolean;

  /** Temporal stability and correlation metadata (Phase 8) */
  temporalContext?: TemporalContext;
}

/**
 * Simulated silent alert dispatch event record.
 */
export interface SilentAlertEvent {
  /** Unique alert event identifier */
  id: string;
  /** Associated incident ID */
  incidentId: string;
  /** Unix epoch ms when alert was dispatched */
  timestamp: number;
  /** True when successfully dispatched in simulation mode */
  dispatched: boolean;
  /** Strictly 'SIMULATED_LOCAL' for prototype safety */
  dispatchMode: 'SIMULATED_LOCAL';
  /** Human-readable explanation of why the alert dispatched */
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8: Temporal Context & False-Positive Reduction Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classification of observed temporal behavior.
 */
export type TemporalEventType =
  | 'NONE'
  | 'TRANSIENT_SPIKE'
  | 'SUSTAINED_ANOMALY'
  | 'MULTI_SIGNAL_CORRELATION'
  | 'BREATHING_PATTERN_ANOMALY';

/**
 * Voice-derived pause/breathing prosodic pattern telemetry.
 *
 * IMPORTANT: This represents voice-derived speech/pause regularity.
 * It is NOT physiological or medical respiratory sensing.
 */
export interface BreathingPatternContext {
  /** Number of observation frames in the analysis window */
  sampleCount: number;
  /** Number of discrete pause episodes observed */
  pauseCount: number;
  /** Mean duration of detected pauses in seconds */
  meanPauseDurationSec: number;
  /** Sample variance of pause durations */
  pauseVariability: number;
  /** Regularity score [0.0 = erratic/frozen, 1.0 = rhythmic speech] */
  regularityScore: number;
  /** Whether the pause pattern is classified as irregular or abnormal */
  isIrregular: boolean;
}

/**
 * Structured temporal stability and correlation assessment.
 */
export interface TemporalContext {
  /** Dominant temporal classification */
  eventType: TemporalEventType;
  /** Number of consecutive abnormal frames sustained */
  sustainedFrames: number;
  /** Number of frames in a detected transient burst */
  transientFrames: number;
  /** Degree of cross-signal correlation [0.0, 1.0] across rolling window */
  multiSignalCorrelation: number;
  /** True if the anomaly is short-lived (< minimumSustainedFrames) */
  isTransient: boolean;
  /** True if the anomaly has persisted for >= minimumSustainedFrames */
  isSustained: boolean;
  /** True if multiple corroborating channels are active within window */
  isMultiSignal: boolean;
  /** Voice-derived pause/breathing prosody context */
  breathingPattern?: BreathingPatternContext;
  /** Non-diagnostic explainability string describing current evidence */
  explanation: string;
}

/**
 * Configuration for the TemporalContextAnalyzer.
 */
export interface TemporalContextConfig {
  /** Size of rolling feature window in frames (default: 30) */
  windowSize: number;
  /** Max consecutive frames considered an isolated transient spike (default: 2) */
  transientWindowFrames: number;
  /** Minimum consecutive abnormal frames required for sustained status (default: 3) */
  minimumSustainedFrames: number;
  /** Rolling window in frames to evaluate cross-signal co-occurrence (default: 10) */
  correlationWindowFrames: number;
  /** Rolling window in frames to evaluate pause/breathing regularity (default: 40) */
  breathingWindowFrames: number;
}


