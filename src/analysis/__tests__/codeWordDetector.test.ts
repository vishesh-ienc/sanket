/**
 * Sanket, Phase 5 Code-Word Detector Unit Tests
 *
 * Deterministic test suite for CodeWordDetector, text normalization,
 * token-aware phrase matching, cooldown debounce, and RiskEngine contextual integration.
 *
 * Zero browser or DOM automation, purely deterministic module tests.
 */

import { CodeWordDetector, normalizeText, levenshteinDistance, compareTokens } from '../codeWordDetector';
import { RiskEngine } from '../riskEngine';
import { ManualTranscriptSource } from '../manualTranscriptSource';
import type { FeatureSet } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Test Runner Harness
// ─────────────────────────────────────────────────────────────────────────────

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string): void {
  totalTests += 1;
  if (condition) {
    passedTests += 1;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests += 1;
    console.error(`  ❌ FAIL: ${testName}${detail ? `, ${detail}` : ''}`);
  }
}

function section(name: string): void {
  console.log(`\n─── ${name} ───`);
}

function normalFeatureSet(timestamp = 1000): FeatureSet {
  return {
    timestamp,
    rmsEnergy: 0.05,
    zeroCrossingRate: 0.08,
    spectralCentroid: 1400,
    pitchHz: 165,
    isSpeech: true,
    silenceDurationSec: 0,
    speechActivityDurationSec: 5.0,
    speechSegmentCount: 2,
  };
}

function multiSignalFeatureSet(timestamp = 1000): FeatureSet {
  return {
    timestamp,
    rmsEnergy: 0.28,
    zeroCrossingRate: 0.35,
    spectralCentroid: 3800,
    pitchHz: 350,
    isSpeech: true,
    silenceDurationSec: 3.5,
    speechActivityDurationSec: 0.8,
    speechSegmentCount: 1,
  };
}

console.log('\n════════════════════════════════════════');
console.log('  Sanket Phase 5 Code-Word Detector Tests');
console.log('════════════════════════════════════════');

// ─────────────────────────────────────────────────────────────────────────────
// A. Normalization & Token Extraction
// ─────────────────────────────────────────────────────────────────────────────
section('A. Text Normalization');

{
  const { normalized, tokens } = normalizeText('Remember to feed the cat');
  assert(normalized === 'remember to feed the cat', 'Basic lowercasing and normalization');
  assert(tokens.length === 5, 'Extracts 5 tokens', `got ${tokens.length}`);
}

{
  const { normalized, tokens } = normalizeText('  Remember,   to  feed the cat!  ');
  assert(
    normalized === 'remember to feed the cat',
    'Normalizes punctuation and multiple whitespace',
    `got "${normalized}"`
  );
  assert(tokens.join(' ') === 'remember to feed the cat', 'Tokens match clean phrase');
}

{
  const { normalized, tokens } = normalizeText('REMEMBER "TO FEED" THE CAT...');
  assert(normalized === 'remember to feed the cat', 'Strips quotes and ellipses');
  assert(tokens[0] === 'remember' && tokens[4] === 'cat', 'Token endpoints correct');
}

{
  const { normalized, tokens } = normalizeText('');
  assert(normalized === '', 'Empty string normalizes to empty');
  assert(tokens.length === 0, 'Empty string produces empty tokens array');
}

{
  assert(levenshteinDistance('cat', 'cats') === 1, 'Levenshtein cat -> cats is 1');
  assert(levenshteinDistance('hello', 'hello') === 0, 'Levenshtein identical strings is 0');
  assert(levenshteinDistance('feed', 'reed') === 1, 'Levenshtein 1-char substitution is 1');
}

{
  assert(compareTokens('cat', 'cat', true) === 1.0, 'Exact token match returns 1.0');
  assert(compareTokens('cat', 'cats', true) >= 0.9, 'Plural token variation returns high score');
  assert(compareTokens('feed', 'feeding', true) >= 0.9, 'Verb suffix variation returns high score');
  assert(compareTokens('cat', 'dog', true) === 0.0, 'Different word returns 0.0');
  assert(compareTokens('cat', 'cats', false) === 0.0, 'Fuzzy tolerance disabled rejects plural');
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Exact & Case-Insensitive Matching
// ─────────────────────────────────────────────────────────────────────────────
section('B. Phrase Matching & Normalization');

{
  const detector = new CodeWordDetector('Remember to feed the cat');
  const result = detector.processTranscript('remember to feed the cat', 1000);
  assert(result.detected === true, '1. Exact configured phrase matches');
  assert(result.confidence === 1.0, 'Exact match has confidence 1.0');
  assert(result.matchedPhrase === 'remember to feed the cat', 'Matched snippet matches target');
}

{
  const detector = new CodeWordDetector('Remember to feed the cat');
  const result = detector.processTranscript('REMEMBER TO FEED THE CAT', 1000);
  assert(result.detected === true, '2. Case-insensitive uppercase matching');
}

{
  const detector = new CodeWordDetector('Remember to feed the cat');
  const result = detector.processTranscript('   remember   \t  to   feed   the   cat   ', 1000);
  assert(result.detected === true, '3. Whitespace normalization (tabs and multiple spaces)');
}

{
  const detector = new CodeWordDetector('Remember to feed the cat');
  const result = detector.processTranscript('Remember, to feed the cat!', 1000);
  assert(result.detected === true, '4. Punctuation normalization (commas, exclamation mark)');
}

{
  const detector = new CodeWordDetector('Remember to feed the cat');
  const result = detector.processTranscript(
    "Yeah, everything's fine... just remember to feed the cat when you get home.",
    1000
  );
  assert(result.detected === true, '5. Phrase embedded in longer conversational sentence matches');
}

// ─────────────────────────────────────────────────────────────────────────────
// C. False-Positive Avoidance Guardrails
// ─────────────────────────────────────────────────────────────────────────────
section('C. False-Positive Avoidance Guardrails');

{
  const detector = new CodeWordDetector('Remember to feed the cat');
  const result = detector.processTranscript('I am going to the grocery store today.', 1000);
  assert(result.detected === false, '6. Unrelated sentence does not match');
}

{
  const detector = new CodeWordDetector('feed the cat');
  // Single token "cat" or "the" present in an unrelated sentence
  const result1 = detector.processTranscript('The weather is nice today.', 1000);
  const result2 = detector.processTranscript('Look at that white cat on the fence.', 2000);
  assert(result1.detected === false, '7a. Single common token "the" does not match multi-word phrase');
  assert(result2.detected === false, '7b. Single token "cat" does not match multi-word phrase');
}

{
  const detector = new CodeWordDetector('cat');
  // "cat" inside "catastrophe" should not match due to token boundary isolation
  const result = detector.processTranscript('That was a total catastrophe.', 1000);
  assert(result.detected === false, '19. Partial word inside longer word does not match (cat vs catastrophe)');
}

// ─────────────────────────────────────────────────────────────────────────────
// D. State, Enable/Disable, & Safety Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
section('D. State, Enable/Disable & Reset');

{
  const detector = new CodeWordDetector('');
  const result = detector.processTranscript('Remember to feed the cat', 1000);
  assert(result.detected === false, '8. Empty configuration behaves safely without throwing');
}

{
  const detector = new CodeWordDetector('Remember to feed the cat');
  detector.disable();
  const result = detector.processTranscript('Remember to feed the cat', 1000);
  assert(result.detected === false, '9. Disabled detector does not match');
  assert(result.reason?.includes('disabled') === true, 'Disabled reason provided');
}

{
  const detector = new CodeWordDetector('Remember to feed the cat');
  detector.processTranscript('Remember to feed the cat', 1000);
  assert(detector.getLastDetection()?.detected === true, 'Last detection recorded before reset');
  detector.reset();
  assert(detector.getLastDetection() === null, '10. Detector reset clears state');
}

{
  const detector = new CodeWordDetector('Safe harbor');
  const result1 = detector.processTranscript("We need to find a safe harbor now.", 1000);
  assert(result1.detected === true, '13. Custom configured phrase works ("Safe harbor")');

  detector.configure('Blue skies ahead');
  const result2 = detector.processTranscript("There are blue skies ahead of us.", 2000);
  assert(result2.detected === true, 'Dynamic reconfiguration works ("Blue skies ahead")');
}

// ─────────────────────────────────────────────────────────────────────────────
// E. Cooldown & Duplicate Debounce Window
// ─────────────────────────────────────────────────────────────────────────────
section('E. Cooldown & Duplicate Debounce');

{
  const detector = new CodeWordDetector({
    phrase: 'Remember to feed the cat',
    cooldownMs: 5000,
  });

  // First detection at t=1000ms
  const first = detector.processTranscript('remember to feed the cat', 1000);
  assert(first.detected === true, 'First recognition fires successfully');

  // Duplicate speech-recognition burst at t=2500ms (<5000ms cooldown)
  const duplicate = detector.processTranscript('remember to feed the cat', 2500);
  assert(
    duplicate.detected === false,
    '11. Duplicate recognition result is suppressed during cooldown (t=2500 < t=6000)'
  );
  assert(
    duplicate.reason?.includes('cooldown') === true,
    'Cooldown reason provided on suppressed result'
  );

  // Eligible again after cooldown at t=6500ms (5500ms > 5000ms cooldown)
  const afterCooldown = detector.processTranscript('remember to feed the cat', 6500);
  assert(
    afterCooldown.detected === true,
    '12. Detection is allowed again after cooldown window expires (t=6500 >= t=6000)'
  );
}

{
  const detector = new CodeWordDetector('Emergency code alpha');
  // Rapid burst within 100ms
  detector.processTranscript('Emergency code alpha', 100);
  const burst2 = detector.processTranscript('Emergency code alpha', 150);
  const burst3 = detector.processTranscript('Emergency code alpha', 200);
  assert(
    burst2.detected === false && burst3.detected === false,
    '24. Rapid speech recognition stream burst suppressed during cooldown'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// F. Fuzzy & Inflection Tolerance
// ─────────────────────────────────────────────────────────────────────────────
section('F. Morphological & Fuzzy Tolerance');

{
  const detector = new CodeWordDetector({
    phrase: 'remember to feed the cat',
    fuzzyTolerance: true,
  });

  // Minor inflection: 'cats' instead of 'cat'
  const result = detector.processTranscript('remember to feed the cats', 1000);
  assert(result.detected === true, '20. Fuzzy matching accepts minor plural variation ("cat" vs "cats")');
  assert(result.confidence >= 0.85, 'Fuzzy match confidence satisfies threshold');
}

{
  const detector = new CodeWordDetector({
    phrase: 'remember to feed the cat',
    fuzzyTolerance: false,
  });

  // When fuzzy tolerance is disabled, 'cats' should be rejected
  const result = detector.processTranscript('remember to feed the cats', 1000);
  assert(result.detected === false, '21. Strict mode (fuzzyTolerance: false) rejects plural variation');
}

{
  const detector = new CodeWordDetector({
    phrase: 'call the doctor',
    fuzzyTolerance: true,
  });

  // Verb inflection variation: 'calling' vs 'call'
  const result = detector.processTranscript('calling the doctor', 1000);
  assert(result.detected === true, '27. Accepts common verb inflection ("calling" vs "call")');
}

// ─────────────────────────────────────────────────────────────────────────────
// G. Transcript Source Abstraction & Privacy Invariants
// ─────────────────────────────────────────────────────────────────────────────
section('G. Transcript Source Abstraction & Privacy Invariants');

{
  const source = new ManualTranscriptSource();
  const detector = new CodeWordDetector('Remember to feed the cat');
  let detectedEvent: string | null = null;

  source.onTranscript((ev) => {
    const res = detector.processTranscript(ev.text, ev.timestamp, ev.sourceId);
    if (res.detected) {
      detectedEvent = res.matchedPhrase;
    }
  });

  source.start();
  assert(source.getStatus() === 'LISTENING', 'ManualTranscriptSource starts in LISTENING state');

  source.emit('Please remember to feed the cat tonight.', 5000);
  assert(
    detectedEvent === 'remember to feed the cat',
    '23. Manual transcript source emits and successfully triggers detector'
  );

  source.stop();
  assert(source.getStatus() === 'IDLE', 'ManualTranscriptSource stops in IDLE state');
}

{
  // Privacy invariant: zero transcript retention inside CodeWordDetector
  const detector = new CodeWordDetector('Secret phrase');
  detector.processTranscript('This is a sensitive conversation about private finances and medical records.', 1000);
  const keys = Object.keys(detector);
  const hasHistoryArray = keys.some((k) =>
    Array.isArray((detector as unknown as Record<string, unknown>)[k]) &&
    ((detector as unknown as Record<string, unknown>)[k] as unknown[]).length > 0
  );
  assert(!hasHistoryArray, '15. No transcript history buffer or conversation log stored in detector');
}

{
  // Determinism check: two independent detectors produce identical results
  const d1 = new CodeWordDetector('Check on the garden');
  const d2 = new CodeWordDetector('Check on the garden');
  const text = 'Did you check on the garden this afternoon?';
  const r1 = d1.processTranscript(text, 1000);
  const r2 = d2.processTranscript(text, 1000);
  assert(
    r1.detected === r2.detected && r1.confidence === r2.confidence && r1.matchedPhrase === r2.matchedPhrase,
    '14. Matching is 100% deterministic across independent instances'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// H. RiskEngine Integration & Single-Signal Ceiling
// ─────────────────────────────────────────────────────────────────────────────
section('H. RiskEngine Contextual Integration & Bounded Boost');

{
  const engine = new RiskEngine();
  const detector = new CodeWordDetector('Remember to feed the cat');

  const detection = detector.processTranscript('Remember to feed the cat', 1000);
  assert(detection.detected === true, 'Detection verified before risk injection');

  // Inject external signal
  engine.injectExternalSignal(25, 25, {
    signal: 'codeWord',
    reason: detection.reason,
  });

  assert(
    engine.getState().smoothedScore === 25,
    '16. Code-word event injected as external signal adds bounded boost (+25)'
  );
}

{
  // Single-signal ceiling holds for Code-Word
  const engine = new RiskEngine();
  engine.injectExternalSignal(100, 25); // requests 100, capped at maxBoost=25

  assert(
    engine.getState().smoothedScore <= 25,
    '17. Code-word contribution is bounded at maxBoost=25'
  );

  assert(
    engine.getState().smoothedScore < 70,
    '18. Code-word alone cannot trigger HIGH_RISK (ceiling: 25 < 70)'
  );
}

{
  // Explainability check: evaluate() reports codeWord in contributingSignals
  const engine = new RiskEngine();
  engine.injectExternalSignal(25, 25, {
    signal: 'codeWord',
    reason: 'Configured distress phrase detected',
  });

  const evaluation = engine.evaluate(normalFeatureSet(1000));
  const codeWordContrib = evaluation.contributingSignals.find((c) => c.signal === 'codeWord');

  assert(
    codeWordContrib !== undefined,
    '26. Evaluation contributingSignals includes "codeWord"',
    `signals: ${evaluation.contributingSignals.map((c) => c.signal).join(', ')}`
  );
  assert(
    codeWordContrib?.reason === 'Configured distress phrase detected',
    'Explanatory reason matches configured distress notice'
  );
}

{
  // Multi-signal co-occurrence + Code Word reaches HIGH_RISK (>=70)
  const engine = new RiskEngine();
  // Feed 10 multi-signal frames to establish sustained acoustic abnormality
  for (let i = 0; i < 10; i++) {
    engine.evaluate(multiSignalFeatureSet(1000 + i * 100));
  }

  // Inject code word signal
  engine.injectExternalSignal(25, 25, {
    signal: 'codeWord',
    reason: 'Configured distress phrase detected',
  });

  // Evaluate next frame with multi-signal + code word
  const finalEval = engine.evaluate(multiSignalFeatureSet(2100));
  assert(
    finalEval.riskScore >= 70,
    '22. Multi-signal acoustic distress + Code Word reaches HIGH_RISK (>=70)',
    `got ${finalEval.riskScore}`
  );
  assert(finalEval.riskLevel === 'HIGH_RISK', 'Risk level transitions to HIGH_RISK');
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════');
console.log('  Sanket Phase 5 Code-Word Tests Summary');
console.log(`  Results: ${passedTests} passed, ${failedTests} failed`);
console.log('════════════════════════════════════════\n');

if (failedTests > 0) {
  process.exit(1);
}
