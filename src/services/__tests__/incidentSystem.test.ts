/**
 * Sanket, Phase 7: Silent Alert Dispatch & Forensic Event System Tests
 *
 * Deterministic unit and integration tests covering:
 *   - Silent Alert Dispatcher (gating, simulation mode, metadata)
 *   - Incident Latch & Duplicate Alert Protection (state machine, latching, unlatching, re-triggering)
 *   - Alert History Service (bounded capacity, retrieval, acknowledge, resolve, fallback storage)
 *   - Forensic Metadata & Context Integrity (deviations, snapshots, zero raw audio retention)
 *   - End-to-end RiskEvaluation Integration
 *
 * No browser, DOM, microphone, or network required.
 */

import {
  dispatchConfirmedRisk,
  createDistressIncident,
} from '../silentAlertDispatcher';
import {
  getIncidents,
  getIncidentById,
  addIncident,
  acknowledgeIncident,
  resolveIncident,
  clearHistory,
  setStorageBackend,
  ALERT_HISTORY_STORAGE_KEY,
  MAX_ALERT_HISTORY_ITEMS,
} from '../alertHistory';
import { IncidentManager } from '../incidentManager';
import type {
  RiskEvaluation,
  IncidentContext,
} from '../../analysis/types';

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

function assertNull(v: unknown, testName: string): void {
  assert(v === null || v === undefined, `${testName} (expected null/undefined, got ${String(v)})`);
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

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createEvaluation(overrides: Partial<RiskEvaluation> = {}): RiskEvaluation {
  return {
    timestamp: 1727438100000,
    riskScore: 78,
    riskLevel: 'HIGH_RISK',
    contributingSignals: [
      { signal: 'pitch', contribution: 22, reason: 'Pitch +65 Hz strain' },
      { signal: 'rms', contribution: 18, reason: 'Energy spike +0.12' },
      { signal: 'silence', contribution: 20, reason: 'Prolonged pause 4.2s' },
      { signal: 'persistence', contribution: 10, reason: 'Sustained abnormal 8 frames' },
    ],
    confirmedSignals: 3,
    persistenceFrames: 8,
    isConfirmed: true,
    ...overrides,
  };
}

function createContext(overrides: Partial<IncidentContext> = {}): IncidentContext {
  return {
    source: 'MICROPHONE',
    baselineAvailable: true,
    baselineDeviations: {
      pitch: 2.4,
      rms: 1.9,
      silence: 1.6,
      spectral: 1.2,
      zcr: 0.8,
    },
    codeWordDetected: false,
    featureSnapshot: {
      pitchHz: 245,
      rms: 0.085,
      voiceActivity: 1,
      silenceDurationSec: 0,
      spectralCentroid: 2400,
      zeroCrossingRate: 0.18,
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite Execution
// ─────────────────────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════');
console.log('  Sanket Phase 7 Incident & Alert Tests');
console.log('════════════════════════════════════════');

// ── Section A: Silent Alert Dispatcher ───────────────────────────────────────
printSection('A. Silent Alert Dispatcher');

{
  const evalHighConfirmed = createEvaluation();
  const alert = dispatchConfirmedRisk(evalHighConfirmed);

  assert(alert !== null, 'Confirmed HIGH_RISK dispatches an alert');
  assert(alert?.dispatched === true, 'Alert dispatched flag is true');
  assert(alert?.dispatchMode === 'SIMULATED_LOCAL', 'Alert dispatchMode is strictly SIMULATED_LOCAL');
  assert(typeof alert?.id === 'string' && alert.id.startsWith('alt-'), 'Alert ID has alt- prefix');
  assert(typeof alert?.incidentId === 'string' && alert.incidentId.startsWith('inc-'), 'Incident ID has inc- prefix');
  assert(alert?.timestamp === evalHighConfirmed.timestamp, 'Alert timestamp matches evaluation timestamp');
  assert(alert?.reason.includes('score=78/100'), 'Alert reason includes risk score');
}

{
  // Unconfirmed HIGH_RISK must NOT dispatch
  const evalUnconfirmed = createEvaluation({ isConfirmed: false, persistenceFrames: 1 });
  const alert = dispatchConfirmedRisk(evalUnconfirmed);
  assertNull(alert, 'Unconfirmed HIGH_RISK does not dispatch alert');
}

{
  // Non-HIGH_RISK levels must NOT dispatch
  const evalSuspicious = createEvaluation({ riskLevel: 'SUSPICIOUS', riskScore: 58, isConfirmed: true });
  assertNull(dispatchConfirmedRisk(evalSuspicious), 'SUSPICIOUS level does not dispatch');

  const evalElevated = createEvaluation({ riskLevel: 'ELEVATED', riskScore: 38, isConfirmed: true });
  assertNull(dispatchConfirmedRisk(evalElevated), 'ELEVATED level does not dispatch');

  const evalNormal = createEvaluation({ riskLevel: 'NORMAL', riskScore: 12, isConfirmed: false });
  assertNull(dispatchConfirmedRisk(evalNormal), 'NORMAL level does not dispatch');
}

{
  // Existing incident ID reuse
  const evalHigh = createEvaluation();
  const existingId = 'inc-custom-999';
  const alert = dispatchConfirmedRisk(evalHigh, undefined, existingId);
  assert(alert?.incidentId === existingId, 'Reuses existing incident ID if provided');
}

{
  // Source tag in dispatch reason
  const simContext = createContext({ source: 'SIMULATION' });
  const alert = dispatchConfirmedRisk(createEvaluation(), simContext);
  assert(alert?.reason.includes('[SIMULATION]'), 'Simulation context noted in dispatch reason');
}

// ── Section B: DistressIncident Model Creation ──────────────────────────────
printSection('B. DistressIncident Model Creation');

{
  const evalHigh = createEvaluation();
  const context = createContext();
  const incident = createDistressIncident(evalHigh, context);

  assert(typeof incident.id === 'string' && incident.id.startsWith('inc-'), 'Incident has valid ID');
  assert(incident.timestamp === evalHigh.timestamp, 'Incident timestamp preserved');
  assert(incident.riskScore === 78, 'Risk score preserved');
  assert(incident.riskLevel === 'HIGH_RISK', 'Risk level is HIGH_RISK');
  assert(incident.status === 'ACTIVE', 'Initial status is ACTIVE');
  assert(incident.source === 'MICROPHONE', 'Source is MICROPHONE');
  assert(incident.baselineAvailable === true, 'Baseline availability preserved');
  assert(incident.baselineDeviations?.pitch === 2.4, 'Pitch deviation preserved');
  assert(incident.confirmedSignals.length === 4, 'Confirmed signals array extracted from positive contributions');
  assert(incident.confirmedSignals.includes('pitch'), 'Confirmed signals contains pitch');
  assert(incident.confirmedSignals.includes('rms'), 'Confirmed signals contains rms');
  assert(incident.featureSnapshot?.pitchHz === 245, 'Feature snapshot pitch preserved');
}

// ── Section C: Duplicate Alert Protection & Incident Latch ──────────────────
printSection('C. Incident Latch & Duplicate Alert Protection');

{
  const mockStorage = new MockStorage();
  setStorageBackend(mockStorage);
  clearHistory();

  const manager = new IncidentManager();
  assert(manager.isLatched() === false, 'Initial state is unlatched');
  assertNull(manager.getCurrentIncident(), 'Initial active incident is null');

  // Frame 1: Normal monitoring
  const normalEval = createEvaluation({ riskLevel: 'NORMAL', riskScore: 10, isConfirmed: false });
  const res1 = manager.processEvaluation(normalEval);
  assert(res1.isNewIncident === false, 'Normal evaluation does not trigger incident');
  assertNull(res1.incident, 'Normal evaluation returns null incident');
  assertNull(res1.alert, 'Normal evaluation returns null alert');
  assert(manager.isLatched() === false, 'Manager remains unlatched');

  // Frame 2: Confirmed HIGH_RISK triggers incident
  const highEval1 = createEvaluation({ riskScore: 75, persistenceFrames: 4, timestamp: 1000 });
  const res2 = manager.processEvaluation(highEval1);
  assert(res2.isNewIncident === true, 'First confirmed HIGH_RISK creates new incident');
  assert(res2.alert !== null, 'First confirmed HIGH_RISK dispatches alert');
  assert(manager.isLatched() === true, 'Manager transitions to latched state');
  const incidentId1 = res2.incident?.id;
  assert(typeof incidentId1 === 'string', 'Incident has valid ID');

  // Frame 3: Sustained HIGH_RISK while latched (duplicate protection!)
  const highEval2 = createEvaluation({ riskScore: 82, persistenceFrames: 5, timestamp: 1100 });
  const res3 = manager.processEvaluation(highEval2);
  assert(res3.isNewIncident === false, 'Sustained frame does NOT create new incident');
  assertNull(res3.alert, 'Sustained frame does NOT dispatch duplicate alert');
  assert(res3.incident?.id === incidentId1, 'Active incident ID remains unchanged');
  assert(res3.incident?.riskScore === 82, 'Active incident score updated to new peak (82)');
  assert(res3.incident?.persistenceFrames === 5, 'Active incident persistence updated (5)');
  assert(manager.isLatched() === true, 'Manager remains latched');

  // Frame 4: Another sustained frame
  const highEval3 = createEvaluation({ riskScore: 80, persistenceFrames: 6, timestamp: 1200 });
  const res4 = manager.processEvaluation(highEval3);
  assert(res4.isNewIncident === false, 'Third frame does not create new incident');
  assertNull(res4.alert, 'Third frame does not dispatch alert');

  // Verify only 1 incident was recorded in history
  const historyDuringIncident = getIncidents();
  assert(historyDuringIncident.length === 1, 'Only 1 incident recorded during sustained event');
  assert(historyDuringIncident[0].id === incidentId1, 'History entry matches active incident');

  // Frame 5: Recovery below HIGH_RISK (e.g. SUSPICIOUS) -> Incident Resolves & Unlatches
  const recoveryEval = createEvaluation({ riskLevel: 'SUSPICIOUS', riskScore: 55, isConfirmed: false, timestamp: 1300 });
  const res5 = manager.processEvaluation(recoveryEval);
  assert(res5.isNewIncident === false, 'Recovery frame does not create new incident');
  assert(manager.isLatched() === false, 'Manager unlatches upon recovery');
  assertNull(manager.getCurrentIncident(), 'Active incident is cleared after recovery');

  // Verify history entry transitioned to RESOLVED
  const historyAfterRecovery = getIncidents();
  assert(historyAfterRecovery.length === 1, 'History still contains 1 incident');
  assert(historyAfterRecovery[0].status === 'RESOLVED', 'Incident status transitioned to RESOLVED');

  // Frame 6: Future new HIGH_RISK event creates a NEW incident
  const newHighEval = createEvaluation({ riskScore: 88, persistenceFrames: 4, timestamp: 2000 });
  const res6 = manager.processEvaluation(newHighEval);
  assert(res6.isNewIncident === true, 'Future confirmed HIGH_RISK triggers a brand new incident');
  assert(res6.alert !== null, 'Future confirmed HIGH_RISK dispatches a new alert');
  assert(res6.incident?.id !== incidentId1, 'New incident has a unique distinct ID');
  assert(manager.isLatched() === true, 'Manager latches for new incident');

  // Verify history now contains 2 incidents
  const historyAfterSecondIncident = getIncidents();
  assert(historyAfterSecondIncident.length === 2, 'History now contains 2 incidents');
  assert(historyAfterSecondIncident[0].id === res6.incident?.id, 'Newest incident is at index 0');
}

// ── Section D: Alert History Service ─────────────────────────────────────────
printSection('D. Alert History Service');

{
  const mockStorage = new MockStorage();
  setStorageBackend(mockStorage);
  clearHistory();

  assert(getIncidents().length === 0, 'History starts empty');

  // Add incident 1
  const inc1 = createDistressIncident(createEvaluation({ riskScore: 72, timestamp: 1000 }));
  addIncident(inc1);
  assert(getIncidents().length === 1, 'Incident 1 added');
  assert(getIncidents()[0].id === inc1.id, 'Incident 1 retrieved');

  // Add incident 2 (newer)
  const inc2 = createDistressIncident(createEvaluation({ riskScore: 85, timestamp: 2000 }));
  addIncident(inc2);
  assert(getIncidents().length === 2, 'Incident 2 added');
  assert(getIncidents()[0].id === inc2.id, 'Newest incident is at index 0');
  assert(getIncidents()[1].id === inc1.id, 'Older incident is at index 1');

  // getIncidentById
  assert(getIncidentById(inc1.id)?.riskScore === 72, 'getIncidentById retrieves correct incident');
  assert(getIncidentById('non-existent') === undefined, 'getIncidentById returns undefined for missing ID');

  // Acknowledge
  const ackSuccess = acknowledgeIncident(inc1.id);
  assert(ackSuccess === true, 'Acknowledge returns true for existing ID');
  assert(getIncidentById(inc1.id)?.status === 'ACKNOWLEDGED', 'Incident 1 status updated to ACKNOWLEDGED');

  // Resolve
  const resSuccess = resolveIncident(inc1.id);
  assert(resSuccess === true, 'Resolve returns true for existing ID');
  assert(getIncidentById(inc1.id)?.status === 'RESOLVED', 'Incident 1 status updated to RESOLVED');

  // Clear history
  clearHistory();
  assert(getIncidents().length === 0, 'Clear history empties the list');
}

// ── Section E: Capacity Clamping & Bounded History ──────────────────────────
printSection('E. Bounded History Capacity');

{
  const mockStorage = new MockStorage();
  setStorageBackend(mockStorage);
  clearHistory();

  // Add 55 incidents (exceeding MAX_ALERT_HISTORY_ITEMS = 50)
  for (let i = 0; i < 55; i++) {
    const inc = createDistressIncident(createEvaluation({ riskScore: 70 + (i % 25), timestamp: 1000 + i * 10 }));
    addIncident(inc);
  }

  const items = getIncidents();
  assert(items.length === MAX_ALERT_HISTORY_ITEMS, `History clamped to max capacity of ${MAX_ALERT_HISTORY_ITEMS} (got ${items.length})`);
  // Verify newest (i=54, timestamp=1540) is at index 0
  assert(items[0].timestamp === 1540, 'Newest item remains at index 0');
}

// ── Section F: LocalStorage Fallback & Error Resilience ─────────────────────
printSection('F. Storage Error Resilience');

{
  // Malformed JSON handling
  const corruptedStorage = new MockStorage();
  corruptedStorage.setItem(ALERT_HISTORY_STORAGE_KEY, '{ invalid json corrupted! }}}');
  setStorageBackend(corruptedStorage);

  assert(getIncidents().length === 0, 'Malformed JSON returns safe empty array without throwing');

  // Non-array JSON handling
  corruptedStorage.setItem(ALERT_HISTORY_STORAGE_KEY, JSON.stringify({ notAnArray: true }));
  setStorageBackend(corruptedStorage);
  assert(getIncidents().length === 0, 'Non-array JSON returns safe empty array');

  // Null/throwing storage backend fallback
  const throwingStorage: any = {
    getItem: () => { throw new Error('SecurityError: localStorage blocked in private window'); },
    setItem: () => { throw new Error('QuotaExceeded'); },
    removeItem: () => {},
  };
  setStorageBackend(throwingStorage);
  assert(getIncidents().length === 0, 'Throwing storage falls back safely to empty array');

  // Restoring clean storage
  setStorageBackend(new MockStorage());
}

// ── Section G: Forensic Context & Privacy Invariants ─────────────────────────
printSection('G. Forensic Context & Privacy Invariants');

{
  const evalHigh = createEvaluation();
  const context = createContext({
    codeWordDetected: true,
    source: 'SIMULATION',
    baselineDeviations: {
      pitch: 3.1,
      rms: 2.2,
      silence: 2.0,
      spectral: 1.8,
      zcr: 1.5,
    },
  });

  const incident = createDistressIncident(evalHigh, context);

  // 1. Deviations preserved
  assert(incident.baselineDeviations?.pitch === 3.1, 'Pitch deviation preserved in incident');
  assert(incident.baselineDeviations?.rms === 2.2, 'RMS deviation preserved in incident');

  // 2. Code-word status preserved
  assert(incident.codeWordDetected === true, 'Code-word detection flag preserved');

  // 3. Source preserved
  assert(incident.source === 'SIMULATION', 'Simulation source preserved');

  // 4. Feature snapshot preserved
  assert(incident.featureSnapshot !== undefined, 'Feature snapshot preserved');
  assert(incident.featureSnapshot?.spectralCentroid === 2400, 'Spectral centroid in snapshot');

  // 5. Privacy Invariant: Zero raw audio or PCM buffers
  const serialized = JSON.stringify(incident);
  assert(!serialized.includes('pcm'), 'Zero PCM data in incident');
  assert(!serialized.includes('waveform'), 'Zero raw waveform data in incident');
  assert(!serialized.includes('channelData'), 'Zero raw channel data in incident');
  assert(!serialized.includes('audioBuffer'), 'Zero audioBuffer in incident');
  assert(typeof (incident as any).timeDomainData === 'undefined', 'No timeDomainData on incident');
  assert(typeof (incident as any).frequencyData === 'undefined', 'No frequencyData on incident');
}

// ── Section H: IncidentManager Manual Controls ──────────────────────────────
printSection('H. IncidentManager Manual Controls');

{
  const mockStorage = new MockStorage();
  setStorageBackend(mockStorage);
  clearHistory();

  const manager = new IncidentManager();
  manager.processEvaluation(createEvaluation());
  assert(manager.isLatched() === true, 'Manager is latched');
  assert(manager.getCurrentIncident()?.status === 'ACTIVE', 'Incident is ACTIVE');

  // Acknowledge current incident
  const ackRes = manager.acknowledgeCurrentIncident();
  assert(ackRes === true, 'acknowledgeCurrentIncident returns true');
  assert(manager.getCurrentIncident()?.status === 'ACKNOWLEDGED', 'Current incident marked ACKNOWLEDGED');

  // Resolve current incident
  const resolveRes = manager.resolveCurrentIncident();
  assert(resolveRes === true, 'resolveCurrentIncident returns true');
  assert(manager.isLatched() === false, 'Manager unlatches after manual resolve');
  assertNull(manager.getCurrentIncident(), 'Current incident cleared after manual resolve');

  // Reset latch
  manager.processEvaluation(createEvaluation());
  assert(manager.isLatched() === true, 'Manager latched again');
  manager.resetLatch();
  assert(manager.isLatched() === false, 'resetLatch immediately unlatches manager');
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n════════════════════════════════════════');
console.log('  Sanket Phase 7 Tests Summary');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
}
