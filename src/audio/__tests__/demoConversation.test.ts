/**
 * Sanket, Built-in Demo Conversation & Incident Hysteresis Tests
 *
 * Runs the bundled conversation (public/demo/conversation.wav, real TTS
 * speech) through the unchanged pipeline:
 *   decodePcm16Wav → AudioFrameBuilder → FeatureExtractor → TemporalContext →
 *   RiskEngine (+ CodeWordDetector on transcript cues) → IncidentManager
 *
 * Covers:
 *   1. Metadata integrity (cues, timeline, code phrase placement)
 *   2. Calm opening stays NORMAL
 *   3. Acoustic-only stream escalates but never alerts (multi-signal ceiling)
 *   4. With the transcript, exactly ONE alert fires after the code phrase
 *   5. Hysteresis: without it, natural speech dips cause duplicate alerts
 *   6. IncidentManager releaseFrames unit behaviour
 *
 * No browser, DOM, microphone, or network required.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AudioFrameBuilder, decodePcm16Wav, FRAME_SIZE } from '../frameBuilder';
import { FeatureExtractor } from '../../analysis/featureExtractor';
import { RiskEngine, EXTERNAL_HOLD_FRAMES } from '../../analysis/riskEngine';
import { TemporalContextAnalyzer } from '../../analysis/temporalContext';
import { CodeWordDetector } from '../../analysis/codeWordDetector';
import { IncidentManager } from '../../services/incidentManager';
import type { RiskEvaluation, RiskLevel } from '../../analysis/types';
import type { DemoConversation } from '../demoConversations';

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

const ROOT = resolve(process.cwd(), 'public');
const meta = JSON.parse(readFileSync(resolve(ROOT, 'demo/conversation.json'), 'utf8')) as DemoConversation;
const wavBytes = readFileSync(resolve(ROOT, meta.audio));
const { samples, sampleRate } = decodePcm16Wav(
  wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength)
);

interface Trace {
  timeSec: number;
  score: number;
  level: RiskLevel;
  newIncident: boolean;
}

function run(withTranscript: boolean, releaseFrames: number): Trace[] {
  const builder = new AudioFrameBuilder();
  const extractor = new FeatureExtractor();
  const temporal = new TemporalContextAnalyzer();
  const engine = new RiskEngine();
  const detector = new CodeWordDetector(meta.codePhrase);
  const incidents = new IncidentManager({ releaseFrames });
  const cues = withTranscript ? [...meta.cues].sort((a, b) => a.finalSec - b.finalSec) : [];
  const trace: Trace[] = [];

  const hop = Math.floor(sampleRate * 0.1);
  for (let end = FRAME_SIZE; end <= samples.length; end += hop) {
    const timeSec = end / sampleRate;
    while (cues.length > 0 && cues[0].finalSec <= timeSec) {
      const cue = cues.shift()!;
      if (detector.processTranscript(cue.text, timeSec * 1000, 'demo-conversation').detected) {
        engine.injectExternalSignal(41, 41, { signal: 'codeWord' });
      }
    }
    const frame = builder.build(samples.slice(end - FRAME_SIZE, end), sampleRate, timeSec * 1000);
    const features = extractor.processFrame(frame);
    const temporalContext = temporal.processFrame(features, null);
    const evaluation = engine.evaluate(features);
    const result = incidents.processEvaluation(evaluation, {
      source: 'SIMULATION',
      baselineAvailable: false,
      codeWordDetected: false,
      temporalContext,
    });
    trace.push({ timeSec, score: evaluation.riskScore, level: evaluation.riskLevel, newIncident: result.isNewIncident });
  }
  return trace;
}

function evalAt(level: RiskLevel, score: number, t: number): RiskEvaluation {
  return {
    timestamp: t,
    riskScore: score,
    riskLevel: level,
    contributingSignals: [{ signal: 'pitch', contribution: 20, reason: 'test' }],
    confirmedSignals: 1,
    persistenceFrames: 10,
    isConfirmed: true,
  };
}

function runTests(): void {
  printSection('1. Metadata Integrity');
  assert(sampleRate >= 16000, `Audio decoded at usable rate (${sampleRate} Hz)`);
  const decodedDuration = samples.length / sampleRate;
  assert(Math.abs(decodedDuration - meta.durationSec) < 0.1, 'Declared duration matches audio');
  assert(meta.cues.every((c) => c.finalSec > c.atSec), 'Every cue ends after it starts');
  assert(meta.cues.every((c, i) => i === 0 || c.atSec >= meta.cues[i - 1].atSec), 'Cues are chronological');
  assert(meta.cues.every((c) => c.finalSec <= meta.durationSec + 0.05), 'Cues fit inside the audio');
  assert(meta.timeline[0].startSec === 0, 'Timeline starts at 0');
  assert(
    Math.abs(meta.timeline[meta.timeline.length - 1].endSec - meta.durationSec) < 0.05,
    'Timeline covers the full audio'
  );
  const phraseCues = meta.cues.filter((c) => c.text.toLowerCase().includes(meta.codePhrase.toLowerCase()));
  assert(phraseCues.length === 1 && phraseCues[0].speaker === 'user', 'Code phrase spoken exactly once, by the monitored user');
  const distress = meta.timeline.find((s) => s.tone === 'distress')!;
  assert(phraseCues[0].atSec >= distress.startSec, 'Code phrase occurs inside the distress segment');
  assert(meta.synthetic === true && /not a real person/i.test(meta.credits), 'Synthetic origin is disclosed');

  printSection('2–4. Pipeline Behaviour');
  const calmEnd = meta.timeline.find((s) => s.tone !== 'calm')!.startSec;
  const withTranscript = run(true, 40);
  const calm = withTranscript.filter((f) => f.timeSec < calmEnd);
  assert(calm.every((f) => f.level === 'NORMAL'), `Calm opening stays NORMAL (max ${Math.max(...calm.map((f) => f.score)).toFixed(1)})`);

  const acoustic = run(false, 40);
  const acousticMax = Math.max(...acoustic.map((f) => f.score));
  assert(acousticMax >= 30, `Acoustic-only distress escalates to ELEVATED+ (max ${acousticMax.toFixed(1)})`);
  assert(!acoustic.some((f) => f.newIncident), 'Acoustic-only stream never dispatches an alert');

  const alerts = withTranscript.filter((f) => f.newIncident);
  const phraseFinal = phraseCues[0].finalSec;
  assert(alerts.length === 1, `Exactly one alert with transcript + hysteresis (got ${alerts.length})`);
  assert(
    alerts.length > 0 && alerts[0].timeSec >= phraseFinal && alerts[0].timeSec < phraseFinal + 6,
    `Alert follows the code phrase (phrase ends ${phraseFinal}s, alert ${alerts[0]?.timeSec.toFixed(1)}s)`
  );

  printSection('5. Why Hysteresis Is Needed');
  const noHysteresis = run(true, 0).filter((f) => f.newIncident).length;
  assert(noHysteresis > 1, `Without hysteresis natural speech dips re-trigger alerts (${noHysteresis} alerts)`);

  printSection('6. IncidentManager releaseFrames');
  const m = new IncidentManager({ releaseFrames: 3 });
  assert(m.processEvaluation(evalAt('HIGH_RISK', 80, 1), undefined).isNewIncident, 'First confirmed HIGH_RISK dispatches');
  const dip1 = m.processEvaluation(evalAt('SUSPICIOUS', 60, 2), undefined);
  assert(dip1.incident?.status === 'ACTIVE' && m.isLatched(), 'Short dip keeps incident active & latched');
  m.processEvaluation(evalAt('SUSPICIOUS', 60, 3), undefined);
  const back = m.processEvaluation(evalAt('HIGH_RISK', 82, 4), undefined);
  assert(!back.isNewIncident && back.incident?.riskScore === 82, 'Recovery within window updates same incident, no new alert');
  for (let i = 0; i < 3; i++) m.processEvaluation(evalAt('ELEVATED', 35, 5 + i), undefined);
  assert(m.isLatched(), 'Still latched after exactly releaseFrames dips');
  const released = m.processEvaluation(evalAt('ELEVATED', 35, 9), undefined);
  assert(released.incident?.status === 'RESOLVED' && !m.isLatched(), 'Resolves after releaseFrames + 1 dips');
  assert(m.processEvaluation(evalAt('HIGH_RISK', 90, 10), undefined).isNewIncident, 'Distinct later episode dispatches a new alert');
  const legacy = new IncidentManager();
  legacy.processEvaluation(evalAt('HIGH_RISK', 80, 1), undefined);
  legacy.processEvaluation(evalAt('SUSPICIOUS', 60, 2), undefined);
  assert(!legacy.isLatched(), 'Default releaseFrames=0 keeps original immediate-release behaviour');

  printSection('7. Sticky Contextual Code-Word Signal');
  const engine = new RiskEngine();
  const calmFeatures = {
    timestamp: 0,
    rmsEnergy: 0.06,
    zeroCrossingRate: 0.08,
    spectralCentroid: 1400,
    pitchHz: 165,
    isSpeech: true,
    silenceDurationSec: 0,
    speechActivityDurationSec: 10,
    speechSegmentCount: 3,
  };
  engine.injectExternalSignal(25, 25, { signal: 'codeWord' });
  const scores: number[] = [];
  const contribAt: number[] = [];
  for (let i = 0; i < EXTERNAL_HOLD_FRAMES + 20; i++) {
    const ev = engine.evaluate({ ...calmFeatures, timestamp: i * 100 });
    scores.push(ev.riskScore);
    contribAt.push(ev.contributingSignals.find((c) => c.signal === 'codeWord')?.contribution ?? 0);
  }
  assert(contribAt[50] === 25, 'Code word still at full weight after 5 s');
  assert(contribAt[EXTERNAL_HOLD_FRAMES - 25] > 0 && contribAt[EXTERNAL_HOLD_FRAMES - 25] < 25, 'Code word fades out near the end of its window');
  assert(contribAt[EXTERNAL_HOLD_FRAMES + 5] === 0, 'Code word expires after the hold window');
  assert(Math.max(...scores) < 50, `Code word alone stays well below HIGH_RISK (max ${Math.max(...scores).toFixed(1)})`);
  assert(scores[40] > 20, `Code word alone is visible as sustained context (${scores[40].toFixed(1)} at 4 s)`);

  console.log('\n════════════════════════════════════════');
  console.log('  Sanket Demo Conversation & Hysteresis Tests');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runTests();
