# Sanket — Development Progress & Current State

> **Continuously Updated Development Ledger**  
> Every working engineer and AI coding agent MUST consult this document upon starting work and update it upon finishing any phase.  
> **Cardinal Rule:** Never claim functionality that has not actually been implemented and verified.

---

## Current Status

- **Current Phase:** **UI Overhaul, Live Code Word, Customisable Signals & Built-in Conversation**
- **Status:** `COMPLETED` on branch `feat/ui-overhaul` (stacked on `feat/complete-handoff`), pending review and merge
- **Last Updated:** 2026-09-28
- **Tests:** **730 / 730** across 13 suites · `npm run lint` clean · `npm run build` clean

---

## Completed in UI Overhaul (2026-09-28)

### Requests from the product owner & team → outcome
| Request | Outcome |
| :--- | :--- |
| Much better, less cluttered UI; sections/sidebars; details on click | ✅ App shell with sidebar (desktop) / bottom tabs (phone); 5 views; activity feed where events appear as they trigger; click → detail sheets (event / incident evidence) |
| Light & dark themes | ✅ Light / Dark / System (top-bar toggle + Settings), no flash on load |
| Works cleanly on PC and mobile | ✅ Verified at 1440 px and 375–390 px (no horizontal scroll, bottom sheets, risk gauge first on phones) |
| Use the plugins | ✅ shadcn/ui via the shadcn MCP/CLI, 21st.dev theme ("Teal Mist") and layout references via the 21st MCP, context7 for shadcn/Tailwind v4 setup, Playwright MCP for all browser verification |
| Live code-word detection ("great feature to see") | ✅ On-device Web Speech (`processLocally`), cloud only by explicit opt-in; verified install → downloading → available in Chrome |
| Scenario simulator shouldn't need a live source | ✅ Scenarios drive the engine without any audio |
| Keep real-time alert delivery on hold | ⏸ Unchanged — alerts remain simulated (dispatch preview only) |
| Teammate: site is a demo of a source-agnostic pipeline, **customisable signals dashboard**, **pre-downloaded conversation built in** | ✅ Signals view (toggle/weight/threshold/sensitivity/code-word weight); bundled 53 s two-voice call with transcript captions; "any source" framing across Monitor + pipeline strip |

### Engine / behaviour fixes found while testing with real speech
- Code word was forgotten by the EMA in < 1 s → now sustained ~15 s context (ADR 024).
- One incident produced 10 alerts with natural speech dips → latch hysteresis (ADR 025).
- Activity feed flooded by Elevated ↔ Suspicious flips → level changes post only after ~1.2 s settle.
- Alert banner vanished when the incident auto-resolved → persists until dismissed.

### New modules & tests
- `src/app/*` (pipeline hook/context, activity model, scenario catalogue, signal metadata), `src/views/*`, `src/components/{sanket,shell,theme,ui}/*`
- `src/analysis/signalSettings.ts` (+26 tests), `speechTranscriptSource.ts` (+30 tests), `useLiveSpeech.ts`
- `src/audio/frameBuilder.ts`, `demoConversations.ts`, `public/demo/conversation.{wav,json}`, `scripts/generate_demo_conversation.py`
- `src/audio/__tests__/demoConversation.test.ts` (+28 tests)

## Open Items / Needs Input

- **Real, consented demo recording (team):** the built-in call is synthetic TTS. An acted recording by a teammate would be more convincing; drop it in `public/demo/` with a manifest (see README).
- **Live speech on non-Chrome browsers:** Firefox has no Web Speech API; Safari/Edge on-device support varies. Those users get the typed test or the cloud opt-in.
- **Live-mic code word needs a human test:** on-device recognition was verified to install and report `available`, but transcription of a real spoken phrase can't be automated here. Please try: Monitor → Mic → say *"remember to feed the cat"*.
- **Real alert delivery:** on hold by request (options in `MOBILE_INTEGRATION.md` §7).
- **Temporal filter vs signal toggles:** disabling a signal removes it from scoring, but the temporal-context analyser still counts that channel when judging "multi-signal". Minor; noted in ADR 026.
- **Legacy synthetic tone call:** `src/audio/sampleRecording.ts` is no longer in the UI but kept as an engine regression test.

---

## Pending Questions for the Team

Decisions nobody has made yet. Each one has a current default, so nothing is blocked, but please confirm or change it.
Reply here or in the PR, then record the answer as an ADR in `docs/DECISIONS.md`.

| # | Question | Current default | Where it matters |
| :-: | :--- | :--- | :--- |
| 1 | **Demo recording:** will someone record an acted, consented call to replace the synthetic TTS one? Which language(s)? | Synthetic 53 s English call (Piper TTS, disclosed in the UI) | `public/demo/`, README "Replacing the Demo Conversation" |
| 2 | **Speech language:** should live code-word recognition use `en-IN`, `hi-IN` or a user-selectable language instead of `en-US`? | `en-US`, hard-coded | `src/analysis/useLiveSpeech.ts` (`lang` default) |
| 3 | **Cloud speech opt-in:** keep the opt-in for browsers without on-device support, or remove it so audio can never leave the device? | Opt-in available, off by default, with a warning | Settings → Live code-word listening; ADR 022 |
| 4 | **Alert delivery (on hold):** when resumed, is a backend relay acceptable? That would change the pitch from "zero cloud" to "zero cloud *audio*". | Simulated only; nothing sent | `docs/MOBILE_INTEGRATION.md` §7, §11 |
| 5 | **Target market / emergency integration:** which country's numbers, SMS provider and consent rules? | None | `docs/MOBILE_INTEGRATION.md` §9, §11 |
| 6 | **Default tuning:** are an alert threshold of 70 and weights of 20/15/15/15/10/10 right for judges, or should the demo be more sensitive? | Original engine values | Signals view; `src/analysis/signalSettings.ts` |
| 7 | **Signal toggles vs false-positive filter:** should switching a signal off also exclude it from the temporal filter's "multi-signal" check? | Scoring only (filter still sees it) | `src/analysis/temporalContext.ts`; ADR 026 |
| 8 | **Legacy synthetic tone call:** keep `src/audio/sampleRecording.ts` as an engine regression test, or delete it? | Kept (tests only, not in the UI) | `src/audio/sampleRecording.ts` + its test |
| 9 | **Hosting the demo:** where will it be deployed (Vercel, Netlify, GitHub Pages)? GitHub Pages needs a Vite `base` path. Mic and speech require HTTPS. | Not deployed | `vite.config.ts` |
| 10 | **Branding:** is the teal waves logo/favicon final, or is there an official mark? | Placeholder waves icon | `public/favicon.svg`, sidebar header |
| 11 | **Wearable "are you safe?" confirmation** before an alert: in scope for v1? | Not planned | `docs/MOBILE_INTEGRATION.md` §7, §11 |
| 12 | **Real-voice verification:** someone should say the code phrase into a real mic in Chrome with the on-device pack installed and confirm detection. Automated tests can't cover this. | Verified up to "On-device available" | Monitor → Mic |

---

## Completed in Handoff Completion (2026-09-28)

- [x] **Bug fixes (verified in a real Chromium session):**
  - Demo simulator interval was re-created on every live-mic frame, starving synthetic frames; the Multi-Signal scenario plateaued at ~66–68 and the guided tour often never raised an alert. Now a steady 10 Hz clock per scenario.
  - Incidents were stamped with `performance.now()` and displayed as 1970 in the forensic modal/history; converted to epoch ms in `useIncidentManager`.
  - Guided tour step 6 now opens the evidence modal once the incident latches; steps 5–6 show an "awaiting confirmation" cue.
  - File playback progress bar and playhead froze during playback (status only refreshed on state transitions).
  - File waveform received a new shim object every render; now uses the file service directly.
  - Top-nav pipeline trace caused horizontal page scroll on phones (489 px content at 390 px).
  - Guided tour silently did nothing if microphone access was denied or unavailable; it now runs on its synthetic scenario data regardless.
- [x] **Built-in sample call** — `src/audio/sampleRecording.ts`, "USE SAMPLE CALL" in the Audio Source panel, storyline strip (segments, playhead, simulated transcript captions).
  - `src/audio/__tests__/sampleRecording.test.ts` — **20 tests**, full pipeline in Node via AnalyserNode-equivalent FFT.
- [x] **Trusted contacts & dispatch preview** — `services/trustedContacts.ts`, `services/dispatchPayload.ts`, `services/useTrustedContacts.ts`, `components/TrustedContactsPanel.tsx`, forensic modal §5, banner recipient count.
  - `src/services/__tests__/trustedContacts.test.ts` — **48 tests** incl. privacy invariants.
- [x] **Phase 10** — `docs/MOBILE_INTEGRATION.md` (design only).
- [x] **Totals:** **646 / 646 tests** across 10 suites; `npm run build` and `npm run lint` clean.

## Known Gaps (Not Implemented)

- No speech-to-text: code-word input is manual, preset, or the sample call's scripted transcript (DECISION 020).
- The standalone Scenario Simulator cards still require a live audio source (the guided tour does not).
- No native mobile app, real alert transport, or geolocation.

---

## Completed in Final Demo Console (Phase 10 / Finalization)

- [x] **Source-Agnostic Audio Architecture:**
  - `src/audio/audioFileInput.ts` — `AudioFileInputService` decodes pre-recorded audio files (`.wav`, `.mp3`, `.ogg`) into normalized `AudioFrame` (2048 FFT) matching the microphone pipeline. Supports play, pause, restart, onended transitions, and optional injected contexts for unit testing.
  - `src/audio/useAudioFileMonitor.ts` — `useAudioFileMonitor` React hook managing file decoding, state subscriptions, telemetry animation frame loop, and playback controls.
  - `src/components/AudioSourcePanel.tsx` — Top-level dual source selector tab panel allowing judges to switch between `Live Microphone` and `Simulated Call Audio` (pre-recorded file), reinforcing that Sanket's detection engine is completely source-agnostic.
- [x] **UI Simplification & Information Hierarchy:**
  - `src/App.tsx` & `src/index.css` reorganized into a top-to-bottom story:
    - Audio Source selection & playback controls
    - Central Risk Score HUD & Waveform oscilloscope
    - Multi-signal breakdown with live references and contribution bars
    - Temporal context & false-positive stability metrics
    - Detection timeline and monitoring telemetry
    - Alert history with one-click forensic event review
    - System Configuration Status summary card on the main dashboard (Personal Baseline, Code-Word, Analysis Mode) with clean expansion toggle for technical calibration
  - `src/components/IncidentBanner.tsx` updated with precise honest terminology:
    - Tag: `SILENT DISTRESS ALERT`
    - Status: `CONFIRMED HIGH-RISK EVENT`
    - Subtext: *"Alert generated after sustained multi-signal confirmation • Simulated local alert • Zero external transmission"*
    - CTA: `VIEW EVIDENCE`
- [x] **Comprehensive Audio Adapter Unit Tests:**
  - `src/audio/__tests__/audioFileInput.test.ts` — **54 deterministic unit tests**
  - Covers initial state, subscription lifecycle, file acceptance, decode failure handling, `AudioFrame` schema conformance, playback controls, onended callbacks, RMS thresholding, reset/dispose teardown, and source-switching independence.
- [x] **Full Test Suite & Build Verification:**
  - **578 / 578 tests passing** across 8 test suites:
    - Feature Extraction: 46
    - Risk Engine: 59
    - Code-Word Detector: 56
    - Voice Baseline: 92
    - Incident & Alert System: 95
    - Temporal Context System: 89
    - Demo Controller: 87
    - Audio File Adapter: 54
  - **Build (`npm run build`):** 0 TypeScript errors, clean production bundle.
  - **Lint (`npx oxlint`):** 0 warnings, 0 errors across 55 files.

---

## Completed in Phase 8

- [x] `src/analysis/temporalContext.ts` — `TemporalContextAnalyzer` class
  - Sliding-window bounded history buffer (default 30 frames, zero raw audio retention)
  - Transient event detection (`isTransient`, `transientFrames`, `TRANSIENT_SPIKE`) for short isolated spikes (e.g. 1–2 frames of cough, laugh, or pitch burst)
  - Sustained anomaly detection (`isSustained`, `sustainedFrames`, `SUSTAINED_ANOMALY`) requiring $\ge 3$ consecutive frames
  - Cross-signal temporal correlation (`multiSignalCorrelation`, `isMultiSignal`, `MULTI_SIGNAL_CORRELATION`) measuring co-occurrence of abnormal channels across 10-frame window
  - Voice-derived pause and breathing regularity proxy (`BreathingPatternContext`, `BREATHING_PATTERN_ANOMALY`): analyzes pause count, mean duration, and variance across 40-frame window; strictly disclaimed as voice-derived conversational turn pacing, NOT medical or respiratory sensing
  - Seamless baseline deviation Z-score integration ($|Z| \ge 2.0$) with fallback to prototype heuristic thresholds
- [x] `src/analysis/useTemporalContext.ts` — React lifecycle hook bridging analyzer with live feature frames and baseline deviations
- [x] `src/services/incidentManager.ts` — False-positive suppression gate
  - Gating condition: isolated transient spikes (`isTransient && !isSustained && !isMultiSignal`) suppress emergency alert dispatch
  - Multi-signal or sustained crises are never suppressed and pass to alert dispatch
  - Preserves single authoritative scoring role of `RiskEngine` without formula tampering
- [x] `src/services/silentAlertDispatcher.ts` — Forensic metadata preservation
  - Preserves `temporalContext` snapshot in created `DistressIncident` models
- [x] `src/components/TemporalContextCard.tsx` — Dashboard HUD card
  - Status badges: `STABLE`, `TRANSIENT SPIKE`, `SUSTAINED`, `MULTI-SIGNAL`, `PAUSE PATTERN IRREGULAR`
  - 4-metric grid: Sustained Frames, Transient Frames, Cross-Signal Correlation %, and Voice-Derived Pause Regularity
  - Real-time non-diagnostic explainability banner
- [x] `src/components/ForensicEventModal.tsx` — Extended with temporal context audit box
- [x] `src/utils/demoScenariosData.ts` & `src/components/DemoScenarios.tsx` — Added 3 interactive preset scenarios: `TRANSIENT_PITCH_SPIKE`, `TRANSIENT_LOUD_EVENT`, and `IRREGULAR_PAUSE_PATTERN`
- [x] `src/analysis/__tests__/temporalContext.test.ts` — **89 deterministic unit tests** covering transient spikes, sustained anomalies, cross-signal correlation, baseline deviation activation, pause proxy regularity, bounds/safety, and suppression integration
- [x] Full Test Suite: **437 / 437 tests passing** (Phase 2: 46, Phase 3: 59, Phase 5: 56, Phase 6: 92, Phase 7: 95, Phase 8: 89)
- [x] Build & Lint: 0 TypeScript errors, 0 ESLint warnings/errors

---

## Completed in Phase 7

- [x] `src/services/silentAlertDispatcher.ts` — Simulated silent alert dispatch service
  - Strict dispatch gating: requires `riskLevel === 'HIGH_RISK'` AND `isConfirmed === true`
  - Generates unique structured incident ID (`inc-...`) and alert ID (`alt-...`)
  - Strictly `SIMULATED_LOCAL` mode — never plays audio, never uses OS popups, never contacts emergency services
  - `createDistressIncident()` creates structured incident metadata with zero raw audio retention
- [x] `src/services/incidentManager.ts` — Incident latch & duplicate alert protection state machine
  - Latch prevents duplicate alerts during sustained HIGH_RISK episodes (dispatches exactly once per incident)
  - Continues updating live peak risk score, persistence frames, and corroborating signals in place
  - Automatically resolves active incident and unlatches when risk returns below HIGH_RISK
  - Allows subsequent confirmed HIGH_RISK events to cleanly trigger brand new incidents
  - Exposes manual acknowledgment, manual resolution, and latch reset APIs
- [x] `src/services/alertHistory.ts` — Local bounded incident audit log
  - Persists up to 50 incidents in `localStorage` under `sanket_alert_history_v1`
  - Sorts newest first; supports `getIncidents()`, `getIncidentById()`, `acknowledgeIncident()`, `resolveIncident()`, `clearHistory()`
  - Resilient storage error handling: handles malformed JSON, corrupted structures, and restricted environments gracefully
- [x] `src/services/useIncidentManager.ts` — React lifecycle hook bridging engine and UI
  - Tracks `currentIncident`, `latestAlert`, `alertHistory`, `alertDispatched`, and modal state
  - Supports manual acknowledgment, resolution, and inspection modal opening/closing
- [x] `src/components/IncidentBanner.tsx` — Prominent, silent dashboard distress alert bar
  - Displays risk score, risk level, timestamp, confirmed signals count, persistence frames
  - Distinguishes between `LIVE MICROPHONE` and `DEMO SIMULATION`
  - Actions for "VIEW EVENT" and "ACKNOWLEDGE" without audible noise
- [x] `src/components/ForensicEventModal.tsx` — Interactive forensic incident inspection modal
  - Event summary: ID, timestamp, origin, risk classification, score
  - Contributing signals table: name, score added, baseline deviation (e.g. 2.4σ from baseline), heuristic reason
  - Multi-signal confirmation: persistence frames, corroborating channel count, code-word status
  - Feature snapshot: pitch, energy, silence, centroid, ZCR at confirmation moment
  - Explicit privacy guarantee & simulated local dispatch disclaimer
- [x] `src/components/AlertHistory.tsx` — Dashboard incident audit panel
  - Chronological list of past incidents with status pills (`ACTIVE`, `ACKNOWLEDGED`, `RESOLVED`)
  - Clicking any incident opens its full forensic modal
  - Empty state and clear history action
- [x] `src/App.tsx` & `src/index.css` — Integrated Phase 7 UI
  - Added "Alert Dispatch" step to pipeline trace
  - Prominent `IncidentBanner` and dashboard `AlertHistory` card
  - Rich glassmorphic HUD styles with zero layout shift
- [x] `src/services/__tests__/incidentSystem.test.ts` — **95 deterministic unit tests**
  - Gating invariants (unconfirmed/non-HIGH_RISK blocked)
  - Duplicate alert prevention during sustained incidents
  - Latch release upon recovery and fresh incident creation upon recurrence
  - History bounding (50 items max), ordering, status updates, and storage error resilience
  - Forensic metadata preservation and privacy invariants (zero raw audio)
- [x] Full Test Suite: **348 / 348 tests passing** (Phase 2: 46, Phase 3: 59, Phase 5: 56, Phase 6: 92, Phase 7: 95)
- [x] Build & Lint: 0 TypeScript errors, 0 ESLint warnings/errors

- [x] `src/analysis/baselineBuilder.ts` — `BaselineBuilder` class using Welford's Online Algorithm
  - Single-pass O(1) per sample — never stores raw audio frames or PCM data
  - Accumulates Welford state for: pitch (F0), RMS energy, ZCR, spectral centroid, silence duration
  - Pitch range filtering (configurable, default 50–600 Hz) discards out-of-band outliers
  - `isReady()`, `getProgress()`, `getRunningStats()` for live UI feedback
  - `finalize(userId)` produces a `BaselineProfile` with mean + sample stdDev per channel
  - `reset()` clears all accumulated state cleanly
- [x] `src/analysis/baselineDeviation.ts` — `calculateBaselineDeviation()` pure function
  - Computes |Z-score| per channel vs `BaselineProfile` statistics
  - Channels: pitchZScore, energyZScore, silenceExcessRatio, zcrZScore, spectralZScore
  - StdDev floor per-channel prevents division-by-zero for highly consistent speakers
  - Z-score capped at 4.0 to prevent extreme outlier saturation
  - Returns `NoBaselineResult` when no profile available — engine falls back to prototype heuristics
  - `baselineToRiskEngineConfig()` maps BaselineProfile → `RiskEngineConfig` overrides
- [x] `src/analysis/useCalibration.ts` — React calibration lifecycle hook
  - States: IDLE → CALIBRATING → COMPLETE | ERROR
  - 30-second auto-finalize timer + early manual finalize once ready
  - Persists `BaselineProfile` to `localStorage` (survives page refresh)
  - Calls `riskEngine.updateConfig()` on finalize to instantly personalize engine references
  - Restores persisted profile on mount and re-applies to engine
  - `clearBaseline()` resets engine back to prototype defaults
- [x] `src/components/CalibrationPanel.tsx` — 4-state UI panel
  - IDLE: UserCheck icon + Start button (disabled unless monitoring active)
  - CALIBRATING: SVG progress ring (animated), voiced frame count, elapsed timer, early-finalize & cancel buttons
  - COMPLETE: 4-stat profile summary grid (pitch mean/stdDev, intensity, silence onset, calibrated date)
  - ERROR: Error explanation + Retry button
- [x] `src/App.tsx` — Phase 6 wired into dashboard
  - `useCalibration` hook consumes `effectiveFeatures` and `riskEngineInstance`
  - `CalibrationPanel` rendered in new console row
  - Pipeline trace: "Baseline" step shows dimmed vs active depending on calibration status
  - Footer updated: "Phase 6 Personal Baseline ✓" when calibrated
- [x] `src/analysis/__tests__/baseline.test.ts` — **92 deterministic unit tests**
  - Welford algorithm correctness (mean, M2, stdDev, numerical stability with large values)
  - BaselineBuilder lifecycle (pre-start guard, progress, finalize, throws when insufficient)
  - Silence frame handling (only voiced frames counted, capped silence included in silence stats)
  - Pitch range filtering (out-of-band samples discarded)
  - Reset and re-calibration cycle
  - Running stats mid-calibration
  - Z-score accuracy (at mean, ±1σ, ±2σ, absolute value for negative deviation)
  - Z-score cap enforcement (extreme outliers → Z_SCORE_CAP)
  - StdDev floor (prevents infinity for perfectly consistent speakers)
  - Silence frames (null Z-scores for voice channels, silenceExcessRatio computed)
  - Null pitch handling
  - baselineToRiskEngineConfig mapping (floor enforcement, 1.5× silence multiplier)
  - End-to-end integration test
  - Privacy invariants (no raw samples in profile object)
  - Determinism (two builders on same input → identical output)

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

## Phase 4 — Live Sanket Safety Dashboard Console (`COMPLETED`)

- [x] **`src/components/RiskScoreGauge.tsx`** — Interactive HUD circular gauge:
  - 260-degree SVG circular gauge with gradient color arcs and glow filters
  - Prominent real-time Distress Risk Score (0–100) and discrete Risk Level badge (`NORMAL`, `ELEVATED`, `SUSPICIOUS`, `HIGH_RISK`)
  - Dynamic color theme transitions (Emerald, Amber, Orange, Red) and pulsing status beacons
  - Persistence indicators (`frames sustained`, `active channels`, confirmation status)
- [x] **`src/components/SignalBreakdown.tsx`** — 6-Channel Telemetry Breakdown:
  - Individual cards for Pitch Deviation, Vocal Intensity, Prolonged Silence, Voice Activity Ratio, Spectral Centroid, and ZCR Turbulence
  - Proportional contribution progress bars showing points added to composite score
  - Real-time values against reference baselines and human-readable anomaly explanations
  - Temporal persistence notice banner
- [x] **`src/components/DetectionTimeline.tsx`** — Detection Timeline & Mini Sparkline:
  - 30-sample rolling sparkline showing real-time score trajectory with color-coded severity bars
  - Real-time event log capturing level transitions (`LEVEL_UP`, `LEVEL_DOWN`) and multi-signal co-occurrences with timestamps
- [x] **`src/components/MonitoringStatus.tsx`** — Pipeline & Audio Hardware Status:
  - Input audio layer specs (Web Audio API, sample rate, 2048 FFT)
  - VAD classification indicator (`VOICED SPEECH` vs `AMBIENT / QUIET`) with live RMS VU meter
  - DSP cadence indicators (10Hz analysis rate) and session accumulation counters
  - 100% local processing security assurance badge
- [x] **`src/components/DemoScenarios.tsx` & `src/utils/demoScenariosData.ts`** — Hackathon Demo Mode:
  - 7 preset test scenarios: Live Mic, Calm Conversational, Isolated Pitch Spike (demonstrates ceiling), Prolonged Silence, Strained Whisper, Multi-Signal Distress (75+ HIGH RISK), and Signals Normalizing (demonstrates EMA recovery decay)
  - Fully compliant with Vite React Fast Refresh
- [x] **`src/App.tsx` & `src/index.css`** — Full Console Assembly:
  - Unified pipeline trace: `Microphone → Feature Extractor → Risk Engine → Console`
  - High-fidelity dark HUD safety aesthetic with Vanilla CSS, glassmorphism, and responsive layout
  - 0 lint errors, 0 build errors, 105/105 tests passing

---

## Phase 5 — Configurable Code-Word Detection (`COMPLETED`)

- [x] **`src/analysis/types.ts`** — Extended contracts for Phase 5:
  - `CodeWordDetectorConfig`: `phrase`, `enabled`, `cooldownMs: 5000`, `fuzzyTolerance: true`, `fuzzyThreshold: 0.85`.
  - `CodeWordDetection`: `detected`, `matchedPhrase`, `normalizedPhrase`, `confidence`, `timestamp`, `reason`, `sourceId`.
- [x] **`src/analysis/transcriptTypes.ts`** — Input-agnostic transcript abstraction:
  - `TranscriptEvent` (`text`, `isFinal`, `confidence`, `timestamp`, `sourceId`)
  - `TranscriptSource` interface (`start`, `stop`, `onTranscript`, `getStatus`)
  - Pure decoupled interface ready for future Web Speech, mobile OS, or VoIP stream listeners.
- [x] **`src/analysis/manualTranscriptSource.ts`** — Deterministic test adapter:
  - In-memory event dispatcher implementing `TranscriptSource` for automated tests and evaluator input simulation.
- [x] **`src/analysis/codeWordDetector.ts`** — Token-aware covert phrase spotter:
  - Pure TypeScript, zero React/DOM dependencies.
  - Deterministic text normalization: lowercases, strips harmless punctuation, collapses whitespace, extracts word tokens.
  - Sliding-window token comparison with strict word boundary enforcement (prevents single-token or partial-word false triggers like "cat" in "catastrophe").
  - Morphological fuzzy tolerance: handles common speech recognition inflections (plurals 'cat' vs 'cats', verb suffixes 'feed' vs 'feeding').
  - 5000ms cooldown debounce window suppressing duplicate speech-recognition re-emissions.
  - Zero transcript retention: processed ephemerally, never stores conversation transcripts or logs.
- [x] **`src/analysis/riskEngine.ts`** — Contextual Signal Integration:
  - `injectExternalSignal(boostAmount, maxBoost = 25, metadata)` injects bounded additive boost (+25 pts).
  - Actively reported in `contributingSignals` as `{ signal: 'codeWord', contribution: 25, reason: 'Configured distress phrase detected' }`.
  - Single-signal ceiling holds: 25 < 70 (`HIGH_RISK`). Code word alone cannot trigger emergency status; requires multi-signal corroboration.
- [x] **`src/components/CodeWordConfig.tsx`** — Interactive Configuration HUD:
  - Custom trigger phrase input with local state.
  - Armed / Disarmed status toggle button.
  - Live detection banner showing match snippet, confidence %, and contextual score boost.
  - Interactive test transcript input & quick-preset buttons for judge demonstration.
  - Clear privacy disclaimer communicating local prototype matching.
- [x] **`src/components/DetectionTimeline.tsx` & `src/components/SignalBreakdown.tsx`**:
  - Timeline logs code-word events (`Configured code word detected`) without leaking the full secret phrase into history.
  - SignalBreakdown dynamically renders `Covert Code Word (+25 pts)` when active.
- [x] **`src/components/DemoScenarios.tsx` & `src/utils/demoScenariosData.ts`**:
  - Added `Covert Code Word Trigger` (demonstrating bounded boost) and `Multi-Signal + Code Word` (demonstrating 85+ `HIGH_RISK` escalation).
  - Explicitly labeled as `SIMULATED CODE-WORD INPUT / DEMO TRANSCRIPT`.
- [x] **`src/analysis/__tests__/codeWordDetector.test.ts`** — Deterministic unit tests:
  - 56 comprehensive unit tests (**56 passed, 0 failed**).
  - Total test suite: **161 passed, 0 failed (100%)**.

---

## NOT Completed Yet (Intentionally Scheduled for Later Phases)

- [ ] Personal voice baseline calibration module (Scheduled: Phase 6)
- [ ] Silent alert dispatch simulation & audit modal (Scheduled: Phase 7)
- [ ] Multi-signal false-positive reduction filters (Scheduled: Phase 8)
- [ ] Mobile/VoIP native integration (Scheduled: Phase 10)

---

## Current Working Functionality (Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5)

1. **Browser Microphone Capture:** `getUserMedia` with echo cancellation and noise suppression.
2. **AudioContext + AnalyserNode DSP Pipeline:** Frame generation at `fftSize=2048`.
3. **Real-time PCM Oscilloscope:** Live waveform canvas via `getFloatTimeDomainData` at 60 FPS.
4. **RMS Energy Measurement:** Per-frame root-mean-square amplitude from actual mic samples.
5. **ACTIVE/QUIET Classification:** Configurable threshold; currently `0.015` RMS default.
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
19. **Live Sanket Console HUD:** Interactive circular risk gauge, 6-channel acoustic breakdown, real-time sparkline & transition timeline, hardware & VAD status monitors, and interactive demonstration scenario simulator.
20. **Covert Code-Word Detection:** Configurable trigger phrase spotter with token-aware matching, fuzzy morphological tolerance, duplicate suppression cooldown, bounded contextual risk boost (+25 pts), and timeline audit logging without phrase leakage.

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
