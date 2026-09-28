/**
 * Sanket, useRiskEngine React Hook (Phase 3)
 *
 * Integrates the RiskEngine into the Sanket monitoring pipeline.
 * Runs at the same cadence as useFeatureExtractor (~10Hz).
 *
 * Architecture:
 *   useFeatureExtractor → FeatureSet (10Hz)
 *                              ↓
 *   useRiskEngine → RiskEngine.evaluate() → RiskEvaluation (React state)
 *                              ↓
 *             Future Phase 4 dashboard / Phase 6 alert engine
 *
 * Rules:
 * - No distress claims. The evaluation estimates risk, it does not confirm danger.
 * - Resets the engine state when monitoring stops.
 * - No DOM, no audio acquisition, no browser globals.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { RiskEngine } from './riskEngine';
import type { FeatureSet, RiskEngineConfig, RiskEvaluation } from './types';

interface UseRiskEngineOptions {
  engineConfig?: Partial<RiskEngineConfig>;
}

export function useRiskEngine(
  latestFeatures: FeatureSet | null,
  isMonitoring: boolean,
  options: UseRiskEngineOptions = {}
) {
  const [latestEvaluation, setLatestEvaluation] = useState<RiskEvaluation | null>(null);
  const [engine] = useState<RiskEngine>(() => new RiskEngine(options.engineConfig));
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable callback: evaluates the latest features and updates state
  const evaluateFeatures = useCallback(
    (features: FeatureSet) => {
      const evaluation = engine.evaluate(features);
      setLatestEvaluation(evaluation);
    },
    [engine]
  );

  // Reset engine state when monitoring stops, deferred to avoid synchronous setState-in-effect
  useEffect(() => {
    if (!isMonitoring) {
      engine.reset();
      // Defer state clear to avoid synchronous setState inside effect body
      clearTimerRef.current = setTimeout(() => {
        setLatestEvaluation(null);
      }, 0);
      return () => {
        if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
      };
    }
    return undefined;
  }, [isMonitoring, engine]);

  // Evaluate whenever a new FeatureSet arrives, call stable callback via timeout
  // to avoid synchronous setState-in-effect lint warning
  useEffect(() => {
    if (!isMonitoring || latestFeatures === null) return;
    const timerId = setTimeout(() => {
      evaluateFeatures(latestFeatures);
    }, 0);
    return () => clearTimeout(timerId);
  }, [latestFeatures, isMonitoring, evaluateFeatures]);

  const injectExternalSignal = useCallback(
    (boostAmount: number, maxBoost = 25, metadata?: { signal?: string; reason?: string }) => {
      engine.injectExternalSignal(boostAmount, maxBoost, metadata);
    },
    [engine]
  );

  return {
    latestEvaluation,
    engine,
    injectExternalSignal,
  };
}
