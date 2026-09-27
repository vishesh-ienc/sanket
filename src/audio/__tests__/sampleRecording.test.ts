/**
 * Sanket — Built-in Sample Call Recording Tests
 *
 * Verifies the synthesized sample call end-to-end through the REAL pipeline:
 *   synthesizeSampleCall → AnalyserNode-equivalent framing (Blackman FFT,
 *   0.8 smoothing, dBFS) → FeatureExtractor → TemporalContextAnalyzer →
 *   RiskEngine → IncidentManager.
 *
 * Covers:
 *   1. WAV encoding (header, length, clipping)
 *   2. Determinism
 *   3. Calm segment stays NORMAL with no incident
 *   4. Acoustic-only distress escalates but respects the multi-signal ceiling
 *      (never HIGH_RISK without corroboration)
 *   5. With the transcript track's covert phrase, the distress segment reaches
 *      confirmed HIGH_RISK and dispatches a single latched alert
 *
 * No browser, DOM, microphone, or network required.
 */

import {
  synthesizeSampleCall,
  encodeWav,
  SAMPLE_CALL_SAMPLE_RATE,
  SAMPLE_CALL_DURATION_SEC,
  SAMPLE_CALL_SEGMENTS,
  SAMPLE_CALL_TRANSCRIPT,
  renderTranscriptCue,
} from '../sampleRecording';
import { AudioFrameBuilder, FRAME_SIZE } from '../frameBuilder';
import { FeatureExtractor } from '../../analysis/featureExtractor';
import { RiskEngine } from '../../analysis/riskEngine';
import { TemporalContextAnalyzer } from '../../analysis/temporalContext';
import { IncidentManager } from '../../services/incidentManager';
import { CodeWordDetector } from '../../analysis/codeWordDetector';
import type { RiskLevel } from '../../analysis/types';

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

function printSection(label: string): void {
  console.log(`\n─── ${label} ───`);
}

const FFT_SIZE = FRAME_SIZE;

interface PipelineTrace {
  timeSec: number;
  score: number;
  level: RiskLevel;
  confirmed: boolean;
  newIncident: boolean;
}

const PHRASE = 'Remember to feed the cat';

function runPipeline(
  samples: Float32Array,
  sampleRate: number,
  withTranscript: boolean
): PipelineTrace[] {
  const detector = new CodeWordDetector(PHRASE);
  const pendingCues = withTranscript ? [...SAMPLE_CALL_TRANSCRIPT] : [];
  const extractor = new FeatureExtractor();
  const engine = new RiskEngine();
  const temporal = new TemporalContextAnalyzer();
  const incidents = new IncidentManager();
  const builder = new AudioFrameBuilder();
  const trace: PipelineTrace[] = [];

  const hop = Math.floor(sampleRate * 0.1); // 10 Hz analysis cadence
  for (let end = FFT_SIZE; end <= samples.length; end += hop) {
    const td = samples.slice(end - FFT_SIZE, end);
    const timeSec = end / sampleRate;
    const frame = builder.build(td, sampleRate, timeSec * 1000);

    while (pendingCues.length > 0 && pendingCues[0].atSec <= timeSec) {
      const cue = pendingCues.shift()!;
      const detection = detector.processTranscript(
        renderTranscriptCue(cue, PHRASE),
        timeSec * 1000,
        'sample-call-transcript'
      );
      if (detection.detected) {
        engine.injectExternalSignal(25, 25, { signal: 'codeWord' });
      }
    }

    const features = extractor.processFrame(frame);
    const temporalContext = temporal.processFrame(features, null);
    const evaluation = engine.evaluate(features);
    const result = incidents.processEvaluation(evaluation, {
      source: 'SIMULATION',
      baselineAvailable: false,
      codeWordDetected: false,
      temporalContext,
    });

    trace.push({
      timeSec,
      score: evaluation.riskScore,
      level: evaluation.riskLevel,
      confirmed: evaluation.isConfirmed,
      newIncident: result.isNewIncident,
    });
  }
  return trace;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

function runTests(): void {
  const samples = synthesizeSampleCall(SAMPLE_CALL_SAMPLE_RATE);

  printSection('1. Synthesis & WAV Encoding');
  assert(
    samples.length === Math.floor(SAMPLE_CALL_DURATION_SEC * SAMPLE_CALL_SAMPLE_RATE),
    'Sample count matches declared duration'
  );
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  assert(peak > 0.1 && peak <= 1, `Peak amplitude within (0.1, 1] (got ${peak.toFixed(3)})`);

  const wav = encodeWav(samples, SAMPLE_CALL_SAMPLE_RATE);
  const view = new DataView(wav);
  const tag = (o: number) => String.fromCharCode(...new Uint8Array(wav, o, 4));
  assert(tag(0) === 'RIFF' && tag(8) === 'WAVE', 'WAV has RIFF/WAVE header');
  assert(tag(36) === 'data', 'WAV has data chunk');
  assert(view.getUint16(22, true) === 1, 'WAV is mono');
  assert(view.getUint32(24, true) === SAMPLE_CALL_SAMPLE_RATE, 'WAV sample rate is encoded');
  assert(wav.byteLength === 44 + samples.length * 2, 'WAV byte length = header + 16-bit samples');

  printSection('2. Determinism');
  const again = synthesizeSampleCall(SAMPLE_CALL_SAMPLE_RATE);
  let identical = again.length === samples.length;
  for (let i = 0; identical && i < samples.length; i += 97) identical = again[i] === samples[i];
  assert(identical, 'Two syntheses produce identical PCM');

  printSection('3–5. Full Detection Pipeline');
  const trace = runPipeline(samples, SAMPLE_CALL_SAMPLE_RATE, true);
  const acousticOnly = runPipeline(samples, SAMPLE_CALL_SAMPLE_RATE, false);
  const calm = SAMPLE_CALL_SEGMENTS.find((s) => s.tone === 'calm')!;
  const distress = SAMPLE_CALL_SEGMENTS.find((s) => s.tone === 'distress')!;

  const calmFrames = trace.filter((f) => f.timeSec >= calm.startSec + 1 && f.timeSec < calm.endSec);
  const calmMax = Math.max(...calmFrames.map((f) => f.score));
  assert(calmFrames.length > 50, 'Calm segment produced analysis frames');
  assert(
    calmFrames.every((f) => f.level === 'NORMAL'),
    `Calm segment stays NORMAL (max score ${calmMax.toFixed(1)})`
  );
  assert(!calmFrames.some((f) => f.newIncident), 'No incident during calm segment');

  const acousticDistress = acousticOnly.filter(
    (f) => f.timeSec >= distress.startSec && f.timeSec < distress.endSec
  );
  const acousticMax = Math.max(...acousticDistress.map((f) => f.score));
  assert(acousticMax >= 50, `Acoustic-only distress escalates to SUSPICIOUS+ (max ${acousticMax.toFixed(1)})`);
  assert(
    !acousticOnly.some((f) => f.level === 'HIGH_RISK'),
    'Acoustic-only stream never reaches HIGH_RISK (multi-signal ceiling holds)'
  );
  assert(!acousticOnly.some((f) => f.newIncident), 'Acoustic-only stream dispatches no alert');

  const phraseCue = SAMPLE_CALL_TRANSCRIPT.find((c) => c.template.includes('{phrase}'))!;
  assert(
    phraseCue.atSec >= distress.startSec && phraseCue.atSec < distress.endSec,
    'Covert phrase cue sits inside the distress segment'
  );
  assert(
    SAMPLE_CALL_TRANSCRIPT.filter((c) => !c.template.includes('{phrase}')).every(
      (c) => !new CodeWordDetector(PHRASE).processTranscript(c.template).detected
    ),
    'Innocuous transcript cues do not trigger the detector'
  );

  const distressFrames = trace.filter((f) => f.timeSec >= distress.startSec && f.timeSec < distress.endSec);
  const distressMax = Math.max(...distressFrames.map((f) => f.score));
  assert(
    distressFrames.some((f) => f.level === 'HIGH_RISK' && f.confirmed),
    `Distress segment reaches confirmed HIGH_RISK (max score ${distressMax.toFixed(1)})`
  );

  const alerts = trace.filter((f) => f.newIncident);
  assert(alerts.length >= 1, 'At least one silent alert dispatched');
  assert(
    alerts.length > 0 && alerts[0].timeSec >= phraseCue.atSec && alerts[0].timeSec < phraseCue.atSec + 2,
    `First alert fires right after the corroborating phrase (t=${alerts[0]?.timeSec.toFixed(1)}s)`
  );
  assert(alerts.length <= 2, `Latch prevents alert spam (alerts=${alerts.length})`);

  console.log('\n════════════════════════════════════════');
  console.log('  Sanket Sample Call Recording Tests');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runTests();
