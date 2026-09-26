# Sanket — Agent Handoff Specification

> **Operational Handoff for Incoming Coding Agents**  
> If you are an AI coding assistant or engineer taking over this repository, this file is your primary onboarding manifest. Read it carefully before writing a single line of code.

---

## 1. What is Sanket?
**Sanket** is a multimodal voice distress-risk detection prototype. It monitors permitted audio streams for non-verbal acoustic signals of distress—such as pitch strain, voice tremors, prolonged silences, and user-configured covert code-words—fusing them into an explainable **Distress Risk Score (0–100)** to trigger simulated silent alerts without alerting bystanders.

---

## 2. Current Project Status
- **Phase:** **Phase 1 — Browser Microphone + Live Audio Analysis** (`COMPLETED`)
- **Git State:** Clean, committed and pushed to GitHub.
- **Build Status:** `npm run build` passes with 0 TypeScript errors. `npm run lint` passes with 0 warnings/errors.
- **Runtime:** React 19 + TypeScript + Vite dev server (`npm run dev`).

---

## 3. Current Phase
- **Completed:** Phase 1.
- **Next Phase:** **Phase 2 — Pitch, Energy, Speech Activity & Silence Detection.**

---

## 4. What Has Been Implemented

### Phase 0
- Clean React 19 + TypeScript + Vite project configuration.
- Dark safety-monitoring UI shell.
- Full documentation suite in `/docs`.
- Directory scaffold for decoupled audio/analysis modules.

### Phase 1 (NEW)
- **`src/audio/types.ts`**: Enhanced with `AudioFrame` (added `frameSize`, `rmsEnergy`), `MonitoringState`, `AudioInputError`, `AudioActivityState`, `AudioInputConfig` (added `activeThresholdRms`).
- **`src/audio/audioInput.ts`**: `AudioInputService` class.
  - `start()`: `getUserMedia` → `AudioContext` → `AnalyserNode` → connect source.
  - `stop()`: disconnects nodes, stops media tracks, closes AudioContext.
  - `getCurrentFrame()`: returns `AudioFrame` snapshot with real PCM data.
  - `calculateRms()`: computes real RMS energy from Float32Array samples.
  - `isAudioActive()`: threshold comparison (ACTIVE vs QUIET).
  - `getAnalyserNode()`: exposes AnalyserNode for canvas rendering without data copies.
  - Full error categorization with user-facing messages (no raw browser errors shown).
- **`src/audio/useAudioMonitor.ts`**: React hook bridging `AudioInputService` to UI.
  - Service instance stored in `useState` (not a ref, to satisfy React rules).
  - Named recursive `stepTelemetry` function inside RAF loop (satisfies oxlint react/immutability).
  - Throttled React state updates at ~20Hz.
  - Unmount effect cleans up RAF + service.
- **`src/components/LiveWaveform.tsx`**: Canvas-based real PCM oscilloscope.
  - Reads `getFloatTimeDomainData` directly from `AnalyserNode` at RAF speed.
  - Zero React re-renders during draw loop.
  - HiDPI aware via `devicePixelRatio`.
- **`src/components/AudioActivityMeter.tsx`**: RMS meter and ACTIVE/QUIET indicator.
- **`src/App.tsx`**: Full 5-state monitoring UI shell with dynamic status badge, error banner, action buttons.
- **`src/index.css`**: Extended with all Phase 1 component styles.

---

## 5. What Has NOT Been Implemented (Do NOT Claim Working)
- [ ] Pitch ($F_0$) detection algorithm (autocorrelation / YIN) → Phase 2
- [ ] Zero-Crossing Rate (ZCR) extraction → Phase 2
- [ ] Spectral Centroid analysis → Phase 2
- [ ] Silence duration / speech activity detection → Phase 2
- [ ] Mathematical Distress Risk Score calculation → Phase 3
- [ ] Telemetry dashboard with live charts or gauges → Phase 4
- [ ] Covert code-word spotter → Phase 5
- [ ] Silent alert dispatch simulation modal → Phase 6
- [ ] Voice baseline calibration → Phase 7
- [ ] Multi-signal temporal co-occurrence filter → Phase 8
- [ ] Mobile/VoIP integrations → Phase 10

---

## 6. Current Architecture

```
React UI (App.tsx)
   ↓ calls
useAudioMonitor hook (src/audio/useAudioMonitor.ts)
   ↓ manages lifecycle of
AudioInputService (src/audio/audioInput.ts)
   ↓ wraps
Web Audio API (AudioContext + AnalyserNode + MediaStream)
   ↓ produces
AudioFrame { timestamp, sampleRate, frameSize, timeDomainData, frequencyData, rmsEnergy }

LiveWaveform component (src/components/LiveWaveform.tsx)
   → reads AnalyserNode directly via getAnalyserNode() for high-freq canvas rendering

AudioActivityMeter component (src/components/AudioActivityMeter.tsx)
   → receives AudioActivityState { rmsEnergy, isActive, threshold } from hook
```

**Architectural Invariant:** `AudioInputService` is pure TypeScript with zero DOM/React dependencies. It can be reused in React Native, Node.js, or a Web Worker.

---

## 7. Important Product Decisions
- **Decision 001:** Name is **Sanket** (Signal/Hint).
- **Decision 002:** Browser microphone is strictly the prototype input layer.
- **Decision 003:** The core engine is input-agnostic and reusable.
- **Decision 004:** No single acoustic signal can trigger an emergency alert.
- **Decision 005:** Transparent heuristic rule-based math instead of fake ML.
- **Decision 006:** Local-first, zero-cloud audio streaming.
- **Decision 007:** `getAnalyserNode()` is exposed for direct canvas access rather than copying Float32Array buffers every RAF tick (see `LiveWaveform`). (Added Phase 1)

---

## 8. Important Constraints
- **Hackathon Scope:** Must be fully functional within ~24 hours.
- **No Heavy ML Bloat:** No TensorFlow/PyTorch runtimes.
- **No Backend / No DB / No Auth:** Fully client-side.
- **Local Audio Only:** Never transmit raw audio over network.

---

## 9. Current Known Limitations
- Background noise can exceed the 0.02 RMS threshold, keeping activity ACTIVE even during silence.
- The `LiveWaveform` canvas does not re-size responsively on window resize.
- No personal baseline calibration yet — threshold is a global constant.
- Phase 2 feature extraction (pitch, ZCR, spectral centroid, silence timer) not yet implemented.

---

## 10. Files & Folders That Matter

| File | Purpose |
| :--- | :--- |
| [docs/PROJECT_CONTEXT.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/PROJECT_CONTEXT.md) | Primary source of truth |
| [docs/ARCHITECTURE.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/ARCHITECTURE.md) | Technical specs & data contracts |
| [docs/PROGRESS.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/PROGRESS.md) | Current implementation state |
| [docs/DECISIONS.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/DECISIONS.md) | Architecture Decision Records |
| [src/audio/types.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/audio/types.ts) | Audio layer data contracts |
| [src/audio/audioInput.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/audio/audioInput.ts) | AudioInputService (core engine layer 1) |
| [src/audio/useAudioMonitor.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/audio/useAudioMonitor.ts) | React hook bridging engine to UI |
| [src/components/LiveWaveform.tsx](file:///c:/Users/VISHESH/Desktop/SANKET/src/components/LiveWaveform.tsx) | Canvas oscilloscope |
| [src/components/AudioActivityMeter.tsx](file:///c:/Users/VISHESH/Desktop/SANKET/src/components/AudioActivityMeter.tsx) | RMS meter |
| [src/App.tsx](file:///c:/Users/VISHESH/Desktop/SANKET/src/App.tsx) | Main UI shell |
| [src/index.css](file:///c:/Users/VISHESH/Desktop/SANKET/src/index.css) | Design system |
| [src/analysis/types.ts](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/types.ts) | FeatureSet, RiskEvent contracts (Phase 2+) |

---

## 11. Next Phase — Phase 2: Pitch, Energy, Speech Activity & Silence Detection

The next agent should build `src/analysis/featureExtractor.ts`:
- **Pitch/F0:** Autocorrelation or YIN algorithm on `timeDomainData`.
- **Zero-Crossing Rate:** Count sign changes in the PCM buffer.
- **Spectral Centroid:** Weighted mean of frequency bins from `frequencyData`.
- **Silence Timer:** Track how long RMS stays below threshold continuously.
- **Voice Activity Detection (VAD):** Boolean gate combining RMS + ZCR.
- Input: `AudioFrame` from `AudioInputService.getCurrentFrame()`.
- Output: `FeatureSet` (already typed in `src/analysis/types.ts`).
- **Do NOT** modify `AudioInputService` — consume its output, don't change it.

---

## 12. Rules For The Next Agent

1. **Read [docs/PROJECT_CONTEXT.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/PROJECT_CONTEXT.md) first.**
2. **Read [docs/PROGRESS.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/PROGRESS.md) second.**
3. **Read [docs/ARCHITECTURE.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/ARCHITECTURE.md) before modifying architecture.**
4. **Read [docs/DECISIONS.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/DECISIONS.md) before making major technical decisions.**
5. **Do not duplicate existing functionality.**
6. **Do not create a parallel implementation when an existing module can be extended.**
7. **Update [docs/PROGRESS.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/PROGRESS.md) after completing meaningful work.**
8. **Update [docs/AGENT_HANDOFF.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/AGENT_HANDOFF.md) when project architecture or workflow changes significantly.**
9. **Update [docs/DECISIONS.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/DECISIONS.md) when making an important architectural decision.**
10. **Do not claim something works unless it has actually been tested.**
11. **Keep the project suitable for a one-day hackathon.**
12. **Prefer working functionality over unnecessary abstraction.**
13. **Do not introduce ML models just to make the project sound more advanced.**
14. **Never represent heuristic prototype scoring as medically or scientifically validated.**
15. **Preserve the separation between audio input and the analysis engine.**
16. **Do not generate fake mobile/call integration.**
17. **Never generate image assets unless explicitly requested.**
18. **Update `current_prompt_update.md` after EVERY single prompt with the latest actions, file changes, and repo status.**
