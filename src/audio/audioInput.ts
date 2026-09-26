/**
 * Sanket Audio Input Service
 * Manages Web Audio API lifecycle, microphone acquisition, framing, and node cleanup.
 * Pure TypeScript service completely decoupled from the React UI.
 */

import type { AudioFrame, AudioInputConfig, AudioInputError } from './types';

const DEFAULT_CONFIG: Required<AudioInputConfig> = {
  sampleRate: 44100,
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
  activeThresholdRms: 0.02,
};

export class AudioInputService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private config: Required<AudioInputConfig>;
  private isRunning = false;

  // Pre-allocated typed arrays with concrete ArrayBuffer backing to prevent GC churn and type mismatch
  private timeDomainBuffer: Float32Array<ArrayBuffer>;
  private frequencyBuffer: Float32Array<ArrayBuffer>;

  constructor(config: AudioInputConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.timeDomainBuffer = new Float32Array(new ArrayBuffer(this.config.fftSize * 4));
    this.frequencyBuffer = new Float32Array(new ArrayBuffer((this.config.fftSize / 2) * 4));
  }

  /**
   * Initializes audio context and acquires microphone stream
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    // Verify browser support
    if (typeof window === 'undefined') {
      throw this.createError('NOT_SUPPORTED', 'Web Audio API is only available in browser environments.');
    }

    const hasMediaDevices = !!navigator?.mediaDevices?.getUserMedia;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!hasMediaDevices || !AudioContextClass) {
      throw this.createError(
        'NOT_SUPPORTED',
        'Your browser does not support audio recording or Web Audio API. Please use a modern browser such as Chrome, Edge, or Firefox.'
      );
    }

    try {
      // 1. Request microphone permission (audio only)
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
        },
        video: false,
      });

      // 2. Initialize AudioContext
      this.audioContext = new AudioContextClass({
        sampleRate: this.config.sampleRate,
      });

      // Browser autoplay policy: resume AudioContext if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // 3. Create AnalyserNode
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = this.config.fftSize;
      this.analyserNode.smoothingTimeConstant = this.config.smoothingTimeConstant;

      // 4. Connect microphone source to analyser
      // NOTE: We deliberately do NOT connect to audioContext.destination to avoid feedback screeching
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.analyserNode);

      // Verify buffers match configured FFT size
      if (this.timeDomainBuffer.length !== this.config.fftSize) {
        this.timeDomainBuffer = new Float32Array(new ArrayBuffer(this.config.fftSize * 4));
        this.frequencyBuffer = new Float32Array(new ArrayBuffer((this.config.fftSize / 2) * 4));
      }

      this.isRunning = true;
    } catch (err: unknown) {
      // Ensure any partially created stream or nodes are released
      this.stop();

      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw this.createError(
            'PERMISSION_DENIED',
            'Microphone access was denied. Please allow microphone permissions in your browser address bar to enable voice monitoring.',
            err
          );
        }
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          throw this.createError(
            'DEVICE_NOT_FOUND',
            'No audio input device (microphone) was detected on your system.',
            err
          );
        }
      }

      throw this.createError(
        'INITIALIZATION_FAILED',
        'Failed to initialize audio input. Please check device settings and try again.',
        err
      );
    }
  }

  /**
   * Stops audio monitoring, releases hardware tracks, and closes AudioContext
   */
  public stop(): void {
    this.isRunning = false;

    // Disconnect audio nodes
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Ignore disconnect errors during teardown
      }
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.analyserNode = null;
    }

    // Stop and release media stream hardware tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Track already closed
        }
      });
      this.mediaStream = null;
    }

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // Context already closed
      }
      this.audioContext = null;
    }
  }

  /**
   * Retrieves the current snapshot AudioFrame from the active AnalyserNode
   */
  public getCurrentFrame(): AudioFrame | null {
    if (!this.isRunning || !this.analyserNode || !this.audioContext) {
      return null;
    }

    // Capture real-time time-domain and frequency data
    this.analyserNode.getFloatTimeDomainData(this.timeDomainBuffer);
    this.analyserNode.getFloatFrequencyData(this.frequencyBuffer);

    const rms = this.calculateRms(this.timeDomainBuffer);

    return {
      timestamp: performance.now(),
      sampleRate: this.audioContext.sampleRate,
      frameSize: this.timeDomainBuffer.length,
      timeDomainData: this.timeDomainBuffer,
      frequencyData: this.frequencyBuffer,
      rmsEnergy: rms,
    };
  }

  /**
   * Calculates Root-Mean-Square (RMS) amplitude from time-domain PCM samples
   */
  public calculateRms(samples: Float32Array): number {
    let sumSquares = 0;
    const len = samples.length;
    for (let i = 0; i < len; i++) {
      const val = samples[i];
      sumSquares += val * val;
    }
    return Math.sqrt(sumSquares / len);
  }

  /**
   * Determines if current audio frame is classified as ACTIVE vs QUIET
   */
  public isAudioActive(rms: number, threshold = this.config.activeThresholdRms): boolean {
    return rms >= threshold;
  }

  /**
   * Returns current active threshold
   */
  public getActiveThreshold(): number {
    return this.config.activeThresholdRms;
  }

  /**
   * Updates configurable active threshold
   */
  public setActiveThreshold(threshold: number): void {
    this.config.activeThresholdRms = Math.max(0.001, Math.min(1.0, threshold));
  }

  /**
   * Direct access to the AnalyserNode for high-performance Canvas rendering
   */
  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private createError(type: AudioInputError['type'], userMessage: string, originalError?: unknown): AudioInputError {
    return {
      type,
      userMessage,
      originalError,
    };
  }
}
