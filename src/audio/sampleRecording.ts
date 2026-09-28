/**
 * Sanket, Built-in Sample Call Recording
 *
 * Procedurally synthesizes a short "simulated call" so evaluators can run the
 * primary file-based demo without supplying their own recording.
 *
 * The signal is a voice-like harmonic source (not a real person's voice):
 *   1. Calm segment    , ~165 Hz intonation, conversational syllable rhythm,
 *                          moderate level, natural harmonic roll-off.
 *   2. Distress segment, elevated & trembling pitch, raised vocal effort,
 *                          flattened (strained) harmonics, breath turbulence,
 *                          and pressured speech with almost no breath gaps.
 *
 * Nothing is fetched or recorded: the WAV is generated in memory and fed
 * through the exact same AudioFileInputService → FeatureExtractor pipeline as
 * any user-supplied file. Pure TypeScript, no DOM required except `File`.
 */

export interface SampleCallSegment {
  /** Segment start in seconds */
  startSec: number;
  /** Segment end in seconds */
  endSec: number;
  /** Short label for timeline markers */
  label: string;
  /** Expected detection behaviour, shown to evaluators */
  expectation: string;
  tone: 'calm' | 'transition' | 'distress';
}

export const SAMPLE_CALL_SAMPLE_RATE = 44100;
export const SAMPLE_CALL_FILE_NAME = 'sanket-sample-call.wav';

export const SAMPLE_CALL_SEGMENTS: SampleCallSegment[] = [
  {
    startSec: 0,
    endSec: 14,
    label: 'Calm conversation',
    expectation: 'Risk stays NORMAL',
    tone: 'calm',
  },
  {
    startSec: 14,
    endSec: 18,
    label: 'Voice tightens',
    expectation: 'Signals begin to rise',
    tone: 'transition',
  },
  {
    startSec: 18,
    endSec: 36,
    label: 'Sustained distress pattern',
    expectation: 'Multi-signal HIGH_RISK → silent alert',
    tone: 'distress',
  },
];

export const SAMPLE_CALL_DURATION_SEC = 36;

/**
 * Simulated transcript track for the sample call.
 *
 * The prototype has no on-device speech-to-text, so the sample ships with a
 * scripted transcript (like captions) that is fed to the CodeWordDetector as
 * the playhead passes each cue. `{phrase}` is replaced with the user's
 * currently configured code word, so the demo respects their configuration.
 * The acoustic signal alone is deliberately capped below HIGH_RISK by the
 * engine's multi-signal design; the covert phrase is the corroborating signal.
 */
export interface SampleCallTranscriptCue {
  atSec: number;
  template: string;
}

export const SAMPLE_CALL_TRANSCRIPT: SampleCallTranscriptCue[] = [
  { atSec: 4, template: 'Hey, yeah I just left the office, should be home in twenty minutes.' },
  { atSec: 10, template: 'The traffic is not too bad tonight actually.' },
  { atSec: 22, template: 'No, no, everything is fine. {phrase}, okay? I have to go.' },
];

export function renderTranscriptCue(cue: SampleCallTranscriptCue, phrase: string): string {
  return cue.template.replace('{phrase}', phrase);
}

/** Deterministic PRNG so the sample (and its tests) are reproducible */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Syllable/phrase envelope in [0, 1]. Calm speech: ~4 syllables/s in 2.4 s
 * phrases separated by short breaths. Distress: rapid, pressured speech with
 * barely any breath gaps.
 */
function speechEnvelope(t: number, distress: number): number {
  const phraseLen = 2.4 + distress * 1.6;
  const gapLen = 0.35 - distress * 0.25;
  const phrasePos = t % (phraseLen + gapLen);
  if (phrasePos > phraseLen) return 0;

  const syllableRate = 4 + distress * 2.5;
  const s = (t * syllableRate) % 1;
  // Raised-cosine syllable with a small floor so voicing stays continuous
  const floor = 0.35 + distress * 0.45;
  const syllable = floor + (1 - floor) * Math.sin(Math.PI * s) ** 2;
  const phraseFade = smoothstep(0, 0.06, phrasePos) * smoothstep(phraseLen, phraseLen - 0.08, phrasePos);
  return syllable * phraseFade;
}

/**
 * Synthesizes the sample call as mono PCM in [-1, 1].
 */
export function synthesizeSampleCall(sampleRate: number = SAMPLE_CALL_SAMPLE_RATE): Float32Array {
  const total = Math.floor(SAMPLE_CALL_DURATION_SEC * sampleRate);
  const out = new Float32Array(total);
  const rand = mulberry32(0x5a4e4b);

  let phase = 0;
  let noiseLp = 0;
  const HARMONICS = 14;

  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    // 0 → calm, 1 → full distress (ramps across the transition segment)
    const d = smoothstep(14, 18, t);

    // ── Fundamental frequency ──
    const calmF0 = 165 + 12 * Math.sin(2 * Math.PI * 0.35 * t) + 6 * Math.sin(2 * Math.PI * 1.1 * t);
    const distressF0 = 390 + 25 * Math.sin(2 * Math.PI * 0.9 * t) + 14 * Math.sin(2 * Math.PI * 7.5 * t); // tremor
    const f0 = calmF0 * (1 - d) + distressF0 * d;
    phase += (2 * Math.PI * f0) / sampleRate;
    if (phase > 2 * Math.PI * 1000) phase -= 2 * Math.PI * 1000;

    // ── Harmonic source: strain flattens the spectral tilt ──
    const tilt = 1.25 - 0.85 * d;
    let voiced = 0;
    let norm = 0;
    for (let k = 1; k <= HARMONICS; k++) {
      if (k * f0 >= sampleRate / 2) break;
      const amp = 1 / Math.pow(k, tilt);
      voiced += amp * Math.sin(k * phase);
      norm += amp;
    }
    voiced /= norm;

    // ── Breath turbulence (high-passed noise), grows under distress ──
    const white = rand() * 2 - 1;
    noiseLp += 0.25 * (white - noiseLp);
    const breath = white - noiseLp;

    const env = speechEnvelope(t, d);
    const noiseMix = 0.03 + 0.32 * d;
    // Raised vocal effort: higher drive into a soft saturator (strained voice)
    const drive = 0.4 * (1 - d) + 4.5 * d;

    out[i] = 0.9 * Math.tanh(drive * env * ((1 - noiseMix) * voiced + noiseMix * breath));
  }

  // Short fades to avoid clicks at file boundaries
  const fade = Math.floor(0.02 * sampleRate);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out[i] *= g;
    out[total - 1 - i] *= g;
  }

  return out;
}

/** Encodes mono float PCM as a 16-bit little-endian WAV file */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

/** Builds the sample call as a `File`, ready for `AudioFileInputService.loadFile()` */
export function createSampleCallFile(): File {
  const wav = encodeWav(synthesizeSampleCall(), SAMPLE_CALL_SAMPLE_RATE);
  return new File([wav], SAMPLE_CALL_FILE_NAME, { type: 'audio/wav' });
}
