/**
 * Scenario catalogue for the simulator (synthetic feature streams that drive
 * the real engine without any audio).
 */

import type { DemoScenarioKey } from '@/utils/demoScenariosData';

export interface ScenarioInfo {
  key: Exclude<DemoScenarioKey, 'LIVE_MIC'>;
  title: string;
  description: string;
  expectation: string;
  tone: 'calm' | 'elevated' | 'filtered' | 'high';
  group: 'Baseline' | 'Single signal' | 'False-positive filter' | 'Multi-signal';
}

export const SCENARIOS: ScenarioInfo[] = [
  {
    key: 'NORMAL_SPEECH',
    title: 'Calm conversation',
    description: 'Pitch around 165 Hz, normal loudness, steady rhythm.',
    expectation: 'Stays Normal',
    tone: 'calm',
    group: 'Baseline',
  },
  {
    key: 'RECOVERY_NORMALIZING',
    title: 'Signals normalising',
    description: 'Voice returns to baseline after an episode.',
    expectation: 'Score decays smoothly',
    tone: 'calm',
    group: 'Baseline',
  },
  {
    key: 'PITCH_STRAIN_ONLY',
    title: 'Pitch spike only',
    description: 'One channel far off baseline (≈340 Hz).',
    expectation: 'Capped below High risk',
    tone: 'elevated',
    group: 'Single signal',
  },
  {
    key: 'EXTENDED_SILENCE',
    title: 'Prolonged silence',
    description: 'Speech stops for several seconds mid-call.',
    expectation: 'Elevated at most',
    tone: 'elevated',
    group: 'Single signal',
  },
  {
    key: 'WHISPER_STRAIN',
    title: 'Strained whisper',
    description: 'Very low energy with breathy turbulence.',
    expectation: 'Elevated',
    tone: 'elevated',
    group: 'Single signal',
  },
  {
    key: 'CODE_WORD_ONLY',
    title: 'Code word only',
    description: 'Covert phrase said in a calm voice.',
    expectation: 'Context boost, no alert',
    tone: 'elevated',
    group: 'Single signal',
  },
  {
    key: 'TRANSIENT_PITCH_SPIKE',
    title: 'Cough / laugh burst',
    description: 'Two-frame pitch spike, then back to normal.',
    expectation: 'Filtered — no alert',
    tone: 'filtered',
    group: 'False-positive filter',
  },
  {
    key: 'TRANSIENT_LOUD_EVENT',
    title: 'Sudden exclamation',
    description: 'Brief loud burst absorbed by the temporal filter.',
    expectation: 'Filtered — no alert',
    tone: 'filtered',
    group: 'False-positive filter',
  },
  {
    key: 'IRREGULAR_PAUSE_PATTERN',
    title: 'Irregular pauses',
    description: 'Fragmented speech with erratic pause lengths.',
    expectation: 'Pause-pattern flag',
    tone: 'filtered',
    group: 'False-positive filter',
  },
  {
    key: 'MULTI_SIGNAL_DISTRESS',
    title: 'Multi-signal distress',
    description: 'Pitch, loudness, strain and breathiness together, sustained.',
    expectation: 'High risk → silent alert',
    tone: 'high',
    group: 'Multi-signal',
  },
  {
    key: 'MULTI_SIGNAL_WITH_CODE_WORD',
    title: 'Distress + code word',
    description: 'Acoustic strain plus the covert phrase.',
    expectation: 'High risk → silent alert',
    tone: 'high',
    group: 'Multi-signal',
  },
];

export function scenarioInfo(key: DemoScenarioKey): ScenarioInfo | undefined {
  return SCENARIOS.find((s) => s.key === key);
}
