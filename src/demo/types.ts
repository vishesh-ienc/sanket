/**
 * Sanket, Judge Demonstration Flow Types (Phase 9)
 *
 * Defines the contract for the step-by-step hackathon judge demonstration mode.
 */

import type { DemoScenarioKey } from '../utils/demoScenariosData';

export type DemoStepId =
  | 'BASELINE_CALIBRATION'
  | 'NORMAL_MONITORING'
  | 'TRANSIENT_EVENT'
  | 'MULTI_SIGNAL_DISTRESS'
  | 'SILENT_ALERT'
  | 'FORENSIC_REVIEW';

export interface DemoStepDefinition {
  /** Unique step identifier */
  id: DemoStepId;
  /** 1-based step index */
  stepNumber: number;
  /** Total step count in the tour */
  totalSteps: number;
  /** Full descriptive title for the step header */
  title: string;
  /** Short label for compact step pills */
  shortTitle: string;
  /** Category badge */
  badge: string;
  /** Scenario key to activate in DemoScenariosData */
  scenario: DemoScenarioKey;
  /** Primary judge narration explaining what is happening */
  narration: string;
  /** The core technical or safety differentiator highlighted to the judge */
  keyDifferentiator: string;
  /** Expected visual/metric outcome on the dashboard */
  expectedOutcome: string;
  /** Recommended visual component to focus on */
  recommendedView?: string;
  /** Whether this step automatically pops open the Forensic Incident Modal */
  autoOpenModal?: boolean;
  /** Whether this step requests applying the calibrated baseline profile */
  autoCalibrate?: boolean;
}

export interface DemoControllerState {
  /** Whether the guided tour is currently active */
  isActive: boolean;
  /** Current 0-based step index (-1 if idle) */
  stepIndex: number;
  /** Current active step definition or null */
  step: DemoStepDefinition | null;
  /** Total steps count */
  totalSteps: number;
  /** Whether currently on the first step */
  isFirst: boolean;
  /** Whether currently on the final step */
  isLast: boolean;
}
