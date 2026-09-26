/**
 * React Hook for Sanket Audio Monitoring
 * Bridges the pure AudioInputService to React state with safe unmounting,
 * throttled UI telemetry updates, and error handling.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioInputService } from './audioInput';
import type {
  AudioActivityState,
  AudioFrame,
  AudioInputConfig,
  AudioInputError,
  MonitoringState,
} from './types';

export function useAudioMonitor(config?: AudioInputConfig) {
  const [monitoringState, setMonitoringState] = useState<MonitoringState>('SYSTEM_READY');
  const [error, setError] = useState<AudioInputError | null>(null);
  const [activity, setActivity] = useState<AudioActivityState>({
    rmsEnergy: 0,
    isActive: false,
    threshold: config?.activeThresholdRms ?? 0.02,
  });

  // State-backed service instance ensures safe reference during render
  const [audioService] = useState<AudioInputService>(() => new AudioInputService(config));
  const currentFrameRef = useRef<AudioFrame | null>(null);
  const telemetryRafRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef<number>(0);

  const stopMonitoring = useCallback(() => {
    if (telemetryRafRef.current !== null) {
      cancelAnimationFrame(telemetryRafRef.current);
      telemetryRafRef.current = null;
    }

    audioService.stop();

    currentFrameRef.current = null;
    setMonitoringState('SYSTEM_READY');
    setActivity((prev) => ({
      ...prev,
      rmsEnergy: 0,
      isActive: false,
    }));
  }, [audioService]);

  const startMonitoring = useCallback(async () => {
    setError(null);
    setMonitoringState('REQUESTING_PERMISSION');

    try {
      await audioService.start();
      setMonitoringState('MONITORING_ACTIVE');

      // Start the throttled telemetry loop using a named recursive function
      lastUiUpdateRef.current = performance.now();

      function stepTelemetry() {
        if (!audioService.getIsRunning()) {
          return;
        }

        const frame = audioService.getCurrentFrame();
        if (frame) {
          currentFrameRef.current = frame;
          const now = performance.now();

          // Throttle React state re-renders to ~20Hz (every 50ms)
          if (now - lastUiUpdateRef.current >= 50) {
            lastUiUpdateRef.current = now;
            const isActive = audioService.isAudioActive(frame.rmsEnergy);
            setActivity({
              rmsEnergy: frame.rmsEnergy,
              isActive,
              threshold: audioService.getActiveThreshold(),
            });
          }
        }

        telemetryRafRef.current = requestAnimationFrame(stepTelemetry);
      }

      telemetryRafRef.current = requestAnimationFrame(stepTelemetry);
    } catch (err: unknown) {
      const audioError = err as AudioInputError;
      setError(audioError);

      if (audioError?.type === 'PERMISSION_DENIED') {
        setMonitoringState('PERMISSION_DENIED');
      } else if (audioError?.type === 'NOT_SUPPORTED') {
        setMonitoringState('NOT_SUPPORTED');
      } else {
        setMonitoringState('ERROR');
      }
    }
  }, [audioService]);

  // Clean up all resources when component unmounts
  useEffect(() => {
    return () => {
      if (telemetryRafRef.current !== null) {
        cancelAnimationFrame(telemetryRafRef.current);
      }
      audioService.stop();
    };
  }, [audioService]);

  return {
    monitoringState,
    activity,
    error,
    startMonitoring,
    stopMonitoring,
    audioService,
    currentFrameRef,
  };
}
