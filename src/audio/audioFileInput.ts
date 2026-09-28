/**
 * Sanket, Audio File Input Service
 *
 * Decodes a pre-recorded audio file (WAV / MP3 / OGG) into the same
 * AudioFrame format produced by the live microphone pipeline.
 *
 * Architecture:
 *
 *   File (AudioBuffer)
 *       ↓
 *   AudioBufferSourceNode
 *       ↓
 *   AnalyserNode (FFT 2048)
 *       ↓
 *   getCurrentFrame()  →  AudioFrame  →  FeatureExtractor  →  RiskEngine
 *
 * This makes the detection engine completely source-agnostic:
 * the same feature-extraction and risk-scoring pipeline runs unchanged
 * whether the audio comes from a live microphone or a pre-recorded call.
 */

import type { AudioFrame } from './types';

export type FilePlaybackState =
  | 'IDLE'
  | 'LOADING'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'ENDED'
  | 'ERROR';

export interface FilePlaybackStatus {
  state: FilePlaybackState;
  fileName: string | null;
  durationSec: number | null;
  currentTimeSec: number;
  errorMessage: string | null;
  isMuted?: boolean;
  volume?: number;
}

export type FilePlaybackListener = (status: FilePlaybackStatus) => void;

export class AudioFileInputService {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private customContextFactory?: () => AudioContext;

  // Pre-allocated frame buffers
  private timeDomainBuffer: Float32Array<ArrayBuffer> | null = null;
  private frequencyBuffer: Float32Array<ArrayBuffer> | null = null;

  private _state: FilePlaybackState = 'IDLE';
  private _fileName: string | null = null;
  private _startedAtContext: number = 0;
  private _pausedAtSec: number = 0;
  private _errorMessage: string | null = null;
  private _muted: boolean = false;
  private _volume: number = 1.0;

  private listeners: Set<FilePlaybackListener> = new Set();

  private readonly FFT_SIZE = 2048;

  constructor(contextFactory?: () => AudioContext) {
    this.customContextFactory = contextFactory;
  }

  // ── Subscriber API ────────────────────────────────────────────────────────

  public subscribe(listener: FilePlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const status = this.getStatus();
    for (const l of this.listeners) l(status);
  }

  public getStatus(): FilePlaybackStatus {
    return {
      state: this._state,
      fileName: this._fileName,
      durationSec: this.audioBuffer?.duration ?? null,
      currentTimeSec: this.getCurrentTimeSec(),
      errorMessage: this._errorMessage,
      isMuted: this._muted,
      volume: this._volume,
    };
  }

  public setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.gainNode && this.audioContext) {
      try {
        this.gainNode.gain.setValueAtTime(muted ? 0 : this._volume, this.audioContext.currentTime);
      } catch {
        this.gainNode.gain.value = muted ? 0 : this._volume;
      }
    }
    this.notify();
  }

  public isMuted(): boolean {
    return this._muted;
  }

  public setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode && this.audioContext && !this._muted) {
      try {
        this.gainNode.gain.setValueAtTime(this._volume, this.audioContext.currentTime);
      } catch {
        this.gainNode.gain.value = this._volume;
      }
    }
    this.notify();
  }

  public getVolume(): number {
    return this._volume;
  }

  private getCurrentTimeSec(): number {
    if (this._state === 'PLAYING' && this.audioContext) {
      const elapsed = this.audioContext.currentTime - this._startedAtContext;
      const duration = this.audioBuffer?.duration ?? 0;
      return Math.min(this._pausedAtSec + elapsed, duration);
    }
    return this._pausedAtSec;
  }

  // ── Load ─────────────────────────────────────────────────────────────────

  public async loadFile(file: File): Promise<void> {
    this.teardown();
    this._state = 'LOADING';
    this._fileName = file.name;
    this._errorMessage = null;
    this._pausedAtSec = 0;
    this.notify();

    try {
      if (this.customContextFactory) {
        this.audioContext = this.customContextFactory();
      } else {
        const globalObj = typeof window !== 'undefined' ? window : globalThis;
        const AudioContextClass =
          (globalObj as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
          (globalObj as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

        if (!AudioContextClass) {
          throw new Error('Web Audio API is not supported in this environment.');
        }

        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const arrayBuffer = await file.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = this.FFT_SIZE;
      this.analyserNode.smoothingTimeConstant = 0.8;

      if (typeof this.audioContext.createGain === 'function') {
        try {
          this.gainNode = this.audioContext.createGain();
          this.gainNode.gain.value = this._muted ? 0 : this._volume;
          if (this.audioContext.destination) {
            this.gainNode.connect(this.audioContext.destination);
          }
        } catch {
          // Ignored in test/mock environments without destination
        }
      }

      this.timeDomainBuffer = new Float32Array(new ArrayBuffer(this.FFT_SIZE * 4));
      this.frequencyBuffer = new Float32Array(new ArrayBuffer((this.FFT_SIZE / 2) * 4));

      this._state = 'READY';
      this.notify();
    } catch (err) {
      this._state = 'ERROR';
      this._errorMessage =
        err instanceof Error
          ? `Failed to decode audio: ${err.message}`
          : 'Unknown error decoding audio file.';
      this.notify();
    }
  }

  // ── Playback control ─────────────────────────────────────────────────────

  public play(fromSec?: number): void {
    if (!this.audioBuffer || !this.audioContext || !this.analyserNode) return;
    if (this._state === 'PLAYING') return;

    this._teardownSourceNode();

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    const startAt = fromSec !== undefined ? fromSec : this._pausedAtSec;

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.analyserNode);

    // Route audio to laptop speakers via GainNode or direct destination
    if (this.gainNode) {
      try {
        this.sourceNode.connect(this.gainNode);
      } catch {
        // Ignored in test/mock environments
      }
    } else if (this.audioContext.destination) {
      try {
        this.sourceNode.connect(this.audioContext.destination);
      } catch {
        // Ignored in test/mock environments
      }
    }

    this.sourceNode.onended = () => {
      if (this._state === 'PLAYING') {
        this._pausedAtSec = 0;
        this._state = 'ENDED';
        this.notify();
      }
    };

    this._startedAtContext = this.audioContext.currentTime;
    this._pausedAtSec = startAt;

    const offset = Math.max(0, Math.min(startAt, this.audioBuffer.duration));
    this.sourceNode.start(0, offset);

    this._state = 'PLAYING';
    this.notify();
  }

  public pause(): void {
    if (this._state !== 'PLAYING') return;
    this._pausedAtSec = this.getCurrentTimeSec();
    this._teardownSourceNode();
    this._state = 'PAUSED';
    this.notify();
  }

  public restart(): void {
    this._pausedAtSec = 0;
    this._teardownSourceNode();
    this.play(0);
  }

  // ── Frame production ─────────────────────────────────────────────────────

  public getCurrentFrame(): AudioFrame | null {
    if (
      this._state !== 'PLAYING' ||
      !this.analyserNode ||
      !this.audioContext ||
      !this.timeDomainBuffer ||
      !this.frequencyBuffer
    ) {
      return null;
    }

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

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getIsRunning(): boolean {
    return this._state === 'PLAYING';
  }

  public isAudioActive(rms: number, threshold = 0.015): boolean {
    return rms >= threshold;
  }

  // ── Teardown ─────────────────────────────────────────────────────────────

  private _teardownSourceNode(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Already stopped
      }
      this.sourceNode = null;
    }
  }

  private teardown(): void {
    this._teardownSourceNode();

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {
        // ok
      }
      this.analyserNode = null;
    }

    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // ok
      }
      this.gainNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        void this.audioContext.close();
      } catch {
        // ok
      }
      this.audioContext = null;
    }

    this.audioBuffer = null;
    this.timeDomainBuffer = null;
    this.frequencyBuffer = null;
  }

  public dispose(): void {
    this.teardown();
    this.listeners.clear();
    this._state = 'IDLE';
    this._fileName = null;
    this._errorMessage = null;
    this._pausedAtSec = 0;
  }

  private calculateRms(samples: Float32Array): number {
    let sum = 0;
    const len = samples.length;
    for (let i = 0; i < len; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / len);
  }
}
