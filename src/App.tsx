/**
 * Sanket Console — Main Application Shell (Phase 4)
 *
 * Full Multimodal Distress-Risk Detection Pipeline:
 *
 *   Real Microphone (getUserMedia + Web Audio API)
 *            ↓
 *   AudioInputService (AudioFrame @ 2048 FFT)
 *            ↓
 *   FeatureExtractor (FeatureSet @ 10Hz: Pitch, RMS, ZCR, Centroid, Silence, VAD)
 *            ↓
 *   RiskEngine (RiskEvaluation @ 10Hz: 0–100 Score, Level, Explainable Signals)
 *            ↓
 *   ┌───────────────────────────────────────────────┐
 *   │                 SANKET CONSOLE                │
 *   │                                               │
 *   │   RISK SCORE (72)       STATUS (HIGH RISK)    │
 *   │                                               │
 *   │   Live Waveform Oscilloscope                  │
 *   │   Signal Breakdown (6 Acoustic Channels)      │
 *   │   Detection Timeline & Real-time Sparkline    │
 *   │   Monitoring & Pipeline Status                │
 *   └───────────────────────────────────────────────┘
 *
 * Strict product positioning: Multimodal voice distress-RISK detection prototype.
 * Does not claim to certify emergency or danger.
 */

import { useState, useEffect } from 'react';
import {
  Shield,
  Radio,
  Square,
  AlertCircle,
  Loader2,
  Cpu,
  Lock,
  Layers,
} from 'lucide-react';
import { useAudioMonitor } from './audio/useAudioMonitor';
import { useFeatureExtractor } from './analysis/useFeatureExtractor';
import { useRiskEngine } from './analysis/useRiskEngine';
import { LiveWaveform } from './components/LiveWaveform';
import { RiskScoreGauge } from './components/RiskScoreGauge';
import { SignalBreakdown } from './components/SignalBreakdown';
import { DetectionTimeline } from './components/DetectionTimeline';
import { MonitoringStatus } from './components/MonitoringStatus';
import { DemoScenarios } from './components/DemoScenarios';
import {
  type DemoScenarioKey,
  getDemoScenarioFeatures,
} from './utils/demoScenariosData';
import type { FeatureSet } from './analysis/types';

export function App() {
  // ── Step 1: Microphone & Web Audio Engine (Phase 1) ───────────────────────
  const {
    monitoringState,
    activity,
    error,
    startMonitoring,
    stopMonitoring,
    audioService,
  } = useAudioMonitor({
    activeThresholdRms: 0.015,
  });

  const isLive = monitoringState === 'MONITORING_ACTIVE';
  const isRequesting = monitoringState === 'REQUESTING_PERMISSION';
  const isDenied = monitoringState === 'PERMISSION_DENIED';
  const isError = monitoringState === 'ERROR' || monitoringState === 'NOT_SUPPORTED';

  // ── Step 2: Feature Extraction Pipeline (Phase 2) ─────────────────────────
  const { latestFeatures: liveFeatures } = useFeatureExtractor(
    audioService,
    isLive,
    { intervalMs: 100 }
  );

  // ── Demo Simulator State (for reliable testing & judge presentation) ──────
  const [activeScenario, setActiveScenario] = useState<DemoScenarioKey>('LIVE_MIC');
  const [simulatedFeatures, setSimulatedFeatures] = useState<FeatureSet | null>(null);
  const [simTick, setSimTick] = useState<number>(0);

  // Drive demo simulator when a scenario is selected
  useEffect(() => {
    if (!isLive || activeScenario === 'LIVE_MIC') {
      const timer = setTimeout(() => {
        setSimulatedFeatures(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      setSimTick((t) => t + 1);
      const synth = getDemoScenarioFeatures(activeScenario, simTick, liveFeatures);
      setSimulatedFeatures(synth);
    }, 100);

    return () => clearInterval(interval);
  }, [isLive, activeScenario, simTick, liveFeatures]);

  // Active features fed to Risk Engine: simulator features if scenario active, else live
  const effectiveFeatures: FeatureSet | null =
    activeScenario === 'LIVE_MIC' ? liveFeatures : simulatedFeatures;

  // ── Step 3: Multi-Signal Risk Engine (Phase 3) ────────────────────────────
  const { latestEvaluation } = useRiskEngine(effectiveFeatures, isLive);

  // Derived evaluation values with safe defaults
  const currentScore = latestEvaluation?.riskScore ?? 0;
  const currentLevel = latestEvaluation?.riskLevel ?? 'NORMAL';
  const isConfirmed = latestEvaluation?.isConfirmed ?? false;
  const persistenceFrames = latestEvaluation?.persistenceFrames ?? 0;
  const confirmedSignals = latestEvaluation?.confirmedSignals ?? 0;

  // Sample rate from active audio service context or default
  const sampleRate = audioService?.getAnalyserNode()?.context.sampleRate ?? 48000;

  return (
    <div className="app-container" id="sanket-console-app">
      {/* Top Banner / Pipeline Trace */}
      <header className="console-top-nav">
        <div className="nav-brand">
          <div className="brand-shield-icon">
            <Shield size={20} strokeWidth={2.5} />
          </div>
          <div className="brand-text-wrap">
            <h1 className="console-main-title">SANKET CONSOLE</h1>
            <span className="console-main-sub">Non-Verbal Distress Detection System</span>
          </div>
        </div>

        {/* Pipeline Trace Visualizer */}
        <div className="pipeline-flow-pill">
          <span className="pipe-step active">Microphone</span>
          <span className="pipe-arrow">→</span>
          <span className="pipe-step active">Feature Extractor</span>
          <span className="pipe-arrow">→</span>
          <span className="pipe-step active">Risk Engine</span>
          <span className="pipe-arrow">→</span>
          <span className="pipe-step active highlight">Console</span>
        </div>

        {/* Primary Action Button */}
        <div className="nav-controls">
          {isLive ? (
            <button
              type="button"
              className="cta-button cta-button-stop"
              id="stop-monitoring-btn"
              onClick={stopMonitoring}
            >
              <Square size={15} fill="currentColor" />
              <span>HALT MONITORING</span>
            </button>
          ) : isDenied || isError ? (
            <button
              type="button"
              className="cta-button cta-button-retry"
              id="retry-monitoring-btn"
              onClick={startMonitoring}
            >
              <Radio size={16} />
              <span>RETRY AUDIO ACCESS</span>
            </button>
          ) : (
            <button
              type="button"
              className="cta-button cta-button-start"
              id="start-monitoring-btn"
              disabled={isRequesting}
              onClick={startMonitoring}
            >
              {isRequesting ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  <span>INITIALIZING DSP...</span>
                </>
              ) : (
                <>
                  <Radio size={16} />
                  <span>START MONITORING</span>
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Error / Permission Guidance Banner */}
      {error && (
        <div className="error-banner" role="alert">
          <div className="error-banner-header">
            <AlertCircle size={16} />
            <span>{isDenied ? 'Microphone Access Required' : 'Audio Hardware Notice'}</span>
          </div>
          <p className="error-banner-body">{error.userMessage}</p>
        </div>
      )}

      {/* Main Console Grid */}
      <main className="console-dashboard-layout">
        {/* ROW 1: Hero Dual-Card Section — Risk Score & Live Oscilloscope */}
        <section className="console-row hero-row">
          {/* 1. RISK SCORE & STATUS HUD */}
          <div className="console-card risk-gauge-card">
            <RiskScoreGauge
              score={currentScore}
              level={currentLevel}
              isConfirmed={isConfirmed}
              persistenceFrames={persistenceFrames}
              confirmedSignals={confirmedSignals}
              isMonitoring={isLive}
            />
          </div>

          {/* 2. LIVE WAVEFORM OSCILLOSCOPE */}
          <div className="console-card waveform-card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-icon-dot" />
                <h2 className="card-title">Live PCM Waveform Oscilloscope</h2>
              </div>
              <span className="card-badge">60 FPS Hardware Render</span>
            </div>

            <p className="waveform-desc">
              Real-time time-domain audio samples from AnalyserNode (FFT Size: 2048).
            </p>

            <LiveWaveform
              audioService={audioService}
              isActive={isLive}
              height={140}
            />

            <div className="waveform-footer">
              <span className="waveform-metric">
                VAD State:{' '}
                <strong>
                  {effectiveFeatures?.isSpeech ? 'VOICED' : 'QUIET'}
                </strong>
              </span>
              <span className="waveform-metric">
                Energy: <strong>{((activity.rmsEnergy) * 100).toFixed(2)}%</strong>
              </span>
              <span className="waveform-metric">
                Sample Rate: <strong>{(sampleRate / 1000).toFixed(1)} kHz</strong>
              </span>
            </div>
          </div>
        </section>

        {/* ROW 2: Signal Breakdown (All 6 Acoustic Channels) */}
        <section className="console-row">
          <SignalBreakdown
            features={effectiveFeatures}
            evaluation={latestEvaluation}
            isMonitoring={isLive}
          />
        </section>

        {/* ROW 3: Detection Timeline & Monitoring Status Side-by-Side */}
        <section className="console-row split-row">
          {/* 3. DETECTION TIMELINE */}
          <div className="console-col">
            <DetectionTimeline
              currentEvaluation={latestEvaluation}
              isMonitoring={isLive}
            />
          </div>

          {/* 4. MONITORING & PIPELINE STATUS */}
          <div className="console-col">
            <MonitoringStatus
              isMonitoring={isLive}
              activity={activity}
              features={effectiveFeatures}
              sampleRate={sampleRate}
            />
          </div>
        </section>

        {/* ROW 4: Interactive Preset Scenarios (Hackathon Evaluator) */}
        <section className="console-row">
          <DemoScenarios
            activeScenario={activeScenario}
            onSelectScenario={(sc) => setActiveScenario(sc)}
            isMonitoring={isLive}
          />
        </section>
      </main>

      {/* Footer Bar */}
      <footer className="console-footer">
        <div className="footer-left">
          <Lock size={12} />
          <span>Local-First DSP • Zero Cloud Streaming</span>
        </div>
        <div className="footer-center">
          <span>Sanket — Non-Verbal Distress-Risk Detection Prototype</span>
        </div>
        <div className="footer-right">
          <Cpu size={12} />
          <span>React 19 + TypeScript + Web Audio API</span>
          <span className="footer-sep">•</span>
          <Layers size={12} />
          <span>Phase 4 Console Active</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
