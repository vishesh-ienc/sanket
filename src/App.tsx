/**
 * Sanket Console — Main Application Shell (Final Demo Console)
 *
 * Sanket is a configurable voice distress-risk detection system.
 * It can be attached to different audio sources; the detection engine
 * is fully source-agnostic.
 *
 * Pipeline (source-agnostic):
 *
 *   ┌────────────────────────────────────────────┐
 *   │  AUDIO SOURCE (Microphone or File)         │
 *   │  → AudioInputService / AudioFileInputService│
 *   └─────────────────┬──────────────────────────┘
 *                     ↓  AudioFrame (normalized)
 *            FeatureExtractor  (pitch, RMS, ZCR, centroid, VAD, silence)
 *                     ↓  FeatureSet
 *            Personal Voice Baseline  (deviation Z-scores)
 *                     ↓
 *            Temporal Context  (stability, false-positive filter)
 *                     ↓
 *            Risk Engine  (multi-signal fusion, 0–100 score)
 *                     ↓
 *            HIGH_RISK Confirmation Gate
 *                     ↓
 *            Silent Alert Dispatch + Forensic Audit
 *
 * Strict positioning: multimodal voice distress-RISK detection prototype.
 * Does NOT claim to certify emergency or danger.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  Lock,
  Cpu,
  Layers,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { useAudioMonitor } from './audio/useAudioMonitor';
import { useAudioFileMonitor } from './audio/useAudioFileMonitor';
import { useFeatureExtractor } from './analysis/useFeatureExtractor';
import { useRiskEngine } from './analysis/useRiskEngine';
import { useCodeWordDetector } from './analysis/useCodeWordDetector';
import { useCalibration } from './analysis/useCalibration';
import { useTemporalContext } from './analysis/useTemporalContext';
import { useIncidentManager } from './services/useIncidentManager';
import { calculateBaselineDeviation } from './analysis/baselineDeviation';
import { LiveWaveform } from './components/LiveWaveform';
import { RiskScoreGauge } from './components/RiskScoreGauge';
import { SignalBreakdown } from './components/SignalBreakdown';
import { DetectionTimeline } from './components/DetectionTimeline';
import { MonitoringStatus } from './components/MonitoringStatus';
import { CodeWordConfig } from './components/CodeWordConfig';
import { CalibrationPanel } from './components/CalibrationPanel';
import { TemporalContextCard } from './components/TemporalContextCard';
import { IncidentBanner } from './components/IncidentBanner';
import { ForensicEventModal } from './components/ForensicEventModal';
import { AlertHistory } from './components/AlertHistory';
import { DemoScenarios } from './components/DemoScenarios';
import { AudioSourcePanel } from './components/AudioSourcePanel';
import type { AudioSourceMode } from './components/AudioSourcePanel';
import {
  type DemoScenarioKey,
  getDemoScenarioFeatures,
} from './utils/demoScenariosData';
import { JudgeDemoPanel } from './components/JudgeDemoPanel';
import { useDemoController } from './demo/useDemoController';
import type { DemoStepDefinition } from './demo/types';
import type { FeatureSet, IncidentContext } from './analysis/types';

export function App() {
  // ── Audio Source Selection ─────────────────────────────────────────────
  const [audioSourceMode, setAudioSourceMode] = useState<AudioSourceMode>('MICROPHONE');

  // ── Source A: Live Microphone (Phase 1) ───────────────────────────────
  const {
    monitoringState,
    activity: micActivity,
    error: micError,
    startMonitoring,
    stopMonitoring,
    audioService: micService,
  } = useAudioMonitor({ activeThresholdRms: 0.015 });

  const isMicLive = monitoringState === 'MONITORING_ACTIVE';

  // ── Source B: Pre-recorded Audio File ────────────────────────────────
  const {
    service: fileService,
    playbackStatus: fileStatus,
    activity: fileActivity,
    isPlaying: isFilePlaying,
    loadFile,
    playFile,
    pauseFile,
    restartFile,
  } = useAudioFileMonitor();

  // ── Unified "is monitoring active" signal ────────────────────────────
  const isLive =
    audioSourceMode === 'MICROPHONE' ? isMicLive : isFilePlaying;

  const activity =
    audioSourceMode === 'MICROPHONE' ? micActivity : fileActivity;

  // The active audio service fed into feature extractor
  // AudioFileInputService has the same getCurrentFrame / getAnalyserNode interface
  // We pass the correct service to useFeatureExtractor via a unified ref
  const activeAudioService =
    audioSourceMode === 'MICROPHONE'
      ? micService
      : (fileService as unknown as typeof micService); // same interface shape

  const activeAnalyserNode =
    audioSourceMode === 'MICROPHONE'
      ? micService?.getAnalyserNode() ?? null
      : fileService.getAnalyserNode();

  const sampleRate =
    activeAnalyserNode?.context.sampleRate ?? 48000;

  // ── Step 2: Feature Extraction Pipeline (Phase 2) ─────────────────────
  const { latestFeatures: liveFeatures } = useFeatureExtractor(
    activeAudioService,
    isLive,
    { intervalMs: 100 }
  );

  // ── Demo Simulator State ──────────────────────────────────────────────
  const [activeScenario, setActiveScenario] = useState<DemoScenarioKey>('LIVE_MIC');
  const [simulatedFeatures, setSimulatedFeatures] = useState<FeatureSet | null>(null);

  useEffect(() => {
    if (!isLive || activeScenario === 'LIVE_MIC') {
      const timer = setTimeout(() => setSimulatedFeatures(null), 0);
      return () => clearTimeout(timer);
    }

    // A single steady 10Hz clock per scenario. Must not depend on live
    // features — re-creating the interval on every mic frame starves the
    // synthetic stream and stalls persistence below the HIGH_RISK gate.
    let tick = 0;
    const interval = setInterval(() => {
      tick += 1;
      setSimulatedFeatures(getDemoScenarioFeatures(activeScenario, tick, null));
    }, 100);

    return () => clearInterval(interval);
  }, [isLive, activeScenario]);

  const effectiveFeatures: FeatureSet | null =
    activeScenario === 'LIVE_MIC' ? liveFeatures : simulatedFeatures;

  // ── Step 3: Multi-Signal Risk Engine (Phase 3) ────────────────────────
  const { latestEvaluation, injectExternalSignal, engine: riskEngineInstance } =
    useRiskEngine(effectiveFeatures, isLive);

  // ── Step 4: Covert Code-Word Detector (Phase 5) ───────────────────────
  const {
    config: codeWordConfig,
    latestDetection: codeWordDetection,
    updatePhrase: updateCodeWordPhrase,
    toggleEnabled: toggleCodeWordEnabled,
    processTranscript: runCodeWordTranscript,
  } = useCodeWordDetector({
    onDetection: (detection) => {
      injectExternalSignal(25, 25, {
        signal: 'codeWord',
        reason: detection.reason ?? 'Configured distress phrase detected',
      });
    },
  });

  // ── Step 5: Personal Voice Baseline (Phase 6) ─────────────────────────
  const {
    calibrationState,
    startCalibration,
    cancelCalibration,
    finalizeCalibration,
    clearBaseline,
    loadPresetProfile,
  } = useCalibration(effectiveFeatures, isLive, { riskEngine: riskEngineInstance });

  // ── Step 6: Baseline Deviations ───────────────────────────────────────
  const baselineDevResult =
    calibrationState.status === 'COMPLETE' && calibrationState.profile && effectiveFeatures
      ? calculateBaselineDeviation(effectiveFeatures, calibrationState.profile)
      : null;

  const baselineDeviations =
    baselineDevResult && baselineDevResult.baselineAvailable
      ? {
          pitch: baselineDevResult.pitchZScore ?? undefined,
          rms: baselineDevResult.energyZScore ?? undefined,
          silence: baselineDevResult.silenceExcessRatio ?? undefined,
          spectral: baselineDevResult.spectralZScore ?? undefined,
          zcr: baselineDevResult.zcrZScore ?? undefined,
        }
      : undefined;

  // ── Step 7: Temporal Context & False-Positive Filter (Phase 8) ────────
  const { temporalContext } = useTemporalContext(effectiveFeatures, baselineDevResult, isLive);

  // ── Step 8: Incident Context (Phase 7) ────────────────────────────────
  const incidentContext: IncidentContext = {
    source:
      audioSourceMode === 'FILE'
        ? 'SIMULATION'
        : activeScenario === 'LIVE_MIC'
        ? 'MICROPHONE'
        : 'SIMULATION',
    baselineAvailable:
      calibrationState.status === 'COMPLETE' && calibrationState.profile !== null,
    baselineDeviations,
    codeWordDetected: codeWordDetection?.detected ?? false,
    featureSnapshot: effectiveFeatures
      ? {
          pitchHz: effectiveFeatures.pitchHz,
          rms: effectiveFeatures.rmsEnergy,
          voiceActivity: effectiveFeatures.isSpeech ? 1 : 0,
          silenceDurationSec: effectiveFeatures.silenceDurationSec,
          spectralCentroid: effectiveFeatures.spectralCentroid,
          zeroCrossingRate: effectiveFeatures.zeroCrossingRate,
        }
      : undefined,
    temporalContext: temporalContext ?? undefined,
  };

  const {
    currentIncident,
    alertHistory,
    isModalOpen,
    modalIncident,
    acknowledgeIncident,
    resolveIncident,
    clearAlertHistory,
    openModal,
    closeModal,
  } = useIncidentManager(latestEvaluation, {
    context: incidentContext,
    isActive: isLive,
  });

  // ── Scenario selector handler ─────────────────────────────────────────
  const handleSelectScenario = useCallback(
    (scenario: DemoScenarioKey) => {
      setActiveScenario(scenario);
      if (scenario === 'CODE_WORD_ONLY' || scenario === 'MULTI_SIGNAL_WITH_CODE_WORD') {
        setTimeout(() => {
          runCodeWordTranscript(
            `Please ${codeWordConfig.phrase} when you get home tonight.`,
            Date.now(),
            'demo-transcript'
          );
        }, 150);
      }
    },
    [codeWordConfig.phrase, runCodeWordTranscript]
  );

  // ── Guided Judge Demo Controller (Phase 9) ───────────────────────────
  const {
    state: demoState,
    steps: demoSteps,
    startDemo,
    nextStep: nextDemoStep,
    prevStep: prevDemoStep,
    goToStep: goToDemoStep,
    resetDemo,
  } = useDemoController();

  const [pendingEvidenceOpen, setPendingEvidenceOpen] = useState(false);

  useEffect(() => {
    if (!pendingEvidenceOpen || !currentIncident) return;
    const timer = setTimeout(() => {
      setPendingEvidenceOpen(false);
      openModal(currentIncident);
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingEvidenceOpen, currentIncident, openModal]);

  const applyDemoStep = useCallback(
    (targetStep: DemoStepDefinition) => {
      if (!isMicLive) startMonitoring();
      // Always use MICROPHONE source for the guided demo
      setAudioSourceMode('MICROPHONE');
      if (targetStep.autoCalibrate && calibrationState.status !== 'COMPLETE') {
        loadPresetProfile();
      }
      handleSelectScenario(targetStep.scenario);
      if (targetStep.autoOpenModal) {
        if (currentIncident) {
          openModal(currentIncident);
        } else {
          // Presenter advanced before HIGH_RISK confirmation latched —
          // open the evidence as soon as the incident is created.
          setPendingEvidenceOpen(true);
        }
      } else {
        setPendingEvidenceOpen(false);
      }
    },
    [
      isMicLive,
      startMonitoring,
      calibrationState.status,
      loadPresetProfile,
      handleSelectScenario,
      currentIncident,
      openModal,
    ]
  );

  const handleStartDemo = () => {
    const nextState = startDemo();
    if (nextState.step) applyDemoStep(nextState.step);
  };

  const handleNextDemoStep = () => {
    const nextState = nextDemoStep();
    if (nextState.step) applyDemoStep(nextState.step);
  };

  const handlePrevDemoStep = () => {
    const nextState = prevDemoStep();
    if (nextState.step) applyDemoStep(nextState.step);
  };

  const handleGoToDemoStep = (idx: number) => {
    const nextState = goToDemoStep(idx);
    if (nextState.step) applyDemoStep(nextState.step);
  };

  const handleResetDemoTour = () => {
    resetDemo();
    setPendingEvidenceOpen(false);
    handleSelectScenario('LIVE_MIC');
  };

  // ── UI: Secondary panel toggle ────────────────────────────────────────
  const [showSecondary, setShowSecondary] = useState(false);

  // Derived evaluation values
  const currentScore = latestEvaluation?.riskScore ?? 0;
  const currentLevel = latestEvaluation?.riskLevel ?? 'NORMAL';
  const isConfirmed = latestEvaluation?.isConfirmed ?? false;
  const persistenceFrames = latestEvaluation?.persistenceFrames ?? 0;
  const confirmedSignals = latestEvaluation?.confirmedSignals ?? 0;

  // Display analyser node from active source for oscilloscope
  const waveformAnalyserNode = activeAnalyserNode;

  return (
    <div className="app-container" id="sanket-console-app">
      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <header className="console-top-nav">
        <div className="nav-brand">
          <div className="brand-shield-icon">
            <Shield size={20} strokeWidth={2.5} />
          </div>
          <div className="brand-text-wrap">
            <h1 className="console-main-title">SANKET CONSOLE</h1>
            <span className="console-main-sub">Voice Distress-Risk Detection Engine</span>
          </div>
        </div>

        {/* Pipeline trace (compact) */}
        <div className="pipeline-flow-pill">
          <span className={`pipe-step ${isLive ? 'active' : 'pipe-step-dim'}`}>
            {audioSourceMode === 'FILE' ? 'File Audio' : 'Microphone'}
          </span>
          <span className="pipe-arrow">→</span>
          <span className="pipe-step active">Features</span>
          <span className={`pipe-step ${calibrationState.status === 'COMPLETE' ? 'active baseline-active' : 'pipe-step-dim'}`}>
            Baseline
          </span>
          <span className="pipe-arrow">→</span>
          <span className="pipe-step active">Risk Engine</span>
          <span className="pipe-arrow">→</span>
          <span className={`pipe-step active ${temporalContext?.isTransient ? 'temporal-transient' : ''}`}>
            Temporal Filter
          </span>
          <span className="pipe-arrow">→</span>
          <span className={`pipe-step ${currentIncident ? 'active alert-step-active' : 'pipe-step-dim'}`}>
            Alert Dispatch
          </span>
        </div>

        <div className="nav-controls">
          <span className={`nav-source-badge ${isLive ? 'nav-source-live' : ''}`}>
            {isLive
              ? audioSourceMode === 'FILE'
                ? '● FILE ANALYZING'
                : '● MIC LIVE'
              : '○ STANDBY'}
          </span>
        </div>
      </header>

      {/* Error Banner */}
      {micError && audioSourceMode === 'MICROPHONE' && (
        <div className="error-banner" role="alert">
          <div className="error-banner-header">
            <AlertCircle size={16} />
            <span>
              {monitoringState === 'PERMISSION_DENIED'
                ? 'Microphone Access Required'
                : 'Audio Hardware Notice'}
            </span>
          </div>
          <p className="error-banner-body">{micError.userMessage}</p>
        </div>
      )}

      {/* Active Incident Banner */}
      <IncidentBanner
        incident={currentIncident}
        onViewEvent={() => openModal(currentIncident)}
        onAcknowledge={() => acknowledgeIncident(currentIncident?.id)}
      />

      {/* ── Main Console Grid ─────────────────────────────────────────── */}
      <main className="console-dashboard-layout">

        {/* ROW 0: Guided Judge Demo Panel */}
        <section className="console-row">
          <JudgeDemoPanel
            controllerState={demoState}
            steps={demoSteps}
            onStartDemo={handleStartDemo}
            onNextStep={handleNextDemoStep}
            onPrevStep={handlePrevDemoStep}
            onGoToStep={handleGoToDemoStep}
            onResetDemo={handleResetDemoTour}
            isMonitoring={isLive}
            onStartMonitoring={startMonitoring}
            awaitingConfirmation={
              demoState.isActive &&
              (demoState.step?.id === 'SILENT_ALERT' || demoState.step?.id === 'FORENSIC_REVIEW') &&
              !currentIncident
            }
          />
        </section>

        {/* ROW 1: Audio Source Panel */}
        <section className="console-row">
          <AudioSourcePanel
            activeSource={audioSourceMode}
            onSelectSource={setAudioSourceMode}
            monitoringState={monitoringState}
            onStartMic={startMonitoring}
            onStopMic={stopMonitoring}
            micError={micError}
            fileStatus={fileStatus}
            onLoadFile={loadFile}
            onPlayFile={playFile}
            onPauseFile={pauseFile}
            onRestartFile={restartFile}
          />
        </section>

        {/* ROW 2: Hero — Risk Score + Live Waveform */}
        <section className="console-row hero-row">
          {/* Risk Score HUD */}
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

          {/* Live Waveform */}
          <div className="console-card waveform-card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-icon-dot" />
                <h2 className="card-title">
                  {audioSourceMode === 'FILE' ? 'File Audio Waveform' : 'Live PCM Waveform Oscilloscope'}
                </h2>
              </div>
              <span className="card-badge">
                {audioSourceMode === 'FILE' ? 'FILE ANALYSIS' : '60 FPS Hardware Render'}
              </span>
            </div>

            <p className="waveform-desc">
              {audioSourceMode === 'FILE'
                ? 'Time-domain analysis of pre-recorded audio — same pipeline as live microphone.'
                : 'Real-time time-domain audio samples from AnalyserNode (FFT Size: 2048).'}
            </p>

            <LiveWaveform
              audioService={
                audioSourceMode === 'MICROPHONE'
                  ? micService
                  : { getAnalyserNode: () => waveformAnalyserNode, getIsRunning: () => isFilePlaying } as unknown as typeof micService
              }
              isActive={isLive}
              height={140}
            />

            <div className="waveform-footer">
              <span className="waveform-metric">
                VAD State:{' '}
                <strong>{effectiveFeatures?.isSpeech ? 'VOICED' : 'QUIET'}</strong>
              </span>
              <span className="waveform-metric">
                Energy: <strong>{(activity.rmsEnergy * 100).toFixed(2)}%</strong>
              </span>
              <span className="waveform-metric">
                Sample Rate: <strong>{(sampleRate / 1000).toFixed(1)} kHz</strong>
              </span>
              <span className="waveform-metric">
                Source:{' '}
                <strong>
                  {audioSourceMode === 'FILE'
                    ? `FILE — ${fileStatus.fileName ?? 'unknown'}`
                    : 'MICROPHONE'}
                </strong>
              </span>
            </div>
          </div>
        </section>

        {/* ROW 3: Signal Breakdown */}
        <section className="console-row">
          <SignalBreakdown
            features={effectiveFeatures}
            evaluation={latestEvaluation}
            isMonitoring={isLive}
          />
        </section>

        {/* ROW 4: Temporal Stability */}
        <section className="console-row">
          <TemporalContextCard
            temporalContext={temporalContext}
            isMonitoring={isLive}
          />
        </section>

        {/* ROW 5: Detection Timeline + Monitoring Status */}
        <section className="console-row split-row">
          <div className="console-col">
            <DetectionTimeline
              currentEvaluation={latestEvaluation}
              isMonitoring={isLive}
              codeWordDetection={codeWordDetection}
            />
          </div>
          <div className="console-col">
            <MonitoringStatus
              isMonitoring={isLive}
              activity={activity}
              features={effectiveFeatures}
              sampleRate={sampleRate}
            />
          </div>
        </section>

        {/* ROW 6: Alert History */}
        <section className="console-row">
          <AlertHistory
            history={alertHistory}
            onSelectIncident={(inc) => openModal(inc)}
            onClearHistory={clearAlertHistory}
          />
        </section>

        {/* ROW 7: Interactive Scenario Simulator */}
        <section className="console-row">
          <DemoScenarios
            activeScenario={activeScenario}
            onSelectScenario={handleSelectScenario}
            isMonitoring={isLive}
          />
        </section>

        {/* ── ROW 8: System Configuration Overview (Section 9) ── */}
        <section className="console-row">
          <div className="console-card config-overview-card" id="config-overview-panel">
            <div className="card-header">
              <div className="card-title-group">
                <SlidersHorizontal size={16} className="card-icon" />
                <h2 className="card-title">System Configuration Status</h2>
                <span className="card-badge">Section 9 Parameter State</span>
              </div>
              <button
                type="button"
                className="config-toggle-btn"
                id="toggle-secondary-detail"
                onClick={() => setShowSecondary((v) => !v)}
              >
                {showSecondary ? (
                  <>
                    <ChevronUp size={14} />
                    <span>HIDE DETAILED CONTROLS</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    <span>CONFIGURE PARAMETERS</span>
                  </>
                )}
              </button>
            </div>

            <div className="config-overview-grid">
              <div className="config-overview-item">
                <span className="config-overview-label">Personal Voice Baseline:</span>
                <span className={`config-overview-badge ${calibrationState.status === 'COMPLETE' ? 'cfg-active' : 'cfg-idle'}`}>
                  {calibrationState.status === 'COMPLETE'
                    ? '● ACTIVE (Deviation Z-Scores)'
                    : '○ UNCALIBRATED (Heuristic Norms)'}
                </span>
              </div>
              <div className="config-overview-item">
                <span className="config-overview-label">Covert Code-Word:</span>
                <span className={`config-overview-badge ${codeWordConfig.enabled ? 'cfg-active' : 'cfg-idle'}`}>
                  {codeWordConfig.enabled
                    ? `● CONFIGURED ("${codeWordConfig.phrase}")`
                    : '○ DISABLED'}
                </span>
              </div>
              <div className="config-overview-item">
                <span className="config-overview-label">Analysis Mode:</span>
                <span className="config-overview-badge cfg-active">
                  ● MULTI-SIGNAL CORRELATION
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Secondary technical panels — hidden by default for judges */}
        {showSecondary && (
          <>
            {/* Code-Word Configuration */}
            <section className="console-row">
              <CodeWordConfig
                config={codeWordConfig}
                latestDetection={codeWordDetection}
                onUpdatePhrase={updateCodeWordPhrase}
                onToggleEnabled={toggleCodeWordEnabled}
                onTestTranscript={(text) =>
                  runCodeWordTranscript(text, Date.now(), 'manual-test')
                }
              />
            </section>

            {/* Personal Voice Baseline Calibration */}
            <section className="console-row">
              <CalibrationPanel
                calibrationState={calibrationState}
                isMonitoring={isLive}
                onStart={startCalibration}
                onCancel={cancelCalibration}
                onFinalize={finalizeCalibration}
                onClear={clearBaseline}
              />
            </section>
          </>
        )}
      </main>

      {/* Forensic Event Modal */}
      <ForensicEventModal
        isOpen={isModalOpen}
        incident={modalIncident}
        onClose={closeModal}
        onAcknowledge={acknowledgeIncident}
        onResolve={resolveIncident}
      />

      {/* Footer */}
      <footer className="console-footer">
        <div className="footer-left">
          <Lock size={12} />
          <span>Local-First DSP • Zero Cloud Streaming • Zero Raw Audio Retention</span>
        </div>
        <div className="footer-center">
          <span>Sanket — Voice Distress-Risk Detection Engine • Source-Agnostic Pipeline</span>
        </div>
        <div className="footer-right">
          <Cpu size={12} />
          <span>React 19 + TypeScript + Web Audio API</span>
          <span className="footer-sep">•</span>
          <Layers size={12} />
          <span>Final Demo Console ✓</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
