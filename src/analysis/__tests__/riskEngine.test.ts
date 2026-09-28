/**
 * Sanket, Risk Engine Deterministic Tests (Phase 3)
 *
 * Tests the RiskEngine using synthetic FeatureSet objects.
 * NO browser, NO DOM, NO microphone, NO browser automation.
 *
 * Run with: npx tsx src/analysis/__tests__/riskEngine.test.ts
 *
 * Test categories:
 *  A. Normal FeatureSet → low risk
 *  B. Single-signal ceiling: no individual signal reaches CRITICAL
 *  C. Multi-signal combination → elevated risk
 *  D. Temporal persistence → sustained abnormality raises risk
 *  E. Brief spike → does not immediately reach CRITICAL
 *  F. Sustained multi-signal → can reach CRITICAL
 *  G. Score decay → normalizing signals bring score down
 *  H. Null/missing pitch → no crash, handled gracefully
 *  I. Score always bounded [0, 100]
 *  J. Risk level thresholds are deterministic
 *  K. Same input sequence → same output sequence (determinism)
 *  L. Engine reset clears state
 *  M. External signal injection is bounded
 *  N. Signal contributions explain score
 *  O. Single signal provably cannot reach CRITICAL alone
 */

import { RiskEngine, scoreToLevel, linearScore, clamp } from '../riskEngine';
import type { FeatureSet } from '../../analysis/types';

// ─────────────────────────────────────────────────────────────────────────────
// Test Harness
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, extra = ''): void {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${extra ? ', ' + extra : ''}`);
    failed++;
  }
}

function assertClose(a: number, b: number, tolerance: number, label: string): void {
  const diff = Math.abs(a - b);
  assert(
    diff <= tolerance,
    label,
    `got ${a.toFixed(3)}, expected ~${b.toFixed(3)}, diff=${diff.toFixed(3)}`
  );
}

function section(title: string): void {
  console.log(`\n─── ${title} ───`);
}

// ─────────────────────────────────────────────────────────────────────────────
// FeatureSet Factories
// ─────────────────────────────────────────────────────────────────────────────

/** Baseline: normal calm conversational speech. All values within expected ranges. */
function normalFeatureSet(timestamp = 1000): FeatureSet {
  return {
    timestamp,
    rmsEnergy: 0.06,          // normal conversational amplitude
    zeroCrossingRate: 0.08,   // low ZCR (voiced speech)
    spectralCentroid: 1200,   // normal speech centroid
    pitchHz: 160,             // close to reference (165 Hz)
    isSpeech: true,
    silenceDurationSec: 0,
    speechActivityDurationSec: 3.0,
    speechSegmentCount: 2,
  };
}

/** High pitch deviation only */
function highPitchFeatureSet(pitchHz = 320, timestamp = 1000): FeatureSet {
  return { ...normalFeatureSet(timestamp), pitchHz };
}

/** Prolonged silence only */
function silenceFeatureSet(silenceDurationSec = 5.0, timestamp = 1000): FeatureSet {
  return {
    ...normalFeatureSet(timestamp),
    isSpeech: false,
    rmsEnergy: 0.001,
    pitchHz: null,
    silenceDurationSec,
    speechSegmentCount: 1,
  };
}

/** High RMS spike only */
function highRmsFeatureSet(rmsEnergy = 0.35, timestamp = 1000): FeatureSet {
  return { ...normalFeatureSet(timestamp), rmsEnergy };
}

/** Multi-signal abnormality: pitch + high RMS + spectral anomaly + silence */
function multiSignalFeatureSet(timestamp = 1000): FeatureSet {
  return {
    timestamp,
    rmsEnergy: 0.32,
    zeroCrossingRate: 0.28,
    spectralCentroid: 3800,
    pitchHz: 320,
    isSpeech: true,            // active speech with multiple anomalies
    silenceDurationSec: 4.0,   // prior silence context
    speechActivityDurationSec: 0.8,
    speechSegmentCount: 2,
  };
}

/** Null pitch (unvoiced/silence frame) */
function nullPitchFeatureSet(timestamp = 1000): FeatureSet {
  return { ...normalFeatureSet(timestamp), pitchHz: null, isSpeech: false, rmsEnergy: 0.001 };
}

/** Feed N identical frames to the engine, returns last evaluation */
function feedFrames(engine: RiskEngine, frame: FeatureSet, n: number, intervalMs = 100) {
  let lastResult = engine.evaluate(frame);
  for (let i = 1; i < n; i++) {
    lastResult = engine.evaluate({ ...frame, timestamp: frame.timestamp + i * intervalMs });
  }
  return lastResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Normal FeatureSet → low risk
// ─────────────────────────────────────────────────────────────────────────────
section('A. Normal FeatureSet → low risk');

{
  const engine = new RiskEngine();
  const result = engine.evaluate(normalFeatureSet(1000));
  assert(result.riskScore < 30, `Normal features → score < 30 (NORMAL)`, `got ${result.riskScore}`);
  assert(result.riskLevel === 'NORMAL', `Normal features → riskLevel = NORMAL`);
}

{
  // Feed 10 consecutive normal frames
  const engine = new RiskEngine();
  const result = feedFrames(engine, normalFeatureSet(), 10);
  assert(result.riskScore < 30, `10 normal frames → score stays < 30`, `got ${result.riskScore}`);
  assert(result.riskLevel === 'NORMAL', `10 normal frames → level = NORMAL`);
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Single-signal ceiling: no single signal can reach HIGH_RISK alone
// ─────────────────────────────────────────────────────────────────────────────
section('B. Single-signal ceiling (no single signal → HIGH_RISK)');

{
  // Extreme pitch deviation, all other signals normal
  const engine = new RiskEngine();
  // Feed many frames to let persistence accumulate
  const extremePitch: FeatureSet = { ...normalFeatureSet(), pitchHz: 500 }; // max deviation
  const result = feedFrames(engine, extremePitch, 30);
  assert(
    result.riskScore < 70,
    `Extreme pitch alone (30 frames) → score < 70 (below HIGH_RISK)`,
    `got ${result.riskScore}`
  );
}

{
  // Extreme silence duration, pitch null, no other signals
  const engine = new RiskEngine();
  const extremeSilence: FeatureSet = silenceFeatureSet(10.0);
  const result = feedFrames(engine, extremeSilence, 30);
  assert(
    result.riskScore < 70,
    `Extreme silence alone (30 frames) → score < 70 (below HIGH_RISK)`,
    `got ${result.riskScore}`
  );
}

{
  // Extreme RMS spike alone
  const engine = new RiskEngine();
  const extremeRms: FeatureSet = highRmsFeatureSet(0.8);
  const result = feedFrames(engine, extremeRms, 30);
  assert(
    result.riskScore < 70,
    `Extreme RMS spike alone (30 frames) → score < 70 (below HIGH_RISK)`,
    `got ${result.riskScore}`
  );
}

{
  // High ZCR alone
  const engine = new RiskEngine();
  const highZcr: FeatureSet = { ...normalFeatureSet(), zeroCrossingRate: 0.9 };
  const result = feedFrames(engine, highZcr, 30);
  assert(
    result.riskScore < 70,
    `Extreme ZCR alone (30 frames) → score < 70 (below HIGH_RISK)`,
    `got ${result.riskScore}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Multi-signal combination raises risk
// ─────────────────────────────────────────────────────────────────────────────
section('C. Multi-signal combination → elevated risk');

{
  const engine = new RiskEngine();
  const multiSingle = engine.evaluate(multiSignalFeatureSet(1000));
  const multiNormal = new RiskEngine().evaluate(normalFeatureSet(1000));
  assert(
    multiSingle.riskScore > multiNormal.riskScore,
    `Multi-signal FeatureSet scores higher than normal`,
    `multi=${multiSingle.riskScore}, normal=${multiNormal.riskScore}`
  );
}

{
  // Multi-signal first frame > NORMAL level
  const engine = new RiskEngine();
  const result = engine.evaluate(multiSignalFeatureSet(1000));
  assert(result.riskLevel !== 'NORMAL' || result.riskScore > 0, `Multi-signal first frame produces non-zero score`);
}

{
  // After 10 multi-signal frames → at least ELEVATED
  const engine = new RiskEngine();
  const result = feedFrames(engine, multiSignalFeatureSet(), 10);
  assert(
    result.riskScore >= 30,
    `10 multi-signal frames → score ≥ 30 (ELEVATED)`,
    `got ${result.riskScore}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// D. Temporal persistence increases risk
// ─────────────────────────────────────────────────────────────────────────────
section('D. Temporal persistence → sustained abnormality raises risk');

{
  const engine1 = new RiskEngine();
  const engine2 = new RiskEngine();
  const frame = highPitchFeatureSet(320);

  // 1 frame vs 15 frames: 15 frames should score higher
  const score1 = engine1.evaluate(frame).riskScore;
  const score15 = feedFrames(engine2, frame, 15).riskScore;

  assert(score15 > score1, `15 persistent frames score higher than 1 frame`, `1f=${score1}, 15f=${score15}`);
}

{
  // Persistence counter increments with abnormal frames
  const engine = new RiskEngine();
  const frame = highPitchFeatureSet(320);
  feedFrames(engine, frame, 10);
  const state = engine.getState();
  assert(
    state.consecutiveAbnormalFrames > 0,
    `consecutiveAbnormalFrames > 0 after abnormal sequence`,
    `got ${state.consecutiveAbnormalFrames}`
  );
}

{
  // After confirmation frames, isConfirmed = true
  const engine = new RiskEngine();
  const confirmThreshold = engine.getConfig().confirmationFrames;
  const frame = highPitchFeatureSet(350);
  const result = feedFrames(engine, frame, confirmThreshold + 2);
  assert(result.isConfirmed === true, `isConfirmed after ${confirmThreshold + 2} persistent frames`);
}

// ─────────────────────────────────────────────────────────────────────────────
// E. Brief spike does NOT immediately produce HIGH_RISK
// ─────────────────────────────────────────────────────────────────────────────
section('E. Brief abnormal spike → does not immediately reach HIGH_RISK');

{
  const engine = new RiskEngine();
  // Single most extreme frame possible: all signals at max
  const extremeFrame: FeatureSet = {
    ...multiSignalFeatureSet(),
    pitchHz: 490,
    rmsEnergy: 0.8,
    zeroCrossingRate: 0.9,
    silenceDurationSec: 10,
    isSpeech: false,
  };
  const result = engine.evaluate(extremeFrame);
  assert(
    result.riskScore < 70,
    `Single extreme frame → score < 70 (below HIGH_RISK)`,
    `got ${result.riskScore}`
  );
}

{
  // 2 abnormal frames + then normal, should not be HIGH_RISK
  const engine = new RiskEngine();
  const abnormal = highPitchFeatureSet(400);
  engine.evaluate(abnormal);
  engine.evaluate({ ...abnormal, timestamp: 1100 });
  const normalResult = engine.evaluate({ ...normalFeatureSet(), timestamp: 1200 });
  assert(
    normalResult.riskScore < 70,
    `2 abnormal + 1 normal → score below HIGH_RISK`,
    `got ${normalResult.riskScore}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// F. Sustained multi-signal → can reach HIGH_RISK
// ─────────────────────────────────────────────────────────────────────────────
section('F. Sustained multi-signal → can reach HIGH_RISK');

{
  // For HIGH_RISK we need multiple corroborating signals active simultaneously
  // sustained across time (e.g. pitch strain + vocal intensity + high centroid + high ZCR + VAD deficit)
  const engine = new RiskEngine();

  const sustainedMultiSignal: FeatureSet = {
    timestamp: 1000,
    rmsEnergy: 0.35,              // far above 0.06 ref (max rmsScore: 15)
    zeroCrossingRate: 0.45,       // high ZCR (max zcrScore: 10)
    spectralCentroid: 4800,       // high spectral centroid (max spectralScore: 10)
    pitchHz: 420,                 // extreme pitch deviation (max pitchScore: 20)
    isSpeech: true,
    silenceDurationSec: 5.0,      // prior silence context
    speechActivityDurationSec: 0.5, // low speech activity ratio (< 25% voiced)
    speechSegmentCount: 1,
  };

  // Feed 40 consecutive frames of multi-signal distress
  const finalResult = feedFrames(engine, sustainedMultiSignal, 40);
  assert(
    finalResult.riskScore >= 70,
    `Sustained multi-signal abnormality → score >= 70 (HIGH_RISK)`,
    `got ${finalResult.riskScore}`
  );
  assert(
    finalResult.riskLevel === 'HIGH_RISK',
    `Combined sustained multi-signal sequence → riskLevel = HIGH_RISK`,
    `got ${finalResult.riskLevel}`
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// G. Score decays after signals normalize
// ─────────────────────────────────────────────────────────────────────────────
section('G. Score decay → normalizing signals reduce score');

{
  const engine = new RiskEngine();
  // Drive score up with 20 multi-signal frames
  feedFrames(engine, multiSignalFeatureSet(), 20);
  const peakScore = engine.getState().smoothedScore;

  // Then feed 20 normal frames
  feedFrames(engine, normalFeatureSet(), 20);
  const decayedScore = engine.getState().smoothedScore;

  assert(decayedScore < peakScore, `Score decays after signals normalize`, `peak=${peakScore.toFixed(2)}, decayed=${decayedScore.toFixed(2)}`);
}

{
  // After 50 normal frames following abnormal, score should approach NORMAL
  const engine = new RiskEngine();
  feedFrames(engine, multiSignalFeatureSet(), 30);
  const result = feedFrames(engine, normalFeatureSet(), 50);
  assert(
    result.riskScore < 50,
    `50 normal frames after abnormal → score below SUSPICIOUS`,
    `got ${result.riskScore}`
  );
}

{
  // Score does NOT instantly reset to 0 after one normal frame
  const engine = new RiskEngine();
  feedFrames(engine, multiSignalFeatureSet(), 20);
  const afterOne = engine.evaluate({ ...normalFeatureSet(), timestamp: 9999 });
  assert(
    afterOne.riskScore > 0,
    `Score does not instantly reset to 0 after one normal frame`,
    `got ${afterOne.riskScore}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// H. Null/missing pitch does not crash
// ─────────────────────────────────────────────────────────────────────────────
section('H. Null pitch and missing optional fields → no crash');

{
  const engine = new RiskEngine();
  const result = engine.evaluate(nullPitchFeatureSet());
  assert(typeof result.riskScore === 'number', `Null pitch → riskScore is a number`);
  assert(!isNaN(result.riskScore), `Null pitch → riskScore is not NaN`);
  assert(result.riskScore >= 0, `Null pitch → riskScore >= 0`);
}

{
  // spectralCentroid = null (silence frame)
  const engine = new RiskEngine();
  const frame: FeatureSet = { ...normalFeatureSet(), spectralCentroid: null, isSpeech: false, pitchHz: null };
  const result = engine.evaluate(frame);
  assert(typeof result.riskScore === 'number', `Null spectralCentroid → no crash`);
}

{
  // pitchHz: 0 is different from null (should not crash either)
  const engine = new RiskEngine();
  // pitchHz=0 would be an unusual valid value; engine should not crash
  const frame: FeatureSet = { ...normalFeatureSet(), pitchHz: 80 }; // minimum valid pitch
  const result = engine.evaluate(frame);
  assert(typeof result.riskScore === 'number', `Minimum pitch (80 Hz) → no crash`);
}

// ─────────────────────────────────────────────────────────────────────────────
// I. Score always bounded [0, 100]
// ─────────────────────────────────────────────────────────────────────────────
section('I. Score always bounded [0, 100]');

{
  const engine = new RiskEngine();
  // Extreme frames in all directions
  const extremeFrames: FeatureSet[] = [
    { ...multiSignalFeatureSet(1000), pitchHz: 500, rmsEnergy: 1.0, zeroCrossingRate: 1.0, silenceDurationSec: 60 },
    normalFeatureSet(2000),
    nullPitchFeatureSet(3000),
    { ...multiSignalFeatureSet(4000) },
    normalFeatureSet(5000),
  ];
  let allBounded = true;
  let allNumbers = true;
  extremeFrames.forEach((frame, i) => {
    const result = engine.evaluate(frame);
    if (result.riskScore < 0 || result.riskScore > 100) {
      allBounded = false;
      console.error(`  Frame ${i}: score ${result.riskScore} out of bounds`);
    }
    if (isNaN(result.riskScore)) {
      allNumbers = false;
    }
  });
  assert(allBounded, `All scores bounded [0, 100]`);
  assert(allNumbers, `All scores are finite numbers`);
}

// ─────────────────────────────────────────────────────────────────────────────
// J. Risk level thresholds are deterministic
// ─────────────────────────────────────────────────────────────────────────────
section('J. Risk level thresholds are deterministic');

{
  // scoreToLevel is a pure function with no state
  const config = new RiskEngine().getConfig();
  assert(scoreToLevel(0, config) === 'NORMAL',       `score=0 → NORMAL`);
  assert(scoreToLevel(29, config) === 'NORMAL',      `score=29 → NORMAL`);
  assert(scoreToLevel(30, config) === 'ELEVATED',    `score=30 → ELEVATED`);
  assert(scoreToLevel(49, config) === 'ELEVATED',    `score=49 → ELEVATED`);
  assert(scoreToLevel(50, config) === 'SUSPICIOUS',  `score=50 → SUSPICIOUS`);
  assert(scoreToLevel(69, config) === 'SUSPICIOUS',  `score=69 → SUSPICIOUS`);
  assert(scoreToLevel(70, config) === 'HIGH_RISK',   `score=70 → HIGH_RISK`);
  assert(scoreToLevel(100, config) === 'HIGH_RISK',  `score=100 → HIGH_RISK`);
}

// ─────────────────────────────────────────────────────────────────────────────
// K. Same input sequence → same output sequence (determinism)
// ─────────────────────────────────────────────────────────────────────────────
section('K. Determinism, same inputs produce same outputs');

{
  const frames: FeatureSet[] = [
    normalFeatureSet(1000),
    highPitchFeatureSet(280, 1100),
    multiSignalFeatureSet(1200),
    normalFeatureSet(1300),
    silenceFeatureSet(3.0, 1400),
  ];

  const engine1 = new RiskEngine();
  const engine2 = new RiskEngine();

  const results1 = frames.map((f) => engine1.evaluate(f).riskScore);
  const results2 = frames.map((f) => engine2.evaluate(f).riskScore);

  const allMatch = results1.every((s, i) => Math.abs(s - results2[i]) < 0.001);
  assert(allMatch, `Same input sequence produces identical scores on two separate engines`);
}

// ─────────────────────────────────────────────────────────────────────────────
// L. Engine reset clears temporal state
// ─────────────────────────────────────────────────────────────────────────────
section('L. Engine reset clears temporal state');

{
  const engine = new RiskEngine();
  feedFrames(engine, multiSignalFeatureSet(), 20);
  const beforeReset = engine.getState().smoothedScore;
  assert(beforeReset > 0, `Score > 0 before reset`);

  engine.reset();
  const state = engine.getState();
  assert(state.smoothedScore === 0, `smoothedScore = 0 after reset`);
  assert(state.consecutiveAbnormalFrames === 0, `consecutiveAbnormalFrames = 0 after reset`);
  assert(state.previousLevel === 'NORMAL', `previousLevel = NORMAL after reset`);
  assert(state.lastTimestamp === null, `lastTimestamp = null after reset`);
}

// ─────────────────────────────────────────────────────────────────────────────
// M. External signal injection is bounded
// ─────────────────────────────────────────────────────────────────────────────
section('M. External signal injection is bounded');

{
  const engine = new RiskEngine();
  // Inject maximum allowed single-source boost (default cap: 25)
  engine.injectExternalSignal(1000, 25); // requesting 1000 but capped at 25
  const state = engine.getState();
  assert(state.smoothedScore <= 25, `Injected boost capped at maxBoost=25`, `got ${state.smoothedScore}`);
}

{
  // injectExternalSignal cannot by itself reach HIGH_RISK on a fresh engine
  const engine = new RiskEngine();
  engine.injectExternalSignal(500, 25);
  assert(
    engine.getState().smoothedScore < 70,
    `External injection alone cannot reach HIGH_RISK`,
    `got ${engine.getState().smoothedScore}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// N. Signal contributions explain score
// ─────────────────────────────────────────────────────────────────────────────
section('N. Signal contributions explain the score');

{
  const engine = new RiskEngine();
  const result = engine.evaluate(multiSignalFeatureSet());
  // Should have at least some contributing signals
  const totalContribution = result.contributingSignals.reduce((s, c) => s + c.contribution, 0);
  assert(
    result.contributingSignals.length > 0 || result.riskScore === 0,
    `contributingSignals is non-empty when score > 0`
  );
  if (result.riskScore > 0) {
    assert(totalContribution > 0, `Total signal contributions > 0 when score > 0`, `got ${totalContribution}`);
  }
}

{
  // Normal frame → no contributing signals (score effectively near 0)
  const engine = new RiskEngine();
  const result = engine.evaluate(normalFeatureSet());
  assert(
    result.riskScore < 5,
    `Normal frame → minimal score`,
    `got ${result.riskScore}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// O. Single signal provably cannot reach HIGH_RISK alone (mathematical guarantee)
// ─────────────────────────────────────────────────────────────────────────────
section('O. Mathematical proof: single signal max < HIGH_RISK threshold');

{
  const engine = new RiskEngine();
  const config = engine.getConfig();
  const maxSingleSignal = Math.max(
    config.weights.pitch,
    config.weights.rms,
    config.weights.silence,
    config.weights.voiceActivity,
    config.weights.spectral,
    config.weights.zcr
  );
  const maxWithPersistence = maxSingleSignal + config.weights.persistence;
  assert(
    maxWithPersistence < config.highRiskThreshold,
    `Max single signal (${maxSingleSignal}) + persistence (${config.weights.persistence}) = ${maxWithPersistence} < HIGH_RISK threshold (${config.highRiskThreshold})`,
    `gap = ${config.highRiskThreshold - maxWithPersistence}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// P. Helper function tests
// ─────────────────────────────────────────────────────────────────────────────
section('P. Helper function correctness');

{
  assertClose(clamp(50, 0, 100), 50, 0.001, `clamp(50, 0, 100) = 50`);
  assertClose(clamp(-10, 0, 100), 0, 0.001, `clamp(-10, 0, 100) = 0`);
  assertClose(clamp(150, 0, 100), 100, 0.001, `clamp(150, 0, 100) = 100`);
}

{
  assertClose(linearScore(0.5, 1.0, 5.0, 20), 0, 0.001, `linearScore below onset = 0`);
  assertClose(linearScore(5.0, 1.0, 5.0, 20), 20, 0.001, `linearScore at saturation = maxScore`);
  assertClose(linearScore(3.0, 1.0, 5.0, 20), 10, 0.001, `linearScore at midpoint = maxScore/2`);
  assertClose(linearScore(10, 1.0, 5.0, 20), 20, 0.001, `linearScore above saturation = maxScore`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Q. Edge cases
// ─────────────────────────────────────────────────────────────────────────────
section('Q. Edge cases');

{
  // Empty / zero-state features
  const engine = new RiskEngine();
  const emptyFeatures: FeatureSet = {
    timestamp: 0,
    rmsEnergy: 0,
    zeroCrossingRate: 0,
    spectralCentroid: null,
    pitchHz: null,
    isSpeech: false,
    silenceDurationSec: 0,
    speechActivityDurationSec: 0,
    speechSegmentCount: 0,
  };
  const result = engine.evaluate(emptyFeatures);
  assert(result.riskScore === 0, `All-zero features → riskScore = 0`, `got ${result.riskScore}`);
  assert(result.riskLevel === 'NORMAL', `All-zero features → NORMAL`);
}

{
  // Verify RiskLevel after reset is NORMAL
  const engine = new RiskEngine();
  feedFrames(engine, multiSignalFeatureSet(), 30);
  engine.reset();
  const freshResult = engine.evaluate(normalFeatureSet());
  assert(freshResult.riskLevel === 'NORMAL', `After reset, normal features → NORMAL level`);
}

{
  // Silence below onset threshold contributes zero
  const engine = new RiskEngine();
  const shortSilence: FeatureSet = silenceFeatureSet(1.0); // below 1.5s onset
  const result = engine.evaluate(shortSilence);
  const silenceContribution = result.contributingSignals.find((c) => c.signal === 'silence');
  assert(
    silenceContribution === undefined,
    `Silence below onset (1.0s < 1.5s) contributes 0`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n════════════════════════════════════════`);
console.log(`  Sanket Phase 3 Risk Engine Tests`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`════════════════════════════════════════`);

if (failed > 0) {
  process.exit(1);
}
