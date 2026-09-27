/**
 * Sanket — Customisable Signal Settings Tests
 *
 * Covers sanitisation, engine mapping, the single-signal ceiling invariant
 * under any user configuration, storage resilience, and live effect on the
 * RiskEngine (disabled signals contribute nothing).
 */

import {
  DEFAULT_SIGNAL_SETTINGS,
  MAX_SIGNAL_WEIGHT,
  MIN_ALERT_THRESHOLD,
  SIGNAL_IDS,
  SIGNAL_SETTINGS_STORAGE_KEY,
  enabledSignalCount,
  loadSignalSettings,
  sanitizeSignalSettings,
  saveSignalSettings,
  singleSignalCeiling,
  toRiskEngineOverrides,
  type SignalSettings,
} from '../signalSettings';
import { RiskEngine } from '../riskEngine';
import type { FeatureSet } from '../types';

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

const clone = (s: SignalSettings): SignalSettings => JSON.parse(JSON.stringify(s));

function strainedPitchOnly(t: number): FeatureSet {
  return {
    timestamp: t,
    rmsEnergy: 0.06,
    zeroCrossingRate: 0.08,
    spectralCentroid: 1400,
    pitchHz: 400,
    isSpeech: true,
    silenceDurationSec: 0,
    speechActivityDurationSec: 20,
    speechSegmentCount: 4,
  };
}

function runTests(): void {
  printSection('1. Sanitisation');
  const def = sanitizeSignalSettings(DEFAULT_SIGNAL_SETTINGS);
  assert(JSON.stringify(def) === JSON.stringify(DEFAULT_SIGNAL_SETTINGS), 'Defaults are already valid');
  assert(JSON.stringify(sanitizeSignalSettings(null)) === JSON.stringify(DEFAULT_SIGNAL_SETTINGS), 'null → defaults');
  const wild = sanitizeSignalSettings({
    signals: { pitch: { enabled: 'yes', weight: 999 }, rms: { weight: -5 } },
    alertThreshold: 10,
    pitchDeviationThreshold: 1000,
    codeWordBoost: 500,
  });
  assert(wild.signals.pitch.weight === MAX_SIGNAL_WEIGHT, 'Weight clamped to maximum');
  assert(wild.signals.pitch.enabled === true, 'Non-boolean enabled → default');
  assert(wild.signals.rms.weight === 0, 'Negative weight clamped to 0');
  assert(wild.alertThreshold === MIN_ALERT_THRESHOLD, 'Alert threshold clamped to minimum');
  assert(wild.pitchDeviationThreshold === 120, 'Pitch threshold clamped');
  assert(wild.codeWordBoost === 35, 'Code-word boost clamped');
  assert(sanitizeSignalSettings({ alertThreshold: NaN }).alertThreshold === 70, 'NaN → default');

  printSection('2. Engine Mapping');
  const o = toRiskEngineOverrides(DEFAULT_SIGNAL_SETTINGS);
  assert(o.weights.pitch === 20 && o.weights.persistence === 15, 'Default weights mapped');
  assert(o.highRiskThreshold === 70 && o.suspiciousThreshold === 50 && o.elevatedThreshold === 30, 'Default level bands');
  const off = clone(DEFAULT_SIGNAL_SETTINGS);
  off.signals.spectral.enabled = false;
  assert(toRiskEngineOverrides(off).weights.spectral === 0, 'Disabled signal → weight 0');
  const low = clone(DEFAULT_SIGNAL_SETTINGS);
  low.alertThreshold = 60;
  const lo = toRiskEngineOverrides(low);
  assert(lo.suspiciousThreshold! < lo.highRiskThreshold! && lo.elevatedThreshold! < lo.suspiciousThreshold!, 'Level bands stay ordered at lower alert threshold');
  assert(enabledSignalCount(off) === 5, 'Enabled signal count');

  printSection('3. Single-Signal Ceiling Invariant');
  const extreme = clone(DEFAULT_SIGNAL_SETTINGS);
  for (const id of SIGNAL_IDS) extreme.signals[id].weight = 999;
  extreme.alertThreshold = 0;
  extreme.codeWordBoost = 999;
  const sx = sanitizeSignalSettings(extreme);
  assert(singleSignalCeiling(sx) < sx.alertThreshold, `Ceiling ${singleSignalCeiling(sx)} < alert ${sx.alertThreshold} even at extremes`);
  assert(singleSignalCeiling(DEFAULT_SIGNAL_SETTINGS) === 40, 'Default ceiling = code word 25 + persistence 15');

  const engine = new RiskEngine();
  engine.updateConfig(toRiskEngineOverrides(sx));
  let maxScore = 0;
  let highRisk = false;
  for (let i = 0; i < 200; i++) {
    const ev = engine.evaluate(strainedPitchOnly(i * 100));
    maxScore = Math.max(maxScore, ev.riskScore);
    highRisk ||= ev.riskLevel === 'HIGH_RISK';
  }
  assert(!highRisk, `Max-weight pitch alone never reaches HIGH_RISK (max ${maxScore.toFixed(1)})`);

  printSection('4. Live Effect on Engine');
  const pitchOff = clone(DEFAULT_SIGNAL_SETTINGS);
  pitchOff.signals.pitch.enabled = false;
  const e2 = new RiskEngine();
  e2.updateConfig(toRiskEngineOverrides(pitchOff));
  const ev = e2.evaluate(strainedPitchOnly(0));
  assert(!ev.contributingSignals.some((c) => c.signal === 'pitch' && c.contribution > 0), 'Disabled pitch contributes nothing');
  const e3 = new RiskEngine();
  e3.updateConfig(toRiskEngineOverrides(DEFAULT_SIGNAL_SETTINGS));
  assert(
    e3.evaluate(strainedPitchOnly(0)).contributingSignals.some((c) => c.signal === 'pitch' && c.contribution > 0),
    'Enabled pitch contributes'
  );
  const sensitive = clone(DEFAULT_SIGNAL_SETTINGS);
  sensitive.pitchDeviationThreshold = 10;
  const e4 = new RiskEngine();
  e4.updateConfig(toRiskEngineOverrides(sensitive));
  const slightlyHigh = { ...strainedPitchOnly(0), pitchHz: 190 };
  const c4 = e4.evaluate(slightlyHigh).contributingSignals.find((c) => c.signal === 'pitch')?.contribution ?? 0;
  const e5 = new RiskEngine();
  const c5 = e5.evaluate(slightlyHigh).contributingSignals.find((c) => c.signal === 'pitch')?.contribution ?? 0;
  assert(c4 > 0 && c5 === 0, 'Lower pitch threshold makes pitch more sensitive');

  printSection('5. Storage');
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  assert(JSON.stringify(loadSignalSettings(store)) === JSON.stringify(DEFAULT_SIGNAL_SETTINGS), 'Empty storage → defaults');
  assert(saveSignalSettings(pitchOff, store) && mem.has(SIGNAL_SETTINGS_STORAGE_KEY), 'Saved under versioned key');
  assert(loadSignalSettings(store).signals.pitch.enabled === false, 'Round-trip preserves settings');
  mem.set(SIGNAL_SETTINGS_STORAGE_KEY, '{broken');
  assert(loadSignalSettings(store).signals.pitch.enabled === true, 'Corrupt JSON → defaults');
  const throwing = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('quota');
    },
  };
  assert(loadSignalSettings(throwing).alertThreshold === 70 && !saveSignalSettings(def, throwing), 'Throwing storage handled');
  assert(!saveSignalSettings(def, null), 'Null storage handled');

  console.log('\n════════════════════════════════════════');
  console.log('  Sanket Signal Settings Tests');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════\n');
  if (failed > 0) process.exit(1);
}

runTests();
