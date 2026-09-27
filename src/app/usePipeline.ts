/**
 * Sanket — Pipeline orchestration hook
 *
 * Wires every stage of the source-agnostic pipeline together:
 *
 *   Source (microphone | demo conversation | uploaded file | simulated scenario)
 *     → FeatureExtractor → Personal baseline → Temporal context
 *     → RiskEngine (+ code word from live speech / transcript track)
 *     → IncidentManager → silent alert (simulated) → forensic audit
 *
 * Views read everything from this single object via PipelineContext.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioMonitor } from '@/audio/useAudioMonitor';
import { useAudioFileMonitor } from '@/audio/useAudioFileMonitor';
import { useFeatureExtractor } from '@/analysis/useFeatureExtractor';
import { useRiskEngine } from '@/analysis/useRiskEngine';
import { useCodeWordDetector } from '@/analysis/useCodeWordDetector';
import { useCalibration } from '@/analysis/useCalibration';
import { useTemporalContext } from '@/analysis/useTemporalContext';
import { useLiveSpeech } from '@/analysis/useLiveSpeech';
import { useIncidentManager } from '@/services/useIncidentManager';
import { useTrustedContacts } from '@/services/useTrustedContacts';
import { calculateBaselineDeviation } from '@/analysis/baselineDeviation';
import {
  loadSignalSettings,
  saveSignalSettings,
  toRiskEngineOverrides,
  DEFAULT_SIGNAL_SETTINGS,
  type SignalSettings,
} from '@/analysis/signalSettings';
import { getDemoScenarioFeatures, type DemoScenarioKey } from '@/utils/demoScenariosData';
import { useDemoController } from '@/demo/useDemoController';
import type { DemoStepDefinition } from '@/demo/types';
import type { FeatureSet, IncidentContext, RiskLevel } from '@/analysis/types';
import {
  activeCue,
  fetchDemoConversation,
  fetchDemoConversationAudio,
  DEMO_CONVERSATION_MANIFESTS,
  type DemoConversation,
} from '@/audio/demoConversations';
import { appendEvent, levelChangeEvent, makeEvent, transientFilteredEvent, type ActivityEvent } from './activity';

export type SourceKind = 'mic' | 'conversation' | 'file';

/** ~1.2 s at 10 Hz before a (non-alert) level change is posted to the feed */
const LEVEL_SETTLE_FRAMES = 12;

export function usePipeline() {
  // ── Sources ────────────────────────────────────────────────────────────
  const [sourceKind, setSourceKind] = useState<SourceKind>('conversation');
  const mic = useAudioMonitor({ activeThresholdRms: 0.015 });
  const file = useAudioFileMonitor();

  const isMicLive = mic.monitoringState === 'MONITORING_ACTIVE';
  const isAudioLive = sourceKind === 'mic' ? isMicLive : file.isPlaying;

  const activeAudioService = sourceKind === 'mic' ? mic.audioService : (file.service as unknown as typeof mic.audioService);
  const analyserNode = sourceKind === 'mic' ? (mic.audioService?.getAnalyserNode() ?? null) : file.service.getAnalyserNode();
  const sampleRate = analyserNode?.context.sampleRate ?? 48000;
  const activity = sourceKind === 'mic' ? mic.activity : file.activity;

  const { latestFeatures: liveFeatures } = useFeatureExtractor(activeAudioService, isAudioLive, { intervalMs: 100 });

  // ── Simulated scenarios (run without any audio) ───────────────────────
  const [scenario, setScenario] = useState<DemoScenarioKey>('LIVE_MIC');
  const [simulatedFeatures, setSimulatedFeatures] = useState<FeatureSet | null>(null);
  const isSimulating = scenario !== 'LIVE_MIC';
  const isActive = isAudioLive || isSimulating;

  useEffect(() => {
    if (!isSimulating) {
      const t = setTimeout(() => setSimulatedFeatures(null), 0);
      return () => clearTimeout(t);
    }
    // One steady 10 Hz clock per scenario (never keyed on live features).
    let tick = 0;
    const interval = setInterval(() => {
      tick += 1;
      setSimulatedFeatures(getDemoScenarioFeatures(scenario, tick, null));
    }, 100);
    return () => clearInterval(interval);
  }, [isSimulating, scenario]);

  const features: FeatureSet | null = isSimulating ? simulatedFeatures : liveFeatures;

  // ── Risk engine + customisable signals ────────────────────────────────
  const { latestEvaluation, injectExternalSignal, engine } = useRiskEngine(features, isActive);
  const [signalSettings, setSignalSettingsState] = useState<SignalSettings>(() => loadSignalSettings());

  useEffect(() => {
    engine?.updateConfig(toRiskEngineOverrides(signalSettings));
  }, [engine, signalSettings]);

  const setSignalSettings = useCallback((next: SignalSettings) => {
    setSignalSettingsState(next);
    saveSignalSettings(next);
  }, []);
  const resetSignalSettings = useCallback(() => setSignalSettings(DEFAULT_SIGNAL_SETTINGS), [setSignalSettings]);

  // Rolling score history (~15 s at 10 Hz) for the trend sparkline
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  useEffect(() => {
    if (!latestEvaluation) return;
    const score = latestEvaluation.riskScore;
    // Deferred like the other telemetry hooks (avoids synchronous setState in effect)
    const t = setTimeout(() => setScoreHistory((h) => [...h.slice(-149), score]), 0);
    return () => clearTimeout(t);
  }, [latestEvaluation]);

  // ── Activity feed ─────────────────────────────────────────────────────
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const pushEvent = useCallback((e: ActivityEvent) => setEvents((list) => appendEvent(list, e)), []);
  const clearEvents = useCallback(() => setEvents([]), []);

  // ── Code word ─────────────────────────────────────────────────────────
  const boostRef = useRef(signalSettings.codeWordBoost);
  useEffect(() => {
    boostRef.current = signalSettings.codeWordBoost;
  }, [signalSettings.codeWordBoost]);

  const codeWord = useCodeWordDetector({
    onDetection: (detection) => {
      const boost = boostRef.current;
      injectExternalSignal(boost, boost, {
        signal: 'codeWord',
        reason: detection.reason ?? 'Configured distress phrase detected',
      });
      pushEvent(
        makeEvent({
          kind: 'code-word',
          tone: 'suspicious',
          title: 'Code word detected',
          detail: `Covert phrase matched (${Math.round(detection.confidence * 100)}% confidence) · +${boost} context for 15 s`,
        }),
      );
    },
  });
  const runTranscript = codeWord.processTranscript;

  // ── Live speech → code word (microphone only) ─────────────────────────
  const speech = useLiveSpeech({
    active: sourceKind === 'mic' && isMicLive && !isSimulating,
    onTranscript: (text, _isFinal, sourceId) => runTranscript(text, Date.now(), sourceId),
  });

  // ── Personal baseline ─────────────────────────────────────────────────
  const calibration = useCalibration(features, isActive, { riskEngine: engine });
  const baselineDev =
    calibration.calibrationState.status === 'COMPLETE' && calibration.calibrationState.profile && features
      ? calculateBaselineDeviation(features, calibration.calibrationState.profile)
      : null;

  // ── Temporal context / false-positive filter ──────────────────────────
  const { temporalContext } = useTemporalContext(features, baselineDev, isActive);

  // ── Incidents ─────────────────────────────────────────────────────────
  const incidentContext: IncidentContext = {
    source: sourceKind === 'mic' && !isSimulating ? 'MICROPHONE' : 'SIMULATION',
    baselineAvailable: calibration.calibrationState.status === 'COMPLETE',
    baselineDeviations:
      baselineDev && baselineDev.baselineAvailable
        ? {
            pitch: baselineDev.pitchZScore ?? undefined,
            rms: baselineDev.energyZScore ?? undefined,
            silence: baselineDev.silenceExcessRatio ?? undefined,
            spectral: baselineDev.spectralZScore ?? undefined,
            zcr: baselineDev.zcrZScore ?? undefined,
          }
        : undefined,
    codeWordDetected: codeWord.latestDetection?.detected ?? false,
    featureSnapshot: features
      ? {
          pitchHz: features.pitchHz,
          rms: features.rmsEnergy,
          voiceActivity: features.isSpeech ? 1 : 0,
          silenceDurationSec: features.silenceDurationSec,
          spectralCentroid: features.spectralCentroid,
          zeroCrossingRate: features.zeroCrossingRate,
        }
      : undefined,
    temporalContext: temporalContext ?? undefined,
  };
  const incidents = useIncidentManager(latestEvaluation, { context: incidentContext, isActive });
  const contacts = useTrustedContacts();

  // Feed: level changes — only once a new level has held for LEVEL_SETTLE_FRAMES,
  // so natural speech doesn't flood the feed with Elevated ↔ Suspicious flips.
  const committedLevelRef = useRef<RiskLevel | null>(null);
  const pendingLevelRef = useRef<{ level: RiskLevel; frames: number } | null>(null);
  useEffect(() => {
    if (!isActive) {
      committedLevelRef.current = null;
      pendingLevelRef.current = null;
      return;
    }
    if (!latestEvaluation) return;
    const level = latestEvaluation.riskLevel;
    const committed = committedLevelRef.current ?? 'NORMAL';
    if (level === committed) {
      pendingLevelRef.current = null;
      committedLevelRef.current = committed;
      return;
    }
    const pending = pendingLevelRef.current;
    const frames = pending && pending.level === level ? pending.frames + 1 : 1;
    pendingLevelRef.current = { level, frames };
    // HIGH_RISK is reported immediately; other levels must settle first
    if (level === 'HIGH_RISK' || frames >= LEVEL_SETTLE_FRAMES) {
      const e = levelChangeEvent(committed, latestEvaluation);
      committedLevelRef.current = level;
      pendingLevelRef.current = null;
      if (e) pushEvent(e);
    }
  }, [latestEvaluation, isActive, pushEvent]);

  // Feed: transient spikes the filter absorbed
  const wasTransientRef = useRef(false);
  useEffect(() => {
    const isTransient = Boolean(temporalContext?.isTransient && !temporalContext.isSustained && !temporalContext.isMultiSignal);
    if (isTransient && !wasTransientRef.current && temporalContext) {
      pushEvent(transientFilteredEvent(temporalContext, latestEvaluation));
    }
    wasTransientRef.current = isTransient;
  }, [temporalContext, latestEvaluation, pushEvent]);

  // Feed: incidents
  const lastIncidentIdRef = useRef<string | null>(null);
  useEffect(() => {
    const inc = incidents.currentIncident;
    if (inc && inc.id !== lastIncidentIdRef.current) {
      lastIncidentIdRef.current = inc.id;
      pushEvent(
        makeEvent({
          kind: 'incident',
          tone: 'high',
          title: 'Silent alert raised',
          detail:
            contacts.contacts.length > 0
              ? `Confirmed multi-signal event · prepared for ${contacts.contacts.length} trusted contact${contacts.contacts.length === 1 ? '' : 's'} (not sent)`
              : 'Confirmed multi-signal event · simulated locally, nothing sent',
          score: inc.riskScore,
          level: 'HIGH_RISK',
          signals: inc.contributingSignals.filter((s) => s.contribution > 0),
          incidentId: inc.id,
        }),
      );
    }
  }, [incidents.currentIncident, contacts.contacts.length, pushEvent]);

  // Feed: calibration finished
  const prevCalStatus = useRef(calibration.calibrationState.status);
  useEffect(() => {
    const status = calibration.calibrationState.status;
    if (status === 'COMPLETE' && prevCalStatus.current === 'CALIBRATING') {
      const p = calibration.calibrationState.profile;
      pushEvent(
        makeEvent({
          kind: 'calibration',
          tone: 'info',
          title: 'Personal baseline ready',
          detail: p ? `Your normal pitch ≈ ${Math.round(p.pitchMean)} Hz — deviations now measured against you` : 'Baseline applied',
        }),
      );
    }
    prevCalStatus.current = status;
  }, [calibration.calibrationState.status, calibration.calibrationState.profile, pushEvent]);

  // ── Demo conversation library ─────────────────────────────────────────
  const [library, setLibrary] = useState<DemoConversation[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<DemoConversation | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(DEMO_CONVERSATION_MANIFESTS.map(fetchDemoConversation))
      .then((list) => !cancelled && setLibrary(list))
      .catch((err: unknown) => !cancelled && setLibraryError(err instanceof Error ? err.message : 'Could not load demos'));
    return () => {
      cancelled = true;
    };
  }, []);

  const playhead = file.playbackStatus.currentTimeSec;
  const caption = conversation && sourceKind === 'conversation' ? activeCue(conversation, playhead) : null;

  // Feed transcript cues to the detector as each utterance finishes
  const lastCueSecRef = useRef(0);
  useEffect(() => {
    if (!conversation || sourceKind !== 'conversation') return;
    const prev = lastCueSecRef.current;
    if (playhead < prev) {
      lastCueSecRef.current = playhead;
      return;
    }
    if (!file.isPlaying) return;
    for (const cue of conversation.cues) {
      if (cue.finalSec > prev && cue.finalSec <= playhead) {
        runTranscript(cue.text, Date.now(), 'demo-conversation-transcript');
      }
    }
    lastCueSecRef.current = playhead;
  }, [conversation, sourceKind, playhead, file.isPlaying, runTranscript]);

  const stopSimulation = useCallback(() => setScenario('LIVE_MIC'), []);

  const loadConversation = useCallback(
    async (conv: DemoConversation, autoplay = true) => {
      setScenario('LIVE_MIC');
      setSourceKind('conversation');
      setConversationLoading(true);
      try {
        if (mic.monitoringState === 'MONITORING_ACTIVE') mic.stopMonitoring();
        await file.loadFile(await fetchDemoConversationAudio(conv));
        setConversation(conv);
        lastCueSecRef.current = 0;
        if (autoplay) file.playFile();
        pushEvent(makeEvent({ kind: 'source', tone: 'neutral', title: 'Demo conversation loaded', detail: conv.title }));
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : 'Could not load the demo conversation');
      } finally {
        setConversationLoading(false);
      }
    },
    [file, mic, pushEvent],
  );

  const loadUpload = useCallback(
    async (f: File) => {
      setScenario('LIVE_MIC');
      setSourceKind('file');
      setConversation(null);
      if (mic.monitoringState === 'MONITORING_ACTIVE') mic.stopMonitoring();
      await file.loadFile(f);
      pushEvent(makeEvent({ kind: 'source', tone: 'neutral', title: 'Audio file loaded', detail: f.name }));
    },
    [file, mic, pushEvent],
  );

  const startMic = useCallback(async () => {
    setScenario('LIVE_MIC');
    setSourceKind('mic');
    if (file.isPlaying) file.pauseFile();
    await mic.startMonitoring();
  }, [file, mic]);

  const stopMic = useCallback(() => mic.stopMonitoring(), [mic]);

  // Source start/stop events
  const prevLiveRef = useRef(false);
  useEffect(() => {
    if (isAudioLive !== prevLiveRef.current) {
      const label = sourceKind === 'mic' ? 'Microphone' : sourceKind === 'conversation' ? 'Demo conversation' : 'Audio file';
      pushEvent(
        makeEvent({
          kind: 'source',
          tone: 'neutral',
          title: isAudioLive ? `${label} streaming` : `${label} stopped`,
          detail: isAudioLive ? 'Frames flowing into the detection pipeline' : 'Pipeline idle',
        }),
      );
      prevLiveRef.current = isAudioLive;
    }
  }, [isAudioLive, sourceKind, pushEvent]);

  // ── Scenario simulator & guided tour ──────────────────────────────────
  const selectScenario = useCallback(
    (key: DemoScenarioKey) => {
      if (key !== 'LIVE_MIC' && file.isPlaying) file.pauseFile();
      setScenario(key);
      if (key === 'CODE_WORD_ONLY' || key === 'MULTI_SIGNAL_WITH_CODE_WORD') {
        setTimeout(() => runTranscript(`Please ${codeWord.config.phrase} when you get home tonight.`, Date.now(), 'demo-transcript'), 150);
      }
    },
    [file, runTranscript, codeWord.config.phrase],
  );

  const demo = useDemoController();
  const [pendingEvidence, setPendingEvidence] = useState(false);

  useEffect(() => {
    if (!pendingEvidence || !incidents.currentIncident) return;
    const t = setTimeout(() => {
      setPendingEvidence(false);
      incidents.openModal(incidents.currentIncident);
    }, 0);
    return () => clearTimeout(t);
  }, [pendingEvidence, incidents]);

  const applyStep = useCallback(
    (step: DemoStepDefinition) => {
      if (step.autoCalibrate && calibration.calibrationState.status !== 'COMPLETE') calibration.loadPresetProfile();
      selectScenario(step.scenario);
      if (step.autoOpenModal) {
        if (incidents.currentIncident) incidents.openModal(incidents.currentIncident);
        else setPendingEvidence(true);
      } else {
        setPendingEvidence(false);
      }
    },
    [calibration, selectScenario, incidents],
  );

  const tour = useMemo(
    () => ({
      state: demo.state,
      steps: demo.steps,
      start: () => {
        const s = demo.startDemo();
        if (s.step) applyStep(s.step);
      },
      next: () => {
        const s = demo.nextStep();
        if (s.step) applyStep(s.step);
      },
      prev: () => {
        const s = demo.prevStep();
        if (s.step) applyStep(s.step);
      },
      goTo: (i: number) => {
        const s = demo.goToStep(i);
        if (s.step) applyStep(s.step);
      },
      exit: () => {
        demo.resetDemo();
        setPendingEvidence(false);
        setScenario('LIVE_MIC');
      },
      awaitingConfirmation:
        demo.state.isActive &&
        (demo.state.step?.id === 'SILENT_ALERT' || demo.state.step?.id === 'FORENSIC_REVIEW') &&
        !incidents.currentIncident,
    }),
    [demo, applyStep, incidents.currentIncident],
  );

  return {
    // sources
    sourceKind,
    setSourceKind,
    mic: { ...mic, isLive: isMicLive, start: startMic, stop: stopMic },
    file,
    analyserNode,
    sampleRate,
    activity,
    isAudioLive,
    isActive,
    // conversation library
    library,
    libraryError,
    conversation,
    conversationLoading,
    caption,
    loadConversation,
    loadUpload,
    // simulation
    scenario,
    isSimulating,
    selectScenario,
    stopSimulation,
    // analysis
    features,
    evaluation: latestEvaluation,
    scoreHistory,
    temporalContext,
    baselineDev,
    signalSettings,
    setSignalSettings,
    resetSignalSettings,
    // code word & speech
    codeWord,
    speech,
    // baseline
    calibration,
    // incidents & alerts
    incidents,
    contacts,
    // feed
    events,
    clearEvents,
    // tour
    tour,
  };
}

export type Pipeline = ReturnType<typeof usePipeline>;
