/**
 * Sanket, Demo Controller (Phase 9)
 *
 * Deterministic state machine governing the guided hackathon judge demonstration.
 * Operates purely on declarative step definitions and subscriber callbacks;
 * completely independent of React / DOM APIs for comprehensive unit testability.
 */

import type { DemoStepDefinition, DemoStepId, DemoControllerState } from './types';

export const DEMO_STEPS: DemoStepDefinition[] = [
  {
    id: 'BASELINE_CALIBRATION',
    stepNumber: 1,
    totalSteps: 6,
    title: 'Personal Voice Baseline Calibration',
    shortTitle: '1. Baseline',
    badge: 'Step 1/6 • Personalization',
    scenario: 'NORMAL_SPEECH',
    narration:
      "First, Sanket establishes the user's natural vocal baseline (pitch mean & variance, dynamic energy, conversational cadence). This ensures sensitivity without false alarms.",
    keyDifferentiator:
      'Static thresholds fail for naturally high-pitched or soft-spoken individuals. Sanket measures relative deviation (Z-scores) from personal norms.',
    expectedOutcome:
      'Baseline profile active (165Hz μ, ±14.5Hz σ). Personalized deviation monitoring initialized.',
    recommendedView: 'Calibration Panel & Baseline Pipeline Step',
    autoCalibrate: true,
  },
  {
    id: 'NORMAL_MONITORING',
    stepNumber: 2,
    totalSteps: 6,
    title: 'Normal Conversational Speech Reference',
    shortTitle: '2. Normal Voice',
    badge: 'Step 2/6 • Reference State',
    scenario: 'NORMAL_SPEECH',
    narration:
      'During normal conversation, voice features remain within standard deviation bounds. The Risk Engine maintains a low risk score.',
    keyDifferentiator:
      'Zero alarm fatigue. Natural conversational inflections, laughter variations, and pauses hover safely in the normal zone.',
    expectedOutcome:
      'Risk Score 8–15 (NORMAL, Green HUD). Temporal Context: STABLE. No alert armed.',
    recommendedView: 'Risk Score Gauge & Signal Breakdown',
  },
  {
    id: 'TRANSIENT_EVENT',
    stepNumber: 3,
    totalSteps: 6,
    title: 'Transient Vocal Spike Filtering',
    shortTitle: '3. Transient Filter',
    badge: 'Step 3/6 • False-Positive Reduction',
    scenario: 'TRANSIENT_PITCH_SPIKE',
    narration:
      'An isolated vocal spike (coughing, laugh burst, or sudden throat-clearing) occurs. Phase 8 Temporal Context recognizes it as a TRANSIENT_SPIKE and suppresses alert dispatch.',
    keyDifferentiator:
      'Single-frame anomalies do not equal danger. Temporal stability requires multi-frame persistence before escalating risk.',
    expectedOutcome:
      'Temporal Filter badge: "TRANSIENT SPIKE". IncidentManager gate: 0 incidents created, 0 alerts dispatched.',
    recommendedView: 'Temporal Stability HUD Card & Alert Suppression Gate',
  },
  {
    id: 'MULTI_SIGNAL_DISTRESS',
    stepNumber: 4,
    totalSteps: 6,
    title: 'Sustained Multi-Signal Distress',
    shortTitle: '4. Multi-Signal',
    badge: 'Step 4/6 • Anomaly Persistence',
    scenario: 'MULTI_SIGNAL_DISTRESS',
    narration:
      'Multiple acoustic channels (acute pitch strain, high acoustic energy, spectral distortion) deviate simultaneously and sustain across consecutive frames.',
    keyDifferentiator:
      'Multi-signal co-occurrence and temporal persistence eliminate single points of failure, confirming genuine distress evidence.',
    expectedOutcome:
      'Temporal Context: SUSTAINED & MULTI-SIGNAL. Risk Score climbs steadily past 70 into confirmed HIGH_RISK.',
    recommendedView: 'Risk Gauge & Multi-Channel Breakdown Bars',
  },
  {
    id: 'SILENT_ALERT',
    stepNumber: 5,
    totalSteps: 6,
    title: 'Silent Emergency Alert Dispatch',
    shortTitle: '5. Silent Alert',
    badge: 'Step 5/6 • Coercion Safety',
    scenario: 'MULTI_SIGNAL_DISTRESS',
    narration:
      'Upon confirmed HIGH_RISK, IncidentManager latches and dispatches a silent alert locally. The prominent Incident Banner appears with zero audible sound.',
    keyDifferentiator:
      'Silent dispatch protects victims in coercion or domestic threat situations where audible sirens or popups endanger life.',
    expectedOutcome:
      'Incident Banner slides into view silently. Duplicate alert latch prevents spam while live peak metrics are tracked in place.',
    recommendedView: 'Top Incident Banner & Alert History Log',
  },
  {
    id: 'FORENSIC_REVIEW',
    stepNumber: 6,
    totalSteps: 6,
    title: 'Forensic Incident Audit & Privacy',
    shortTitle: '6. Forensic Review',
    badge: 'Step 6/6 • Transparent Audit',
    scenario: 'MULTI_SIGNAL_DISTRESS',
    narration:
      'Inspect the generated incident audit record. The forensic modal reveals contributing signals, baseline Z-scores, and confirms zero raw audio retention.',
    keyDifferentiator:
      'Provides complete explainability for emergency responders and legal review while maintaining zero audio recordings on device.',
    expectedOutcome:
      'Forensic Event Modal open with telemetry table, confirmation breakdown, and local privacy declaration.',
    recommendedView: 'Forensic Event Telemetry Modal',
    autoOpenModal: true,
  },
];

export type DemoStateListener = (state: DemoControllerState) => void;

export class DemoController {
  private steps: DemoStepDefinition[];
  private currentStepIndex: number = -1; // -1 = IDLE
  private listeners: Set<DemoStateListener> = new Set();

  constructor(customSteps?: DemoStepDefinition[]) {
    this.steps = customSteps ?? DEMO_STEPS;
  }

  /**
   * Subscribes a listener to state changes.
   */
  public subscribe(listener: DemoStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emits the current state to all subscribers.
   */
  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /**
   * Returns a snapshot of the current state.
   */
  public getState(): DemoControllerState {
    const isActive = this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length;
    const step = isActive ? this.steps[this.currentStepIndex] : null;

    return {
      isActive,
      stepIndex: this.currentStepIndex,
      step,
      totalSteps: this.steps.length,
      isFirst: this.currentStepIndex === 0,
      isLast: this.currentStepIndex === this.steps.length - 1,
    };
  }

  /**
   * Starts the demo from Step 1.
   */
  public startDemo(): DemoControllerState {
    this.currentStepIndex = 0;
    this.notify();
    return this.getState();
  }

  /**
   * Advances to the next step if available.
   */
  public nextStep(): DemoControllerState {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      this.notify();
    }
    return this.getState();
  }

  /**
   * Retreats to the previous step if available.
   */
  public prevStep(): DemoControllerState {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.notify();
    }
    return this.getState();
  }

  /**
   * Jumps directly to a 0-based step index or step id.
   */
  public goToStep(target: number | DemoStepId): DemoControllerState {
    if (typeof target === 'number') {
      if (target >= 0 && target < this.steps.length) {
        this.currentStepIndex = target;
        this.notify();
      }
    } else {
      const idx = this.steps.findIndex((s) => s.id === target);
      if (idx !== -1) {
        this.currentStepIndex = idx;
        this.notify();
      }
    }
    return this.getState();
  }

  /**
   * Resets the demo back to IDLE.
   */
  public resetDemo(): DemoControllerState {
    this.currentStepIndex = -1;
    this.notify();
    return this.getState();
  }

  /**
   * Returns all step definitions.
   */
  public getSteps(): DemoStepDefinition[] {
    return [...this.steps];
  }
}
