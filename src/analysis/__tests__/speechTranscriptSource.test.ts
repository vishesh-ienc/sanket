/**
 * Sanket, Browser Speech Transcript Source Tests
 *
 * Uses a mock SpeechRecognition constructor (no browser, mic, or network).
 *
 * Covers:
 *   1. Support detection (missing API, on-device availability, unknown)
 *   2. Privacy: on-device mode forces processLocally=true; cloud only when chosen
 *   3. Result events → TranscriptEvent emission (interim + final)
 *   4. Auto-restart after browser ends a continuous session
 *   5. Error handling (benign vs fatal) and stop()
 *   6. Integration with CodeWordDetector
 */

import {
  BrowserSpeechTranscriptSource,
  checkSpeechSupport,
  installOnDeviceSpeech,
  type RecognitionConstructorLike,
  type RecognitionLike,
  type RecognitionResultEvent,
} from '../speechTranscriptSource';
import { CodeWordDetector } from '../codeWordDetector';
import type { TranscriptEvent } from '../transcriptTypes';

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

const instances: MockRecognition[] = [];

class MockRecognition implements RecognitionLike {
  lang = '';
  continuous = false;
  interimResults = false;
  processLocally?: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = 0;
  aborted = false;
  constructor() {
    instances.push(this);
  }
  start() {
    this.started++;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.aborted = true;
  }
  emit(text: string, isFinal: boolean) {
    const result = Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal });
    this.onresult?.({ resultIndex: 0, results: [result] as unknown as RecognitionResultEvent['results'] });
  }
}

function makeCtor(availability?: string, installOk = true): RecognitionConstructorLike {
  const ctor = MockRecognition as unknown as RecognitionConstructorLike;
  const withStatics = Object.assign(ctor, {}) as RecognitionConstructorLike;
  if (availability !== undefined) {
    withStatics.available = async () => availability;
    withStatics.install = async () => installOk;
  } else {
    delete withStatics.available;
    delete withStatics.install;
  }
  return withStatics;
}

async function runTests(): Promise<void> {
  printSection('1. Support Detection');
  const none = await checkSpeechSupport('en-US', null);
  assert(!none.apiAvailable && none.onDevice === 'unavailable', 'No API → unsupported');
  assert((await checkSpeechSupport('en-US', makeCtor('available'))).onDevice === 'available', 'On-device available reported');
  assert((await checkSpeechSupport('en-US', makeCtor('downloadable'))).onDevice === 'downloadable', 'Downloadable reported');
  assert((await checkSpeechSupport('en-US', makeCtor('weird'))).onDevice === 'unknown', 'Unexpected status → unknown');
  const legacy = await checkSpeechSupport('en-US', makeCtor(undefined));
  assert(legacy.apiAvailable && legacy.onDevice === 'unknown', 'Older API without available() → unknown');
  const throwing = makeCtor('available');
  throwing.available = async () => {
    throw new Error('x');
  };
  assert((await checkSpeechSupport('en-US', throwing)).onDevice === 'unknown', 'available() throwing → unknown');
  assert(await installOnDeviceSpeech('en-US', makeCtor('downloadable', true)), 'install() success propagated');
  assert(!(await installOnDeviceSpeech('en-US', makeCtor(undefined))), 'install() missing → false');

  printSection('2. Privacy Mode');
  instances.length = 0;
  const unsupported = new BrowserSpeechTranscriptSource({ ctor: null });
  unsupported.start();
  assert(unsupported.getStatus() === 'UNSUPPORTED', 'Start without API → UNSUPPORTED');

  const local = new BrowserSpeechTranscriptSource({ ctor: makeCtor('available') });
  assert(local.getMode() === 'on-device', 'Default mode is on-device');
  local.start();
  assert(instances[0].processLocally === true, 'On-device mode sets processLocally = true');
  assert(instances[0].continuous && instances[0].interimResults, 'Continuous with interim results');
  assert(instances[0].lang === 'en-US', 'Language applied');
  assert(local.getStatus() === 'LISTENING', 'Status LISTENING after start');
  local.stop();

  instances.length = 0;
  const cloud = new BrowserSpeechTranscriptSource({ ctor: makeCtor('unavailable'), mode: 'cloud', lang: 'hi-IN' });
  cloud.start();
  assert(instances[0].processLocally === false, 'Cloud mode only when explicitly chosen');
  assert(instances[0].lang === 'hi-IN', 'Custom language applied');
  cloud.stop();

  printSection('3. Result Emission');
  instances.length = 0;
  const src = new BrowserSpeechTranscriptSource({ ctor: makeCtor('available') });
  const events: TranscriptEvent[] = [];
  const unsub = src.onTranscript((e) => events.push(e));
  src.start();
  instances[0].emit('remember to', false);
  instances[0].emit('remember to feed the cat', true);
  assert(events.length === 2, 'Interim and final results emitted');
  assert(!events[0].isFinal && events[1].isFinal, 'isFinal flags preserved');
  assert(events[1].sourceId === 'browser-speech-on-device', 'Source id records privacy mode');
  unsub();
  instances[0].emit('ignored', true);
  assert(events.length === 2, 'Unsubscribed listener receives nothing');

  printSection('4. Auto-restart');
  const before = instances.length;
  instances[instances.length - 1].onend?.();
  assert(instances.length === before + 1 && instances[instances.length - 1].started === 1, 'Session end → new recognition started');
  assert(src.getStatus() === 'LISTENING', 'Still LISTENING after restart');

  printSection('5. Errors & Stop');
  instances[instances.length - 1].onerror?.({ error: 'no-speech' });
  assert(src.getStatus() === 'LISTENING', 'no-speech is benign');
  const statuses: string[] = [];
  src.onStatusChange((s) => statuses.push(s));
  instances[instances.length - 1].onerror?.({ error: 'language-not-supported' });
  assert(src.getStatus() === 'ERROR', 'language-not-supported → ERROR');
  assert(/on-device/i.test(src.getErrorMessage() ?? ''), 'Error message explains on-device pack');
  assert(statuses.includes('ERROR'), 'Status listeners notified');
  const count = instances.length;
  instances[instances.length - 1].onend?.();
  assert(instances.length === count, 'No restart after fatal error');

  const s2 = new BrowserSpeechTranscriptSource({ ctor: makeCtor('available') });
  s2.start();
  const rec = instances[instances.length - 1];
  s2.stop();
  assert(rec.aborted && s2.getStatus() === 'IDLE', 'stop() aborts and returns to IDLE');
  const after = instances.length;
  rec.onend?.();
  assert(instances.length === after, 'No restart after stop()');

  printSection('6. Code-Word Integration');
  instances.length = 0;
  const detector = new CodeWordDetector('Remember to feed the cat');
  const live = new BrowserSpeechTranscriptSource({ ctor: makeCtor('available') });
  let detections = 0;
  live.onTranscript((e) => {
    if (detector.processTranscript(e.text, e.timestamp, e.sourceId).detected) detections++;
  });
  live.start();
  instances[0].emit('everything is fine', false);
  instances[0].emit('everything is fine remember to feed the cat', false);
  instances[0].emit('everything is fine remember to feed the cat okay', true);
  assert(detections === 1, 'Phrase detected once from interim+final stream (cooldown dedupes)');

  console.log('\n════════════════════════════════════════');
  console.log('  Sanket Browser Speech Transcript Source Tests');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

void runTests();
