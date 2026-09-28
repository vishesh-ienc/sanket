/**
 * Sanket, Feature Extraction Deterministic Tests
 *
 * Tests pure DSP functions and the FeatureExtractor class using synthetic
 * audio signals. No browser, no DOM, no microphone required.
 *
 * Test strategy:
 *   - Known-input / known-output mathematical verification
 *   - Silence edge cases (zero signal)
 *   - Sinusoidal tones at known frequencies for pitch validation
 *   - Voice Activity Detection threshold boundary testing
 *   - Silence duration state machine transitions
 *   - Speech segment counting
 *
 * Run with: npx tsx src/analysis/__tests__/featureExtraction.test.ts
 * (tsx handles TypeScript without a separate compile step)
 */

import {
  calculateRms,
  calculateZeroCrossingRate,
  calculateSpectralCentroid,
  estimatePitch,
  detectVoiceActivity,
} from '../featureFunctions';
import { FeatureExtractor } from '../featureExtractor';
import type { AudioFrame } from '../../audio/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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
  assert(diff <= tolerance, label, `got ${a.toFixed(4)}, expected ~${b.toFixed(4)}, diff=${diff.toFixed(4)}`);
}

function section(title: string): void {
  console.log(`\n─── ${title} ───`);
}

/** Creates a silent (all-zero) Float32Array of given length */
function silence(n: number): Float32Array {
  return new Float32Array(new ArrayBuffer(n * 4));
}

/** Creates a DC-offset signal (constant value) */
function constantSignal(n: number, value: number): Float32Array {
  const arr = new Float32Array(new ArrayBuffer(n * 4));
  arr.fill(value);
  return arr;
}

/** Generates a pure sinusoidal tone at `freq` Hz, sampled at `sampleRate` Hz */
function sineWave(n: number, freq: number, sampleRate: number, amplitude = 0.8): Float32Array {
  const arr = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    arr[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return arr;
}

/**
 * Creates a Float32Array with a known number of zero crossings.
 * Alternates between +value and -value every `period` samples.
 */
function squareWave(n: number, halfPeriod: number, amplitude = 0.5): Float32Array {
  const arr = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    arr[i] = Math.floor(i / halfPeriod) % 2 === 0 ? amplitude : -amplitude;
  }
  return arr;
}

/** Creates a synthetic dBFS frequency array (all silence = -Infinity) */
function silenceFreqData(n: number): Float32Array {
  const arr = new Float32Array(new ArrayBuffer(n * 4));
  arr.fill(-Infinity);
  return arr;
}

/** Creates a synthetic minimal AudioFrame for testing FeatureExtractor */
function makeFrame(
  timeDomainData: Float32Array,
  frequencyData: Float32Array,
  timestamp = 1000,
  sampleRate = 44100
): AudioFrame {
  const rms = calculateRms(timeDomainData);
  return {
    timestamp,
    sampleRate,
    frameSize: timeDomainData.length,
    timeDomainData,
    frequencyData,
    rmsEnergy: rms,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// A. RMS Tests
// ─────────────────────────────────────────────────────────────────────────────

section('A. RMS Energy');

{
  const s = silence(1024);
  assertClose(calculateRms(s), 0, 1e-9, 'Silence → RMS = 0');
}

{
  // A constant amplitude A has RMS = A
  const A = 0.5;
  const s = constantSignal(1024, A);
  assertClose(calculateRms(s), A, 1e-6, `Constant ${A} → RMS = ${A}`);
}

{
  // Pure sine at amplitude A has RMS = A / √2 ≈ 0.7071*A
  const A = 0.8;
  const s = sineWave(4096, 200, 44100, A);
  const expected = A / Math.SQRT2;
  assertClose(calculateRms(s), expected, 0.002, `Sine A=${A} → RMS ≈ A/√2 = ${expected.toFixed(4)}`);
}

{
  assert(calculateRms(new Float32Array(0)) === 0, 'Empty array → RMS = 0');
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Zero-Crossing Rate Tests
// ─────────────────────────────────────────────────────────────────────────────

section('B. Zero-Crossing Rate');

{
  assert(calculateZeroCrossingRate(silence(1024)) === 0, 'Silence → ZCR = 0');
}

{
  assert(calculateZeroCrossingRate(constantSignal(1024, 0.5)) === 0, 'Constant positive → ZCR = 0');
}

{
  // A square wave with halfPeriod=1: +A, -A, +A, -A, ...
  // Every adjacent pair crosses → crossings = N-1 → ZCR = 1.0
  const s = squareWave(512, 1, 0.5);
  assertClose(calculateZeroCrossingRate(s), 1.0, 0.01, 'Square wave period=2 → ZCR ≈ 1.0');
}

{
  // Square wave alternating every 8 samples: crossings every 8 samples
  const halfPeriod = 8;
  const n = 512;
  const s = squareWave(n, halfPeriod, 0.5);
  const zcr = calculateZeroCrossingRate(s);
  // Expected: 1 crossing per halfPeriod samples (approximately)
  const expectedZcr = 1 / halfPeriod;
  assertClose(zcr, expectedZcr, 0.02, `Square halfPeriod=${halfPeriod} → ZCR ≈ ${expectedZcr.toFixed(3)}`);
}

{
  assert(calculateZeroCrossingRate(new Float32Array(1)) === 0, 'Single sample → ZCR = 0');
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Spectral Centroid Tests
// ─────────────────────────────────────────────────────────────────────────────

section('C. Spectral Centroid');

{
  const f = silenceFreqData(1024);
  const result = calculateSpectralCentroid(f, 44100);
  assert(result === null, 'Silent frequency spectrum → centroid = null');
}

{
  // Single non-silent bin at index k: centroid should be near k's frequency
  const numBins = 512;
  const sampleRate = 44100;
  const binFreqWidth = sampleRate / (2 * numBins);
  const targetBin = 100;
  const freqData = new Float32Array(new ArrayBuffer(numBins * 4));
  freqData.fill(-Infinity);
  freqData[targetBin] = -6; // -6 dBFS → linear magnitude ≈ 0.501
  const result = calculateSpectralCentroid(freqData, sampleRate);
  const expectedFreq = (targetBin + 0.5) * binFreqWidth;
  assert(result !== null, 'Single bin → centroid is non-null');
  if (result !== null) {
    assertClose(result, expectedFreq, 50, `Single bin ${targetBin} → centroid near ${expectedFreq.toFixed(0)} Hz`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// D. Pitch Estimation Tests
// ─────────────────────────────────────────────────────────────────────────────

section('D. Pitch Estimation (Autocorrelation)');

{
  // Silence → pitch = null
  const s = silence(2048);
  assert(estimatePitch(s, 44100) === null, 'Silence → pitch = null');
}

{
  // Known sine tone at 220 Hz → pitch should be near 220 Hz
  const freq = 220;
  const s = sineWave(4096, freq, 44100, 0.8);
  const result = estimatePitch(s, 44100);
  assert(result !== null, `Sine ${freq} Hz → pitch not null`);
  if (result !== null) {
    assertClose(result, freq, 15, `Sine ${freq} Hz → estimated pitch within 15 Hz`);
  }
}

{
  // Known sine tone at 150 Hz (male speech range)
  const freq = 150;
  const s = sineWave(4096, freq, 44100, 0.8);
  const result = estimatePitch(s, 44100);
  assert(result !== null, `Sine ${freq} Hz → pitch not null`);
  if (result !== null) {
    assertClose(result, freq, 15, `Sine ${freq} Hz → estimated pitch within 15 Hz`);
  }
}

{
  // Known sine tone at 300 Hz (female speech range)
  const freq = 300;
  const s = sineWave(4096, freq, 44100, 0.8);
  const result = estimatePitch(s, 44100);
  assert(result !== null, `Sine ${freq} Hz → pitch not null`);
  if (result !== null) {
    assertClose(result, freq, 20, `Sine ${freq} Hz → estimated pitch within 20 Hz`);
  }
}

{
  // Very low amplitude (below RMS floor from VAD), test autocorrelation rejects
  const s = sineWave(2048, 200, 44100, 0.0001);
  const result = estimatePitch(s, 44100);
  assert(result === null, 'Extremely low amplitude tone → pitch = null (below energy floor)');
}

{
  // Empty array → null
  assert(estimatePitch(new Float32Array(0), 44100) === null, 'Empty buffer → pitch = null');
}

{
  // Out-of-range frequency: max Hz < min Hz → should return null
  const s = sineWave(2048, 200, 44100, 0.8);
  assert(estimatePitch(s, 44100, 300, 100) === null, 'Invalid range (min > max) → pitch = null');
}

// ─────────────────────────────────────────────────────────────────────────────
// E. Voice Activity Detection Tests
// ─────────────────────────────────────────────────────────────────────────────

section('E. Voice Activity Detection');

{
  assert(detectVoiceActivity(0.0, 0.015) === false, 'RMS=0 → VAD=false (silence)');
}

{
  assert(detectVoiceActivity(0.014, 0.015) === false, 'RMS just below threshold → VAD=false');
}

{
  assert(detectVoiceActivity(0.015, 0.015) === true, 'RMS = threshold → VAD=true (boundary inclusive)');
}

{
  assert(detectVoiceActivity(0.1, 0.015) === true, 'RMS=0.1 → VAD=true (normal speech)');
}

{
  // Custom threshold
  assert(detectVoiceActivity(0.05, 0.06) === false, 'Custom threshold: RMS below → false');
  assert(detectVoiceActivity(0.07, 0.06) === true,  'Custom threshold: RMS above → true');
}

// ─────────────────────────────────────────────────────────────────────────────
// F. FeatureExtractor, Temporal State Tests
// ─────────────────────────────────────────────────────────────────────────────

section('F. FeatureExtractor Temporal State');

const SAMPLE_RATE = 44100;
const FRAME_SIZE = 2048;
const FREQ_BINS = FRAME_SIZE / 2;

{
  // Test: silence accumulates silenceDurationSec
  const extractor = new FeatureExtractor({ voiceActivityRmsThreshold: 0.015 });
  const silentData = silence(FRAME_SIZE);
  const freqData = silenceFreqData(FREQ_BINS);

  // Frame 1 at t=0 (first frame, dtSec=0, silence just begins, silenceDurationSec=0)
  const f1 = extractor.processFrame(makeFrame(silentData, freqData, 0));
  // Frame 2 at t=500ms (dtSec=0.5 → silenceDurationSec = 0.5)
  const f2 = extractor.processFrame(makeFrame(silentData, freqData, 500));
  // Frame 3 at t=1000ms (dtSec=0.5 → silenceDurationSec = 1.0)
  const f3 = extractor.processFrame(makeFrame(silentData, freqData, 1000));

  assert(f2.isSpeech === false, 'Silent frame → isSpeech = false');
  assert(f1.silenceDurationSec >= 0, 'First silent frame → silenceDurationSec >= 0');
  // f2 has accumulated 1 interval (500ms): silenceDurationSec ≈ 0.5
  assertClose(f2.silenceDurationSec, 0.5, 0.01, 'After 2 frames (t=0→500ms): silenceDurationSec ≈ 0.5s');
  // f3 has accumulated 2 intervals (1000ms total): silenceDurationSec ≈ 1.0
  assertClose(f3.silenceDurationSec, 1.0, 0.01, 'After 3 frames (t=0→1000ms): silenceDurationSec ≈ 1.0s');
}

{
  // Test: VOICE → SILENCE → VOICE resets silence timer and increments segment count
  const extractor = new FeatureExtractor({ voiceActivityRmsThreshold: 0.015 });
  const voiceData = sineWave(FRAME_SIZE, 200, SAMPLE_RATE, 0.5);
  const silentData = silence(FRAME_SIZE);
  const freqData = silenceFreqData(FREQ_BINS);

  const fv1 = extractor.processFrame(makeFrame(voiceData, freqData, 0));
  const fv2 = extractor.processFrame(makeFrame(voiceData, freqData, 100));
  const fs1 = extractor.processFrame(makeFrame(silentData, freqData, 200));
  const fs2 = extractor.processFrame(makeFrame(silentData, freqData, 300));
  const fv3 = extractor.processFrame(makeFrame(voiceData, freqData, 400));

  assert(fv1.isSpeech === true,  'Voice frame 1 → isSpeech=true');
  assert(fv2.isSpeech === true,  'Voice frame 2 → isSpeech=true');
  assert(fs1.isSpeech === false, 'Silent frame 1 → isSpeech=false');
  assert(fs2.isSpeech === false, 'Silent frame 2 → isSpeech=false');
  assert(fv3.isSpeech === true,  'Voice frame 3 → isSpeech=true (resumed)');

  // After resuming voice, silence should be reset
  assert(fv3.silenceDurationSec === 0, 'silenceDurationSec resets to 0 on voice resumption');

  // Segment count: first voice burst = 1 segment, second voice burst = 2 segments
  assert(fv3.speechSegmentCount === 2, `speechSegmentCount = 2 after voice → silence → voice transition (got ${fv3.speechSegmentCount})`);
}

{
  // Test: reset() clears all state
  const extractor = new FeatureExtractor({ voiceActivityRmsThreshold: 0.015 });
  const voiceData = sineWave(FRAME_SIZE, 200, SAMPLE_RATE, 0.5);
  const freqData = silenceFreqData(FREQ_BINS);

  extractor.processFrame(makeFrame(voiceData, freqData, 0));
  extractor.processFrame(makeFrame(voiceData, freqData, 100));
  extractor.reset();

  const state = extractor.getTemporalState();
  assert(state.silenceDurationSec === 0, 'After reset: silenceDurationSec = 0');
  assert(state.speechActivityDurationSec === 0, 'After reset: speechActivityDurationSec = 0');
  assert(state.speechSegmentCount === 0, 'After reset: speechSegmentCount = 0');
  assert(state.wasVoicedPrevFrame === false, 'After reset: wasVoicedPrevFrame = false');
  assert(state.lastFrameTimestamp === null, 'After reset: lastFrameTimestamp = null');
}

{
  // Test: speech activity duration accumulates during voiced frames
  const extractor = new FeatureExtractor({ voiceActivityRmsThreshold: 0.015 });
  const voiceData = sineWave(FRAME_SIZE, 200, SAMPLE_RATE, 0.5);
  const freqData = silenceFreqData(FREQ_BINS);

  extractor.processFrame(makeFrame(voiceData, freqData, 0));     // dt=0
  extractor.processFrame(makeFrame(voiceData, freqData, 100));   // dt=0.1s
  const f3 = extractor.processFrame(makeFrame(voiceData, freqData, 300));   // dt=0.2s

  // Total speech duration = 0 + 0.1 + 0.2 = 0.3s
  assertClose(f3.speechActivityDurationSec, 0.3, 0.01, 'Speech duration accumulated: ~0.3s');
}

{
  // Test: silence duration in first silent frame is 0 (just started)
  const extractor = new FeatureExtractor({ voiceActivityRmsThreshold: 0.015 });
  const silentData = silence(FRAME_SIZE);
  const freqData = silenceFreqData(FREQ_BINS);

  // Frame starts immediately in silence
  const f1 = extractor.processFrame(makeFrame(silentData, freqData, 0));
  assert(f1.silenceDurationSec === 0, 'First silent frame: silenceDurationSec = 0 (started this frame)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n════════════════════════════════════════`);
console.log(`  Sanket Phase 2 Feature Extraction Tests`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`════════════════════════════════════════`);

if (failed > 0) {
  process.exit(1);
}
