# Sanket — Agent Handoff Specification

> **Operational Handoff for Incoming Coding Agents**  
> If you are an AI coding assistant or engineer taking over this repository, this file is your primary onboarding manifest. Read it carefully before writing a single line of code.

---

## 1. What is Sanket?
**Sanket** is a multimodal voice distress-risk detection prototype. It monitors permitted audio streams for non-verbal acoustic signals of distress—such as pitch strain, voice tremors, prolonged silences, and user-configured covert code-words—fusing them into an explainable **Distress Risk Score (0–100)** to trigger simulated silent alerts without alerting bystanders.

---

## 2. Current Project Status
- **Phase:** **Phase 8 — Multi-Signal False-Positive Reduction & Temporal Correlation** (`COMPLETED`)
- **Git State:** Clean, all tests passing, ready for Phase 9.
- **Build Status:** `npm run build` passes with 0 TypeScript errors. `npm run lint` passes with 0 warnings/errors.
- **Tests:**
  - `npx tsx src/analysis/__tests__/featureExtraction.test.ts` → **46/46 passed**
  - `npx tsx src/analysis/__tests__/riskEngine.test.ts` → **59/59 passed**
  - `npx tsx src/analysis/__tests__/codeWordDetector.test.ts` → **56/56 passed**
  - `npx tsx src/analysis/__tests__/baseline.test.ts` → **92/92 passed**
  - `npx tsx src/services/__tests__/incidentSystem.test.ts` → **95/95 passed**
  - `npx tsx src/analysis/__tests__/temporalContext.test.ts` → **89/89 passed**
  - Total: **437 passed, 0 failed**
- **Runtime:** React 19 + TypeScript + Vite dev server (`npm run dev`).

---

## 3. Current Phase
- **Completed:** Phase 1 (Audio Input), Phase 2 (Feature Extraction), Phase 3 (Multi-Signal Risk Engine), Phase 4 (Sanket Console Dashboard), Phase 5 (Configurable Code-Word Detection), Phase 6 (Personal Voice Baseline & Calibration), Phase 7 (Silent Alert Dispatch & Forensic Event System), Phase 8 (Multi-Signal False-Positive Reduction & Temporal Correlation).
- **Next Phase:** **Phase 9 — Polish & Judge Demonstration Flow.**

---

## 4. What Has Been Implemented

### Phase 0
- Clean React 19 + TypeScript + Vite project configuration.
- Dark safety-monitoring UI shell.
- Full documentation suite in `/docs`.
- Directory scaffold for decoupled audio/analysis modules.

### Phase 1
- **`src/audio/types.ts`**: `AudioFrame`, `MonitoringState`, `AudioInputError`, `AudioActivityState`, `AudioInputConfig`.
- **`src/audio/audioInput.ts`**: `AudioInputService` class.
- **`src/audio/useAudioMonitor.ts`**: React hook bridging `AudioInputService` to UI (20Hz).
- **`src/components/LiveWaveform.tsx`**: Canvas-based real PCM oscilloscope.
- **`src/components/AudioActivityMeter.tsx`**: RMS meter and ACTIVE/QUIET indicator.
- **`src/App.tsx`**: Full 5-state monitoring UI shell.
- **`src/index.css`**: Extended with all Phase 1 component styles.

### Phase 2
- **`src/analysis/types.ts`**: `FeatureSet` (9 fields), `FeatureExtractorConfig`.
- **`src/analysis/featureFunctions.ts`**: Pure stateless DSP functions (`calculateRms`, `calculateZeroCrossingRate`, `calculateSpectralCentroid`, `estimatePitch`, `detectVoiceActivity`).
- **`src/analysis/featureExtractor.ts`**: Stateful `FeatureExtractor` class (~10Hz analysis cadence).
- **`src/analysis/useFeatureExtractor.ts`**: React hook.
- **`src/analysis/__tests__/featureExtraction.test.ts`**: 46 deterministic unit tests.

### Phase 3
- **`src/analysis/types.ts`**: `RiskLevel`, `RiskEvaluation`, `SignalContribution`, `RiskEngineConfig`.
- **`src/analysis/riskEngine.ts`**: Pure TypeScript heuristic risk decision engine with EMA decay, single-signal ceiling, and external signal injection.
- **`src/analysis/useRiskEngine.ts`**: React hook bridging features into risk evaluations.
- **`src/analysis/__tests__/riskEngine.test.ts`**: 59 deterministic unit tests.

### Phase 4
- **`src/components/RiskScoreGauge.tsx`**: Circular SVG HUD gauge with 260° arc, live score (0–100), risk status badge (`NORMAL`, `ELEVATED`, `SUSPICIOUS`, `HIGH_RISK`), tick marks, dynamic glow filters, and persistence indicators.
- **`src/components/SignalBreakdown.tsx`**: 6-channel acoustic breakdown with dynamic proportional progress bars, baseline references, live readouts, and human-readable anomaly explanations.
- **`src/components/DetectionTimeline.tsx`**: 30-sample rolling sparkline chart and transition event logger capturing risk level changes and multi-signal co-occurrences.
- **`src/components/MonitoringStatus.tsx`**: Web Audio hardware state, VAD classification pill (`VOICED SPEECH` vs `AMBIENT / QUIET`), 10Hz DSP cadence indicator, and local-first privacy security declaration.
- **`src/components/DemoScenarios.tsx` & `src/utils/demoScenariosData.ts`**: Interactive test scenario simulator for judge evaluation.
- **`src/App.tsx` & `src/index.css`**: Complete dashboard assembly and sleek dark safety HUD design system.

### Phase 5
- **`src/analysis/codeWordDetector.ts`**: Pure TypeScript token-aware covert phrase spotter.
  - Deterministic text normalization (lowercasing, harmless punctuation removal, whitespace collapsing).
  - Sliding-window token comparison with word boundary enforcement.
  - Morphological fuzzy tolerance for speech-recognition inflections (plurals/verb suffixes).
  - 5000ms cooldown debounce window suppressing duplicate recognizer emissions.
  - Zero transcript retention: processed ephemerally, never stores conversation transcripts or logs.
- **`src/analysis/transcriptTypes.ts`**: Input-agnostic transcript abstraction (`TranscriptEvent`, `TranscriptSource`).
- **`src/analysis/manualTranscriptSource.ts`**: Deterministic in-memory test adapter for transcript emission.
- **`src/analysis/useCodeWordDetector.ts`**: React hook managing phrase configuration, armed status, and detection events.
- **`src/analysis/riskEngine.ts`**: Contextual signal integration via `injectExternalSignal(25, 25, { signal: 'codeWord', ... })` with explainable attribution in `contributingSignals`. Single-signal ceiling holds (25 < 70).
- **`src/components/CodeWordConfig.tsx`**: Configuration HUD with phrase input, armed toggle, live detection alert, and interactive manual test simulator.
- **`src/analysis/__tests__/codeWordDetector.test.ts`**: 56 deterministic unit tests covering normalization, boundaries, cooldown, fuzzy matching, and risk engine integration.

### Phase 6
- **`src/analysis/baselineBuilder.ts`**: `BaselineBuilder` implementing Welford's online one-pass algorithm.
  - Computes running sample mean, variance, and standard deviation in $O(1)$ memory.
  - Voiced frame filtering (discards silence/unvoiced frames where RMS < 0.015 or isSpeech = false).
  - Progress tracking (`voicedFramesCollected`, `elapsedSec`, `progressFraction`).
  - Zero raw audio retention: stores only statistical scalars in `BaselineProfile`.
- **`src/analysis/baselineDeviation.ts`**: Statistical Z-score deviation calculation and config adapter.
  - Computes channel deviations normalized to $[0, 1]$ using standard deviations.
  - `baselineToRiskEngineConfig()` bridges calibrated profiles into personalized dynamic `RiskEngineConfig` thresholds.
- **`src/analysis/useCalibration.ts`**: React hook managing calibration lifecycle (`IDLE`, `CALIBRATING`, `COMPLETE`, `ERROR`) with `localStorage` persistence and fallback handling.
- **`src/components/CalibrationPanel.tsx`**: 4-state calibration HUD panel with circular SVG countdown timer, live baseline summary statistics, and active profile status.
- **`src/analysis/__tests__/baseline.test.ts`**: 92 comprehensive deterministic unit tests.

### Phase 7 (NEW)
- **`src/services/silentAlertDispatcher.ts`**: Pure deterministic alert dispatcher.
  - Strict dispatch gating: requires `riskLevel === 'HIGH_RISK'` and `isConfirmed === true`.
  - Mode is strictly `SIMULATED_LOCAL` with zero audible noise, zero OS notifications, and zero external network calls.
  - `createDistressIncident()` extracts confirmed channel names and snapshots without raw audio.
- **`src/services/incidentManager.ts`**: State machine and duplicate alert protection latch.
  - Latches on confirmed HIGH_RISK, dispatching exactly once per sustained event.
  - Continuously updates active incident metrics (peak score, persistence, signals).
  - Automatically unlatches and marks incident RESOLVED when score returns below HIGH_RISK.
  - Supports re-triggering for distinct future incidents.
- **`src/services/alertHistory.ts`**: Bounded local storage audit log.
  - Capacity clamped to 50 items; stores only statistical metadata under `sanket_alert_history_v1`.
  - Full error resilience for corrupted JSON, quota exceptions, or restricted contexts.
- **`src/services/useIncidentManager.ts`**: React lifecycle hook.
- **`src/components/IncidentBanner.tsx`**: Silent, prominent distress banner with live metrics and source tags.
- **`src/components/ForensicEventModal.tsx`**: Comprehensive forensic inspection modal showing contributing signals, baseline deviations, confirmation telemetry, and privacy declarations.
### Phase 8 (NEW)
- **`src/analysis/temporalContext.ts`**: Pure TypeScript `TemporalContextAnalyzer`.
  - Bounded ring-buffer history (30 frames, zero raw audio retention).
  - Transient spike detection (`isTransient`, `transientFrames`, `TRANSIENT_SPIKE`) for short isolated vocal bursts (e.g. coughs, laughs, loud speech bursts).
  - Sustained anomaly detection (`isSustained`, `sustainedFrames`, `SUSTAINED_ANOMALY`) requiring $\ge 3$ consecutive frames.
  - Cross-signal temporal correlation (`multiSignalCorrelation`, `isMultiSignal`, `MULTI_SIGNAL_CORRELATION`) across 10-frame co-occurrence window.
  - Voice-derived pause/breathing regularity proxy (`BreathingPatternContext`, `BREATHING_PATTERN_ANOMALY`): analyzes pause count, duration, and variance across 40 frames; strictly disclaimed as conversational turn-pacing proxy, NOT medical sensing.
- **`src/services/incidentManager.ts`**: False-positive suppression gate.
  - Blocks isolated transient spikes (`isTransient && !isSustained && !isMultiSignal`) from triggering silent emergency alerts.
  - Passes sustained or multi-signal crises unhindered.
- **`src/components/TemporalContextCard.tsx`**: Dashboard HUD card with status badges, 4-metric grid, and explainability banner.
- **`src/components/ForensicEventModal.tsx`**: Updated with temporal telemetry audit box.
- **`src/utils/demoScenariosData.ts` & `src/components/DemoScenarios.tsx`**: 3 new interactive presets (`TRANSIENT_PITCH_SPIKE`, `TRANSIENT_LOUD_EVENT`, `IRREGULAR_PAUSE_PATTERN`).
- **`src/analysis/__tests__/temporalContext.test.ts`**: 89 comprehensive deterministic unit tests.

---

## 5. What Has NOT Been Implemented (Do NOT Claim Working)
- [ ] Polish & Judge Demonstration Flow → Phase 9
- [ ] Mobile/VoIP native integration → Phase 10

---

## 6. Current Architecture

```
React UI (App.tsx)
   ↓ calls
useAudioMonitor hook (src/audio/useAudioMonitor.ts)         ← 20Hz UI telemetry
   ↓ manages
AudioInputService (src/audio/audioInput.ts)
   ↓ wraps
Web Audio API (AudioContext + AnalyserNode + MediaStream)
   ↓ produces
AudioFrame { timestamp, sampleRate, frameSize, timeDomainData, frequencyData, rmsEnergy }
   ↓
useFeatureExtractor hook (src/analysis/useFeatureExtractor.ts)   ← 10Hz analysis
   ↓ calls
FeatureExtractor.processFrame() (src/analysis/featureExtractor.ts)
   ↓ calls
featureFunctions.ts (RMS, ZCR, Spectral Centroid, Pitch, VAD)
   ↓ maintains
TemporalState { silenceDurationSec, speechActivityDurationSec, speechSegmentCount, ... }
   ↓ emits
FeatureSet { rmsEnergy, zeroCrossingRate, spectralCentroid, pitchHz, isSpeech,
             silenceDurationSec, speechActivityDurationSec, speechSegmentCount }
   ↓
useRiskEngine hook (src/analysis/useRiskEngine.ts)               ← 10Hz scoring
   ↓ calls
RiskEngine.evaluate() (src/analysis/riskEngine.ts)
   ↓ maintains
RiskTemporalState { smoothedScore, consecutiveAbnormalFrames, rmsSmoothRef, ... }
   ↓ emits
RiskEvaluation { riskScore, riskLevel, contributingSignals, confirmedSignals, persistenceFrames, isConfirmed }
   ↓
Future Phase 4 Live Safety Dashboard
```

---

## 7. Data Contracts

### FeatureSet Contract
```typescript
interface FeatureSet {
  timestamp: number;                // ms (performance.now())
  rmsEnergy: number;                // 0.0–1.0 amplitude ratio
  zeroCrossingRate: number;         // 0.0–1.0 fraction of sign changes
  spectralCentroid: number | null;  // Hz, null on silence
  pitchHz: number | null;           // Hz, null on unvoiced/silence/low-confidence
  isSpeech: boolean;                // VAD gate
  silenceDurationSec: number;       // continuous silence since last voice, resets on voice
  speechActivityDurationSec: number;// cumulative voiced duration this session
  speechSegmentCount: number;       // count of voice ON transitions
}
```

### RiskEvaluation Contract
```typescript
type RiskLevel = 'NORMAL' | 'ELEVATED' | 'SUSPICIOUS' | 'HIGH_RISK';

interface SignalContribution {
  signal: string;                   // 'pitch' | 'rms' | 'silence' | 'voiceActivity' | 'spectral' | 'zcr' | 'persistence'
  contribution: number;             // 0–maxWeight
  reason: string;                   // Human-readable rationale for UI/audit logs
}

interface RiskEvaluation {
  timestamp: number;
  riskScore: number;                // 0–100 smoothed composite score
  riskLevel: RiskLevel;             // NORMAL (0–29), ELEVATED (30–49), SUSPICIOUS (50–69), HIGH_RISK (70–100)
  contributingSignals: SignalContribution[];
  confirmedSignals: number;         // Number of positive non-persistence contributors
  persistenceFrames: number;        // Consecutive abnormal frames count
  isConfirmed: boolean;             // True if persistence >= confirmationFrames
}
```

---

## 8. Test Strategy & Commands

All tests use synthetic signals and require **no browser, no DOM, and no microphone**:
- `npx tsx src/analysis/__tests__/featureExtraction.test.ts` (46 tests)
- `npx tsx src/analysis/__tests__/riskEngine.test.ts` (59 tests)
- Full verification: `npm run lint && npm run build && npx tsx src/analysis/__tests__/featureExtraction.test.ts && npx tsx src/analysis/__tests__/riskEngine.test.ts`

---

## 9. Important Product Decisions
- **Decision 001:** Name is **Sanket**.
- **Decision 002:** Browser microphone is strictly the prototype input layer.
- **Decision 003:** Core engine is input-agnostic.
- **Decision 004:** No single acoustic signal triggers an emergency conclusion.
- **Decision 005:** Heuristic rule-based scoring over opaque fake ML.
- **Decision 006:** Local-first, zero-cloud audio streaming.
- **Decision 007:** `getAnalyserNode()` exposed for canvas rendering (Phase 1).
- **Decision 008:** Autocorrelation chosen over YIN for pitch (Phase 2).
- **Decision 009:** `FeatureExtractor` maintains temporal state internally (Phase 2).
- **Decision 010:** Multi-Signal Decision Engine with Exponential Moving Average (Phase 3).
- **Decision 011:** Strict Single-Signal Ceiling Guarantee (Phase 3).

---

## 10. Files & Folders That Matter

| File | Purpose |
| :--- | :--- |
| [docs/PROJECT_CONTEXT.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/PROJECT_CONTEXT.md) | Primary source of truth & positioning |
| [docs/ARCHITECTURE.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/ARCHITECTURE.md) | Technical specs & data contracts |
| [docs/PROGRESS.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/PROGRESS.md) | Current implementation state |
| [docs/DECISIONS.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/DECISIONS.md) | Architecture Decision Records (ADRs 001–011) |
| [docs/ROADMAP.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/ROADMAP.md) | Multi-phase development roadmap |
| [src/audio/types.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/audio/types.ts) | Audio layer data contracts |
| [src/audio/audioInput.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/audio/audioInput.ts) | AudioInputService |
| [src/audio/useAudioMonitor.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/audio/useAudioMonitor.ts) | React hook — audio bridge |
| [src/analysis/types.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/types.ts) | FeatureSet, RiskEvaluation, RiskEvent contracts |
| [src/analysis/featureFunctions.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/featureFunctions.ts) | Pure DSP functions |
| [src/analysis/featureExtractor.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/featureExtractor.ts) | Stateful FeatureExtractor class |
| [src/analysis/useFeatureExtractor.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/useFeatureExtractor.ts) | React hook — feature bridge |
| [src/analysis/riskEngine.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/riskEngine.ts) | Heuristic multi-signal decision engine |
| [src/analysis/useRiskEngine.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/useRiskEngine.ts) | React hook — risk evaluation bridge |
| [src/analysis/__tests__/featureExtraction.test.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/__tests__/featureExtraction.test.ts) | 46 deterministic DSP tests |
| [src/analysis/__tests__/riskEngine.test.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/__tests__/riskEngine.test.ts) | 59 deterministic risk engine tests |
| [src/components/LiveWaveform.tsx](file:///c:/Users/VISHESH/Desktop/SANKET/src/components/LiveWaveform.tsx) | Canvas oscilloscope |
| [src/components/AudioActivityMeter.tsx](file:///c:/Users/VISHESH/Desktop/SANKET/src/components/AudioActivityMeter.tsx) | RMS meter |
| [src/App.tsx](file:///c:/Users/VISHESH/Desktop/SANKET/src/App.tsx) | Main UI shell |
| [src/index.css](file:///c:/Users/VISHESH/Desktop/SANKET/src/index.css) | Design system |

---

## 11. Next Phase — Phase 4: Live Sanket Safety Dashboard

The next agent should build the interactive telemetry UI:
- Create real-time Distress Risk Score gauge / meter (Green `NORMAL`, Yellow `ELEVATED`, Orange `SUSPICIOUS`, Red `HIGH_RISK`).
- Build breakdown cards displaying individual signal contributions (`contributingSignals`).
- Show pitch deviation, vocal intensity, silence duration, and spectral strain telemetry in real-time.
- Preserve the decoupled pipeline: UI components consume `useRiskEngine`, which consumes `useFeatureExtractor`, which consumes `useAudioMonitor`.
- Maintain rich, stunning dark mode aesthetics without external CSS frameworks.

---

## 12. Rules For The Next Agent

1. **Read `docs/PROJECT_CONTEXT.md` first.**
2. **Read `docs/PROGRESS.md` second.**
3. **Read `docs/ARCHITECTURE.md` before modifying architecture.**
4. **Read `docs/DECISIONS.md` before making major technical decisions.**
5. **Do not duplicate existing functionality.**
6. **Do not modify `AudioInputService`, `FeatureExtractor`, or `RiskEngine` — consume their outputs.**
7. **Update `docs/PROGRESS.md` after completing meaningful work.**
8. **Update `docs/AGENT_HANDOFF.md` when architecture changes significantly.**
9. **Update `docs/DECISIONS.md` when making an important architectural decision.**
10. **Do not claim something works unless it has actually been tested.**
11. **Keep the project suitable for a one-day hackathon.**
12. **Prefer working functionality over unnecessary abstraction.**
13. **Do not introduce ML models.**
14. **Never represent heuristic prototype scoring as medically validated.**
15. **Preserve the separation: audio input → feature extraction → risk engine → UI.**
16. **Do not generate fake mobile/call integration.**
17. **Never generate image assets unless explicitly requested.**
18. **Update `current_prompt_update.md` after EVERY single prompt.**
