/**
 * Sanket, Phase 6: Baseline Builder & Deviation Tests
 *
 * Tests for:
 *   - BaselineBuilder (Welford online statistics)
 *   - calculateBaselineDeviation (Z-score computation)
 *   - baselineToRiskEngineConfig (profile → engine config mapping)
 *
 * No browser, DOM, or microphone required.
 * All tests use synthetic feature sets and deterministic arithmetic.
 */

import { BaselineBuilder, welfordUpdate, welfordStdDev, createWelfordState } from '../baselineBuilder';
import {
  calculateBaselineDeviation,
  baselineToRiskEngineConfig,
  Z_SCORE_CAP,
  PITCH_STDDEV_FLOOR,
} from '../baselineDeviation';
import type { FeatureSet, BaselineProfile } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
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
  assert(Math.abs(a - b) <= tolerance, `${testName} (expected ~${b}, got ${a.toFixed(6)})`);
}

function assertNull(v: unknown, testName: string): void {
  assert(v === null || v === undefined, `${testName} (expected null/undefined, got ${String(v)})`);
}

function printSection(label: string): void {
  console.log(`\n─── ${label} ───`);
}

function syntheticFrame(overrides: Partial<FeatureSet> = {}): FeatureSet {
  return {
    timestamp: 1000,
    rmsEnergy: 0.06,
    zeroCrossingRate: 0.15,
    spectralCentroid: 1500,
    pitchHz: 180,
    isSpeech: true,
    silenceDurationSec: 0,
    speechActivityDurationSec: 1.0,
    speechSegmentCount: 1,
    ...overrides,
  };
}

function syntheticSilenceFrame(silenceDurationSec: number): FeatureSet {
  return {
    timestamp: 1000,
    rmsEnergy: 0.002,
    zeroCrossingRate: 0.05,
    spectralCentroid: null,
    pitchHz: null,
    isSpeech: false,
    silenceDurationSec,
    speechActivityDurationSec: 0,
    speechSegmentCount: 0,
  };
}

// Build a synthetic BaselineProfile with explicit values
function makeProfile(overrides: Partial<BaselineProfile> = {}): BaselineProfile {
  return {
    userId: 'test-user',
    calibratedAt: Date.now(),
    pitchMean: 180,
    pitchStdDev: 20,
    energyMean: 0.06,
    energyStdDev: 0.01,
    normalSilenceThresholdSec: 1.5,
    zcrMean: 0.15,
    zcrStdDev: 0.03,
    spectralMean: 1500,
    spectralStdDev: 200,
    frameCount: 50,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Welford Algorithm, Unit Tests
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n════════════════════════════════════════');
console.log('  Sanket Phase 6 Baseline Tests');
console.log('════════════════════════════════════════');

printSection('A. Welford Online Algorithm');

{
  // One sample
  const s0 = createWelfordState();
  const s1 = welfordUpdate(s0, 10);
  assert(s1.count === 1, 'After 1 sample: count = 1');
  assert(s1.mean === 10, 'After 1 sample: mean = sample value');
  assert(s1.m2 === 0, 'After 1 sample: M2 = 0');
  assert(welfordStdDev(s1) === 0, 'After 1 sample: stdDev = 0 (insufficient)');

  // Two samples: [10, 20] → mean=15, variance=50, stdDev≈7.071
  const s2 = welfordUpdate(s1, 20);
  assert(s2.count === 2, 'After 2 samples: count = 2');
  assertClose(s2.mean, 15, 0.0001, 'After 2 samples: mean = 15');
  assertClose(welfordStdDev(s2), 7.0711, 0.001, 'After 2 samples: stdDev ≈ 7.071');

  // Three samples: [10, 20, 30] → mean=20, variance=100, stdDev=10
  const s3 = welfordUpdate(s2, 30);
  assertClose(s3.mean, 20, 0.0001, 'After 3 samples: mean = 20');
  assertClose(welfordStdDev(s3), 10, 0.0001, 'After 3 samples: stdDev = 10');

  // 100 samples: identical values → stdDev = 0
  let s = createWelfordState();
  for (let i = 0; i < 100; i++) s = welfordUpdate(s, 5.0);
  assertClose(s.mean, 5.0, 0.0001, '100 identical samples: mean = 5.0');
  assertClose(welfordStdDev(s), 0, 0.0001, '100 identical samples: stdDev = 0');

  // Numerical stability: large values
  let sl = createWelfordState();
  for (let i = 0; i < 50; i++) sl = welfordUpdate(sl, 1_000_000 + i);
  assertClose(sl.mean, 1_000_024.5, 0.01, 'Large values: mean is numerically stable');
  // Expected stdDev for 0..49 = sqrt(sum of (i-24.5)^2 / 49) = sqrt(212.5) ≈ 14.577
  assertClose(welfordStdDev(sl), 14.577, 0.1, 'Large values: stdDev is numerically stable');
}

// ─────────────────────────────────────────────────────────────────────────────
// B. BaselineBuilder, Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

printSection('B. BaselineBuilder Lifecycle');

{
  const builder = new BaselineBuilder({ minVoicedFrames: 5 });

  // Before start, frames are ignored
  builder.addFrame(syntheticFrame());
  assert(builder.getVoicedFrameCount() === 0, 'Frames ignored before start()');
  assert(!builder.isActive(), 'Not active before start()');
  assert(!builder.isReady(), 'Not ready before start()');

  builder.start();
  assert(builder.isActive(), 'Active after start()');
  assert(builder.getVoicedFrameCount() === 0, 'Voiced frames = 0 right after start()');

  // Feed 4 voiced frames, should not be ready
  for (let i = 0; i < 4; i++) builder.addFrame(syntheticFrame({ pitchHz: 170 + i * 5 }));
  assert(builder.getVoicedFrameCount() === 4, 'Voiced frames = 4');
  assert(!builder.isReady(), 'Not ready at 4/5 voiced frames');
  assert(builder.getProgress() < 1.0, 'Progress < 1.0 at 4/5');

  // Feed 1 more, now ready
  builder.addFrame(syntheticFrame({ pitchHz: 190 }));
  assert(builder.getVoicedFrameCount() === 5, 'Voiced frames = 5');
  assert(builder.isReady(), 'Ready at 5/5 voiced frames');
  assertClose(builder.getProgress(), 1.0, 0.001, 'Progress = 1.0 when ready');

  // Finalize
  const profile = builder.finalize('test-user');
  assert(profile.userId === 'test-user', 'Profile userId matches');
  assert(profile.frameCount === 5, 'Profile frameCount = 5');
  assert(profile.pitchMean > 0, 'Profile pitchMean > 0');
  assert(!builder.isActive(), 'Not active after finalize()');

  // Expect pitch mean ≈ (170+175+180+185+190)/5 = 180
  assertClose(profile.pitchMean, 180, 0.01, 'Pitch mean ≈ 180 for 5 evenly spaced samples');
}

// ─────────────────────────────────────────────────────────────────────────────
// C. BaselineBuilder, Finalize throws if not ready
// ─────────────────────────────────────────────────────────────────────────────

printSection('C. BaselineBuilder, Throws when Insufficient Data');

{
  const builder = new BaselineBuilder({ minVoicedFrames: 10 });
  builder.start();
  builder.addFrame(syntheticFrame()); // only 1 voiced frame
  let threw = false;
  try {
    builder.finalize('u1');
  } catch {
    threw = true;
  }
  assert(threw, 'finalize() throws when voiced frames < minVoicedFrames');
}

// ─────────────────────────────────────────────────────────────────────────────
// D. BaselineBuilder, Silence and Unvoiced Frames
// ─────────────────────────────────────────────────────────────────────────────

printSection('D. BaselineBuilder, Silence Frame Handling');

{
  const builder = new BaselineBuilder({ minVoicedFrames: 3 });
  builder.start();

  // 2 voiced frames
  builder.addFrame(syntheticFrame({ rmsEnergy: 0.08 }));
  builder.addFrame(syntheticFrame({ rmsEnergy: 0.10 }));
  // 5 silence frames (shouldn't count toward voiced count)
  for (let i = 1; i <= 5; i++) builder.addFrame(syntheticSilenceFrame(i * 0.5));
  // 1 more voiced
  builder.addFrame(syntheticFrame({ rmsEnergy: 0.09 }));

  assert(builder.getVoicedFrameCount() === 3, 'Silence frames do not count as voiced');
  assert(builder.isReady(), 'Ready after 3 voiced frames regardless of silence');

  const profile = builder.finalize('u2');
  // energyMean ≈ (0.08 + 0.10 + 0.09) / 3 = 0.09
  assertClose(profile.energyMean, 0.09, 0.001, 'Energy mean from voiced frames only');
  // normalSilenceThresholdSec: mean of [0.5, 1.0, 1.5, 2.0, 2.5] = 1.5
  assertClose(profile.normalSilenceThresholdSec, 1.5, 0.01, 'Silence threshold = mean of silence frames');
}

// ─────────────────────────────────────────────────────────────────────────────
// E. BaselineBuilder, Pitch Out of Range Discarded
// ─────────────────────────────────────────────────────────────────────────────

printSection('E. BaselineBuilder, Pitch Range Filtering');

{
  const builder = new BaselineBuilder({ minVoicedFrames: 3, pitchRangeHz: [80, 400] });
  builder.start();
  // 3 valid voiced frames at 200Hz
  builder.addFrame(syntheticFrame({ pitchHz: 200 }));
  builder.addFrame(syntheticFrame({ pitchHz: 200 }));
  builder.addFrame(syntheticFrame({ pitchHz: 200 }));
  // Frame with out-of-range pitch (above 400 Hz)
  builder.addFrame(syntheticFrame({ pitchHz: 600 }));
  // Frame with below-range pitch (below 80 Hz)
  builder.addFrame(syntheticFrame({ pitchHz: 40 }));

  const profile = builder.finalize('u3');
  // Only the 3 × 200Hz pitches should be included
  assertClose(profile.pitchMean, 200, 0.01, 'Out-of-range pitch values are discarded');
  assert(profile.pitchStdDev < 1, 'StdDev near 0 for identical valid pitch samples');
}

// ─────────────────────────────────────────────────────────────────────────────
// F. BaselineBuilder, Reset Clears State
// ─────────────────────────────────────────────────────────────────────────────

printSection('F. BaselineBuilder, Reset');

{
  const builder = new BaselineBuilder({ minVoicedFrames: 2 });
  builder.start();
  builder.addFrame(syntheticFrame({ pitchHz: 300 }));
  builder.addFrame(syntheticFrame({ pitchHz: 300 }));
  assert(builder.isReady(), 'Ready before reset');
  builder.reset();
  assert(!builder.isActive(), 'Not active after reset');
  assert(!builder.isReady(), 'Not ready after reset');
  assert(builder.getVoicedFrameCount() === 0, 'Voiced frames = 0 after reset');
  // Starting again should work from scratch
  builder.start();
  builder.addFrame(syntheticFrame({ pitchHz: 150 }));
  builder.addFrame(syntheticFrame({ pitchHz: 150 }));
  const profile = builder.finalize('u4');
  assertClose(profile.pitchMean, 150, 0.01, 'After reset and re-calibration: new pitch mean used');
}

// ─────────────────────────────────────────────────────────────────────────────
// G. BaselineBuilder, Running Stats During Calibration
// ─────────────────────────────────────────────────────────────────────────────

printSection('G. BaselineBuilder, Running Stats');

{
  const builder = new BaselineBuilder({ minVoicedFrames: 5 });
  builder.start();
  const s0 = builder.getRunningStats();
  assert(s0.pitchMean === null, 'Running pitchMean null before 3 voiced frames');
  assert(s0.isReady === false, 'isReady false initially');

  for (let i = 0; i < 3; i++) builder.addFrame(syntheticFrame({ pitchHz: 200 }));
  const s3 = builder.getRunningStats();
  assert(s3.pitchMean !== null, 'Running pitchMean available after 3 voiced frames');
  assertClose(s3.pitchMean!, 200, 0.01, 'Running pitchMean ≈ 200 after 3 identical samples');
  assert(s3.voicedFrames === 3, 'voicedFrames = 3');
  assertClose(s3.progress, 0.6, 0.01, 'Progress = 0.6 at 3/5');
}

// ─────────────────────────────────────────────────────────────────────────────
// H. calculateBaselineDeviation, No Baseline
// ─────────────────────────────────────────────────────────────────────────────

printSection('H. calculateBaselineDeviation, No Baseline');

{
  const features = syntheticFrame();
  const result = calculateBaselineDeviation(features, null);
  assert(result.baselineAvailable === false, 'null baseline → baselineAvailable=false');
  const result2 = calculateBaselineDeviation(features, undefined);
  assert(result2.baselineAvailable === false, 'undefined baseline → baselineAvailable=false');
}

// ─────────────────────────────────────────────────────────────────────────────
// I. calculateBaselineDeviation, Z-Score Computation
// ─────────────────────────────────────────────────────────────────────────────

printSection('I. calculateBaselineDeviation, Z-Score Accuracy');

{
  const profile = makeProfile({
    pitchMean: 180, pitchStdDev: 20,
    energyMean: 0.06, energyStdDev: 0.01,
    zcrMean: 0.15, zcrStdDev: 0.03,
    spectralMean: 1500, spectralStdDev: 200,
  });

  // Exact mean → Z-score = 0
  const exactMean = calculateBaselineDeviation(syntheticFrame({
    pitchHz: 180, rmsEnergy: 0.06, zeroCrossingRate: 0.15, spectralCentroid: 1500,
  }), profile);
  assert(exactMean.baselineAvailable === true, 'baselineAvailable=true when profile provided');
  assertClose((exactMean as { pitchZScore: number }).pitchZScore, 0, 0.001, 'Pitch at mean → Z=0');
  assertClose((exactMean as { energyZScore: number }).energyZScore, 0, 0.001, 'Energy at mean → Z=0');

  // +1 stdDev → Z-score = 1
  const oneSigma = calculateBaselineDeviation(syntheticFrame({
    pitchHz: 200, // 180 + 20
    rmsEnergy: 0.07, // 0.06 + 0.01
    zeroCrossingRate: 0.18, // 0.15 + 0.03
    spectralCentroid: 1700, // 1500 + 200
  }), profile);
  assertClose((oneSigma as { pitchZScore: number }).pitchZScore, 1.0, 0.01, 'Pitch +1σ → Z≈1.0');
  assertClose((oneSigma as { energyZScore: number }).energyZScore, 1.0, 0.01, 'Energy +1σ → Z≈1.0');
  assertClose((oneSigma as { zcrZScore: number }).zcrZScore, 1.0, 0.01, 'ZCR +1σ → Z≈1.0');
  assertClose((oneSigma as { spectralZScore: number }).spectralZScore, 1.0, 0.01, 'Spectral +1σ → Z≈1.0');

  // +2 stdDev → Z-score = 2
  const twoSigma = calculateBaselineDeviation(syntheticFrame({
    pitchHz: 220, // 180 + 40 = +2σ
    rmsEnergy: 0.08, // 0.06 + 0.02 = +2σ
  }), profile);
  assertClose((twoSigma as { pitchZScore: number }).pitchZScore, 2.0, 0.01, 'Pitch +2σ → Z≈2.0');
  assertClose((twoSigma as { energyZScore: number }).energyZScore, 2.0, 0.01, 'Energy +2σ → Z≈2.0');

  // Z-score is absolute value (below mean also → positive Z)
  const belowMean = calculateBaselineDeviation(syntheticFrame({
    pitchHz: 140, // 180 - 40 = -2σ → |Z| = 2
    rmsEnergy: 0.04, // 0.06 - 0.02 = -2σ → |Z| = 2
  }), profile);
  assertClose((belowMean as { pitchZScore: number }).pitchZScore, 2.0, 0.01, 'Pitch -2σ → |Z|=2.0');
  assertClose((belowMean as { energyZScore: number }).energyZScore, 2.0, 0.01, 'Energy -2σ → |Z|=2.0');
}

// ─────────────────────────────────────────────────────────────────────────────
// J. calculateBaselineDeviation, Z-Score Cap
// ─────────────────────────────────────────────────────────────────────────────

printSection('J. calculateBaselineDeviation, Z-Score Cap');

{
  const profile = makeProfile({ pitchMean: 180, pitchStdDev: 20 });
  // Extreme outlier: 400 Hz = (400-180)/20 = Z=11 → should be capped at Z_SCORE_CAP
  const extreme = calculateBaselineDeviation(syntheticFrame({ pitchHz: 400 }), profile);
  assert(
    (extreme as { pitchZScore: number }).pitchZScore <= Z_SCORE_CAP,
    `Extreme pitch deviation capped at Z_SCORE_CAP (${Z_SCORE_CAP})`
  );
  assertClose((extreme as { pitchZScore: number }).pitchZScore, Z_SCORE_CAP, 0.001, 'Capped Z = Z_SCORE_CAP');
}

// ─────────────────────────────────────────────────────────────────────────────
// K. calculateBaselineDeviation, StdDev Floor
// ─────────────────────────────────────────────────────────────────────────────

printSection('K. calculateBaselineDeviation, StdDev Floor');

{
  // StdDev = 0 (perfectly consistent speaker) → floor prevents infinity
  const profile = makeProfile({ pitchMean: 180, pitchStdDev: 0, energyMean: 0.06, energyStdDev: 0 });
  const result = calculateBaselineDeviation(syntheticFrame({ pitchHz: 200 }), profile);
  assert(Number.isFinite((result as { pitchZScore: number }).pitchZScore), 'Z-score is finite when stdDev=0 (floor applied)');
  // Z = |200-180| / PITCH_STDDEV_FLOOR
  const expected = Math.min(Math.abs(200 - 180) / PITCH_STDDEV_FLOOR, Z_SCORE_CAP);
  assertClose((result as { pitchZScore: number }).pitchZScore, expected, 0.01, 'Z-score uses floor when stdDev=0');
}

// ─────────────────────────────────────────────────────────────────────────────
// L. calculateBaselineDeviation, Unvoiced Frames
// ─────────────────────────────────────────────────────────────────────────────

printSection('L. calculateBaselineDeviation, Unvoiced / Silence Frames');

{
  const profile = makeProfile({ normalSilenceThresholdSec: 2.0 });

  // Silence frame: no pitch/energy/ZCR/spectral Z-scores
  const silenceResult = calculateBaselineDeviation(syntheticSilenceFrame(3.0), profile);
  assert(silenceResult.baselineAvailable === true, 'baselineAvailable=true on silence frame');
  assertNull((silenceResult as { pitchZScore: null }).pitchZScore, 'Silence frame: pitchZScore=null');
  assertNull((silenceResult as { energyZScore: null }).energyZScore, 'Silence frame: energyZScore=null');

  // Silence excess ratio: 3.0 / 2.0 = 1.5
  assertClose((silenceResult as { silenceExcessRatio: number }).silenceExcessRatio, 1.5, 0.001,
    'Silence excess ratio = silenceDuration / normalSilenceThreshold');

  // Short silence (below threshold): ratio < 1
  const shortSilence = calculateBaselineDeviation(syntheticSilenceFrame(1.0), profile);
  assertClose((shortSilence as { silenceExcessRatio: number }).silenceExcessRatio, 0.5, 0.001,
    'Short silence: excess ratio < 1');

  // Voiced frame: no silence excess ratio
  const voicedResult = calculateBaselineDeviation(syntheticFrame(), profile);
  assertNull((voicedResult as { silenceExcessRatio: null }).silenceExcessRatio,
    'Voiced frame: silenceExcessRatio=null');
}

// ─────────────────────────────────────────────────────────────────────────────
// M. calculateBaselineDeviation, Null Pitch
// ─────────────────────────────────────────────────────────────────────────────

printSection('M. calculateBaselineDeviation, Null Pitch Handling');

{
  const profile = makeProfile();
  const frame = syntheticFrame({ pitchHz: null });
  const result = calculateBaselineDeviation(frame, profile);
  assertNull((result as { pitchZScore: null }).pitchZScore, 'null pitchHz → pitchZScore=null');
  // Energy still computed (isSpeech=true)
  assert((result as { energyZScore: number | null }).energyZScore !== null, 'Energy Z-score computed despite null pitch');
}

// ─────────────────────────────────────────────────────────────────────────────
// N. baselineToRiskEngineConfig, Correct Mapping
// ─────────────────────────────────────────────────────────────────────────────

printSection('N. baselineToRiskEngineConfig, Engine Config Mapping');

{
  const profile = makeProfile({
    pitchMean: 220,
    energyMean: 0.09,
    normalSilenceThresholdSec: 2.0,
  });
  const config = baselineToRiskEngineConfig(profile);

  assertClose(config.pitchBaselineRef, 220, 0.001, 'pitchBaselineRef = profile pitchMean');
  assertClose(config.rmsBaselineRef, 0.09, 0.001, 'rmsBaselineRef = profile energyMean');
  // silenceOnsetSec = max(2.0 * 1.5, 1.0) = 3.0
  assertClose(config.silenceOnsetSec, 3.0, 0.001, 'silenceOnsetSec = normalSilenceThresholdSec × 1.5');

  // Low silence threshold → floored to 1.0
  const lowProfile = makeProfile({ normalSilenceThresholdSec: 0.3 });
  const lowConfig = baselineToRiskEngineConfig(lowProfile);
  assert(lowConfig.silenceOnsetSec >= 1.0, 'silenceOnsetSec is at minimum 1.0');
}

// ─────────────────────────────────────────────────────────────────────────────
// O. Full Integration: Build Baseline → Compute Deviation → Update RiskEngine
// ─────────────────────────────────────────────────────────────────────────────

printSection('O. Integration: Build → Deviate → Engine Config');

{
  // 1. Build a baseline from 40 voiced frames at known values
  const builder = new BaselineBuilder({ minVoicedFrames: 30 });
  builder.start();
  for (let i = 0; i < 40; i++) {
    builder.addFrame(syntheticFrame({
      pitchHz: 160 + (i % 5) * 5,         // oscillates 160–180 → mean ≈ 170
      rmsEnergy: 0.07 + (i % 3) * 0.005,  // oscillates → mean ≈ 0.075
      zeroCrossingRate: 0.12,
      spectralCentroid: 1400,
    }));
  }
  assert(builder.isReady(), 'Integration: builder ready after 40 frames');
  const profile = builder.finalize('integration-user');

  // 2. Verify profile stats
  assertClose(profile.pitchMean, 170, 2, 'Integration: pitch mean ≈ 170');
  assert(profile.pitchStdDev > 0, 'Integration: pitch stdDev > 0 (has variation)');

  // 3. Compute deviation for a frame at known baseline
  const atMean = calculateBaselineDeviation(syntheticFrame({ pitchHz: profile.pitchMean }), profile);
  assert(atMean.baselineAvailable === true, 'Integration: deviation computed');
  assert((atMean as { pitchZScore: number }).pitchZScore < 1.0, 'Integration: frame at mean → low Z-score');

  // 4. Compute deviation for a frame 3σ above mean
  const elevated = calculateBaselineDeviation(syntheticFrame({
    pitchHz: profile.pitchMean + 3 * profile.pitchStdDev,
  }), profile);
  assert((elevated as { pitchZScore: number }).pitchZScore > 2.0, 'Integration: 3σ pitch deviation → Z > 2');

  // 5. Config mapping
  const engineConfig = baselineToRiskEngineConfig(profile);
  assertClose(engineConfig.pitchBaselineRef, profile.pitchMean, 0.01, 'Integration: engine config uses profile pitch mean');
}

// ─────────────────────────────────────────────────────────────────────────────
// P. Privacy: No Raw Audio Retention
// ─────────────────────────────────────────────────────────────────────────────

printSection('P. Privacy Invariants');

{
  const builder = new BaselineBuilder({ minVoicedFrames: 3 });
  builder.start();
  builder.addFrame(syntheticFrame({ pitchHz: 200, rmsEnergy: 0.08 }));
  builder.addFrame(syntheticFrame({ pitchHz: 210, rmsEnergy: 0.09 }));
  builder.addFrame(syntheticFrame({ pitchHz: 220, rmsEnergy: 0.10 }));
  const profile = builder.finalize('privacy-user');

  // Verify profile contains only statistics, not raw samples
  const profileKeys = Object.keys(profile);
  assert(!profileKeys.includes('rawSamples'), 'Profile does not store raw audio samples');
  assert(!profileKeys.includes('frames'), 'Profile does not store frame history');
  assert(!profileKeys.includes('audioBuffer'), 'Profile does not store audio buffers');
  assert(profileKeys.includes('pitchMean'), 'Profile stores mean statistic');
  assert(profileKeys.includes('pitchStdDev'), 'Profile stores stdDev statistic');
  assert(typeof profile.pitchMean === 'number', 'Profile stats are numbers, not arrays');
}

// ─────────────────────────────────────────────────────────────────────────────
// Q. Determinism
// ─────────────────────────────────────────────────────────────────────────────

printSection('Q. Determinism');

{
  // Same input frames → identical profile on two builders
  const b1 = new BaselineBuilder({ minVoicedFrames: 5 });
  const b2 = new BaselineBuilder({ minVoicedFrames: 5 });
  b1.start(); b2.start();
  const frames: FeatureSet[] = [
    syntheticFrame({ pitchHz: 150, rmsEnergy: 0.05 }),
    syntheticFrame({ pitchHz: 160, rmsEnergy: 0.06 }),
    syntheticFrame({ pitchHz: 170, rmsEnergy: 0.07 }),
    syntheticFrame({ pitchHz: 180, rmsEnergy: 0.08 }),
    syntheticFrame({ pitchHz: 190, rmsEnergy: 0.09 }),
  ];
  frames.forEach((f) => { b1.addFrame(f); b2.addFrame(f); });
  const p1 = b1.finalize('u1');
  const p2 = b2.finalize('u2');
  assertClose(p1.pitchMean, p2.pitchMean, 0.0001, 'Determinism: same frames → identical pitchMean');
  assertClose(p1.pitchStdDev, p2.pitchStdDev, 0.0001, 'Determinism: same frames → identical pitchStdDev');
  assertClose(p1.energyMean, p2.energyMean, 0.0001, 'Determinism: same frames → identical energyMean');
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n════════════════════════════════════════');
console.log('  Sanket Phase 6 Baseline Tests');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
