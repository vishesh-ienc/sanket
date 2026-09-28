/**
 * Sanket, useCalibration React Hook (Phase 6)
 *
 * Manages the lifecycle of a personal voice baseline calibration session:
 *   - START: Begin recording acoustic statistics from live FeatureSet stream.
 *   - CALIBRATING: Accumulates Welford statistics, exposes progress.
 *   - COMPLETE: Finalizes BaselineProfile; updates RiskEngine config.
 *   - IDLE / ERROR: Pre-calibration or error state.
 *
 * Architecture:
 *   useFeatureExtractor → FeatureSet
 *       ↓ (during calibration)
 *   BaselineBuilder.addFrame()
 *       ↓ (on finalize)
 *   BaselineProfile → localStorage (persisted)
 *       ↓
 *   baselineToRiskEngineConfig() → RiskEngine.updateConfig()
 *       ↓
 *   calculateBaselineDeviation() → per-frame Z-score signals
 *
 * Privacy contract:
 *   - No audio samples retained. Only running Welford statistics.
 *   - localStorage persists only the final numeric profile (no audio).
 *   - Profile can be cleared by the user at any time via clearBaseline().
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { BaselineBuilder } from './baselineBuilder';
import { baselineToRiskEngineConfig } from './baselineDeviation';
import type { FeatureSet, BaselineProfile } from './types';
import type { RiskEngine } from './riskEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sanket_baseline_profile_v1';

/** Calibration session duration: how long it runs before auto-finalizing (ms) */
const CALIBRATION_DURATION_MS = 30_000; // 30 seconds

/** Minimum voiced frames required before manual early finalize is allowed */
const MIN_VOICED_FRAMES = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CalibrationStatus =
  | 'IDLE'          // No calibration running, no profile stored
  | 'CALIBRATING'   // Active calibration session in progress
  | 'COMPLETE'      // A valid profile has been finalized and is active
  | 'ERROR';        // Calibration failed (not enough voiced data, etc.)

export interface CalibrationState {
  status: CalibrationStatus;
  /** Active baseline profile, or null if not yet calibrated */
  profile: BaselineProfile | null;
  /** Progress 0.0–1.0 (voiced frame ratio vs minimum required) */
  progress: number;
  /** Voiced frames collected so far */
  voicedFrames: number;
  /** Minimum voiced frames required for finalization */
  minVoicedFrames: number;
  /** Elapsed ms since calibration started (null when not calibrating) */
  elapsedMs: number | null;
  /** Error message if status === 'ERROR' */
  errorMessage: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadStoredProfile(): BaselineProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BaselineProfile;
    // Basic sanity check
    if (
      typeof parsed.pitchMean === 'number' &&
      typeof parsed.energyMean === 'number' &&
      typeof parsed.frameCount === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveStoredProfile(profile: BaselineProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable (private browsing, etc.), non-fatal
  }
}

function clearStoredProfile(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

interface UseCalibrationOptions {
  /**
   * The RiskEngine instance to update when calibration completes.
   * When provided, baselineToRiskEngineConfig() output is fed to engine.updateConfig().
   */
  riskEngine?: RiskEngine | null;

  /**
   * Calibration session duration in ms. Defaults to CALIBRATION_DURATION_MS (30s).
   */
  calibrationDurationMs?: number;

  /**
   * User ID to attach to the baseline profile.
   * Default: 'default'
   */
  userId?: string;
}

export function useCalibration(
  latestFeatures: FeatureSet | null,
  isMonitoring: boolean,
  options: UseCalibrationOptions = {}
) {
  const {
    riskEngine = null,
    calibrationDurationMs = CALIBRATION_DURATION_MS,
    userId = 'default',
  } = options;

  // Load persisted profile on mount
  const [profile, setProfile] = useState<BaselineProfile | null>(() => loadStoredProfile());
  const [status, setStatus] = useState<CalibrationStatus>(() =>
    loadStoredProfile() ? 'COMPLETE' : 'IDLE'
  );
  const [progress, setProgress] = useState(0);
  const [voicedFrames, setVoicedFrames] = useState(0);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const builderRef = useRef<BaselineBuilder>(
    new BaselineBuilder({ minVoicedFrames: MIN_VOICED_FRAMES })
  );
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Apply stored profile to risk engine on mount (if persisted profile exists)
  useEffect(() => {
    const stored = loadStoredProfile();
    if (stored && riskEngine) {
      riskEngine.updateConfig(baselineToRiskEngineConfig(stored));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Feed live features into the builder during calibration ─────────────────
  useEffect(() => {
    if (status !== 'CALIBRATING' || latestFeatures === null || !isMonitoring) return;
    builderRef.current.addFrame(latestFeatures);
    const stats = builderRef.current.getRunningStats();
    setProgress(stats.progress);
    setVoicedFrames(stats.voicedFrames);
  }, [latestFeatures, status, isMonitoring]);

  // ── Finalize helper ────────────────────────────────────────────────────────
  const finalizeCalibration = useCallback(() => {
    const builder = builderRef.current;
    builder.stop();

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (elapsedIntervalRef.current !== null) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }

    if (!builder.isReady()) {
      setStatus('ERROR');
      setErrorMessage(
        `Not enough voiced speech collected (${builder.getVoicedFrameCount()} frames). ` +
          `Speak normally for at least a few seconds and try again.`
      );
      return;
    }

    try {
      const newProfile = builder.finalize(userId);
      setProfile(newProfile);
      setStatus('COMPLETE');
      setProgress(1.0);
      setElapsedMs(null);
      setErrorMessage(null);
      saveStoredProfile(newProfile);

      // Apply new baseline to the risk engine immediately
      if (riskEngine) {
        riskEngine.updateConfig(baselineToRiskEngineConfig(newProfile));
      }
    } catch (err) {
      setStatus('ERROR');
      setErrorMessage(err instanceof Error ? err.message : 'Calibration finalize failed.');
    }
  }, [riskEngine, userId]);

  // ── Start calibration ──────────────────────────────────────────────────────
  const startCalibration = useCallback(() => {
    if (!isMonitoring) return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (elapsedIntervalRef.current !== null) clearInterval(elapsedIntervalRef.current);

    builderRef.current.start();
    startTimeRef.current = Date.now();
    setStatus('CALIBRATING');
    setProgress(0);
    setVoicedFrames(0);
    setElapsedMs(0);
    setErrorMessage(null);

    // Auto-finalize after calibrationDurationMs
    timerRef.current = setTimeout(() => {
      finalizeCalibration();
    }, calibrationDurationMs);

    // Drive elapsed timer at 500ms for UI
    elapsedIntervalRef.current = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    }, 500);
  }, [isMonitoring, calibrationDurationMs, finalizeCalibration]);

  // ── Cancel calibration ─────────────────────────────────────────────────────
  const cancelCalibration = useCallback(() => {
    builderRef.current.stop();
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (elapsedIntervalRef.current !== null) clearInterval(elapsedIntervalRef.current);
    timerRef.current = null;
    elapsedIntervalRef.current = null;
    setStatus(profile ? 'COMPLETE' : 'IDLE');
    setProgress(0);
    setVoicedFrames(0);
    setElapsedMs(null);
    setErrorMessage(null);
  }, [profile]);

  // ── Clear baseline ─────────────────────────────────────────────────────────
  const clearBaseline = useCallback(() => {
    setProfile(null);
    setStatus('IDLE');
    setProgress(0);
    setVoicedFrames(0);
    setElapsedMs(null);
    setErrorMessage(null);
    clearStoredProfile();
    builderRef.current.reset();
    // Reset risk engine to prototype defaults
    if (riskEngine) {
      riskEngine.updateConfig({
        pitchBaselineRef: 165,
        rmsBaselineRef: 0.06,
        silenceOnsetSec: 1.5,
      });
    }
  }, [riskEngine]);

  // ── Load Preset Profile (Judge Demonstration & Testing) ────────────────────
  const loadPresetProfile = useCallback((presetProfile?: BaselineProfile): BaselineProfile => {
    const p: BaselineProfile = presetProfile || {
      userId: 'demo-judge',
      calibratedAt: Date.now(),
      frameCount: 120,
      pitchMean: 165.0,
      pitchStdDev: 14.5,
      energyMean: 0.058,
      energyStdDev: 0.012,
      normalSilenceThresholdSec: 1.5,
      zcrMean: 0.082,
      zcrStdDev: 0.018,
      spectralMean: 1420.0,
      spectralStdDev: 180.0,
    };
    saveStoredProfile(p);
    setProfile(p);
    setStatus('COMPLETE');
    setProgress(1.0);
    setVoicedFrames(120);
    setElapsedMs(null);
    setErrorMessage(null);
    if (riskEngine) {
      riskEngine.updateConfig(baselineToRiskEngineConfig(p));
    }
    return p;
  }, [riskEngine]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      if (elapsedIntervalRef.current !== null) clearInterval(elapsedIntervalRef.current);
    };
  }, []);

  const state: CalibrationState = {
    status,
    profile,
    progress,
    voicedFrames,
    minVoicedFrames: MIN_VOICED_FRAMES,
    elapsedMs,
    errorMessage,
  };

  return {
    calibrationState: state,
    startCalibration,
    cancelCalibration,
    finalizeCalibration,
    clearBaseline,
    loadPresetProfile,
  };
}
