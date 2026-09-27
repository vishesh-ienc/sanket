/**
 * Sanket Transcript Source Abstraction (Phase 5)
 *
 * Defines the generic interface between speech-to-text transcript producers
 * (e.g. browser Web Speech, mobile OS listeners, VoIP adapters, or manual demo inputs)
 * and the downstream CodeWordDetector.
 *
 * Strict Privacy & Architectural Isolation:
 * - CodeWordDetector depends ONLY on this abstract interface, never on browser globals.
 * - Transcripts are ephemeral events; full conversation logs are NEVER stored.
 */

export interface TranscriptEvent {
  /** The recognized transcript text */
  text: string;
  /** Whether the recognition engine marked this result as final */
  isFinal: boolean;
  /** Optional confidence score from recognition provider (0.0 to 1.0) */
  confidence?: number;
  /** Millisecond timestamp when the utterance was recognized */
  timestamp: number;
  /** Origin identifier (e.g. 'manual', 'browser-speech-api', 'mock-source') */
  sourceId?: string;
}

export type TranscriptSourceStatus =
  | 'IDLE'
  | 'LISTENING'
  | 'UNSUPPORTED'
  | 'ERROR';

export interface TranscriptSource {
  /** Initializes and starts the transcript listener */
  start(): Promise<void> | void;
  /** Halts the transcript listener */
  stop(): void;
  /** Registers a listener callback for incoming transcript events */
  onTranscript(callback: (event: TranscriptEvent) => void): () => void;
  /** Returns the current operational status */
  getStatus(): TranscriptSourceStatus;
}
