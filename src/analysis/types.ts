/**
 * Sanket Feature Extraction, Baseline, & Risk Engine Contracts
 * Pure TypeScript interfaces decoupled from browser DOM/React UI
 */

export interface FeatureSet {
  timestamp: number;
  rmsEnergy: number;
  pitchHz: number | null;
  zeroCrossingRate: number;
  spectralCentroid: number;
  isSpeech: boolean;
}

export interface BaselineProfile {
  userId: string;
  calibratedAt: number;
  pitchMean: number;
  pitchStdDev: number;
  energyMean: number;
  energyStdDev: number;
  normalSilenceThresholdSec: number;
  frameCount: number;
}

export type RiskLevel = 'NORMAL' | 'ELEVATED' | 'SUSPECTED' | 'CRITICAL';

export interface RiskEvent {
  id: string;
  timestamp: number;
  score: number;
  level: RiskLevel;
  contributingSignals: string[];
  details: {
    pitchZScore?: number;
    silenceDurationSec?: number;
    energyShiftRatio?: number;
    codeWordMatched?: boolean;
    [key: string]: unknown;
  };
}
