/**
 * Sanket, useAudioFileMonitor React Hook
 *
 * Bridges AudioFileInputService to React state.
 * Exposes the same shape as useAudioMonitor where possible so that
 * App.tsx can conditionally route either source to the FeatureExtractor.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioFileInputService } from './audioFileInput';
import type { FilePlaybackStatus } from './audioFileInput';
import type { AudioActivityState } from './types';

export function useAudioFileMonitor() {
  const [service] = useState<AudioFileInputService>(() => new AudioFileInputService());
  const [playbackStatus, setPlaybackStatus] = useState<FilePlaybackStatus>(service.getStatus());
  const [activity, setActivity] = useState<AudioActivityState>({
    rmsEnergy: 0,
    isActive: false,
    threshold: 0.015,
  });

  const telemetryRafRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef<number>(0);

  // Subscribe to service state changes
  useEffect(() => {
    const unsubscribe = service.subscribe((status) => {
      setPlaybackStatus(status);
    });
    return unsubscribe;
  }, [service]);

  // Start / stop the telemetry RAF loop based on playback state
  useEffect(() => {
    if (playbackStatus.state !== 'PLAYING') {
      if (telemetryRafRef.current !== null) {
        cancelAnimationFrame(telemetryRafRef.current);
        telemetryRafRef.current = null;
      }
      // Defer to avoid synchronous setState inside effect (oxlint set-state-in-effect)
      const resetTimer = setTimeout(() => {
        setActivity({ rmsEnergy: 0, isActive: false, threshold: 0.015 });
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    lastUiUpdateRef.current = performance.now();

    function stepTelemetry() {
      const frame = service.getCurrentFrame();
      if (frame) {
        const now = performance.now();
        if (now - lastUiUpdateRef.current >= 50) {
          lastUiUpdateRef.current = now;
          setActivity({
            rmsEnergy: frame.rmsEnergy,
            isActive: service.isAudioActive(frame.rmsEnergy),
            threshold: 0.015,
          });
          // Playhead only changes via notify() on state transitions; poll it
          // here so progress UI and transcript cues advance during playback.
          setPlaybackStatus(service.getStatus());
        }
      }
      telemetryRafRef.current = requestAnimationFrame(stepTelemetry);
    }

    telemetryRafRef.current = requestAnimationFrame(stepTelemetry);
    return () => {
      if (telemetryRafRef.current !== null) {
        cancelAnimationFrame(telemetryRafRef.current);
        telemetryRafRef.current = null;
      }
    };
  }, [playbackStatus.state, service]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (telemetryRafRef.current !== null) {
        cancelAnimationFrame(telemetryRafRef.current);
      }
      service.dispose();
    };
  }, [service]);

  const loadFile = useCallback(
    async (file: File) => {
      await service.loadFile(file);
    },
    [service]
  );

  const playFile = useCallback(() => service.play(), [service]);
  const pauseFile = useCallback(() => service.pause(), [service]);
  const restartFile = useCallback(() => service.restart(), [service]);
  const setMuted = useCallback((muted: boolean) => service.setMuted(muted), [service]);
  const setVolume = useCallback((vol: number) => service.setVolume(vol), [service]);

  const isPlaying = playbackStatus.state === 'PLAYING';
  const isMuted = playbackStatus.isMuted ?? false;
  const volume = playbackStatus.volume ?? 1.0;

  return {
    service,
    playbackStatus,
    activity,
    isPlaying,
    isMuted,
    volume,
    loadFile,
    playFile,
    pauseFile,
    restartFile,
    setMuted,
    setVolume,
  };
}
