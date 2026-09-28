/**
 * Sanket, useFeatureExtractor React Hook
 *
 * Integrates the FeatureExtractor into the Sanket monitoring loop.
 * Runs at ~10Hz (every 100ms), decoupled from the 60fps canvas loop
 * and the 20Hz RMS telemetry loop from Phase 1.
 *
 * Architecture:
 *   useAudioMonitor (Phase 1) → audioService.getCurrentFrame()
 *                                          ↓
 *   useFeatureExtractor (Phase 2)  → FeatureExtractor.processFrame()
 *                                          ↓
 *                               FeatureSet (React state @ 10Hz)
 *                                          ↓
 *                              Future Phase 3 risk engine hook
 *
 * Rules:
 * - Does not perform distress scoring.
 * - Does not modify audio capture behavior.
 * - Resets the extractor state when monitoring stops.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AudioInputService } from '../audio/audioInput';
import { FeatureExtractor } from './featureExtractor';
import type { FeatureSet, FeatureExtractorConfig } from './types';

interface UseFeatureExtractorOptions {
  /** Analysis interval in milliseconds. Default: 100ms (10Hz) */
  intervalMs?: number;
  extractorConfig?: Partial<FeatureExtractorConfig>;
}

export function useFeatureExtractor(
  audioService: AudioInputService | null,
  isMonitoring: boolean,
  options: UseFeatureExtractorOptions = {}
) {
  const { intervalMs = 100, extractorConfig } = options;
  const [latestFeatures, setLatestFeatures] = useState<FeatureSet | null>(null);

  // Store FeatureExtractor in state so it is stable across renders and safe
  // to reference in event handlers and effects (satisfies oxlint react/refs rule)
  const [extractor] = useState<FeatureExtractor>(() => new FeatureExtractor(extractorConfig));

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable helper to tear down the interval
  const clearAnalysisInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isMonitoring) {
      clearAnalysisInterval();
      extractor.reset();
      // Defer the state clear so it is not called synchronously inside the effect body
      // (avoids the oxlint set-state-in-effect warning for synchronous setState)
      const timeoutId = setTimeout(() => {
        setLatestFeatures(null);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    // Monitoring is active, reset extractor then start the analysis interval
    extractor.reset();

    intervalRef.current = setInterval(() => {
      if (!audioService || !audioService.getIsRunning()) return;

      const frame = audioService.getCurrentFrame();
      if (!frame) return;

      const features = extractor.processFrame(frame);
      setLatestFeatures(features);
    }, intervalMs);

    return () => {
      clearAnalysisInterval();
    };
  }, [isMonitoring, audioService, intervalMs, extractor, clearAnalysisInterval]);

  return {
    latestFeatures,
    extractor,
  };
}
