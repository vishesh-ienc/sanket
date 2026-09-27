/**
 * Sanket — Portable AudioFrame Builder
 *
 * Reproduces what Web Audio's AnalyserNode gives the browser adapters
 * (fftSize 2048, Blackman window, magnitude / N, 0.8 temporal smoothing,
 * dBFS), so any PCM source — tests, Node tooling, or a future native mobile
 * adapter — can feed the unchanged FeatureExtractor. Pure TypeScript.
 */

import type { AudioFrame } from './types';

export const FRAME_SIZE = 2048;

/** Windowed FFT magnitudes (|X| / N) for a power-of-two frame */
export function fftMagnitudes(input: Float32Array): Float32Array {
  const n = input.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    re[i] = input[i] * (0.42 - 0.5 * Math.cos(a) + 0.08 * Math.cos(2 * a)); // Blackman
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const vr = re[b] * wr - im[b] * wi;
        const vi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
      }
    }
  }
  const mags = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) mags[i] = Math.hypot(re[i], im[i]) / n;
  return mags;
}

/**
 * Stateful builder: call `build()` with the latest FRAME_SIZE samples at each
 * analysis tick. Keeps AnalyserNode-style spectral smoothing across calls.
 */
export class AudioFrameBuilder {
  private smoothed = new Float32Array(FRAME_SIZE / 2);
  private readonly smoothingTimeConstant: number;

  constructor(smoothingTimeConstant = 0.8) {
    this.smoothingTimeConstant = smoothingTimeConstant;
  }

  build(samples: Float32Array, sampleRate: number, timestampMs: number): AudioFrame {
    const mags = fftMagnitudes(samples);
    const frequencyData = new Float32Array(FRAME_SIZE / 2);
    const k = this.smoothingTimeConstant;
    for (let i = 0; i < mags.length; i++) {
      this.smoothed[i] = k * this.smoothed[i] + (1 - k) * mags[i];
      frequencyData[i] = 20 * Math.log10(this.smoothed[i] + 1e-12);
    }
    let sumSq = 0;
    for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
    return {
      timestamp: timestampMs,
      sampleRate,
      frameSize: samples.length,
      timeDomainData: samples,
      frequencyData,
      rmsEnergy: Math.sqrt(sumSq / samples.length),
    };
  }

  reset(): void {
    this.smoothed.fill(0);
  }
}

/** Decodes 16-bit PCM mono WAV bytes (as written by encodeWav / the demo generator) */
export function decodePcm16Wav(bytes: ArrayBuffer): { samples: Float32Array; sampleRate: number } {
  const view = new DataView(bytes);
  const sampleRate = view.getUint32(24, true);
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
    const size = view.getUint32(offset + 4, true);
    if (id === 'data') {
      const count = Math.floor(size / 2);
      const samples = new Float32Array(count);
      for (let i = 0; i < count; i++) samples[i] = view.getInt16(offset + 8 + i * 2, true) / 32768;
      return { samples, sampleRate };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('WAV data chunk not found');
}
