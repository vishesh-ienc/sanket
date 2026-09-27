/**
 * Sanket Covert Code-Word Detector (Phase 5)
 *
 * Provides deterministic, token-aware covert distress phrase spotter
 * operating on generic transcript streams without any React or browser API dependencies.
 *
 * Architectural & Privacy Invariants:
 * 1. Matching logic is 100% local and deterministic.
 * 2. Zero conversation transcript retention (transcripts are processed ephemerally and discarded).
 * 3. Token-aware boundary checks prevent accidental single-token or partial-word false triggers.
 * 4. Configurable cooldown window suppresses duplicate speech-recognition re-emissions.
 * 5. Code-word detection serves as a bounded contextual signal (+25 pts) and does NOT
 *    bypass the RiskEngine or independently claim certainty of danger.
 */

import type { CodeWordDetectorConfig, CodeWordDetection } from './types';

export const DEFAULT_CODE_WORD_CONFIG: CodeWordDetectorConfig = {
  phrase: 'Remember to feed the cat',
  enabled: true,
  cooldownMs: 5000,
  fuzzyTolerance: true,
  fuzzyThreshold: 0.85,
};

/**
 * Normalizes text deterministically:
 * - Lowercases all characters
 * - Strips harmless punctuation (periods, commas, exclamation points, quotes, dashes, etc.)
 * - Collapses repeated whitespace into single spaces and trims
 * - Extracts clean word tokens
 */
export function normalizeText(text: string): { normalized: string; tokens: string[] } {
  if (!text) {
    return { normalized: '', tokens: [] };
  }

  const cleaned = text
    .toLowerCase()
    // Replace harmless punctuation characters with spaces to preserve word boundaries
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'–—\\[\]<>]/g, ' ')
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned.length > 0 ? cleaned.split(' ').filter(Boolean) : [];

  return { normalized: cleaned, tokens };
}

/**
 * Calculates Levenshtein distance between two short strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val =
        a[i - 1] === b[j - 1]
          ? row[j - 1]
          : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }

  return row[b.length];
}

/**
 * Compares two tokens with optional small morphological tolerance.
 * Returns match score between 0.0 (mismatch) and 1.0 (exact match).
 */
export function compareTokens(target: string, candidate: string, fuzzyTolerance: boolean): number {
  if (target === candidate) {
    return 1.0;
  }

  if (!fuzzyTolerance) {
    return 0.0;
  }

  // Common speech-recognition morphological variations (plural/singular, simple tenses)
  const isPluralVariation =
    (candidate === `${target}s` || target === `${candidate}s`) ||
    (candidate === `${target}es` || target === `${candidate}es`);

  if (isPluralVariation) {
    return 0.95;
  }

  // Common verb suffix variation (e.g. feed vs feeding, call vs calling)
  const isVerbSuffixVariation =
    (candidate === `${target}ing` || target === `${candidate}ing`) ||
    (candidate === `${target}ed` || target === `${candidate}ed`);

  if (isVerbSuffixVariation) {
    return 0.92;
  }

  // Single character typo/misrecognition on words of sufficient length (>= 4 chars)
  if (target.length >= 4 && candidate.length >= 4) {
    const dist = levenshteinDistance(target, candidate);
    if (dist === 1) {
      return 0.90;
    }
  }

  return 0.0;
}

export class CodeWordDetector {
  private config: CodeWordDetectorConfig;
  private normalizedConfig: { normalized: string; tokens: string[] };
  private lastDetectionTimestamp: number | null = null;
  private lastDetection: CodeWordDetection | null = null;

  constructor(config?: Partial<CodeWordDetectorConfig> | string) {
    if (typeof config === 'string') {
      this.config = { ...DEFAULT_CODE_WORD_CONFIG, phrase: config };
    } else {
      this.config = { ...DEFAULT_CODE_WORD_CONFIG, ...(config ?? {}) };
    }
    this.normalizedConfig = normalizeText(this.config.phrase);
  }

  /**
   * Updates configuration or target phrase.
   */
  public configure(config: Partial<CodeWordDetectorConfig> | string): void {
    const oldPhrase = this.config.phrase;
    if (typeof config === 'string') {
      this.config = { ...this.config, phrase: config };
    } else {
      this.config = { ...this.config, ...config };
    }
    this.normalizedConfig = normalizeText(this.config.phrase);
    if (oldPhrase !== this.config.phrase) {
      this.lastDetectionTimestamp = null;
      this.lastDetection = null;
    }
  }

  /** Enables code-word monitoring */
  public enable(): void {
    this.config.enabled = true;
  }

  /** Disables code-word monitoring */
  public disable(): void {
    this.config.enabled = false;
  }

  /** Returns active configuration */
  public getConfig(): Readonly<CodeWordDetectorConfig> {
    return { ...this.config };
  }

  /** Returns the most recent detection result */
  public getLastDetection(): Readonly<CodeWordDetection | null> {
    return this.lastDetection ? { ...this.lastDetection } : null;
  }

  /** Resets temporal debounce and detection state */
  public reset(): void {
    this.lastDetectionTimestamp = null;
    this.lastDetection = null;
  }

  /**
   * Evaluates an incoming transcript text against the configured phrase.
   *
   * @param text Raw recognized utterance
   * @param timestamp Optional millisecond timestamp (defaults to Date.now())
   * @param sourceId Optional identifier of the transcript source
   */
  public processTranscript(
    text: string,
    timestamp?: number,
    sourceId?: string
  ): CodeWordDetection {
    const now = timestamp ?? Date.now();

    // 1. Guard: Check if detector is enabled or target phrase is empty
    if (!this.config.enabled) {
      return {
        detected: false,
        matchedPhrase: null,
        normalizedPhrase: this.normalizedConfig.normalized || null,
        confidence: 0,
        timestamp: now,
        reason: 'Code-word detector is currently disabled',
        sourceId,
      };
    }

    const targetTokens = this.normalizedConfig.tokens;
    if (targetTokens.length === 0) {
      return {
        detected: false,
        matchedPhrase: null,
        normalizedPhrase: null,
        confidence: 0,
        timestamp: now,
        reason: 'No code-word phrase configured',
        sourceId,
      };
    }

    // 2. Normalize incoming transcript text
    const { tokens: inputTokens } = normalizeText(text);

    // If input has fewer tokens than the target phrase, it cannot contain the full phrase
    if (inputTokens.length < targetTokens.length) {
      return {
        detected: false,
        matchedPhrase: null,
        normalizedPhrase: this.normalizedConfig.normalized,
        confidence: 0,
        timestamp: now,
        sourceId,
      };
    }

    // 3. Sliding window token-aware matching
    let bestConfidence = 0;
    let matchFound = false;
    let matchedSnippet: string | null = null;

    const windowSize = targetTokens.length;

    for (let i = 0; i <= inputTokens.length - windowSize; i++) {
      let windowScoreSum = 0;
      let windowMatches = true;

      for (let j = 0; j < windowSize; j++) {
        const targetToken = targetTokens[j];
        const candidateToken = inputTokens[i + j];
        const score = compareTokens(targetToken, candidateToken, this.config.fuzzyTolerance);

        if (score < 0.90) {
          windowMatches = false;
          break;
        }

        windowScoreSum += score;
      }

      if (windowMatches) {
        const avgConfidence = windowScoreSum / windowSize;
        if (avgConfidence >= this.config.fuzzyThreshold && avgConfidence > bestConfidence) {
          bestConfidence = avgConfidence;
          matchFound = true;
          matchedSnippet = inputTokens.slice(i, i + windowSize).join(' ');
        }
      }
    }

    // 4. Handle non-match
    if (!matchFound) {
      return {
        detected: false,
        matchedPhrase: null,
        normalizedPhrase: this.normalizedConfig.normalized,
        confidence: 0,
        timestamp: now,
        sourceId,
      };
    }

    // 5. Check cooldown / duplicate debounce window
    if (
      this.lastDetectionTimestamp !== null &&
      now - this.lastDetectionTimestamp < this.config.cooldownMs
    ) {
      const suppressedResult: CodeWordDetection = {
        detected: false,
        matchedPhrase: matchedSnippet,
        normalizedPhrase: this.normalizedConfig.normalized,
        confidence: bestConfidence,
        timestamp: now,
        reason: `Suppressed duplicate detection within ${this.config.cooldownMs}ms cooldown window`,
        sourceId,
      };
      this.lastDetection = suppressedResult;
      return suppressedResult;
    }

    // 6. Confirmed detection
    this.lastDetectionTimestamp = now;
    const confirmedResult: CodeWordDetection = {
      detected: true,
      matchedPhrase: matchedSnippet,
      normalizedPhrase: this.normalizedConfig.normalized,
      confidence: Math.round(bestConfidence * 100) / 100,
      timestamp: now,
      reason: 'Configured distress phrase detected',
      sourceId,
    };

    this.lastDetection = confirmedResult;
    return confirmedResult;
  }
}
