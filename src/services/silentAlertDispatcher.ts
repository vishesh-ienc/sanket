/**
 * Sanket, Silent Alert Dispatcher (Phase 7)
 *
 * Dispatches simulated silent alerts when the RiskEngine reaches a sustained,
 * confirmed HIGH_RISK state.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SAFETY & PROTOTYPE BOUNDARY GUARANTEE
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. SIMULATED LOCAL ONLY: This module NEVER contacts emergency services,
 *    police, or dispatch centers.
 * 2. NO EXTERNAL NETWORK CALLS: Zero HTTP/WebSocket requests, SMS, or emails.
 * 3. NO AUDIBLE ALARM: Never plays audio or sound that could alert a bystander.
 * 4. NO BROWSER NOTIFICATION POPUPS: Avoids OS-level notification alerts.
 * 5. PURE DETERMINISTIC EXECUTION: Operates independently of browser DOM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  RiskEvaluation,
  IncidentContext,
  DistressIncident,
  SilentAlertEvent,
} from '../analysis/types';

let idCounter = 0;

/**
 * Generates an opaque, structured incident ID.
 * Example: "inc-1727438100000-0042"
 */
export function generateIncidentId(timestamp: number = Date.now()): string {
  idCounter = (idCounter + 1) % 100000;
  const pad = String(idCounter).padStart(5, '0');
  return `inc-${timestamp}-${pad}`;
}

/**
 * Generates an opaque alert event ID.
 * Example: "alt-1727438100000-0042"
 */
export function generateAlertId(timestamp: number = Date.now()): string {
  idCounter = (idCounter + 1) % 100000;
  const pad = String(idCounter).padStart(5, '0');
  return `alt-${timestamp}-${pad}`;
}

/**
 * Builds a structured DistressIncident from a confirmed RiskEvaluation and context snapshot.
 * Preserves statistical and explanatory metadata with zero raw audio retention.
 */
export function createDistressIncident(
  evaluation: RiskEvaluation,
  context?: IncidentContext,
  incidentId?: string
): DistressIncident {
  const ts = evaluation.timestamp || Date.now();
  const id = incidentId || generateIncidentId(ts);

  // Extract human-readable confirmed signal channel names
  const confirmedSignals: string[] = evaluation.contributingSignals
    .filter((s) => s.contribution > 0)
    .map((s) => s.signal);

  return {
    id,
    timestamp: ts,
    riskScore: evaluation.riskScore,
    riskLevel: evaluation.riskLevel,
    contributingSignals: evaluation.contributingSignals,
    confirmedSignals,
    persistenceFrames: evaluation.persistenceFrames,
    baselineAvailable: context?.baselineAvailable ?? false,
    baselineDeviations: context?.baselineDeviations,
    codeWordDetected: context?.codeWordDetected ?? false,
    featureSnapshot: context?.featureSnapshot,
    status: 'ACTIVE',
    source: context?.source ?? 'MICROPHONE',
    alertDispatched: false,
    temporalContext: context?.temporalContext,
  };
}

/**
 * Dispatches a simulated silent alert for a confirmed HIGH_RISK evaluation.
 *
 * Gating Invariants:
 * - evaluation.riskLevel === 'HIGH_RISK'
 * - evaluation.isConfirmed === true
 *
 * If either invariant fails, returns null without dispatching.
 */
export function dispatchConfirmedRisk(
  evaluation: RiskEvaluation,
  context?: IncidentContext,
  existingIncidentId?: string
): SilentAlertEvent | null {
  // Strict gate: Must be HIGH_RISK AND multi-frame confirmed
  if (evaluation.riskLevel !== 'HIGH_RISK' || !evaluation.isConfirmed) {
    return null;
  }

  const timestamp = evaluation.timestamp || Date.now();
  const incidentId = existingIncidentId || generateIncidentId(timestamp);
  const alertId = generateAlertId(timestamp);

  const signalSummary = evaluation.contributingSignals
    .filter((s) => s.contribution > 0)
    .map((s) => `${s.signal} (+${s.contribution})`)
    .join(', ');

  const sourceTag = context?.source === 'SIMULATION' ? ' [SIMULATION]' : '';
  const reason =
    `Multi-signal distress confirmed${sourceTag}: score=${evaluation.riskScore}/100, ` +
    `persistence=${evaluation.persistenceFrames} frames, signals=[${signalSummary}]`;

  return {
    id: alertId,
    incidentId,
    timestamp,
    dispatched: true,
    dispatchMode: 'SIMULATED_LOCAL',
    reason,
  };
}
