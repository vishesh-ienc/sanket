/**
 * Sanket — Browser Speech Transcript Source (live code-word input)
 *
 * TranscriptSource adapter over the Web Speech API `SpeechRecognition`.
 *
 * Privacy modes:
 *  - 'on-device' (default): sets `processLocally = true` so recognition must
 *    run on this device (Chrome's on-device speech, language pack installed
 *    once via `SpeechRecognition.install`). Audio never leaves the device.
 *  - 'cloud': explicit opt-in only. The browser vendor's recognition service
 *    receives the microphone audio. The UI must disclose this before enabling.
 *
 * Transcripts are emitted as ephemeral events and never stored here.
 * Pure TypeScript over an injectable constructor — no React.
 */

import type { TranscriptEvent, TranscriptSource, TranscriptSourceStatus } from './transcriptTypes';

export type SpeechPrivacyMode = 'on-device' | 'cloud';
export type OnDeviceAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unknown';

export interface SpeechSupport {
  /** Browser exposes SpeechRecognition at all */
  apiAvailable: boolean;
  /** On-device availability for the language ('unknown' if the browser can't tell) */
  onDevice: OnDeviceAvailability;
}

/* Minimal structural types for the parts of the Web Speech API we use */
interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
export interface RecognitionResultEvent {
  resultIndex: number;
  results: { readonly length: number; [index: number]: RecognitionResult };
}
export interface RecognitionErrorEvent {
  error: string;
}
export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export interface RecognitionConstructorLike {
  new (): RecognitionLike;
  available?: (opts: { langs: string[]; processLocally: boolean }) => Promise<string>;
  install?: (opts: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
}

export function getRecognitionConstructor(
  globalObj: unknown = typeof window !== 'undefined' ? window : undefined,
): RecognitionConstructorLike | null {
  if (!globalObj) return null;
  const g = globalObj as { SpeechRecognition?: RecognitionConstructorLike; webkitSpeechRecognition?: RecognitionConstructorLike };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export async function checkSpeechSupport(
  lang: string,
  ctor: RecognitionConstructorLike | null = getRecognitionConstructor(),
): Promise<SpeechSupport> {
  if (!ctor) return { apiAvailable: false, onDevice: 'unavailable' };
  if (typeof ctor.available !== 'function') return { apiAvailable: true, onDevice: 'unknown' };
  try {
    const status = await ctor.available({ langs: [lang], processLocally: true });
    const known: OnDeviceAvailability[] = ['available', 'downloadable', 'downloading', 'unavailable'];
    return { apiAvailable: true, onDevice: known.includes(status as OnDeviceAvailability) ? (status as OnDeviceAvailability) : 'unknown' };
  } catch {
    return { apiAvailable: true, onDevice: 'unknown' };
  }
}

/** Downloads the on-device language pack. Must be called from a user gesture. */
export async function installOnDeviceSpeech(
  lang: string,
  ctor: RecognitionConstructorLike | null = getRecognitionConstructor(),
): Promise<boolean> {
  if (!ctor || typeof ctor.install !== 'function') return false;
  try {
    return await ctor.install({ langs: [lang], processLocally: true });
  } catch {
    return false;
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone or speech permission was denied.',
  'service-not-allowed': 'Speech recognition is blocked in this browser context.',
  'language-not-supported': 'On-device recognition is not installed for this language.',
  'audio-capture': 'No microphone was found for speech recognition.',
  network: 'Cloud speech recognition needs a network connection.',
};

export interface BrowserSpeechOptions {
  lang?: string;
  mode?: SpeechPrivacyMode;
  ctor?: RecognitionConstructorLike | null;
}

export class BrowserSpeechTranscriptSource implements TranscriptSource {
  private readonly lang: string;
  private readonly mode: SpeechPrivacyMode;
  private readonly ctor: RecognitionConstructorLike | null;
  private recognition: RecognitionLike | null = null;
  private status: TranscriptSourceStatus;
  private errorMessage: string | null = null;
  private wantRunning = false;
  private restarts = 0;
  private listeners = new Set<(e: TranscriptEvent) => void>();
  private statusListeners = new Set<(s: TranscriptSourceStatus) => void>();

  constructor(options: BrowserSpeechOptions = {}) {
    this.lang = options.lang ?? 'en-US';
    this.mode = options.mode ?? 'on-device';
    this.ctor = options.ctor === undefined ? getRecognitionConstructor() : options.ctor;
    this.status = this.ctor ? 'IDLE' : 'UNSUPPORTED';
  }

  getStatus(): TranscriptSourceStatus {
    return this.status;
  }

  getErrorMessage(): string | null {
    return this.errorMessage;
  }

  getMode(): SpeechPrivacyMode {
    return this.mode;
  }

  onTranscript(callback: (event: TranscriptEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onStatusChange(callback: (status: TranscriptSourceStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  start(): void {
    if (!this.ctor) {
      this.setStatus('UNSUPPORTED');
      return;
    }
    if (this.wantRunning) return;
    this.wantRunning = true;
    this.restarts = 0;
    this.errorMessage = null;
    this.launch();
  }

  stop(): void {
    this.wantRunning = false;
    if (this.recognition) {
      this.recognition.onend = null;
      try {
        this.recognition.abort();
      } catch {
        /* already stopped */
      }
      this.recognition = null;
    }
    if (this.status !== 'UNSUPPORTED') this.setStatus('IDLE');
  }

  private launch(): void {
    if (!this.ctor) return;
    const rec = new this.ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    // On-device mode MUST process locally; cloud mode is an explicit opt-in.
    rec.processLocally = this.mode === 'on-device';

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const alt = result[0];
        if (!alt) continue;
        const event: TranscriptEvent = {
          text: alt.transcript,
          isFinal: result.isFinal,
          confidence: alt.confidence,
          timestamp: Date.now(),
          sourceId: `browser-speech-${this.mode}`,
        };
        this.listeners.forEach((l) => l(event));
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return; // benign; onend restarts
      this.errorMessage = ERROR_MESSAGES[e.error] ?? `Speech recognition error: ${e.error}`;
      this.wantRunning = false;
      this.setStatus('ERROR');
    };

    rec.onend = () => {
      // Browsers end continuous sessions after silence; keep listening while wanted.
      if (this.wantRunning && this.restarts < 50) {
        this.restarts += 1;
        this.launch();
      } else if (this.status === 'LISTENING') {
        this.setStatus('IDLE');
      }
    };

    this.recognition = rec;
    try {
      rec.start();
      this.setStatus('LISTENING');
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Could not start speech recognition.';
      this.wantRunning = false;
      this.setStatus('ERROR');
    }
  }

  private setStatus(status: TranscriptSourceStatus): void {
    this.status = status;
    this.statusListeners.forEach((l) => l(status));
  }
}
