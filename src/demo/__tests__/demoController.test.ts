/**
 * Sanket — Phase 9: DemoController Unit Tests
 *
 * Deterministic unit tests covering:
 *   - Initial idle state
 *   - Start demo lifecycle
 *   - Sequential advancement (nextStep)
 *   - Sequential reversal (prevStep)
 *   - Direct jump (goToStep by index and id)
 *   - Boundary protections (underflow & overflow)
 *   - Reset to idle
 *   - Subscriber notification and unsubscription
 *   - Step definition contract validation (all 6 steps)
 *   - Reusability & determinism
 *
 * No browser, DOM, microphone, or network required.
 */

import { DemoController, DEMO_STEPS } from '../demoController';
import type { DemoControllerState } from '../types';

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

function printSection(label: string): void {
  console.log(`\n─── ${label} ───`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Initial Idle State
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 1: Initial Idle State');

{
  const controller = new DemoController();
  const state = controller.getState();

  assert(state.isActive === false, 'Test 1: Initial isActive is false');
  assert(state.stepIndex === -1, 'Test 1: Initial stepIndex is -1');
  assert(state.step === null, 'Test 1: Initial step is null');
  assert(state.totalSteps === 6, 'Test 1: Total steps is 6');
  assert(state.isFirst === false, 'Test 1: isFirst is false when idle');
  assert(state.isLast === false, 'Test 1: isLast is false when idle');
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Start Demo & Progression
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 2: Start Demo & Progression');

{
  const controller = new DemoController();

  // Test 2: startDemo moves to Step 1
  const s0 = controller.startDemo();
  assert(s0.isActive === true, 'Test 2: startDemo sets isActive=true');
  assert(s0.stepIndex === 0, 'Test 2: startDemo sets stepIndex=0');
  assert(s0.step?.id === 'BASELINE_CALIBRATION', 'Test 2: Step 0 is BASELINE_CALIBRATION');
  assert(s0.isFirst === true, 'Test 2: isFirst is true on step 0');
  assert(s0.isLast === false, 'Test 2: isLast is false on step 0');

  // Test 3: nextStep advances sequentially through all 6 steps
  const s1 = controller.nextStep();
  assert(s1.stepIndex === 1, 'Test 3: nextStep advances to step 1');
  assert(s1.step?.id === 'NORMAL_MONITORING', 'Test 3: Step 1 is NORMAL_MONITORING');
  assert(s1.isFirst === false, 'Test 3: isFirst is false on step 1');

  const s2 = controller.nextStep();
  assert(s2.stepIndex === 2, 'Test 3: nextStep advances to step 2');
  assert(s2.step?.id === 'TRANSIENT_EVENT', 'Test 3: Step 2 is TRANSIENT_EVENT');

  const s3 = controller.nextStep();
  assert(s3.stepIndex === 3, 'Test 3: nextStep advances to step 3');
  assert(s3.step?.id === 'MULTI_SIGNAL_DISTRESS', 'Test 3: Step 3 is MULTI_SIGNAL_DISTRESS');

  const s4 = controller.nextStep();
  assert(s4.stepIndex === 4, 'Test 3: nextStep advances to step 4');
  assert(s4.step?.id === 'SILENT_ALERT', 'Test 3: Step 4 is SILENT_ALERT');

  const s5 = controller.nextStep();
  assert(s5.stepIndex === 5, 'Test 3: nextStep advances to step 5');
  assert(s5.step?.id === 'FORENSIC_REVIEW', 'Test 3: Step 5 is FORENSIC_REVIEW');
  assert(s5.isLast === true, 'Test 3: isLast is true on step 5');

  // Test 4: Overflow guard — nextStep at last step does not exceed bounds
  const sOverflow = controller.nextStep();
  assert(sOverflow.stepIndex === 5, 'Test 4: nextStep at last step stays at 5');
  assert(sOverflow.isLast === true, 'Test 4: isLast remains true');
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Backward Progression (prevStep)
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 3: Backward Progression');

{
  const controller = new DemoController();
  controller.startDemo(); // step 0
  controller.goToStep(5); // step 5

  // Test 5: prevStep retreats sequentially
  const p4 = controller.prevStep();
  assert(p4.stepIndex === 4, 'Test 5: prevStep moves from 5 to 4');
  assert(p4.step?.id === 'SILENT_ALERT', 'Test 5: Step 4 is SILENT_ALERT');

  controller.prevStep(); // 3
  controller.prevStep(); // 2
  controller.prevStep(); // 1
  const p0 = controller.prevStep(); // 0
  assert(p0.stepIndex === 0, 'Test 5: prevStep retreats to step 0');
  assert(p0.isFirst === true, 'Test 5: isFirst is true on step 0');

  // Test 6: Underflow guard — prevStep at step 0 does not decrease below 0
  const pUnderflow = controller.prevStep();
  assert(pUnderflow.stepIndex === 0, 'Test 6: prevStep at step 0 stays at 0');
  assert(pUnderflow.isFirst === true, 'Test 6: isFirst remains true');
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Direct Jumps (goToStep) & Reset
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 4: Direct Jumps & Reset');

{
  const controller = new DemoController();

  // Test 7: Jump by numeric index
  const j2 = controller.goToStep(2);
  assert(j2.stepIndex === 2, 'Test 7: goToStep(2) sets index to 2');
  assert(j2.step?.id === 'TRANSIENT_EVENT', 'Test 7: Step is TRANSIENT_EVENT');

  // Test 8: Jump by step ID
  const jAlert = controller.goToStep('SILENT_ALERT');
  assert(jAlert.stepIndex === 4, 'Test 8: goToStep("SILENT_ALERT") sets index to 4');
  assert(jAlert.step?.id === 'SILENT_ALERT', 'Test 8: Step is SILENT_ALERT');

  // Test 9: Invalid numeric index is rejected safely
  const curIndex = controller.getState().stepIndex;
  controller.goToStep(-99);
  assert(controller.getState().stepIndex === curIndex, 'Test 9: Negative index rejected');
  controller.goToStep(999);
  assert(controller.getState().stepIndex === curIndex, 'Test 9: Out-of-bounds index rejected');

  // Test 10: resetDemo returns cleanly to IDLE
  const rState = controller.resetDemo();
  assert(rState.isActive === false, 'Test 10: resetDemo sets isActive=false');
  assert(rState.stepIndex === -1, 'Test 10: resetDemo sets stepIndex=-1');
  assert(rState.step === null, 'Test 10: resetDemo clears step to null');
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: Subscriber Notifications & Unsubscription
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 5: Subscriber Notifications');

{
  const controller = new DemoController();
  const received: number[] = [];

  // Test 11: Subscriber is notified immediately upon subscription and on transitions
  const unsubscribe = controller.subscribe((state: DemoControllerState) => {
    received.push(state.stepIndex);
  });

  assert(received.length === 1 && received[0] === -1, 'Test 11: Immediate initial notification');

  controller.startDemo(); // step 0
  assert(received.length === 2 && received[1] === 0, 'Test 11: Notified on startDemo');

  controller.nextStep(); // step 1
  assert(received.length === 3 && received[2] === 1, 'Test 11: Notified on nextStep');

  // Test 12: Unsubscribe stops future notifications
  unsubscribe();
  controller.nextStep(); // step 2
  assert(received.length === 3, 'Test 12: Unsubscribed listener receives no further notifications');
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 6: Step Definition Contract Validation
// ─────────────────────────────────────────────────────────────────────────────
printSection('Section 6: Step Definition Contract Validation');

{
  const controller = new DemoController();
  const steps = controller.getSteps();

  // Test 13: Exactly 6 steps
  assert(steps.length === 6, 'Test 13: Controller defines exactly 6 steps');
  assert(DEMO_STEPS.length === 6, 'Test 13: Exported DEMO_STEPS has 6 elements');

  // Test 14: Step ordering and 1-based indexing
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    assert(s.stepNumber === i + 1, `Test 14: Step ${i} has stepNumber ${i + 1}`);
    assert(s.totalSteps === 6, `Test 14: Step ${i} totalSteps is 6`);
    assert(s.title.length > 5, `Test 14: Step ${i} has descriptive title`);
    assert(s.narration.length > 20, `Test 14: Step ${i} has comprehensive narration`);
    assert(s.keyDifferentiator.length > 20, `Test 14: Step ${i} has key differentiator`);
    assert(s.expectedOutcome.length > 10, `Test 14: Step ${i} has expected outcome`);
  }

  // Test 15: Step 1 flags autoCalibrate
  assert(steps[0].autoCalibrate === true, 'Test 15: Step 1 (Baseline) requests autoCalibrate');

  // Test 16: Step 3 scenario is TRANSIENT_PITCH_SPIKE
  assert(steps[2].scenario === 'TRANSIENT_PITCH_SPIKE', 'Test 16: Step 3 scenario is TRANSIENT_PITCH_SPIKE');

  // Test 17: Step 4 & 5 scenarios are MULTI_SIGNAL_DISTRESS
  assert(steps[3].scenario === 'MULTI_SIGNAL_DISTRESS', 'Test 17: Step 4 scenario is MULTI_SIGNAL_DISTRESS');
  assert(steps[4].scenario === 'MULTI_SIGNAL_DISTRESS', 'Test 17: Step 5 scenario is MULTI_SIGNAL_DISTRESS');

  // Test 18: Step 6 flags autoOpenModal
  assert(steps[5].autoOpenModal === true, 'Test 18: Step 6 requests autoOpenModal for forensic review');
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n════════════════════════════════════════');
console.log('  Sanket Phase 9 DemoController Tests');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
