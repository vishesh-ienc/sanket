/**
 * Sanket — Incident Manager & Duplicate Alert Protection (Phase 7)
 *
 * Implements the incident latch state machine:
 *
 *   NORMAL / ELEVATED / SUSPICIOUS
 *                ↓
 *      HIGH_RISK + confirmed
 *                ↓
 *         ALERT DISPATCHED (Once)
 *                ↓
 *   remain latched while incident continues
 *   (no duplicate alerts generated)
 *                ↓
 *      risk returns below HIGH_RISK
 *                ↓
 *        incident resolved
 *                ↓
 *   future confirmed HIGH_RISK creates new incident
 *
 * Never alters RiskEngine calculation; strictly acts as an operational consumer.
 */

import type {
  RiskEvaluation,
  IncidentContext,
  DistressIncident,
  SilentAlertEvent,
} from '../analysis/types';
import {
  createDistressIncident,
  dispatchConfirmedRisk,
} from './silentAlertDispatcher';
import {
  addIncident,
  acknowledgeIncident as ackInHistory,
  resolveIncident as resolveInHistory,
} from './alertHistory';

export interface IncidentProcessResult {
  incident: DistressIncident | null;
  alert: SilentAlertEvent | null;
  isNewIncident: boolean;
}

export interface IncidentManagerOptions {
  /**
   * Consecutive non-HIGH_RISK evaluations required before an active incident
   * resolves and the latch releases. Natural speech makes the score dip
   * between phrases; without hysteresis each dip + recovery would dispatch a
   * duplicate alert. Default 0 = release immediately (original behaviour).
   */
  releaseFrames?: number;
}

export class IncidentManager {
  private activeIncident: DistressIncident | null = null;
  private latched: boolean = false;
  private lastAlert: SilentAlertEvent | null = null;
  private readonly releaseFrames: number;
  private framesBelowHighRisk = 0;

  constructor(options: IncidentManagerOptions = {}) {
    this.releaseFrames = Math.max(0, options.releaseFrames ?? 0);
  }

  /**
   * Evaluates the latest RiskEvaluation against the incident state machine.
   */
  public processEvaluation(
    evaluation: RiskEvaluation | null,
    context?: IncidentContext
  ): IncidentProcessResult {
    if (!evaluation) {
      return {
        incident: this.activeIncident,
        alert: null,
        isNewIncident: false,
      };
    }

    // Phase 8 False-Positive Suppression Gate:
    // An isolated transient spike without multi-signal correlation or sustained duration
    // is held back from triggering emergency alert dispatch.
    const isSuppressedTransient = Boolean(
      context?.temporalContext?.isTransient &&
      !context?.temporalContext?.isSustained &&
      !context?.temporalContext?.isMultiSignal
    );

    const isHighRiskConfirmed =
      evaluation.riskLevel === 'HIGH_RISK' &&
      evaluation.isConfirmed === true &&
      !isSuppressedTransient;

    // CASE 1: High risk confirmed and NOT yet latched → DISPATCH NEW INCIDENT
    if (isHighRiskConfirmed && !this.latched) {
      this.latched = true;

      // 1. Create incident metadata model
      const incident = createDistressIncident(evaluation, context);
      incident.alertDispatched = true;

      // 2. Dispatch simulated silent alert
      const alert = dispatchConfirmedRisk(evaluation, context, incident.id);
      this.lastAlert = alert;

      // 3. Record in local alert history
      addIncident(incident);

      this.activeIncident = incident;

      return {
        incident,
        alert,
        isNewIncident: true,
      };
    }

    if (isHighRiskConfirmed) {
      this.framesBelowHighRisk = 0;
    }

    // CASE 2b: Brief dip below HIGH_RISK while latched → HOLD (hysteresis)
    if (!isHighRiskConfirmed && this.latched && this.activeIncident) {
      this.framesBelowHighRisk += 1;
      if (this.framesBelowHighRisk <= this.releaseFrames) {
        return {
          incident: this.activeIncident,
          alert: null,
          isNewIncident: false,
        };
      }
    }

    // CASE 2: High risk continues while already latched → MAINTAIN ACTIVE INCIDENT (NO DUPLICATE DISPATCH)
    if (isHighRiskConfirmed && this.latched && this.activeIncident) {
      // Update ongoing incident metrics (peak score, persistence, signals)
      const updatedIncident: DistressIncident = {
        ...this.activeIncident,
        riskScore: Math.max(this.activeIncident.riskScore, evaluation.riskScore),
        persistenceFrames: evaluation.persistenceFrames,
        contributingSignals: evaluation.contributingSignals,
        confirmedSignals: evaluation.contributingSignals
          .filter((s) => s.contribution > 0)
          .map((s) => s.signal),
      };

      this.activeIncident = updatedIncident;
      addIncident(updatedIncident); // Update in-place in history

      return {
        incident: updatedIncident,
        alert: null,
        isNewIncident: false,
      };
    }

    // CASE 3: Risk fell below HIGH_RISK → RESOLVE ACTIVE INCIDENT & UNLATCH
    if (!isHighRiskConfirmed && this.latched && this.activeIncident) {
      const resolvedIncident: DistressIncident = {
        ...this.activeIncident,
        status: 'RESOLVED',
      };

      resolveInHistory(resolvedIncident.id);
      this.latched = false;
      this.activeIncident = null;
      this.framesBelowHighRisk = 0;

      return {
        incident: resolvedIncident,
        alert: null,
        isNewIncident: false,
      };
    }

    // CASE 4: Normal/Elevated/Suspicious monitoring while unlatched
    return {
      incident: null,
      alert: null,
      isNewIncident: false,
    };
  }

  /**
   * Returns the currently active distress incident, if any.
   */
  public getCurrentIncident(): DistressIncident | null {
    return this.activeIncident;
  }

  /**
   * Returns the most recently dispatched silent alert event.
   */
  public getLastAlert(): SilentAlertEvent | null {
    return this.lastAlert;
  }

  /**
   * Indicates whether the incident latch is currently active.
   */
  public isLatched(): boolean {
    return this.latched;
  }

  /**
   * Acknowledges the active incident.
   */
  public acknowledgeCurrentIncident(): boolean {
    if (!this.activeIncident) return false;
    this.activeIncident = {
      ...this.activeIncident,
      status: 'ACKNOWLEDGED',
    };
    ackInHistory(this.activeIncident.id);
    return true;
  }

  /**
   * Manually resolves the current incident and unlatches the system.
   */
  public resolveCurrentIncident(): boolean {
    if (!this.activeIncident) return false;
    const id = this.activeIncident.id;
    resolveInHistory(id);
    this.activeIncident = null;
    this.latched = false;
    return true;
  }

  /**
   * Resets the latch state manually (e.g. user reset or monitoring stop).
   */
  public resetLatch(): void {
    if (this.activeIncident) {
      resolveInHistory(this.activeIncident.id);
    }
    this.activeIncident = null;
    this.latched = false;
    this.lastAlert = null;
    this.framesBelowHighRisk = 0;
  }
}
