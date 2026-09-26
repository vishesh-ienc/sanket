# Sanket — Agent Handoff Specification

> **Operational Handoff for Incoming Coding Agents**  
> If you are an AI coding assistant or engineer taking over this repository, this file is your primary onboarding manifest. Read it carefully before writing a single line of code.

---

## 1. What is Sanket?
**Sanket** is a multimodal voice distress-risk detection prototype. It monitors permitted audio streams for non-verbal acoustic signals of distress—such as pitch strain, voice tremors, prolonged silences, and user-configured covert code-words—fusing them into an explainable **Distress Risk Score (0–100)** to trigger simulated silent alerts without alerting bystanders.

---

## 2. Current Project Status
- **Phase:** **Phase 2 — Voice Feature Extraction** (`COMPLETED`)
- **Git State:** Clean, to be committed and pushed.
- **Build Status:** `npm run build` passes with 0 TypeScript errors. `npm run lint` passes with 0 warnings/errors.
- **Tests:** `npx tsx src/analysis/__tests__/featureExtraction.test.ts` → **46/46 passed**
- **Runtime:** React 19 + TypeScript + Vite dev server (`npm run dev`).

---

## 3. Current Phase
- **Completed:** Phase 2.
- **Next Phase:** **Phase 3 — Multi-Signal Distress Risk Engine.**

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
  - `start()`: `getUserMedia` → `AudioContext` → `AnalyserNode` → connect source.
  - `stop()`: disconnects nodes, stops media tracks, closes AudioContext.
  - `getCurrentFrame()`: returns `AudioFrame` snapshot with real PCM data.
  - `calculateRms()`: RMS energy from Float32Array samples.
  - `isAudioActive()`: threshold comparison (ACTIVE vs QUIET).
  - `getAnalyserNode()`: exposes AnalyserNode for canvas rendering.
- **`src/audio/useAudioMonitor.ts`**: React hook bridging `AudioInputService` to UI (20Hz).
- **`src/components/LiveWaveform.tsx`**: Canvas-based real PCM oscilloscope.
- **`src/components/AudioActivityMeter.tsx`**: RMS meter and ACTIVE/QUIET indicator.
- **`src/App.tsx`**: Full 5-state monitoring UI shell.
- **`src/index.css`**: Extended with all Phase 1 component styles.

### Phase 2 (NEW)
- **`src/analysis/types.ts`**: Expanded `FeatureSet` (8 fields), added `FeatureExtractorConfig`.
- **`src/analysis/featureFunctions.ts`**: Pure stateless DSP utility functions:
  - `calculateRms(samples)` — RMS from PCM Float32Array
  - `calculateZeroCrossingRate(samples)` — normalized sign-change fraction
  - `calculateSpectralCentroid(frequencyData, sampleRate, minMagnitude)` — weighted Hz centroid; **null** on silence
  - `estimatePitch(samples, sampleRate, minHz, maxHz, confidenceThreshold)` — autocorrelation F0; **null** on unvoiced/low-energy
  - `detectVoiceActivity(rms, threshold)` — energy gate VAD
- **`src/analysis/featureExtractor.ts`**: Stateful `FeatureExtractor` class:
  - `processFrame(frame: AudioFrame): FeatureSet` — complete per-frame analysis
  - Internal `TemporalState`: `silenceDurationSec`, `speechActivityDurationSec`, `speechSegmentCount`, `wasVoicedPrevFrame`, `lastFrameTimestamp`
  - `reset()`, `getTemporalState()`, `updateConfig()` methods
- **`src/analysis/useFeatureExtractor.ts`**: React hook:
  - Runs at configurable analysis interval (default 100ms / 10Hz)
  - `FeatureExtractor` stored in `useState` (not `useRef`) — satisfies oxlint react/refs rule
  - Resets extractor on monitoring stop
- **`src/analysis/__tests__/featureExtraction.test.ts`**: 46 deterministic tests (synthetic audio, no DOM/browser)
- **`tsconfig.app.json`**: `__tests__` directories excluded from browser build
- **`tsconfig.test.json`**: Separate tsconfig for test runner

---

## 5. What Has NOT Been Implemented (Do NOT Claim Working)
- [ ] Risk Score calculation (0–100 numeric) → Phase 3
- [ ] `RiskLevel` classification (`NORMAL` / `ELEVATED` / `SUSPECTED` / `CRITICAL`) → Phase 3
- [ ] Multi-signal temporal co-occurrence weighting → Phase 3
- [ ] Personal baseline calibration (`BaselineProfile`) → Phase 7
- [ ] Distress telemetry dashboard → Phase 4
- [ ] Covert code-word spotter → Phase 5
- [ ] Silent alert dispatch simulation → Phase 6
- [ ] Multi-signal false-positive filter → Phase 8

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
featureFunctions.ts (calculateRms, calculateZeroCrossingRate, calculateSpectralCentroid, estimatePitch, detectVoiceActivity)
   ↓ maintains
TemporalState { silenceDurationSec, speechActivityDurationSec, speechSegmentCount, ... }
   ↓ emits
FeatureSet { rmsEnergy, zeroCrossingRate, spectralCentroid, pitchHz, isSpeech,
             silenceDurationSec, speechActivityDurationSec, speechSegmentCount }
   ↓
Future Phase 3 Risk Engine hook (useRiskEngine)

LiveWaveform component  → reads AnalyserNode directly at ~60fps RAF
AudioActivityMeter component → reads activity state from useAudioMonitor
```

---

## 7. FeatureSet Contract

```typescript
interface FeatureSet {
  timestamp: number;                // ms (performance.now())
  rmsEnergy: number;                // 0.0–1.0 amplitude ratio (NOT calibrated dBSPL)
  zeroCrossingRate: number;         // 0.0–1.0 fraction of sign changes
  spectralCentroid: number | null;  // Hz, null on silence
  pitchHz: number | null;           // Hz, null on unvoiced/silence/low-confidence
  isSpeech: boolean;                // VAD gate
  silenceDurationSec: number;       // continuous silence since last voice, resets on voice
  speechActivityDurationSec: number;// cumulative voiced duration this session
  speechSegmentCount: number;       // count of voice ON transitions
}
```

**Critical nullability rule:** `pitchHz: null` and `pitchHz: 0` are DIFFERENT states. The risk engine must handle null correctly (= "unavailable") vs 0 (= "measured as 0Hz", which is physically impossible for speech).

---

## 8. Test Strategy

- All feature extraction tests use synthetic Float32Array signals.
- No browser, no DOM, no microphone required.
- Run with: `npx tsx src/analysis/__tests__/featureExtraction.test.ts`
- Tests cover: RMS (silence, constant, sine), ZCR (silence, constant, square waves), spectral centroid (silence→null, single bin), pitch (150/220/300 Hz tones ±15–20Hz, silence→null, low amplitude→null, invalid range→null), VAD (boundary conditions, custom thresholds), temporal state machine (silence accumulation, voice→silence→voice transitions, segment counting, reset).

---

## 9. Important Product Decisions
- **Decision 001:** Name is **Sanket**.
- **Decision 002:** Browser microphone is strictly the prototype input layer.
- **Decision 003:** Core engine is input-agnostic.
- **Decision 004:** No single acoustic signal triggers an emergency conclusion.
- **Decision 005:** Heuristic rule-based scoring over opaque fake ML.
- **Decision 006:** Local-first, zero-cloud audio streaming.
- **Decision 007:** `getAnalyserNode()` exposed for canvas rendering (Phase 1).
- **Decision 008:** Autocorrelation chosen over YIN or external library for pitch (Phase 2).
- **Decision 009:** `FeatureExtractor` maintains temporal state internally, not in React (Phase 2).

---

## 10. Files & Folders That Matter

| File | Purpose |
| :--- | :--- |
| [docs/PROJECT_CONTEXT.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/PROJECT_CONTEXT.md) | Primary source of truth |
| [docs/ARCHITECTURE.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/ARCHITECTURE.md) | Technical specs & data contracts |
| [docs/PROGRESS.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/PROGRESS.md) | Current implementation state |
| [docs/DECISIONS.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/DECISIONS.md) | Architecture Decision Records |
| [src/audio/types.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/audio/types.ts) | Audio layer data contracts |
| [src/audio/audioInput.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/audio/audioInput.ts) | AudioInputService |
| [src/audio/useAudioMonitor.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/audio/useAudioMonitor.ts) | React hook — audio bridge |
| [src/analysis/types.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/types.ts) | FeatureSet, FeatureExtractorConfig, RiskEvent contracts |
| [src/analysis/featureFunctions.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/featureFunctions.ts) | Pure DSP functions |
| [src/analysis/featureExtractor.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/featureExtractor.ts) | Stateful FeatureExtractor class |
| [src/analysis/useFeatureExtractor.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/useFeatureExtractor.ts) | React hook — feature bridge |
| [src/analysis/__tests__/featureExtraction.test.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/__tests__/featureExtraction.test.ts) | 46 deterministic tests |
| [src/components/LiveWaveform.tsx](file:///c:/Users/VISHESH/Desktop/SANKET/src/components/LiveWaveform.tsx) | Canvas oscilloscope |
| [src/components/AudioActivityMeter.tsx](file:///c:/Users/VISHESH/Desktop/SANKET/src/components/AudioActivityMeter.tsx) | RMS meter |
| [src/App.tsx](file:///c:/Users/VISHESH/Desktop/SANKET/src/App.tsx) | Main UI shell |
| [src/index.css](file:///c:/Users/VISHESH/Desktop/SANKET/src/index.css) | Design system |

---

## 11. Next Phase — Phase 3: Multi-Signal Distress Risk Engine

The next agent should build `src/analysis/riskEngine.ts`:

**Inputs:** `FeatureSet` stream from `FeatureExtractor`  
**Outputs:** Numeric `riskScore` (0–100) + `RiskLevel` + contributing signal list + `RiskEvent` when score crosses thresholds

**Key implementation notes:**
- This phase DOES introduce distress scoring — but it must use **transparent, weighted, configurable** heuristics.
- Each contributing signal (pitch deviation, silence duration, RMS shift, etc.) contributes a weighted sub-score.
- No single signal produces a `CRITICAL` classification.
- Score should decay gradually when signals return to normal (not binary on/off).
- Use `BaselineProfile` if available; fall back to universal population defaults if not yet calibrated.
- `RiskEvent` is emitted when `riskScore` crosses defined thresholds.
- Build a `useRiskEngine` React hook for integration.
- No dashboard yet — Phase 4 handles visualization.

---

## 12. Rules For The Next Agent

1. **Read `docs/PROJECT_CONTEXT.md` first.**
2. **Read `docs/PROGRESS.md` second.**
3. **Read `docs/ARCHITECTURE.md` before modifying architecture.**
4. **Read `docs/DECISIONS.md` before making major technical decisions.**
5. **Do not duplicate existing functionality.**
6. **Do not modify `AudioInputService` or `FeatureExtractor` — consume their output.**
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
