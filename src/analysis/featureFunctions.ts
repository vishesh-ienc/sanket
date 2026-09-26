/**
 * Sanket — Acoustic Feature Extraction Functions
 *
 * Pure, stateless DSP utility functions.
 * Each function accepts typed arrays and numeric parameters; none reference
 * the browser DOM, React, or the audio input service.
 *
 * These functions answer: "What is happening acoustically in this frame?"
 * They do NOT make any distress or safety judgements.
 *
 * Limitations clearly documented per function.
 */

// ─────────────────────────────────────────────────────────────────────────────
// A. RMS Energy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates Root-Mean-Square amplitude from normalized PCM samples.
 *
 * @param samples  Float32Array of time-domain samples in [-1.0, 1.0]
 * @returns        RMS value in [0.0, 1.0]
 *
 * Limitation: Browser microphone gain varies by hardware and OS settings.
 * This is a relative amplitude measure, NOT a calibrated acoustic dB SPL value.
 */
export function calculateRms(samples: Float32Array): number {
  const len = samples.length;
  if (len === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < len; i++) {
    const v = samples[i];
    sumSquares += v * v;
  }
  return Math.sqrt(sumSquares / len);
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Zero-Crossing Rate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates Zero-Crossing Rate (ZCR) for a PCM frame.
 *
 * ZCR = number of sign changes / (N - 1)
 * Result is in [0.0, 1.0] (fraction of transitions per sample pair).
 *
 * @param samples  Float32Array of time-domain samples in [-1.0, 1.0]
 * @returns        Normalized ZCR in [0.0, 1.0]
 *
 * Interpretation guidance:
 * - Low ZCR + adequate RMS → likely voiced, periodic signal (sustained vowels)
 * - High ZCR → likely unvoiced fricatives, sibilants, noise, or silence
 * - ZCR alone is NOT a distress indicator. Context and baseline deviation matter.
 */
export function calculateZeroCrossingRate(samples: Float32Array): number {
  const len = samples.length;
  if (len < 2) return 0;

  let crossings = 0;
  for (let i = 1; i < len; i++) {
    // A crossing occurs when adjacent samples have opposite signs
    if ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0)) {
      crossings++;
    }
  }

  return crossings / (len - 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Spectral Centroid
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the Spectral Centroid from frequency-domain magnitude data.
 *
 * The spectral centroid is the weighted mean frequency of the spectrum:
 *   centroid = Σ(f_i × m_i) / Σ(m_i)
 * where f_i is the frequency at bin i, and m_i is the linear magnitude at bin i.
 *
 * The AnalyserNode returns dBFS values (typically -∞ to 0 dB).
 * We convert to linear magnitude before computing to get meaningful weights.
 *
 * @param frequencyData  Float32Array of dBFS values from AnalyserNode.getFloatFrequencyData()
 * @param sampleRate     Audio sample rate in Hz (e.g. 44100)
 * @param minMagnitude   Minimum linear magnitude threshold; bins below this are ignored
 * @returns              Spectral centroid in Hz, or null if total magnitude is negligible
 *
 * Interpretation:
 * - Brighter sounds (consonants, high-pitched speech) → higher centroid
 * - Darker/lower-pitched sounds → lower centroid
 * - Not by itself a distress indicator.
 */
export function calculateSpectralCentroid(
  frequencyData: Float32Array,
  sampleRate: number,
  minMagnitude = 0.001
): number | null {
  const numBins = frequencyData.length;
  if (numBins === 0) return null;

  // Frequency resolution: each bin spans sampleRate / (2 * numBins) Hz
  const binFreqWidth = sampleRate / (2 * numBins);

  let weightedFreqSum = 0;
  let magnitudeSum = 0;

  for (let i = 0; i < numBins; i++) {
    // Convert dBFS → linear magnitude: magnitude = 10^(dB/20)
    const dbValue = frequencyData[i];
    // Guard against -Infinity (silence) which produces magnitude = 0
    const magnitude = isFinite(dbValue) ? Math.pow(10, dbValue / 20) : 0;

    if (magnitude >= minMagnitude) {
      const binFreq = (i + 0.5) * binFreqWidth;
      weightedFreqSum += binFreq * magnitude;
      magnitudeSum += magnitude;
    }
  }

  if (magnitudeSum < minMagnitude) {
    // Negligible total spectral energy — frame is effectively silent
    return null;
  }

  return weightedFreqSum / magnitudeSum;
}

// ─────────────────────────────────────────────────────────────────────────────
// D. Pitch Estimation via Autocorrelation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimates fundamental frequency (F0 / pitch) using normalized autocorrelation.
 *
 * Algorithm: Biased autocorrelation, search within human speech range [minHz, maxHz].
 * A normalized peak (correlation coefficient) above the confidence threshold
 * is accepted as a valid pitch estimate.
 *
 * @param samples             Float32Array of time-domain PCM samples
 * @param sampleRate          Audio context sample rate in Hz
 * @param minHz               Minimum F0 search frequency (default: 80 Hz)
 * @param maxHz               Maximum F0 search frequency (default: 500 Hz)
 * @param confidenceThreshold Minimum normalized peak height to accept (default: 0.25)
 * @returns                   Estimated F0 in Hz, or null if unvoiced / confidence insufficient
 *
 * Assumptions & limitations:
 * - Monophonic single-speaker audio. Multi-speaker or music will produce unreliable results.
 * - Frame must be long enough: for 80 Hz at 44100 Hz sample rate, need ≥ 551 samples.
 * - Typical frame size of 2048 at 44100 Hz covers down to ~21 Hz.
 * - Autocorrelation is a well-understood heuristic; it is NOT a medically validated
 *   measurement of vocal cord physiology.
 * - Estimates may be unreliable on unvoiced speech (fricatives, whispers).
 * - Returns null rather than a wrong value for silence/noise frames.
 */
export function estimatePitch(
  samples: Float32Array,
  sampleRate: number,
  minHz = 80,
  maxHz = 500,
  confidenceThreshold = 0.25
): number | null {
  const N = samples.length;
  if (N === 0 || sampleRate <= 0) return null;

  // Lag range corresponding to the Hz search window
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(Math.floor(sampleRate / minHz), N - 1);

  if (minLag >= maxLag || maxLag >= N) return null;

  // Compute the zero-lag (autocorrelation at lag=0) for normalization
  let r0 = 0;
  for (let i = 0; i < N; i++) {
    r0 += samples[i] * samples[i];
  }

  if (r0 < 1e-4) {
    // Essentially silent frame — no reliable pitch
    return null;
  }

  // Search for the maximum normalized autocorrelation in [minLag, maxLag]
  let bestLag = -1;
  let bestCorr = -1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const limit = N - lag;
    for (let i = 0; i < limit; i++) {
      corr += samples[i] * samples[i + lag];
    }
    // Normalize: biased normalization against zero-lag
    const normalizedCorr = corr / r0;

    if (normalizedCorr > bestCorr) {
      bestCorr = normalizedCorr;
      bestLag = lag;
    }
  }

  if (bestLag < 1 || bestCorr < confidenceThreshold) {
    // No periodic peak found with adequate confidence
    return null;
  }

  return sampleRate / bestLag;
}

// ─────────────────────────────────────────────────────────────────────────────
// E. Voice Activity Detection (VAD)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple energy-based Voice Activity Detection.
 *
 * Classifies a frame as voiced (true) or non-voiced (false)
 * based purely on RMS energy exceeding a configurable threshold.
 *
 * @param rms        Pre-computed RMS amplitude for the frame
 * @param threshold  Minimum RMS to consider as voiced speech (default: 0.015)
 * @returns          true = likely voiced speech; false = silence/noise/non-voice
 *
 * Limitations:
 * - A basic energy gate does NOT distinguish between speech and other loud sounds
 *   (clapping, background music, ambient noise above threshold).
 * - This is NOT a neural speech/non-speech classifier.
 * - Threshold may need tuning relative to a user's personal baseline (Phase 7).
 */
export function detectVoiceActivity(rms: number, threshold = 0.015): boolean {
  return rms >= threshold;
}
