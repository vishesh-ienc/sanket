# Sanket — Development Progress & Current State

> **Continuously Updated Development Ledger**  
> Every working engineer and AI coding agent MUST consult this document upon starting work and update it upon finishing any phase.  
> **Cardinal Rule:** Never claim functionality that has not actually been implemented and verified.

---

## Current Status

- **Current Phase:** **Phase 2 — Voice Feature Extraction**
- **Status:** `COMPLETED`
- **Last Updated:** 2026-09-27
- **Next Phase:** **Phase 3 — Multi-Signal Distress Risk Engine**

---

## Completed in Phase 0

- [x] Modern React 19 + TypeScript + Vite project initialized
- [x] Complete documentation infrastructure established in `/docs`
- [x] Comprehensive architectural design and data contract specification (`ARCHITECTURE.md`)
- [x] Phased 11-step hackathon development roadmap created (`ROADMAP.md`)
- [x] Architecture Decision Records (ADRs) initialized (`DECISIONS.md`)
- [x] 2–3 minute judge demonstration sequence planned (`DEMO_FLOW.md`)
- [x] Agent handoff rules and guidelines documented (`AGENT_HANDOFF.md`)
- [x] Professional GitHub `README.md` created
- [x] Clean dark safety-monitoring shell UI built and verified
- [x] Local Git repository initialized with appropriate `.gitignore` and initial commit
- [x] GitHub repository created and synchronized via `gh` CLI

---

## Completed in Phase 1

- [x] `AudioInputService` class (`src/audio/audioInput.ts`)
  - `getUserMedia` microphone acquisition (audio-only)
  - `AudioContext` + `AnalyserNode` initialization and connection
  - `getFloatTimeDomainData` and `getFloatFrequencyData` polling per frame
  - Real RMS energy calculation per frame from PCM samples
  - ACTIVE vs QUIET classification against configurable threshold
  - Full lifecycle: `start()`, `stop()`, cleanup of tracks/nodes/context
  - Prevention of duplicate streams on repeated `start()` calls
  - Graceful error categorization (`PERMISSION_DENIED`, `NOT_SUPPORTED`, `DEVICE_NOT_FOUND`, `INITIALIZATION_FAILED`)
- [x] `useAudioMonitor` React hook (`src/audio/useAudioMonitor.ts`)
  - Bridges `AudioInputService` to React state without direct DOM/Web Audio in UI components
  - Throttled telemetry loop (~20Hz React updates) via `requestAnimationFrame`
  - `startMonitoring()` and `stopMonitoring()` async safe actions
  - Unmount cleanup (RAF cancellation + service stop)
  - All 5 monitoring states exposed: `SYSTEM_READY`, `REQUESTING_PERMISSION`, `MONITORING_ACTIVE`, `PERMISSION_DENIED`, `NOT_SUPPORTED`/`ERROR`
- [x] `LiveWaveform` canvas component (`src/components/LiveWaveform.tsx`)
  - Reads REAL time-domain PCM samples from `AnalyserNode`
  - Renders a neon blue oscilloscope via Canvas 2D API at native `requestAnimationFrame` rate
  - HiDPI (`devicePixelRatio`) aware
  - Zero React re-renders during waveform draw loop
- [x] `AudioActivityMeter` component (`src/components/AudioActivityMeter.tsx`)
  - Displays real RMS energy value with 4 decimal precision
  - ACTIVE / QUIET / STANDBY pill indicator driven by RMS vs threshold
  - Visual VU-style meter bar with non-linear RMS scaling
- [x] Updated `AudioInputConfig` and `AudioFrame` types (`src/audio/types.ts`)
- [x] Updated `App.tsx` with full Phase 1 state machine
- [x] Updated `index.css` with full Phase 1 design tokens
- [x] Build validated: `npm run build` → **0 TypeScript errors, 0 lint errors**

---

## Completed in Phase 2 (NEW)

- [x] **`src/analysis/types.ts`** — Extended `FeatureSet` with all Phase 2 fields:
  - `rmsEnergy` (raw amplitude)
  - `zeroCrossingRate` (fraction of sign changes per sample pair)
  - `spectralCentroid: number | null` (weighted mean Hz; null for silence)
  - `pitchHz: number | null` (F0 from autocorrelation; null when unvoiced)
  - `isSpeech` (VAD result)
  - `silenceDurationSec` (accumulates across frames; resets on voice activity)
  - `speechActivityDurationSec` (cumulative voiced duration this session)
  - `speechSegmentCount` (voice ON transitions since monitoring start)
  - Added `FeatureExtractorConfig` interface for all configurable thresholds

- [x] **`src/analysis/featureFunctions.ts`** — Pure stateless DSP functions:
  - `calculateRms(samples)` — RMS from Float32Array PCM
  - `calculateZeroCrossingRate(samples)` — Normalized ZCR
  - `calculateSpectralCentroid(frequencyData, sampleRate, minMagnitude)` — Weighted Hz centroid from dBFS bins; null on silence
  - `estimatePitch(samples, sampleRate, minHz, maxHz, confidenceThreshold)` — Autocorrelation monophonic F0 estimator; null on unvoiced/low-energy/low-confidence
  - `detectVoiceActivity(rms, threshold)` — Simple energy-gate VAD
  - All functions: no React, no DOM, no browser globals

- [x] **`src/analysis/featureExtractor.ts`** — Stateful `FeatureExtractor` class:
  - `processFrame(frame: AudioFrame): FeatureSet` — main integration point
  - Calls all DSP functions, maintains cross-frame temporal state
  - Pitch only estimated on voiced frames (performance optimization)
  - `reset()` — clears all temporal state
  - `getTemporalState()` — read-only snapshot of internal state
  - `updateConfig(partial)` — live threshold updates
  - Analysis interval: designed for ~10Hz caller frequency (every 100ms)

- [x] **`src/analysis/useFeatureExtractor.ts`** — React hook:
  - Runs `FeatureExtractor.processFrame()` at configurable interval (default 10Hz)
  - Resets extractor on monitoring stop
  - `FeatureExtractor` stored in `useState` (not useRef) — satisfies oxlint react/refs rule
  - 0 oxlint warnings

- [x] **`src/analysis/__tests__/featureExtraction.test.ts`** — Deterministic unit tests:
  - 46 tests, **46 passed, 0 failed**
  - Synthetic audio signals only (no browser, no DOM, no microphone)
  - Tests: RMS from sine/silence/constant, ZCR from square waves, spectral centroid from single-bin spectra, pitch from 150/220/300 Hz sine tones (within 15–20 Hz tolerance), VAD boundary conditions, silence accumulation state machine, voice→silence→voice transitions, speech segment counting, reset()

- [x] **`tsconfig.app.json`** — Excludes `__tests__` dirs from browser build
- [x] **`tsconfig.test.json`** — Separate test config for tsx runner

- [x] **Build validated:** `npm run build` → **0 TypeScript errors, 0 lint errors**
- [x] **Tests validated:** `npx tsx src/analysis/__tests__/featureExtraction.test.ts` → **46/46 passed**

---

## Phase 3 — Multi-Signal Distress Risk Engine (`COMPLETED`)

- [x] **`src/analysis/types.ts`** — Extended contracts for Phase 3:
  - `RiskLevel`: `'NORMAL' | 'ELEVATED' | 'SUSPICIOUS' | 'HIGH_RISK'`
  - `RiskEvaluation`: Full evaluation snapshot with `riskScore`, `riskLevel`, `contributingSignals`, `confirmedSignals`, `persistenceFrames`, `isConfirmed`
  - `SignalContribution`: Per-channel breakdown `{ signal, contribution, reason }` for explainability
  - `RiskEngineConfig`: Configurable baseline references, sensitivity thresholds, EMA decay factor, confirmation frames, weights, and risk level thresholds

- [x] **`src/analysis/riskEngine.ts`** — Stateful heuristic decision engine:
  - Input: `FeatureSet` stream from `FeatureExtractor` (~10Hz)
  - Output: `RiskEvaluation` with smoothed score [0, 100], discrete level, and explainable signal breakdown
  - Pure TypeScript: **Zero React, zero DOM, zero browser API dependencies**
  - Linear bounded scoring for:
    - `pitch`: deviation from reference (weight: 20)
    - `rms`: vocal intensity deviation and whisper detection (weight: 15)
    - `silence`: prolonged hesitation/silence (weight: 15)
    - `voiceActivity`: session voice ratio deficit (weight: 15)
    - `spectral`: high-frequency strain centroid (weight: 10)
    - `zcr`: breathiness/turbulent airflow (weight: 10)
    - `persistence`: sustained abnormality confirmation bonus (weight: 15)
  - Mathematical single-signal ceiling: Max single signal is 20 + 15 persistence = 35 < 70 (`HIGH_RISK`). **No single signal can independently produce `HIGH_RISK`.**
  - Exponential moving average smoothing (`decayFactor: 0.78`): gradual recovery when speech returns to normal, no abrupt jumping or latching.
  - `injectExternalSignal()`: bounded additive boost channel for future code-word (Phase 5) or breathing (Phase 8) signals.
  - `reset()`, `getState()`, `getConfig()`, `updateConfig()` methods.

- [x] **`src/analysis/useRiskEngine.ts`** — React hook:
  - Connects `FeatureSet` from `useFeatureExtractor` to `RiskEngine`
  - Evaluates at ~10Hz
  - Deferral via `setTimeout(0)` to prevent synchronous `setState`-in-effect warnings
  - Clears evaluation and resets engine on monitoring stop
  - 0 oxlint warnings

- [x] **`src/analysis/__tests__/riskEngine.test.ts`** — Deterministic test suite:
  - 59 comprehensive unit tests, **59 passed, 0 failed** (105 total across both suites)
  - Validates normal features, single-signal ceiling, multi-signal combination, temporal persistence, brief spike suppression, sustained multi-signal HIGH_RISK, score decay upon recovery, null pitch safety, bounded [0, 100], threshold determinism, engine reset, external signal injection bounds, signal explainability, and helper functions.

---

## NOT Completed Yet (Intentionally Scheduled for Later Phases)

- [ ] Real-time telemetry dashboard with charts/gauges (Scheduled: Phase 4)
- [ ] Configurable covert code-word detection (Scheduled: Phase 5)
- [ ] Silent alert dispatch simulation & audit modal (Scheduled: Phase 6)
- [ ] Personal voice baseline calibration module (Scheduled: Phase 7)
- [ ] Multi-signal false-positive reduction filters (Scheduled: Phase 8)
- [ ] Mobile/VoIP native integration (Scheduled: Phase 10)

---

## Current Working Functionality (Phase 1 + Phase 2 + Phase 3)

1. **Browser Microphone Capture:** `getUserMedia` with echo cancellation and noise suppression.
2. **AudioContext + AnalyserNode DSP Pipeline:** Frame generation at `fftSize=2048`.
3. **Real-time PCM Oscilloscope:** Live waveform canvas via `getFloatTimeDomainData`.
4. **RMS Energy Measurement:** Per-frame root-mean-square amplitude from actual mic samples.
5. **ACTIVE/QUIET Classification:** Configurable threshold; currently `0.02` RMS default.
6. **5-State Monitoring UI:** `SYSTEM_READY → REQUESTING_PERMISSION → MONITORING_ACTIVE`, plus `PERMISSION_DENIED`, `ERROR`, with Retry.
7. **Full Resource Cleanup:** Tracks stop, nodes disconnect, AudioContext closes on stop/unmount.
8. **Zero-Crossing Rate:** Per-frame sign-change fraction from PCM buffer.
9. **Spectral Centroid:** Weighted frequency centroid in Hz; null on silence.
10. **Pitch Estimation (F0):** Autocorrelation on voiced frames; null on silence/noise.
11. **Voice Activity Detection (VAD):** Simple energy threshold gate.
12. **Silence Duration Tracking:** Cross-frame accumulator; resets on voice resumption.
13. **Speech Timing:** Cumulative speech duration and segment count per session.
14. **Multi-Signal Distress Risk Scoring:** Bounded 0–100 heuristic scoring across 6 acoustic channels + persistence.
15. **Discrete Risk Level Classification:** 0–29 `NORMAL`, 30–49 `ELEVATED`, 50–69 `SUSPICIOUS`, 70–100 `HIGH_RISK`.
16. **Single-Signal Ceiling Safety Invariant:** Provably impossible for any isolated signal to reach `HIGH_RISK`.
17. **Exponential Moving Average Score Decay:** Gradual recovery when signals return to normal calm conversational speech.
18. **Explainable Risk Telemetry:** Every evaluation itemizes active signals with numeric contributions and human-readable reasons.

---

## Phase 2 Known Limitations

- Autocorrelation is O(N×lag-range) per frame. For 2048 samples at 44100Hz and 80–500Hz range, this is acceptable at 10Hz analysis rate but would be expensive at 60Hz.
- VAD uses a single RMS threshold; background noise above threshold will keep `isSpeech=true` during actual silence.
- Spectral centroid currently uses all bins uniformly; a higher-quality implementation would apply frequency weighting or band-pass the input.
- Pitch estimation is monophonic; multi-speaker or music environments produce unreliable estimates.
- `silenceDurationSec` measures acoustic silence (below RMS threshold), not human-perceived silence (e.g. whispering may be missed).
- No personal baseline yet — all thresholds are universal constants.

---

## Rules for Future Agents

1. **UPDATE THIS FILE AFTER EVERY MAJOR PHASE.**
2. **NEVER CLAIM FUNCTIONALITY THAT HAS NOT ACTUALLY BEEN IMPLEMENTED AND TESTED.**
3. **UPDATE `current_prompt_update.md` AFTER EVERY PROMPT.**
