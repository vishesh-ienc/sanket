/**
 * Sanket, Temporal Context & False-Positive Reduction Analyzer (Phase 8)
 *
 * Evaluates short-term temporal stability, transient vocal spikes,
 * cross-signal temporal correlation, and voice-derived pause regularity.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SAFETY, PROTOTYPE & PRIVACY GUARANTEES
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. ZERO ML / ZERO HEAVY MODELS: Pure deterministic arithmetic and stateful
 *    ring-buffer analysis.
 * 2. RISK ENGINE AUTHORITY: Never replaces or duplicates RiskEngine; provides
 *    contextual evidence and gating metadata only.
 * 3. VOICE-DERIVED PROXY ONLY: Breathing and pause metrics are derived purely
 *    from vocal activity transitions. NOT medical or respiratory sensing.
 * 4. ZERO RAW AUDIO RETENTION: Bounded ring buffer stores only derived scalars;
 *    zero PCM samples, waveforms, or complete transcripts.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  FeatureSet,
  TemporalContext,
  TemporalContextConfig,
  TemporalEventType,
  BreathingPatternContext,
} from './types';
import type { BaselineDeviationOutput } from './baselineDeviation';

export const DEFAULT_TEMPORAL_CONFIG: TemporalContextConfig = {
  windowSize: 30, // 30 frames (~3s at 10Hz)
  transientWindowFrames: 2, // 1–2 frames considered isolated transient spike
  minimumSustainedFrames: 3, // >=3 frames required for sustained anomaly
  correlationWindowFrames: 10, // 10 frames (~1s) cross-signal co-occurrence window
  breathingWindowFrames: 40, // 40 frames (~4s) voice-derived pause window
};

/**
 * Compact derived observation stored in the bounded history buffer.
 * Strictly metadata; zero raw audio buffers.
 */
interface CompactObservation {
  timestamp: number;
  activeChannels: string[];
  isSpeech: boolean;
  silenceDurationSec: number;
  pitchHz: number | null;
  rmsEnergy: number;
}

export class TemporalContextAnalyzer {
  private config: TemporalContextConfig;
  private history: CompactObservation[] = [];
  private consecutiveAbnormalFrames: number = 0;
  private consecutiveNormalFrames: number = 0;
  private lastTransientBurstFrames: number = 0;

  constructor(config?: Partial<TemporalContextConfig>) {
    this.config = { ...DEFAULT_TEMPORAL_CONFIG, ...config };
  }

  /**
   * Resets all accumulated temporal history and counters.
   */
  public reset(): void {
    this.history = [];
    this.consecutiveAbnormalFrames = 0;
    this.consecutiveNormalFrames = 0;
    this.lastTransientBurstFrames = 0;
  }

  /**
   * Returns current analyzer configuration.
   */
  public getConfig(): TemporalContextConfig {
    return { ...this.config };
  }

  /**
   * Identifies which signal channels are abnormal for this frame based on
   * personal baseline deviations if available, or prototype heuristic thresholds.
   */
  private identifyActiveChannels(
    features: FeatureSet,
    deviations?: BaselineDeviationOutput | null
  ): string[] {
    const active: string[] = [];

    if (deviations && deviations.baselineAvailable) {
      // Personal Baseline Z-Score evaluation (|Z| >= 2.0 is statistically anomalous)
      if (deviations.pitchZScore !== null && deviations.pitchZScore >= 2.0) {
        active.push('pitch');
      }
      if (deviations.energyZScore !== null && deviations.energyZScore >= 2.0) {
        active.push('rms');
      }
      if (deviations.silenceExcessRatio !== null && deviations.silenceExcessRatio >= 1.5) {
        active.push('silence');
      }
      if (deviations.spectralZScore !== null && deviations.spectralZScore >= 2.0) {
        active.push('spectral');
      }
      if (deviations.zcrZScore !== null && deviations.zcrZScore >= 2.0) {
        active.push('zcr');
      }
    } else {
      // Fallback prototype heuristic thresholds
      if (features.pitchHz !== null && (features.pitchHz > 215 || features.pitchHz < 115)) {
        active.push('pitch');
      }
      if (features.rmsEnergy > 0.12) {
        active.push('rms');
      }
      if (features.silenceDurationSec > 2.0) {
        active.push('silence');
      }
      if (features.spectralCentroid !== null && features.spectralCentroid > 2500) {
        active.push('spectral');
      }
      if (features.zeroCrossingRate > 0.25) {
        active.push('zcr');
      }
    }

    return active;
  }

  /**
   * Analyzes voice-derived pause and prosodic regularity over recent history.
   *
   * Disclaimer: Voice-derived pause regularity proxy only; NOT medical respiratory sensing.
   */
  private analyzeBreathingPattern(): BreathingPatternContext {
    const windowFrames = this.history.slice(-this.config.breathingWindowFrames);
    const sampleCount = windowFrames.length;

    if (sampleCount < 5) {
      return {
        sampleCount,
        pauseCount: 0,
        meanPauseDurationSec: 0,
        pauseVariability: 0,
        regularityScore: 1.0,
        isIrregular: false,
      };
    }

    // Identify discrete pause episodes (sequences where isSpeech === false)
    const pauseDurations: number[] = [];
    let inPause = false;
    let currentPauseDuration = 0;

    for (const obs of windowFrames) {
      if (!obs.isSpeech) {
        inPause = true;
        currentPauseDuration = obs.silenceDurationSec;
      } else {
        if (inPause && currentPauseDuration > 0) {
          pauseDurations.push(currentPauseDuration);
        }
        inPause = false;
        currentPauseDuration = 0;
      }
    }
    // Include ongoing pause if present
    if (inPause && currentPauseDuration > 0) {
      pauseDurations.push(currentPauseDuration);
    }

    const pauseCount = pauseDurations.length;
    if (pauseCount === 0) {
      return {
        sampleCount,
        pauseCount: 0,
        meanPauseDurationSec: 0,
        pauseVariability: 0,
        regularityScore: 1.0,
        isIrregular: false,
      };
    }

    const meanPauseDurationSec =
      pauseDurations.reduce((sum, d) => sum + d, 0) / pauseCount;

    // Variance of pause durations
    const variance =
      pauseDurations.reduce((sum, d) => sum + Math.pow(d - meanPauseDurationSec, 2), 0) /
      pauseCount;

    // Regularity metric: high variance or prolonged freezes reduce regularity
    const hasProlongedPause = pauseDurations.some((d) => d > 3.5);
    const hasErraticPacing = variance > 2.0 && pauseCount >= 2;
    const isIrregular = hasProlongedPause || hasErraticPacing;

    // Regularity score clamped [0.0, 1.0]
    let regularityScore = 1.0;
    if (hasProlongedPause) regularityScore -= 0.4;
    if (hasErraticPacing) regularityScore -= 0.3;
    regularityScore = Math.max(0.1, Math.min(1.0, regularityScore));

    return {
      sampleCount,
      pauseCount,
      meanPauseDurationSec,
      pauseVariability: variance,
      regularityScore,
      isIrregular,
    };
  }

  /**
   * Processes a new frame observation and computes full temporal context.
   */
  public processFrame(
    features: FeatureSet,
    deviations?: BaselineDeviationOutput | null
  ): TemporalContext {
    const activeChannels = this.identifyActiveChannels(features, deviations);
    const hasAnomaly = activeChannels.length > 0;

    // Update temporal counters
    if (hasAnomaly) {
      this.consecutiveAbnormalFrames++;
      this.consecutiveNormalFrames = 0;
    } else {
      if (
        this.consecutiveAbnormalFrames > 0 &&
        this.consecutiveAbnormalFrames <= this.config.transientWindowFrames
      ) {
        // Record that an isolated spike just concluded
        this.lastTransientBurstFrames = this.consecutiveAbnormalFrames;
      }
      this.consecutiveAbnormalFrames = 0;
      this.consecutiveNormalFrames++;
    }

    // Maintain bounded rolling history
    const compact: CompactObservation = {
      timestamp: features.timestamp,
      activeChannels,
      isSpeech: features.isSpeech,
      silenceDurationSec: features.silenceDurationSec,
      pitchHz: features.pitchHz,
      rmsEnergy: features.rmsEnergy,
    };

    this.history.push(compact);
    if (this.history.length > this.config.windowSize) {
      this.history.shift();
    }

    // 1. Transient Spike Detection
    const isCurrentTransient =
      this.consecutiveAbnormalFrames > 0 &&
      this.consecutiveAbnormalFrames <= this.config.transientWindowFrames;

    // Also consider if an isolated spike just recovered 1 frame ago
    const isJustRecoveredTransient =
      !hasAnomaly && this.consecutiveNormalFrames === 1 && this.lastTransientBurstFrames > 0;

    const isTransient = isCurrentTransient || isJustRecoveredTransient;
    const transientFrames = isCurrentTransient
      ? this.consecutiveAbnormalFrames
      : isJustRecoveredTransient
      ? this.lastTransientBurstFrames
      : 0;

    // 2. Sustained Anomaly Detection
    const isSustained =
      this.consecutiveAbnormalFrames >= this.config.minimumSustainedFrames;
    const sustainedFrames = isSustained ? this.consecutiveAbnormalFrames : 0;

    // 3. Cross-Signal Temporal Correlation
    const recentWindow = this.history.slice(-this.config.correlationWindowFrames);
    const uniqueChannelsInWindow = new Set<string>();
    for (const obs of recentWindow) {
      for (const ch of obs.activeChannels) {
        uniqueChannelsInWindow.add(ch);
      }
    }

    const multiSignalCorrelation = Math.min(1.0, uniqueChannelsInWindow.size / 5);
    const isMultiSignal = uniqueChannelsInWindow.size >= 2;

    // 4. Voice-Derived Pause/Breathing Regularity
    const breathingPattern = this.analyzeBreathingPattern();

    // 5. Classification
    let eventType: TemporalEventType = 'NONE';
    if (isMultiSignal && isSustained) {
      eventType = 'MULTI_SIGNAL_CORRELATION';
    } else if (isSustained) {
      eventType = 'SUSTAINED_ANOMALY';
    } else if (isTransient) {
      eventType = 'TRANSIENT_SPIKE';
    } else if (breathingPattern.isIrregular) {
      eventType = 'BREATHING_PATTERN_ANOMALY';
    }

    // 6. Non-diagnostic explainability string
    let explanation: string;
    if (eventType === 'MULTI_SIGNAL_CORRELATION') {
      explanation = `Multiple signals (${uniqueChannelsInWindow.size} channels) sustained across ${sustainedFrames} frames, distress-risk evidence increased.`;
    } else if (eventType === 'SUSTAINED_ANOMALY') {
      explanation = `Acoustic anomaly sustained across ${sustainedFrames} frames, temporal persistence active.`;
    } else if (eventType === 'TRANSIENT_SPIKE') {
      explanation = `Transient vocal spike (${transientFrames} frames), isolated burst, monitoring continues without escalation.`;
    } else if (eventType === 'BREATHING_PATTERN_ANOMALY') {
      explanation = 'Voice-derived pause pattern is irregular, conversational turn pacing deviates from normal.';
    } else if (uniqueChannelsInWindow.size === 1) {
      explanation = 'Single-channel deviation, insufficient temporal evidence for distress escalation.';
    } else {
      explanation = 'Acoustic patterns stable within normal baseline range.';
    }

    return {
      eventType,
      sustainedFrames,
      transientFrames,
      multiSignalCorrelation,
      isTransient,
      isSustained,
      isMultiSignal,
      breathingPattern,
      explanation,
    };
  }
}
