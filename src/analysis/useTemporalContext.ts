/**
 * Sanket — useTemporalContext React Hook (Phase 8)
 *
 * Bridges the TemporalContextAnalyzer with React component lifecycle.
 * Provides live temporal context, transient detection, and pause regularity telemetry.
 */

import { useState, useEffect } from 'react';
import type { FeatureSet, TemporalContext, TemporalContextConfig } from './types';
import type { BaselineDeviationOutput } from './baselineDeviation';
import { TemporalContextAnalyzer } from './temporalContext';

export function useTemporalContext(
  features: FeatureSet | null,
  deviations?: BaselineDeviationOutput | null,
  isActive: boolean = true,
  config?: Partial<TemporalContextConfig>
): {
  temporalContext: TemporalContext | null;
  resetTemporalContext: () => void;
} {
  const [analyzer] = useState(() => new TemporalContextAnalyzer(config));
  const [temporalContext, setTemporalContext] = useState<TemporalContext | null>(null);

  useEffect(() => {
    if (!isActive) {
      analyzer.reset();
      const timer = setTimeout(() => {
        setTemporalContext(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    if (features) {
      const ctx = analyzer.processFrame(features, deviations);
      const timer = setTimeout(() => {
        setTemporalContext(ctx);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [features, deviations, isActive, analyzer]);

  const resetTemporalContext = () => {
    analyzer.reset();
    setTemporalContext(null);
  };

  return {
    temporalContext,
    resetTemporalContext,
  };
}
