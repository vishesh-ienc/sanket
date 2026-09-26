/**
 * Sanket Audio Input & Processing Layer Contracts
 * Pure TypeScript interfaces decoupled from browser DOM/React UI
 */

export interface AudioFrame {
  /** High-resolution timestamp in milliseconds */
  timestamp: number;
  /** Audio sample rate (e.g. 44100 or 48000 Hz) */
  sampleRate: number;
  /** Number of samples in this frame */
  frameSize: number;
  /** Raw normalized time-domain PCM samples (-1.0 to 1.0) */
  timeDomainData: Float32Array;
  /** Fast Fourier Transform magnitude/decibel array */
  frequencyData: Float32Array;
  /** Root-mean-square amplitude calculation (0.0 to 1.0) */
  rmsEnergy: number;
}

export interface AudioInputConfig {
  sampleRate?: number;
  fftSize?: number;
  smoothingTimeConstant?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  /** RMS threshold above which audio is classified as ACTIVE vs QUIET */
  activeThresholdRms?: number;
}

export type MonitoringState =
  | 'SYSTEM_READY'
  | 'REQUESTING_PERMISSION'
  | 'MONITORING_ACTIVE'
  | 'PERMISSION_DENIED'
  | 'NOT_SUPPORTED'
  | 'ERROR';

export type AudioInputErrorType =
  | 'PERMISSION_DENIED'
  | 'NOT_SUPPORTED'
  | 'DEVICE_NOT_FOUND'
  | 'INITIALIZATION_FAILED';

export interface AudioInputError {
  type: AudioInputErrorType;
  userMessage: string;
  originalError?: unknown;
}

export interface AudioActivityState {
  rmsEnergy: number;
  isActive: boolean;
  threshold: number;
}
