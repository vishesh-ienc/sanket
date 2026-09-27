/**
 * Demo Scenario Data & Synthetic Feature Generators
 * Provides preset test scenarios for reliable live demonstrations and judge evaluation.
 */

import type { FeatureSet } from '../analysis/types';

export type DemoScenarioKey =
  | 'LIVE_MIC'
  | 'NORMAL_SPEECH'
  | 'PITCH_STRAIN_ONLY'
  | 'EXTENDED_SILENCE'
  | 'WHISPER_STRAIN'
  | 'CODE_WORD_ONLY'
  | 'MULTI_SIGNAL_DISTRESS'
  | 'MULTI_SIGNAL_WITH_CODE_WORD'
  | 'TRANSIENT_PITCH_SPIKE'
  | 'TRANSIENT_LOUD_EVENT'
  | 'IRREGULAR_PAUSE_PATTERN'
  | 'RECOVERY_NORMALIZING';

/** Helper generator returning synthetic FeatureSet for demo scenarios */
export function getDemoScenarioFeatures(
  scenario: DemoScenarioKey,
  tick: number,
  prevFeatures: FeatureSet | null
): FeatureSet | null {
  const timestamp = performance.now();

  switch (scenario) {
    case 'NORMAL_SPEECH':
      return {
        timestamp,
        rmsEnergy: 0.058 + Math.sin(tick * 0.2) * 0.015,
        zeroCrossingRate: 0.08 + Math.sin(tick * 0.1) * 0.02,
        spectralCentroid: 1400 + Math.sin(tick * 0.3) * 200,
        pitchHz: 165 + Math.sin(tick * 0.2) * 12,
        isSpeech: true,
        silenceDurationSec: 0,
        speechActivityDurationSec: 4.5,
        speechSegmentCount: 2,
      };

    case 'PITCH_STRAIN_ONLY':
      // Pitch alone: high deviation (340 Hz), all other signals normal
      return {
        timestamp,
        rmsEnergy: 0.062,
        zeroCrossingRate: 0.09,
        spectralCentroid: 1600,
        pitchHz: 340 + Math.sin(tick * 0.2) * 15, // extreme pitch
        isSpeech: true,
        silenceDurationSec: 0,
        speechActivityDurationSec: 3.0,
        speechSegmentCount: 1,
      };

    case 'EXTENDED_SILENCE':
      // Silence alone: prolonged pause (4.5s)
      return {
        timestamp,
        rmsEnergy: 0.002,
        zeroCrossingRate: 0.01,
        spectralCentroid: null,
        pitchHz: null,
        isSpeech: false,
        silenceDurationSec: 4.2 + (tick % 20) * 0.1,
        speechActivityDurationSec: 2.0,
        speechSegmentCount: 1,
      };

    case 'WHISPER_STRAIN':
      // Whisper: low energy + high ZCR + high centroid
      return {
        timestamp,
        rmsEnergy: 0.018, // whisper level
        zeroCrossingRate: 0.38, // elevated turbulence
        spectralCentroid: 3200,
        pitchHz: null,
        isSpeech: true,
        silenceDurationSec: 0,
        speechActivityDurationSec: 1.8,
        speechSegmentCount: 1,
      };

    case 'CODE_WORD_ONLY':
      // Normal calm speech baseline acoustic signals (code-word trigger handles contextual boost)
      return {
        timestamp,
        rmsEnergy: 0.056 + Math.sin(tick * 0.1) * 0.01,
        zeroCrossingRate: 0.08,
        spectralCentroid: 1450,
        pitchHz: 165 + Math.sin(tick * 0.1) * 8,
        isSpeech: true,
        silenceDurationSec: 0,
        speechActivityDurationSec: 5.2,
        speechSegmentCount: 2,
      };

    case 'MULTI_SIGNAL_DISTRESS':
      // Full multi-signal co-occurrence: Pitch + RMS + Spectral + ZCR + Persistence
      return {
        timestamp,
        rmsEnergy: 0.32 + Math.sin(tick * 0.1) * 0.04,
        zeroCrossingRate: 0.42,
        spectralCentroid: 4600,
        pitchHz: 410 + Math.sin(tick * 0.2) * 20,
        isSpeech: true,
        silenceDurationSec: 4.5,
        speechActivityDurationSec: 0.6,
        speechSegmentCount: 1,
      };

    case 'MULTI_SIGNAL_WITH_CODE_WORD':
      // Combined acoustic distress + contextual covert code word
      return {
        timestamp,
        rmsEnergy: 0.35 + Math.sin(tick * 0.1) * 0.03,
        zeroCrossingRate: 0.44,
        spectralCentroid: 4800,
        pitchHz: 425 + Math.sin(tick * 0.2) * 15,
        isSpeech: true,
        silenceDurationSec: 3.8,
        speechActivityDurationSec: 0.5,
        speechSegmentCount: 1,
      };

    case 'TRANSIENT_PITCH_SPIKE': {
      // Short-lived isolated pitch burst (coughs, laugh burst, surprise spike):
      // Spikes for only 2 frames (tick 4 & 5), calm before and after
      const isSpike = tick % 20 === 4 || tick % 20 === 5;
      return {
        timestamp,
        rmsEnergy: isSpike ? 0.18 : 0.055,
        zeroCrossingRate: isSpike ? 0.14 : 0.08,
        spectralCentroid: isSpike ? 2400 : 1400,
        pitchHz: isSpike ? 385 : 165,
        isSpeech: true,
        silenceDurationSec: 0,
        speechActivityDurationSec: 3.5,
        speechSegmentCount: 2,
      };
    }

    case 'TRANSIENT_LOUD_EVENT': {
      // Sudden brief volume surge (throat clearing, single loud exclamation):
      // Spikes for 2 frames, returns immediately to baseline
      const isLoud = tick % 20 === 4 || tick % 20 === 5;
      return {
        timestamp,
        rmsEnergy: isLoud ? 0.36 : 0.058,
        zeroCrossingRate: isLoud ? 0.18 : 0.08,
        spectralCentroid: isLoud ? 2200 : 1450,
        pitchHz: 170,
        isSpeech: true,
        silenceDurationSec: 0,
        speechActivityDurationSec: 4.0,
        speechSegmentCount: 2,
      };
    }

    case 'IRREGULAR_PAUSE_PATTERN': {
      // Alternates between brief fragmented speech (0.3s) and erratic prolonged silence (4.2s)
      const isFragmentedVoice = (tick % 15) < 3;
      return {
        timestamp,
        rmsEnergy: isFragmentedVoice ? 0.06 : 0.002,
        zeroCrossingRate: isFragmentedVoice ? 0.08 : 0.01,
        spectralCentroid: isFragmentedVoice ? 1500 : null,
        pitchHz: isFragmentedVoice ? 175 : null,
        isSpeech: isFragmentedVoice,
        silenceDurationSec: isFragmentedVoice ? 0 : 4.2 + (tick % 10) * 0.1,
        speechActivityDurationSec: 1.2,
        speechSegmentCount: 5,
      };
    }

    case 'RECOVERY_NORMALIZING':
      // Returning to calm speech: signals normalize and let score decay
      return {
        timestamp,
        rmsEnergy: 0.055,
        zeroCrossingRate: 0.07,
        spectralCentroid: 1300,
        pitchHz: 162,
        isSpeech: true,
        silenceDurationSec: 0,
        speechActivityDurationSec: 6.0,
        speechSegmentCount: 2,
      };

    case 'LIVE_MIC':
    default:
      return prevFeatures;
  }
}
