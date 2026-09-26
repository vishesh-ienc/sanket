/**
 * Sanket Audio Input & Processing Layer Contracts
 * Pure TypeScript interfaces decoupled from browser DOM/React UI
 */

export interface AudioFrame {
  /** High-resolution timestamp in milliseconds */
  timestamp: number;
  /** Audio sample rate (e.g. 44100 or 48000 Hz) */
  sampleRate: number;
  /** Raw normalized time-domain PCM samples (-1.0 to 1.0) */
  timeDomainData: Float32Array;
  /** Fast Fourier Transform magnitude/decibel array */
  frequencyData: Float32Array;
}

export interface AudioInputConfig {
  sampleRate?: number;
  fftSize?: number;
  smoothingTimeConstant?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export type AudioInputStatus = 'IDLE' | 'INITIALIZING' | 'ACTIVE' | 'PAUSED' | 'ERROR';
