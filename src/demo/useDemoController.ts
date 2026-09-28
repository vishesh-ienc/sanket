/**
 * Sanket, useDemoController React Hook (Phase 9)
 *
 * Connects the pure TypeScript DemoController to React lifecycle and component state.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { DemoController, DEMO_STEPS } from './demoController';
import type { DemoControllerState, DemoStepId } from './types';

export function useDemoController(customController?: DemoController) {
  const controller = useMemo(() => customController ?? new DemoController(), [customController]);
  const [state, setState] = useState<DemoControllerState>(() => controller.getState());

  useEffect(() => {
    const unsubscribe = controller.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, [controller]);

  const startDemo = useCallback(() => controller.startDemo(), [controller]);
  const nextStep = useCallback(() => controller.nextStep(), [controller]);
  const prevStep = useCallback(() => controller.prevStep(), [controller]);
  const goToStep = useCallback((target: number | DemoStepId) => controller.goToStep(target), [controller]);
  const resetDemo = useCallback(() => controller.resetDemo(), [controller]);

  return {
    state,
    steps: DEMO_STEPS,
    startDemo,
    nextStep,
    prevStep,
    goToStep,
    resetDemo,
  };
}
