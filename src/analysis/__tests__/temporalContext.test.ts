/**
 * Sanket — Phase 8: Temporal Context & False-Positive Reduction Tests
 *
 * Deterministic unit and integration tests covering:
 *   - Transient spike detection (isolated bursts, recovery transition)
 *   - Sustained anomaly detection (persistence thresholds, multi-frame accumulation)
 *   - Cross-signal temporal correlation (multi-channel co-occurrence within temporal window)
 *   - Baseline deviation integration (Z-score anomaly activation vs fallback heuristics)
 *   - Voice-derived pause / breathing regularity proxy (turn-pacing, prolonged freezes, variance)
 *   - Bounds, memory safety, and buffer lifecycle
 *   - IncidentManager false-positive suppression integration
 *
 * No browser, DOM, microphone, or network required.
 */

import {
  TemporalContextAnalyzer,
  DEFAULT_TEMPORAL_CONFIG,
} from '../temporalContext';
import type {
  FeatureSet,
  RiskEvaluation,
  IncidentContext,
} from '../types';
import type { BaselineDeviationOutput } from '../baselineDeviation';
import { IncidentManager } from '../../services/incidentManager';
import { clearHistory, setStorageBackend } from '../../services/alertHistory';

// ─────────────────────────────────────────────────────────────────────────────
// Test Harness
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string): void {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

function assertClose(a: number, b: number, tolerance: number, testName: string): void {
  assert(Math.abs(a - b) <= tolerance, `${testName} (expected ~${b}, got ${a.toFixed(4)})`);
}

function printSection(label: string): void {
  console.log(`\n─── ${label} ───`);
}

// Mock In-Memory Storage for Testing
class MockStorage {
  private data: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.data[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.data[key] = value;
  }
  removeItem(key: string): void {
    delete this.data[key];
  }
  clear(): void {
    this.data = {};
  }
}

setStorageBackend(new MockStorage());

// ─────────────────────────────────────────────────────────────────────────────
// Synthetic Data Generators
// ─────────────────────────────────────────────────────────────────────────────

function createNormalFrame(overrides: Partial<FeatureSet> = {}): FeatureSet {
  return {
    timestamp: 1000,
    rmsEnergy: 0.05,
    zeroCrossingRate: 0.10,
    spectralCentroid: 1200,
    pitchHz: 150, // Between 115 and 215 -> Normal
    isSpeech: true,
    silenceDurationSec: 0,
    speechActivityDurationSec: 1.0,
    ...overrides,
  };
}

function createSpikeFrame(overrides: Partial<FeatureSet> = {}): FeatureSet {
  return {
    timestamp: 1100,
    rmsEnergy: 0.05,
    zeroCrossingRate: 0.10,
    spectralCentroid: 1200,
    pitchHz: 280, // > 215 -> Abnormal pitch spike
    isSpeech: true,
    silenceDurationSec: 0,
    speechActivityDurationSec: 1.1,
    ...overrides,
  };
}

function createMockEvaluation(overrides: Partial<RiskEvaluation> = {}): RiskEvaluation {
  return {
    riskScore: 78,
    riskLevel: 'HIGH_RISK',
    contributingSignals: [
      { signal: 'PITCH_ELEVATION', score: 85, weight: 0.35, contribution: 29.75 },
      { signal: 'ENERGY_BURST', score: 80, weight: 0.25, contribution: 20.0 },
    ],
    persistenceFrames: 3,
    isConfirmed: true,
    timestamp: 2000,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Transient Spike Detection
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 1: Transient Spike Detection');

{
  const analyzer = new TemporalContextAnalyzer();

  // Test 1: Single isolated pitch spike is classified as TRANSIENT_SPIKE
  const f1 = createSpikeFrame();
  const res1 = analyzer.processFrame(f1);
  assert(res1.eventType === 'TRANSIENT_SPIKE', 'Test 1: Single pitch spike produces TRANSIENT_SPIKE');
  assert(res1.isTransient === true, 'Test 1: isTransient is true for 1-frame spike');
  assert(res1.transientFrames === 1, 'Test 1: transientFrames is 1');
  assert(res1.isSustained === false, 'Test 1: isSustained is false for 1-frame spike');

  // Test 2: Transient spike followed by normal frame marks recovery transition
  const f2 = createNormalFrame({ timestamp: 1200 });
  const res2 = analyzer.processFrame(f2);
  assert(res2.isTransient === true, 'Test 2: Immediately recovered spike retains isTransient=true for 1 recovery frame');
  assert(res2.transientFrames === 1, 'Test 2: transientFrames reflects last burst frames during recovery');
  assert(res2.isSustained === false, 'Test 2: isSustained remains false on recovery');

  // Test 3: Normal frame after recovery clears transient state
  const f3 = createNormalFrame({ timestamp: 1300 });
  const res3 = analyzer.processFrame(f3);
  assert(res3.eventType === 'NONE', 'Test 3: Second normal frame clears transient eventType to NONE');
  assert(res3.isTransient === false, 'Test 3: isTransient is false after full recovery');
  assert(res3.transientFrames === 0, 'Test 3: transientFrames is 0');
}

{
  const analyzer = new TemporalContextAnalyzer();

  // Test 4: Two consecutive anomalous frames within transient window (2) are still transient
  analyzer.processFrame(createSpikeFrame({ timestamp: 100 }));
  const res = analyzer.processFrame(createSpikeFrame({ timestamp: 200 }));
  assert(res.isTransient === true, 'Test 4: Two consecutive spikes remain isTransient=true');
  assert(res.transientFrames === 2, 'Test 4: transientFrames is 2');
  assert(res.isSustained === false, 'Test 4: 2 frames does not meet minimum sustained frames (3)');

  // Test 5: Third consecutive anomalous frame transitions to sustained
  const res3 = analyzer.processFrame(createSpikeFrame({ timestamp: 300 }));
  assert(res3.isTransient === false, 'Test 5: 3rd frame is no longer transient');
  assert(res3.isSustained === true, 'Test 5: 3rd frame transitions to isSustained=true');
}

{
  const analyzer = new TemporalContextAnalyzer();

  // Test 6: Isolated RMS energy burst (> 0.12) is recognized as transient spike
  const resRMS = analyzer.processFrame(createNormalFrame({ rmsEnergy: 0.18 }));
  assert(resRMS.eventType === 'TRANSIENT_SPIKE', 'Test 6: High RMS burst produces TRANSIENT_SPIKE');
  assert(resRMS.isTransient === true, 'Test 6: High RMS burst is transient');

  // Test 7: Isolated silence duration (> 2.0s) is recognized as anomaly
  analyzer.reset();
  const resSilence = analyzer.processFrame(createNormalFrame({ silenceDurationSec: 2.5 }));
  assert(resSilence.isTransient === true, 'Test 7: Isolated silence spike is transient');

  // Test 8: Sudden high spectral centroid (> 2500Hz) triggers transient spike
  analyzer.reset();
  const resSpec = analyzer.processFrame(createNormalFrame({ spectralCentroid: 3200 }));
  assert(resSpec.eventType === 'TRANSIENT_SPIKE', 'Test 8: Spectral centroid spike produces TRANSIENT_SPIKE');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Sustained Anomaly Detection
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 2: Sustained Anomaly Detection');

{
  const analyzer = new TemporalContextAnalyzer();

  // Feed 3 consecutive high-pitch frames
  analyzer.processFrame(createSpikeFrame({ timestamp: 100 }));
  analyzer.processFrame(createSpikeFrame({ timestamp: 200 }));
  const res3 = analyzer.processFrame(createSpikeFrame({ timestamp: 300 }));

  // Test 9: Anomaly persisting for >= 3 frames flags isSustained=true
  assert(res3.isSustained === true, 'Test 9: 3 consecutive anomalies flag isSustained=true');
  assert(res3.sustainedFrames === 3, 'Test 9: sustainedFrames is 3');
  assert(res3.eventType === 'SUSTAINED_ANOMALY', 'Test 9: Event type is SUSTAINED_ANOMALY for single sustained channel');

  // Test 10: 4th, 5th, 6th frames accumulate sustained counter
  analyzer.processFrame(createSpikeFrame({ timestamp: 400 }));
  analyzer.processFrame(createSpikeFrame({ timestamp: 500 }));
  const res6 = analyzer.processFrame(createSpikeFrame({ timestamp: 600 }));
  assert(res6.sustainedFrames === 6, 'Test 10: sustainedFrames correctly accumulates to 6');

  // Test 11: Normal frame immediately resets sustained state
  const resNorm = analyzer.processFrame(createNormalFrame({ timestamp: 700 }));
  assert(resNorm.isSustained === false, 'Test 11: Normal frame resets isSustained to false');
  assert(resNorm.sustainedFrames === 0, 'Test 11: Normal frame resets sustainedFrames to 0');

  // Test 12: Subsequent spike starts from 1, not 7
  const resNew = analyzer.processFrame(createSpikeFrame({ timestamp: 800 }));
  assert(resNew.sustainedFrames === 0, 'Test 12: New anomaly after reset has sustainedFrames=0');
  assert(resNew.isTransient === true, 'Test 12: New anomaly after reset starts as transient');
}

{
  const analyzer = new TemporalContextAnalyzer();

  // Test 13: Sustained RMS energy anomaly
  for (let i = 0; i < 4; i++) {
    analyzer.processFrame(createNormalFrame({ rmsEnergy: 0.16, timestamp: 1000 + i * 100 }));
  }
  const resRMS = analyzer.processFrame(createNormalFrame({ rmsEnergy: 0.16, timestamp: 1400 }));
  assert(resRMS.isSustained === true, 'Test 13: Sustained high RMS flags isSustained=true');
  assert(resRMS.sustainedFrames === 5, 'Test 13: Sustained high RMS has 5 sustainedFrames');

  // Test 14: Sustained silence duration anomaly
  analyzer.reset();
  for (let i = 0; i < 3; i++) {
    analyzer.processFrame(createNormalFrame({ silenceDurationSec: 3.0, timestamp: 2000 + i * 100 }));
  }
  const resSil = analyzer.processFrame(createNormalFrame({ silenceDurationSec: 3.0, timestamp: 2300 }));
  assert(resSil.isSustained === true, 'Test 14: Sustained silence flags isSustained=true');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Cross-Signal Temporal Correlation
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 3: Cross-Signal Temporal Correlation');

{
  const analyzer = new TemporalContextAnalyzer();

  // Test 15: Single abnormal channel -> correlation 1/5 = 0.2, isMultiSignal=false
  const res1 = analyzer.processFrame(createSpikeFrame());
  assertClose(res1.multiSignalCorrelation, 0.2, 0.01, 'Test 15: Single channel gives 0.2 correlation');
  assert(res1.isMultiSignal === false, 'Test 15: Single channel is NOT multi-signal');

  // Test 16: Two abnormal channels within same frame -> correlation 2/5 = 0.4, isMultiSignal=true
  analyzer.reset();
  const res2 = analyzer.processFrame(createNormalFrame({ pitchHz: 280, rmsEnergy: 0.18 }));
  assertClose(res2.multiSignalCorrelation, 0.4, 0.01, 'Test 16: Two channels give 0.4 correlation');
  assert(res2.isMultiSignal === true, 'Test 16: Two channels isMultiSignal=true');

  // Test 17: Multi-channel co-occurrence across consecutive frames within correlation window
  analyzer.reset();
  // Frame 1: pitch spike
  analyzer.processFrame(createNormalFrame({ pitchHz: 280, timestamp: 100 }));
  // Frame 2: RMS spike (pitch normal)
  const resCross = analyzer.processFrame(createNormalFrame({ rmsEnergy: 0.18, timestamp: 200 }));
  assert(resCross.isMultiSignal === true, 'Test 17: Co-occurrence across frames inside window is multi-signal');
  assertClose(resCross.multiSignalCorrelation, 0.4, 0.01, 'Test 17: Two distinct channels in window gives 0.4 correlation');

  // Test 18: Co-occurrence of 3 signals (pitch, rms, spectral)
  const res3Ch = analyzer.processFrame(createNormalFrame({ spectralCentroid: 3000, timestamp: 300 }));
  assertClose(res3Ch.multiSignalCorrelation, 0.6, 0.01, 'Test 18: 3 channels in window gives 0.6 correlation');

  // Test 19: MULTI_SIGNAL_CORRELATION event type requires both isMultiSignal AND isSustained
  analyzer.reset();
  // Feed 3 consecutive frames with pitch + rms
  analyzer.processFrame(createNormalFrame({ pitchHz: 280, rmsEnergy: 0.18, timestamp: 100 }));
  analyzer.processFrame(createNormalFrame({ pitchHz: 280, rmsEnergy: 0.18, timestamp: 200 }));
  const resMultiSustained = analyzer.processFrame(
    createNormalFrame({ pitchHz: 280, rmsEnergy: 0.18, timestamp: 300 })
  );
  assert(resMultiSustained.isMultiSignal === true, 'Test 19: isMultiSignal is true');
  assert(resMultiSustained.isSustained === true, 'Test 19: isSustained is true');
  assert(
    resMultiSustained.eventType === 'MULTI_SIGNAL_CORRELATION',
    'Test 19: Combined multi-signal + sustained produces MULTI_SIGNAL_CORRELATION eventType'
  );

  // Test 20: Expired channels beyond correlation window (10 frames) drop out
  analyzer.reset();
  // Feed pitch spike at frame 0
  analyzer.processFrame(createNormalFrame({ pitchHz: 280, timestamp: 1000 }));
  // Feed 11 normal frames
  for (let i = 1; i <= 11; i++) {
    analyzer.processFrame(createNormalFrame({ timestamp: 1000 + i * 100 }));
  }
  // Feed RMS spike
  const resAfterExpire = analyzer.processFrame(createNormalFrame({ rmsEnergy: 0.18, timestamp: 2200 }));
  // Since pitch occurred > 10 frames ago, only RMS is in the 10-frame correlation window
  assertClose(
    resAfterExpire.multiSignalCorrelation,
    0.2,
    0.01,
    'Test 20: Channel outside 10-frame window is discarded, correlation is 0.2'
  );
  assert(resAfterExpire.isMultiSignal === false, 'Test 20: Discarded old channel means isMultiSignal is false');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: Personal Baseline Deviation Integration
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 4: Baseline Deviation Integration');

{
  const analyzer = new TemporalContextAnalyzer();

  // Test 21: Deviations with pitchZScore >= 2.0 activate pitch channel
  const devPitch: BaselineDeviationOutput = {
    baselineAvailable: true,
    pitchZScore: 2.6,
    energyZScore: 0.4,
    silenceExcessRatio: 1.0,
    spectralZScore: 0.2,
    zcrZScore: 0.1,
  };
  const resPitchDev = analyzer.processFrame(createNormalFrame(), devPitch);
  assert(resPitchDev.isTransient === true, 'Test 21: pitchZScore >= 2.0 activates pitch channel as anomaly');

  // Test 22: Deviations with energyZScore >= 2.0 activate rms channel
  analyzer.reset();
  const devEnergy: BaselineDeviationOutput = {
    baselineAvailable: true,
    pitchZScore: 0.3,
    energyZScore: 2.8,
    silenceExcessRatio: 1.0,
    spectralZScore: 0.2,
    zcrZScore: 0.1,
  };
  const resEnergyDev = analyzer.processFrame(createNormalFrame(), devEnergy);
  assert(resEnergyDev.isTransient === true, 'Test 22: energyZScore >= 2.0 activates rms channel');

  // Test 23: Deviations with silenceExcessRatio >= 1.5 activate silence channel
  analyzer.reset();
  const devSil: BaselineDeviationOutput = {
    baselineAvailable: true,
    pitchZScore: 0.0,
    energyZScore: 0.0,
    silenceExcessRatio: 1.8,
    spectralZScore: 0.0,
    zcrZScore: 0.0,
  };
  const resSilDev = analyzer.processFrame(createNormalFrame(), devSil);
  assert(resSilDev.isTransient === true, 'Test 23: silenceExcessRatio >= 1.5 activates silence channel');

  // Test 24: Deviations with spectralZScore and zcrZScore >= 2.0 activate multi-signal
  analyzer.reset();
  const devMulti: BaselineDeviationOutput = {
    baselineAvailable: true,
    pitchZScore: 0.0,
    energyZScore: 0.0,
    silenceExcessRatio: 1.0,
    spectralZScore: 2.3,
    zcrZScore: 2.5,
  };
  const resMultiDev = analyzer.processFrame(createNormalFrame(), devMulti);
  assert(resMultiDev.isMultiSignal === true, 'Test 24: 2 baseline Z-scores >= 2.0 activate isMultiSignal=true');

  // Test 25: All Z-scores < 2.0 are NOT anomalous
  analyzer.reset();
  const devNormal: BaselineDeviationOutput = {
    baselineAvailable: true,
    pitchZScore: 1.2,
    energyZScore: 1.4,
    silenceExcessRatio: 1.1,
    spectralZScore: 0.8,
    zcrZScore: 0.5,
  };
  const resDevNorm = analyzer.processFrame(createNormalFrame(), devNormal);
  assert(resDevNorm.eventType === 'NONE', 'Test 25: Sub-threshold Z-scores produce eventType NONE');
  assert(resDevNorm.isTransient === false, 'Test 25: Sub-threshold Z-scores are not transient');

  // Test 26: Null deviations fall back to prototype heuristic thresholds smoothly
  analyzer.reset();
  const resFallback = analyzer.processFrame(createNormalFrame({ pitchHz: 250 }), null);
  assert(resFallback.isTransient === true, 'Test 26: Null deviations fall back to pitchHz > 215 heuristic');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: Voice-Derived Pause and Breathing Regularity Proxy
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 5: Voice-Derived Pause / Breathing Regularity');

{
  const analyzer = new TemporalContextAnalyzer();

  // Test 27: Under 5 samples yields default regularityScore=1.0 and isIrregular=false
  for (let i = 0; i < 3; i++) {
    analyzer.processFrame(createNormalFrame());
  }
  const resFew = analyzer.processFrame(createNormalFrame());
  assert(resFew.breathingPattern.sampleCount === 4, 'Test 27: sampleCount is 4');
  assert(resFew.breathingPattern.regularityScore === 1.0, 'Test 27: < 5 samples yields regularity 1.0');
  assert(resFew.breathingPattern.isIrregular === false, 'Test 27: < 5 samples is not irregular');

  // Test 28: Continuous speech with zero pauses produces zero pauses and regularity 1.0
  analyzer.reset();
  for (let i = 0; i < 10; i++) {
    analyzer.processFrame(createNormalFrame({ isSpeech: true, silenceDurationSec: 0 }));
  }
  const resContinuous = analyzer.processFrame(createNormalFrame({ isSpeech: true }));
  assert(resContinuous.breathingPattern.pauseCount === 0, 'Test 28: Continuous speech has pauseCount 0');
  assert(resContinuous.breathingPattern.regularityScore === 1.0, 'Test 28: Zero pauses regularityScore is 1.0');
  assert(resContinuous.breathingPattern.isIrregular === false, 'Test 28: Zero pauses is not irregular');

  // Test 29: Prolonged freeze / pause (> 3.5s) triggers isIrregular=true
  analyzer.reset();
  // 5 frames of speech
  for (let i = 0; i < 5; i++) {
    analyzer.processFrame(createNormalFrame({ isSpeech: true }));
  }
  // Pause frame with silenceDurationSec = 4.2s
  const resProlonged = analyzer.processFrame(
    createNormalFrame({ isSpeech: false, silenceDurationSec: 4.2 })
  );
  assert(resProlonged.breathingPattern.isIrregular === true, 'Test 29: Pause > 3.5s flags isIrregular=true');
  assert(resProlonged.breathingPattern.regularityScore < 1.0, 'Test 29: Prolonged pause reduces regularityScore');

  // Test 30: Erratic pause pacing (high variance) flags isIrregular=true
  analyzer.reset();
  // Simulate 2 distinct pauses: one very short (0.3s) and one long (3.2s)
  analyzer.processFrame(createNormalFrame({ isSpeech: true }));
  analyzer.processFrame(createNormalFrame({ isSpeech: false, silenceDurationSec: 0.3 }));
  analyzer.processFrame(createNormalFrame({ isSpeech: true }));
  analyzer.processFrame(createNormalFrame({ isSpeech: true }));
  analyzer.processFrame(createNormalFrame({ isSpeech: false, silenceDurationSec: 3.2 }));
  analyzer.processFrame(createNormalFrame({ isSpeech: true })); // 1st frame after pause
  const resErratic = analyzer.processFrame(createNormalFrame({ isSpeech: true })); // 2nd normal frame: transient cleared
  assert(resErratic.breathingPattern.pauseCount >= 2, 'Test 30: Detected multiple discrete pause episodes');
  assert(resErratic.breathingPattern.pauseVariability > 2.0, 'Test 30: Pause duration variance is > 2.0');
  assert(resErratic.breathingPattern.isIrregular === true, 'Test 30: Erratic pause variance flags isIrregular=true');

  // Test 31: BREATHING_PATTERN_ANOMALY eventType when irregular pauses occur without vocal spikes
  assert(
    resErratic.eventType === 'BREATHING_PATTERN_ANOMALY',
    'Test 31: Irregular pause pattern produces BREATHING_PATTERN_ANOMALY eventType'
  );

  // Test 32: Explanation mentions voice-derived pacing without medical claims
  assert(
    resErratic.explanation.toLowerCase().includes('voice-derived') ||
    resErratic.explanation.toLowerCase().includes('pacing'),
    'Test 32: Explanation uses voice-derived/conversational turn-pacing terminology'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: Bounds, Safety, and Robustness
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 6: Bounds, Safety, and Robustness');

{
  const analyzer = new TemporalContextAnalyzer();

  // Test 33: Initial normal frame
  const initRes = analyzer.processFrame(createNormalFrame());
  assert(initRes.eventType === 'NONE', 'Test 33: First normal frame is NONE');
  assert(initRes.sustainedFrames === 0, 'Test 33: sustainedFrames is 0');
  assert(initRes.transientFrames === 0, 'Test 33: transientFrames is 0');
  assert(initRes.multiSignalCorrelation === 0, 'Test 33: correlation is 0');

  // Test 34: Null pitchHz handled without error
  const nullPitchRes = analyzer.processFrame(createNormalFrame({ pitchHz: null }));
  assert(nullPitchRes.isTransient === false, 'Test 34: Null pitch is handled safely as non-anomalous');

  // Test 35: Null spectralCentroid handled without error
  const nullSpecRes = analyzer.processFrame(createNormalFrame({ spectralCentroid: null }));
  assert(nullSpecRes.isTransient === false, 'Test 35: Null spectral centroid is handled safely');

  // Test 36: Extreme finite values do not cause NaN or crashes
  const extremeRes = analyzer.processFrame(
    createNormalFrame({ pitchHz: 8000, rmsEnergy: 99.9, silenceDurationSec: 500 })
  );
  assert(Number.isFinite(extremeRes.multiSignalCorrelation), 'Test 36: Extreme inputs yield finite correlation');
  assert(Number.isFinite(extremeRes.breathingPattern.regularityScore), 'Test 36: Regularity score is finite');

  // Test 37: History buffer bounded to windowSize (30 frames)
  analyzer.reset();
  for (let i = 0; i < 50; i++) {
    analyzer.processFrame(createNormalFrame({ timestamp: 1000 + i * 100 }));
  }
  // Internal check via breathingPattern sample count
  const resBounded = analyzer.processFrame(createNormalFrame({ timestamp: 6000 }));
  assert(
    resBounded.breathingPattern.sampleCount <= DEFAULT_TEMPORAL_CONFIG.windowSize + 1,
    'Test 37: Observation history remains strictly bounded by windowSize'
  );

  // Test 38: reset() clears all state
  analyzer.processFrame(createSpikeFrame());
  analyzer.processFrame(createSpikeFrame());
  analyzer.processFrame(createSpikeFrame());
  analyzer.reset();
  const resAfterReset = analyzer.processFrame(createNormalFrame());
  assert(resAfterReset.sustainedFrames === 0, 'Test 38: reset() clears sustainedFrames');
  assert(resAfterReset.isTransient === false, 'Test 38: reset() clears transient state');
  assert(resAfterReset.eventType === 'NONE', 'Test 38: reset() restores eventType to NONE');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: IncidentManager & False-Positive Suppression Integration
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 7: IncidentManager & False-Positive Suppression Integration');

{
  const manager = new IncidentManager();
  clearHistory();

  // Test 39: Isolated transient spike suppresses emergency alert dispatch even if RiskEngine flags HIGH_RISK
  const transientContext: IncidentContext = {
    temporalContext: {
      eventType: 'TRANSIENT_SPIKE',
      sustainedFrames: 0,
      transientFrames: 1,
      multiSignalCorrelation: 0.2,
      isTransient: true,
      isSustained: false,
      isMultiSignal: false,
      breathingPattern: {
        sampleCount: 1,
        pauseCount: 0,
        meanPauseDurationSec: 0,
        pauseVariability: 0,
        regularityScore: 1.0,
        isIrregular: false,
      },
      explanation: 'Transient vocal spike — monitoring continues.',
    },
  };

  const evalHigh = createMockEvaluation();
  const resTransient = manager.processEvaluation(evalHigh, transientContext);

  assert(resTransient.alert === null, 'Test 39: Isolated transient spike suppresses alert dispatch');
  assert(resTransient.isNewIncident === false, 'Test 39: Isolated transient spike does NOT create new incident');
  assert(manager.isLatched() === false, 'Test 39: IncidentManager remains unlatched during transient spike');

  // Test 40: Sustained high risk (isSustained=true) bypasses suppression and dispatches silent alert
  const sustainedContext: IncidentContext = {
    temporalContext: {
      eventType: 'SUSTAINED_ANOMALY',
      sustainedFrames: 4,
      transientFrames: 0,
      multiSignalCorrelation: 0.2,
      isTransient: false,
      isSustained: true,
      isMultiSignal: false,
      breathingPattern: {
        sampleCount: 10,
        pauseCount: 0,
        meanPauseDurationSec: 0,
        pauseVariability: 0,
        regularityScore: 1.0,
        isIrregular: false,
      },
      explanation: 'Acoustic anomaly sustained across 4 frames.',
    },
  };

  const resSustained = manager.processEvaluation(evalHigh, sustainedContext);
  assert(resSustained.alert !== null, 'Test 40: Sustained HIGH_RISK dispatches silent alert');
  assert(resSustained.isNewIncident === true, 'Test 40: Sustained HIGH_RISK creates new incident');
  assert(manager.isLatched() === true, 'Test 40: IncidentManager latches on sustained high risk');
  assert(
    resSustained.incident?.temporalContext?.eventType === 'SUSTAINED_ANOMALY',
    'Test 40: Incident preserves temporalContext metadata'
  );

  // Test 41: While latched, ongoing evaluation updates incident without duplicate alert
  const resOngoing = manager.processEvaluation(evalHigh, sustainedContext);
  assert(resOngoing.alert === null, 'Test 41: No duplicate alert while latched');
  assert(resOngoing.isNewIncident === false, 'Test 41: isNewIncident is false for ongoing frames');

  // Test 42: Resolution when risk drops to LOW_RISK
  const evalLow: RiskEvaluation = {
    ...evalHigh,
    riskScore: 20,
    riskLevel: 'LOW_RISK',
    isConfirmed: false,
  };
  const resResolved = manager.processEvaluation(evalLow);
  assert(resResolved.incident?.status === 'RESOLVED', 'Test 42: Dropping risk resolves active incident');
  assert(manager.isLatched() === false, 'Test 42: Manager unlatches after resolution');

  // Test 43: Multi-signal high risk (isMultiSignal=true) also bypasses suppression immediately
  const multiSignalContext: IncidentContext = {
    temporalContext: {
      eventType: 'MULTI_SIGNAL_CORRELATION',
      sustainedFrames: 1,
      transientFrames: 1,
      multiSignalCorrelation: 0.6,
      isTransient: true, // even if marked transient on frame 1...
      isSustained: false,
      isMultiSignal: true, // ...multi-signal correlation ensures it is NOT suppressed!
      breathingPattern: {
        sampleCount: 5,
        pauseCount: 0,
        meanPauseDurationSec: 0,
        pauseVariability: 0,
        regularityScore: 1.0,
        isIrregular: false,
      },
      explanation: 'Multiple signals correlated.',
    },
  };

  const resMulti = manager.processEvaluation(evalHigh, multiSignalContext);
  assert(resMulti.alert !== null, 'Test 43: Multi-signal distress bypasses transient suppression and dispatches');
  assert(manager.isLatched() === true, 'Test 43: Manager latches on multi-signal distress');

  // Test 44: Null evaluation returns safe empty result
  const resNull = manager.processEvaluation(null);
  assert(resNull.alert === null, 'Test 44: Null evaluation produces null alert');
  assert(resNull.isNewIncident === false, 'Test 44: Null evaluation produces false isNewIncident');
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n════════════════════════════════════════');
console.log('  Sanket Phase 8 Temporal Context Tests');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
