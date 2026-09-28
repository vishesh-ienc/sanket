/**
 * Sanket, useCodeWordDetector React Hook (Phase 5)
 *
 * Connects the CodeWordDetector engine to React components.
 * Manages configuration state, active monitoring toggle, detection events,
 * and passes code-word detections to the RiskEngine as external contextual signals.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { CodeWordDetector } from './codeWordDetector';
import type { CodeWordDetectorConfig, CodeWordDetection } from './types';

interface UseCodeWordDetectorOptions {
  initialConfig?: Partial<CodeWordDetectorConfig>;
  onDetection?: (detection: CodeWordDetection) => void;
}

export function useCodeWordDetector(options: UseCodeWordDetectorOptions = {}) {
  const [detector] = useState<CodeWordDetector>(
    () => new CodeWordDetector(options.initialConfig)
  );

  const [config, setConfig] = useState<CodeWordDetectorConfig>(() =>
    detector.getConfig()
  );

  const [latestDetection, setLatestDetection] = useState<CodeWordDetection | null>(null);

  // Keep onDetection callback reference fresh without forcing effect re-runs
  const onDetectionRef = useRef(options.onDetection);
  useEffect(() => {
    onDetectionRef.current = options.onDetection;
  }, [options.onDetection]);

  /** Updates the target phrase */
  const updatePhrase = useCallback(
    (newPhrase: string) => {
      detector.configure({ phrase: newPhrase });
      setConfig(detector.getConfig());
    },
    [detector]
  );

  /** Toggles active armed/disarmed status */
  const toggleEnabled = useCallback(() => {
    const nextState = !detector.getConfig().enabled;
    detector.configure({ enabled: nextState });
    setConfig(detector.getConfig());
  }, [detector]);

  /** Updates complete configuration */
  const updateConfig = useCallback(
    (partial: Partial<CodeWordDetectorConfig>) => {
      detector.configure(partial);
      setConfig(detector.getConfig());
    },
    [detector]
  );

  /**
   * Processes a recognized transcript text.
   * If detected, notifies onDetection callback and sets latestDetection state.
   */
  const processTranscript = useCallback(
    (text: string, timestamp?: number, sourceId?: string): CodeWordDetection => {
      const result = detector.processTranscript(text, timestamp, sourceId);
      setLatestDetection(result);

      if (result.detected && onDetectionRef.current) {
        onDetectionRef.current(result);
      }

      return result;
    },
    [detector]
  );

  /** Resets detection history and debounce state */
  const reset = useCallback(() => {
    detector.reset();
    setLatestDetection(null);
  }, [detector]);

  return {
    config,
    latestDetection,
    updatePhrase,
    toggleEnabled,
    updateConfig,
    processTranscript,
    reset,
    detector,
  };
}
