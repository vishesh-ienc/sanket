/**
 * Sanket Demo Scenarios Simulator Component
 * Provides preset test scenarios for reliable live demonstrations and judge evaluation,
 * allowing instant demonstration of multi-signal co-occurrence and single-signal ceiling.
 */

import { Play, RotateCcw, Volume2, ShieldAlert, Sparkles, Mic, Pause, KeyRound } from 'lucide-react';
import type { DemoScenarioKey } from '../utils/demoScenariosData';

interface DemoScenariosProps {
  activeScenario: DemoScenarioKey;
  onSelectScenario: (scenario: DemoScenarioKey) => void;
  isMonitoring: boolean;
}

export function DemoScenarios({
  activeScenario,
  onSelectScenario,
  isMonitoring,
}: DemoScenariosProps) {
  const scenarios: {
    key: DemoScenarioKey;
    label: string;
    icon: typeof Play;
    tag: string;
    description: string;
    accent: string;
  }[] = [
    {
      key: 'LIVE_MIC',
      label: 'Live Microphone',
      icon: Mic,
      tag: 'REAL-TIME',
      description: 'Stream live audio from your microphone through Web Audio API',
      accent: '#0ea5e9',
    },
    {
      key: 'NORMAL_SPEECH',
      label: 'Calm Conversational',
      icon: Volume2,
      tag: 'SCORE: ~10 (NORMAL)',
      description: 'Baseline pitch (~160Hz), normal RMS (~6%), balanced speech cadence',
      accent: '#10b981',
    },
    {
      key: 'PITCH_STRAIN_ONLY',
      label: 'Isolated Pitch Spike',
      icon: Play,
      tag: 'CEILING: <35 (ELEVATED)',
      description: 'Single acoustic channel anomaly (340Hz pitch); capped below HIGH RISK',
      accent: '#f59e0b',
    },
    {
      key: 'EXTENDED_SILENCE',
      label: 'Prolonged Silence',
      icon: Pause,
      tag: 'SCORE: ~25 (ELEVATED)',
      description: 'Extended pause (4.2s continuous silence) during active monitoring',
      accent: '#fbbf24',
    },
    {
      key: 'WHISPER_STRAIN',
      label: 'Strained Whisper',
      icon: Sparkles,
      tag: 'SCORE: ~32 (ELEVATED)',
      description: 'Abnormally low vocal energy with elevated zero-crossing turbulence',
      accent: '#c084fc',
    },
    {
      key: 'CODE_WORD_ONLY',
      label: 'Covert Code Word Trigger',
      icon: KeyRound,
      tag: 'BOOST: +25 PTS (ELEVATED)',
      description: 'Simulated phrase "Remember to feed the cat"; demonstrates bounded contextual boost (<70)',
      accent: '#f43f5e',
    },
    {
      key: 'MULTI_SIGNAL_DISTRESS',
      label: 'Multi-Signal Distress',
      icon: ShieldAlert,
      tag: 'CRITICAL: 75+ (HIGH RISK)',
      description: 'Pitch strain + volume spike + spectral centroid + high ZCR + persistence',
      accent: '#ef4444',
    },
    {
      key: 'MULTI_SIGNAL_WITH_CODE_WORD',
      label: 'Multi-Signal + Code Word',
      icon: ShieldAlert,
      tag: 'CRITICAL: 85+ (HIGH RISK)',
      description: 'Acoustic strain + high ZCR + prolonged silence + covert code word',
      accent: '#e11d48',
    },
    {
      key: 'TRANSIENT_PITCH_SPIKE',
      label: 'Transient Pitch Spike (Cough)',
      icon: Sparkles,
      tag: 'PHASE 8: SUPPRESSED',
      description: 'Short 2-frame pitch burst returning to baseline; demonstrates false-positive suppression without alert dispatch',
      accent: '#38bdf8',
    },
    {
      key: 'TRANSIENT_LOUD_EVENT',
      label: 'Transient Loud Exclamation',
      icon: Volume2,
      tag: 'PHASE 8: SUPPRESSED',
      description: 'Sudden brief volume burst; absorbed by temporal filter as isolated non-distress event',
      accent: '#2dd4bf',
    },
    {
      key: 'IRREGULAR_PAUSE_PATTERN',
      label: 'Irregular Pause Prosody',
      icon: Pause,
      tag: 'PHASE 8: PROSODY PROXY',
      description: 'Voice-derived fragmented speech & erratic pauses; non-medical prosodic regularity analysis',
      accent: '#a855f7',
    },
    {
      key: 'RECOVERY_NORMALIZING',
      label: 'Signals Normalizing',
      icon: RotateCcw,
      tag: 'EMA DECAY',
      description: 'Signals return to baseline; demonstrates smooth exponential score decay',
      accent: '#38bdf8',
    },
  ];

  return (
    <div className="demo-scenarios-card" id="demo-scenarios">
      <div className="scenarios-header">
        <div className="scenarios-title-group">
          <Sparkles size={16} className="scenarios-icon" />
          <h2 className="scenarios-title">Interactive Scenario Simulator</h2>
        </div>
        <span className="scenarios-badge">Hackathon Demonstration Mode</span>
      </div>

      <p className="scenarios-description">
        Demonstrate multi-signal correlation and the single-signal ceiling without relying solely on
        room acoustics. Select a preset below to observe live telemetry changes in the Sanket
        Console.
      </p>

      <div className="scenarios-grid">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isSelected = activeScenario === sc.key;

          return (
            <button
              key={sc.key}
              type="button"
              className={`scenario-btn ${isSelected ? 'scenario-btn-selected' : ''}`}
              onClick={() => onSelectScenario(sc.key)}
              disabled={!isMonitoring && sc.key !== 'LIVE_MIC'}
              style={{
                borderColor: isSelected ? sc.accent : 'rgba(255, 255, 255, 0.08)',
                boxShadow: isSelected ? `0 0 16px ${sc.accent}33` : 'none',
              }}
            >
              <div className="scenario-btn-top">
                <div
                  className="scenario-btn-icon"
                  style={{
                    backgroundColor: `${sc.accent}20`,
                    color: sc.accent,
                  }}
                >
                  <Icon size={14} />
                </div>
                <span className="scenario-btn-label">{sc.label}</span>
                <span
                  className="scenario-btn-tag"
                  style={{
                    backgroundColor: `${sc.accent}15`,
                    color: sc.accent,
                    borderColor: `${sc.accent}40`,
                  }}
                >
                  {sc.tag}
                </span>
              </div>
              <p className="scenario-btn-desc">{sc.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
