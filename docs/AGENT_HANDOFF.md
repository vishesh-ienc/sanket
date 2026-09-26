# Sanket — Agent Handoff Specification

> **Operational Handoff for Incoming Coding Agents**  
> If you are an AI coding assistant or engineer taking over this repository, this file is your primary onboarding manifest. Read it carefully before writing a single line of code.

---

## 1. What is Sanket?
**Sanket** is a multimodal voice distress-risk detection prototype. It monitors permitted audio streams for non-verbal acoustic signals of distress—such as pitch strain, voice tremors, prolonged silences, and user-configured covert code-words—fusing them into an explainable **Distress Risk Score (0–100)** to trigger simulated silent alerts without alerting bystanders.

---

## 2. Current Project Status
- **Phase:** **Phase 3 — Multi-Signal Distress Risk Engine** (`COMPLETED`)
- **Git State:** Clean, all tests passing, ready for Phase 4.
- **Build Status:** `npm run build` passes with 0 TypeScript errors. `npm run lint` passes with 0 warnings/errors.
- **Tests:**
  - `npx tsx src/analysis/__tests__/featureExtraction.test.ts` → **46/46 passed**
  - `npx tsx src/analysis/__tests__/riskEngine.test.ts` → **59/59 passed**
  - Total: **105 passed, 0 failed**
- **Runtime:** React 19 + TypeScript + Vite dev server (`npm run dev`).

---

## 3. Current Phase
- **Completed:** Phase 1 (Audio Input), Phase 2 (Feature Extraction), Phase 3 (Multi-Signal Risk Engine).
- **Next Phase:** **Phase 4 — Live Sanket Safety Dashboard.**

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

### Phase 2
- **`src/analysis/types.ts`**: `FeatureSet` (9 fields), `FeatureExtractorConfig`.
- **`src/analysis/featureFunctions.ts`**: Pure stateless DSP functions:
  - `calculateRms(samples)` — RMS from PCM Float32Array
  - `calculateZeroCrossingRate(samples)` — normalized sign-change fraction
  - `calculateSpectralCentroid(frequencyData, sampleRate, minMagnitude)` — weighted Hz centroid; **null** on silence
  - `estimatePitch(samples, sampleRate, minHz, maxHz, confidenceThreshold)` — autocorrelation F0; **null** on unvoiced/low-energy
  - `detectVoiceActivity(rms, threshold)` — energy gate VAD
- **`src/analysis/featureExtractor.ts`**: Stateful `FeatureExtractor` class:
  - `processFrame(frame: AudioFrame): FeatureSet` — complete per-frame analysis (~10Hz)
  - Internal `TemporalState`: `silenceDurationSec`, `speechActivityDurationSec`, `speechSegmentCount`, `wasVoicedPrevFrame`, `lastFrameTimestamp`
  - `reset()`, `getTemporalState()`, `updateConfig()` methods
- **`src/analysis/useFeatureExtractor.ts`**: React hook:
  - Runs at configurable analysis interval (default 100ms / 10Hz)
  - `FeatureExtractor` stored in `useState` (not `useRef`) — satisfies oxlint react/refs rule
  - Resets extractor on monitoring stop
- **`src/analysis/__tests__/featureExtraction.test.ts`**: 46 deterministic unit tests.

### Phase 3 (NEW)
- **`src/analysis/types.ts`**:
  - `RiskLevel`: `'NORMAL' | 'ELEVATED' | 'SUSPICIOUS' | 'HIGH_RISK'`
  - `RiskEvaluation`: Smoothed composite score (0–100), level, explainable signal breakdown, confirmed signal count, persistence frames, isConfirmed flag.
  - `SignalContribution`: Per-channel detail `{ signal, contribution, reason }`.
  - `RiskEngineConfig`: Thresholds, baseline references, EMA smoothing factor, confirmation count, per-signal weights.
- **`src/analysis/riskEngine.ts`**: Pure TypeScript heuristic risk decision engine:
  - 6 independent signal channels (pitch, RMS, silence, voice activity, spectral centroid, ZCR) + persistence bonus.
  - Bounded linear scoring functions per channel.
  - Single-signal ceiling: Max single weight is 20, max single + persistence is 35 < 70 (`HIGH_RISK`). **Single signals provably cannot trigger `HIGH_RISK`.**
  - Exponential moving average smoothing (`decayFactor: 0.78`): gradual recovery when speech normalizes; transient spikes do not latch into alerts.
  - `injectExternalSignal()`: bounded additive channel for future Phase 5 (code-word) and Phase 8 (breathing) integration.
  - `reset()`, `getState()`, `getConfig()`, `updateConfig()`, and `evaluationToRiskEvent()` methods.
- **`src/analysis/useRiskEngine.ts`**: React hook:
  - Bridges `useFeatureExtractor` output into `RiskEngine` (~10Hz).
  - Clean lifecycle reset on monitoring stop.
  - Deferrals with `setTimeout(0)` to prevent React effect state-update warnings.
- **`src/analysis/__tests__/riskEngine.test.ts`**: 59 deterministic unit tests covering mathematical proofs, signal bounds, recovery decay, and determinism.

---

## 5. What Has NOT Been Implemented (Do NOT Claim Working)
- [ ] Distress telemetry dashboard (gauges, meter, cards, history) → Phase 4
- [ ] Covert code-word spotter → Phase 5
- [ ] Silent alert dispatch simulation & forensic modal → Phase 6
- [ ] Personal baseline calibration (`BaselineProfile`) → Phase 7
- [ ] Multi-signal false-positive reduction filters → Phase 8
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
