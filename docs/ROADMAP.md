# Sanket — Phased Development Roadmap

> **Phase Tracking & Execution Blueprint**  
> This roadmap governs the incremental development of the Sanket prototype for the hackathon.  
> Each phase builds upon the outputs of preceding phases.  
> **Status Conventions:** `COMPLETED` | `IN PROGRESS` | `NOT STARTED`

---

## Roadmap Summary

| Phase | Title | Status |
| :--- | :--- | :--- |
| **Phase 0** | Project Initialization & Documentation Infrastructure | **COMPLETED** |
| **Phase 1** | Browser Microphone & Live Audio Pipeline | **COMPLETED** |
| **Phase 2** | Pitch, Energy, Speech Activity & Silence Detection | **COMPLETED** |
| **Phase 3** | Distress Risk Scoring Engine | **COMPLETED** |
| **Phase 4** | Live Sanket Safety Dashboard | **COMPLETED** |
| **Phase 5** | Configurable Code-Word Detection | **COMPLETED** |
| **Phase 6** | Personal Voice Baseline & Calibration | **COMPLETED** |
| **Phase 7** | Silent Alert Dispatch & Forensic Event System | **COMPLETED** |
| **Phase 8** | Multi-Signal Temporal Correlation & False Alarm Reduction | **COMPLETED** |
| **Phase 9** | Polish & Judge Demonstration Flow | **COMPLETED** |
| **Phase 10** | Mobile Deployment Architecture & Future Integration Docs | **NOT STARTED** |

---

## Detailed Phase Breakdown

### Phase 0: Project Initialization & Documentation Infrastructure
- **Status:** `COMPLETED`
- **Goal:** Establish a pristine, modern React + Vite project scaffold with modular directories, strict architectural documentation, ADR decision logs, and Git tracking.
- **Expected Functionality:** Clean development server running, initial safety shell UI visible, complete documentation suite created under `/docs`.
- **Inputs:** Project specification, repository workspace.
- **Outputs:** Project scaffold, package configurations, Git repository with initial commit, documentation set (`PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `PROGRESS.md`, `DECISIONS.md`, `DEMO_FLOW.md`, `AGENT_HANDOFF.md`).
- **Dependencies:** Node.js, Vite, npm, Git.

---

### Phase 1: Browser Microphone & Live Audio Pipeline
- **Status:** `COMPLETED`
- **Goal:** Connect the browser `getUserMedia` audio input safely with graceful permission handling, stream lifecycle management, and audio frame generation.
- **Implemented:**
  - `AudioInputService` class managing full `getUserMedia` → `AudioContext` → `AnalyserNode` → `AudioFrame` pipeline.
  - Real-time PCM time-domain and frequency capture via `getFloatTimeDomainData` / `getFloatFrequencyData`.
  - RMS energy calculation per frame; ACTIVE/QUIET threshold classifier.
  - `useAudioMonitor` React hook with throttled ~20Hz React state updates.
  - `LiveWaveform` canvas component rendering actual PCM samples at RAF speed.
  - `AudioActivityMeter` component displaying RMS and activity state.
  - Full resource cleanup on stop and unmount.
  - 5-state monitoring machine in `App.tsx` with error handling.
- **Inputs:** Browser microphone permission + Web Audio API.
- **Outputs:** `AudioFrame` stream with `timeDomainData`, `frequencyData`, `rmsEnergy`.
- **Dependencies:** Phase 0.

---

### Phase 2: Pitch, Energy, Speech Activity & Silence Detection
- **Status:** `COMPLETED`
- **Goal:** Implement the `FeatureExtractor` module to parse acoustic primitives from `AudioFrame` in real-time.
- **Implemented:**
  - `calculateRms()` — RMS energy from PCM samples (re-usable, self-contained)
  - `calculateZeroCrossingRate()` — Normalized ZCR from PCM buffer
  - `calculateSpectralCentroid()` — Weighted mean Hz from dBFS frequency data, with null for silence
  - `estimatePitch()` — Autocorrelation-based monophonic F0 estimation (80–500 Hz), null for unvoiced
  - `detectVoiceActivity()` — Energy-threshold VAD gate
  - `FeatureExtractor` class — Stateful wrapper maintaining silence duration, speech segment count, speech activity duration across frames
  - `useFeatureExtractor` — React hook running analysis at configurable interval (default 10Hz)
  - 46 deterministic unit tests covering all functions and temporal state transitions
- **Inputs:** `AudioFrame` stream from Phase 1.
- **Outputs:** Stream of typed `FeatureSet` objects (`rmsEnergy`, `zeroCrossingRate`, `spectralCentroid`, `pitchHz`, `isSpeech`, `silenceDurationSec`, `speechActivityDurationSec`, `speechSegmentCount`).
- **Dependencies:** Phase 1.

---

### Phase 3: Distress Risk Scoring Engine
- **Status:** `COMPLETED`
- **Goal:** Implement the mathematical core that aggregates acoustic deviations into an explainable Distress Risk Score ($0–100$).
- **Implemented:**
  - `RiskEngine` class — pure TypeScript stateful heuristic decision engine (zero React/DOM/browser dependencies)
  - Multi-signal weighted scoring across 6 channels (pitch, RMS, silence, voice activity, spectral centroid, ZCR) + persistence bonus
  - Exponential moving average smoothing (`decayFactor: 0.78`) with gradual score decay upon recovery
  - Single-signal ceiling guarantee: max single signal weight is 20, ceiling with persistence is 35 < 70 (`HIGH_RISK`)
  - Discrete risk classification: `NORMAL` (0–29), `ELEVATED` (30–49), `SUSPICIOUS` (50–69), `HIGH_RISK` (70–100)
  - `SignalContribution` explainability breakdown for every evaluation frame
  - `injectExternalSignal()` hook for future Phase 5 (code-word) and Phase 8 (breathing) integration
  - `useRiskEngine` React hook operating at ~10Hz with clean lifecycle reset
  - 59 deterministic unit tests (**59 passed, 0 failed**)
- **Inputs:** `FeatureSet` stream from Phase 2.
- **Outputs:** `RiskEvaluation` with continuous numeric score ($0–100$), `RiskLevel`, contributing signal reasons, and persistence state.
- **Dependencies:** Phase 2.

---

### Phase 4: Live Sanket Safety Dashboard Console
- **Status:** `COMPLETED`
- **Goal:** Create a high-fidelity, dark safety-monitoring interface displaying real-time telemetry.
- **Implemented:**
  - `RiskScoreGauge`: 260° SVG circular arc gauge with real-time score (0–100), risk status badge (`NORMAL`, `ELEVATED`, `SUSPICIOUS`, `HIGH_RISK`), glowing filter effects, and persistence frame indicators.
  - `SignalBreakdown`: 6-channel acoustic telemetry readout (Pitch, RMS, Silence, Voice Activity, Spectral Centroid, ZCR) with dynamic progress bars, baseline references, and human-readable anomaly explanations.
  - `DetectionTimeline`: 30-sample rolling sparkline chart and transition event logger capturing risk level changes and multi-signal co-occurrences.
  - `MonitoringStatus`: Web Audio hardware state, VAD classification pill, 10Hz DSP cadence indicator, and local-first privacy security declaration.
  - `DemoScenarios` & `demoScenariosData`: Interactive test scenario simulator (Calm, Pitch Spike, Silence, Whisper, Multi-Signal Distress, Recovery) for judge evaluation.
  - Assembled in `App.tsx` and styled with custom Vanilla CSS in `index.css`.
- **Inputs:** State emissions from `RiskEngine`, `FeatureExtractor`, and `useAudioMonitor`.
- **Outputs:** Interactive, responsive React dashboard with smooth animations.
- **Dependencies:** Phase 3.

---

### Phase 5: Configurable Code-Word Detection
- **Status:** `COMPLETED`
- **Goal:** Allow users to set a covert distress phrase (e.g., *"Remember to feed the cat"*) that elevates contextual risk upon detection.
- **Implemented:**
  - `CodeWordDetector`: Pure TypeScript token-aware phrase spotter with deterministic text normalization, sliding-window token matching, morphological fuzzy tolerance, and 5000ms duplicate suppression cooldown. Zero transcript retention.
  - `TranscriptSource` abstraction & `ManualTranscriptSource`: Decoupled transcript ingestion interface ready for browser/mobile/VoIP adapters.
  - Contextual Risk Engine integration: `injectExternalSignal()` injects bounded boost (+25 pts) with explainable `contributingSignals` attribution without breaching the single-signal ceiling (25 < 70).
  - `CodeWordConfig`: Dashboard configuration HUD with custom phrase input, arm/disarm toggle, live match badge, and manual test input.
  - Timeline and SignalBreakdown support for code-word telemetry without leaking configured phrase into history.
  - 56 deterministic unit tests (161 total suite tests passing).
- **Inputs:** Transcript stream / simulated utterance, user-configured trigger string.
- **Outputs:** Contextual signal flag and bounded +25 boost to `RiskEngine`.
- **Dependencies:** Phase 4.

---

### Phase 6: Personal Voice Baseline & Calibration
- **Status:** `COMPLETED`
- **Goal:** Implement a personal voice calibration mode and rolling baseline to measure relative deviations instead of universal constants.
- **Implemented:**
  - `BaselineBuilder` class using Welford's online one-pass algorithm (O(1) memory, zero raw audio storage).
  - Voice activity filtering: excludes silence/unvoiced frames from pitch and resonance statistics.
  - `calculateBaselineDeviation()` computes per-channel statistical Z-scores with floor protection and cap clamping.
  - `baselineToRiskEngineConfig()` dynamically adapts `RiskEngineConfig` thresholds to the user's vocal physiology.
  - `useCalibration` React hook with 4 lifecycle states, auto-finalize, and `localStorage` persistence.
  - `CalibrationPanel` HUD component with circular SVG countdown timer and summary statistics grid.
  - 92 deterministic unit tests.
- **Inputs:** FeatureSet stream during active calibration.
- **Outputs:** `BaselineProfile` applied dynamically to `RiskEngine`.
- **Dependencies:** Phase 5.

---

### Phase 7: Silent Alert Dispatch & Forensic Event System
- **Status:** `COMPLETED`
- **Goal:** Implement simulated silent alert dispatching and structured forensic incident inspection upon sustained confirmed `HIGH_RISK`.
- **Implemented:**
  - `silentAlertDispatcher`: Gated dispatcher generating unique alert/incident records in `SIMULATED_LOCAL` mode.
  - `incidentManager`: Incident latch state machine preventing duplicate dispatches during sustained crises and resetting cleanly upon normalization.
  - `alertHistory`: Local storage audit log retaining up to 50 incidents (`sanket_alert_history_v1`) with full error resilience.
  - `useIncidentManager`: React hook managing incident state, acknowledgement, resolution, and modal triggers.
  - `IncidentBanner`: Silent, high-visibility dashboard distress alert bar showing live score, source, and quick action.
  - `ForensicEventModal`: Complete metadata audit modal showing contributing signals, baseline Z-scores, feature snapshot, and privacy declarations.
  - `AlertHistory`: Dashboard historical incident viewer with inspect and clear actions.
  - 95 deterministic unit tests (**348 total across all 5 suites**).
- **Inputs:** `RiskEvaluation` stream from `RiskEngine` + `IncidentContext`.
- **Outputs:** `DistressIncident` audit log and simulated silent alerts.
- **Dependencies:** Phase 6.
- **Inputs:** `RiskEvent` with level `HIGH_DISTRESS_RISK` from Phase 3.
- **Outputs:** Simulated dispatch UI notification, audit event logged with timestamp and trigger telemetry.
- **Dependencies:** Phase 6.
- **Outputs:** `Baseline` profile object storing statistical distribution parameters ($\mu, \sigma$).
- **Dependencies:** Phase 2, Phase 3.

---

### Phase 8: Multi-Signal Temporal Correlation & False Alarm Reduction
- **Status:** `COMPLETED`
- **Goal:** Harden the scoring engine against false positives caused by laughing, coughing, loud background noises, or standard conversational enthusiasm.
- **Implemented:**
  - `TemporalContextAnalyzer`: Bounded sliding-window history buffer tracking transient spikes, sustained anomalies, and cross-signal co-occurrence.
  - False-positive suppression gate in `IncidentManager`: Blocks isolated transient spikes without muting sustained or multi-signal crises.
  - Voice-derived pause/breathing regularity proxy: Analyzes pause duration, count, and variance without medical claims.
  - `TemporalContextCard`: Live HUD metrics with status badges, correlation gauge, and explainability banner.
  - 89 deterministic unit tests (**437 total across all 6 suites**).
- **Inputs:** Rolling historical buffer of `FeatureSet` and personal baseline deviations.
- **Outputs:** Temporal context metadata and gated silent emergency alerts.
- **Dependencies:** Phase 3, Phase 6, Phase 7.

---

### Phase 9: Polish & Judge Demonstration Flow
- **Status:** `COMPLETED`
- **Goal:** Optimize the presentation and provide interactive test controls for a seamless 2–3 minute hackathon judge demonstration.
- **Implemented:**
  - `DemoController`: Deterministic state machine governing sequential 6-step judge evaluation tour.
  - `JudgeDemoPanel`: Interactive dashboard HUD panel displaying step progress flow, narration, judge highlights, outcome indicators, and navigation controls.
  - Step Sequence: Personal Baseline → Normal Voice Reference → Transient Spike Filtering → Sustained Multi-Signal Distress → Silent Local Alert Dispatch → Forensic Audit Review.
  - 87 deterministic unit tests (**524 total across all 7 suites**).
- **Inputs:** Full application stack, preset synthetic demo scenarios, and baseline calibration state.
- **Outputs:** Seamless, polished end-to-end judge demonstration experience.
- **Dependencies:** Phases 1 through 8.

---

### Phase 10: Mobile Deployment Architecture & Future Integration Docs
- **Status:** `NOT STARTED`
- **Goal:** Document the concrete technical bridge from the browser prototype to native iOS/Android background service integration.
- **Expected Functionality:** Architectural blueprints for mobile background audio permissions, battery-efficient downsampling, VoIP call integration, and encrypted on-device storage.
- **Inputs:** Final prototype learnings and architecture.
- **Outputs:** Technical whitepaper and developer guide (`docs/MOBILE_INTEGRATION.md`).
- **Dependencies:** Phase 9.
