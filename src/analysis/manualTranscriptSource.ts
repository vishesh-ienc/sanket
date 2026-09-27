/**
 * Sanket Manual / Test Transcript Source (Phase 5)
 *
 * Deterministic in-memory implementation of TranscriptSource.
 * Used for automated unit tests, hackathon evaluator demonstrations,
 * and simulated covert trigger phrase injection.
 */

import type { TranscriptEvent, TranscriptSource, TranscriptSourceStatus } from './transcriptTypes';

export class ManualTranscriptSource implements TranscriptSource {
  private listeners: Set<(event: TranscriptEvent) => void> = new Set();
  private status: TranscriptSourceStatus = 'IDLE';

  public start(): void {
    this.status = 'LISTENING';
  }

  public stop(): void {
    this.status = 'IDLE';
  }

  public onTranscript(callback: (event: TranscriptEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getStatus(): TranscriptSourceStatus {
    return this.status;
  }

  /**
   * Deterministically dispatches a transcript event to all registered listeners.
   *
   * @param text Recognized utterance
   * @param timestamp Optional millisecond timestamp (defaults to Date.now())
   * @param isFinal Whether the recognition is considered final (default: true)
   */
  public emit(text: string, timestamp?: number, isFinal = true): void {
    const event: TranscriptEvent = {
      text,
      isFinal,
      timestamp: timestamp ?? Date.now(),
      sourceId: 'manual-transcript-source',
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Prevent listener exceptions from breaking the dispatch loop
      }
    }
  }

  /** Clears all registered listeners */
  public clearListeners(): void {
    this.listeners.clear();
  }
}
