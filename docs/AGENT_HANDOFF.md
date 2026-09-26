# Sanket — Agent Handoff Specification

> **Operational Handoff for Incoming Coding Agents**  
> If you are an AI coding assistant or engineer taking over this repository, this file is your primary onboarding manifest. Read it carefully before writing a single line of code.

---

## 1. What is Sanket?
**Sanket** is a multimodal voice distress-risk detection prototype. It monitors permitted audio streams for non-verbal acoustic signals of distress—such as pitch strain, voice tremors, prolonged silences, and user-configured covert code-words—fusing them into an explainable **Distress Risk Score (0–100)** to trigger simulated silent alerts without alerting bystanders.

---

## 2. Current Project Status
- **Phase:** **Phase 0 — Project Initialization** (`COMPLETED`)
- **Git State:** Initialized, clean status, initial commit committed and pushed to GitHub.
- **Build Status:** Verified passing (`npm run build` succeeds cleanly).
- **Runtime:** React 19 + TypeScript + Vite dev server configured.

---

## 3. Current Phase
- **Current Phase:** Phase 0 (Complete).
- **Next Phase:** **Phase 1 — Browser Microphone & Live Audio Analysis**.

---

## 4. What Has Been Implemented
- Clean React 19 + TypeScript + Vite project configuration.
- Dark, minimalist safety-monitoring UI shell displaying:
  - System Header (`SANKET - Voice Distress-Risk Detection`)
  - Status Indicator (`SYSTEM READY`)
  - "START MONITORING" action button hook
  - Prototype scope disclaimer (`"Prototype mode — browser microphone input"`)
- Full documentation suite in `/docs`:
  - `docs/PROJECT_CONTEXT.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ROADMAP.md`
  - `docs/PROGRESS.md`
  - `docs/DECISIONS.md`
  - `docs/DEMO_FLOW.md`
  - `docs/AGENT_HANDOFF.md`
- Directory structure scaffolding for audio and analysis decoupling:
  - `src/audio/` (for Web Audio API stream capture and framing)
  - `src/analysis/` (for pitch detection, feature extraction, baseline, and risk scoring)
  - `src/components/` (for UI presentation components)
  - `src/services/` (for state coordination and alert dispatching)
  - `src/utils/` (for math and formatting helpers)

---

## 5. What Has NOT Been Implemented (Do NOT Claim Working)
- [ ] Browser microphone capture (`getUserMedia`)
- [ ] Audio framing and Web Audio `AnalyserNode` buffer pipeline
- [ ] Pitch ($F_0$) detection algorithm (autocorrelation / YIN)
- [ ] Energy (RMS), Zero-Crossing Rate, or Spectral Centroid extraction
- [ ] Silence duration / speech activity detection
- [ ] Mathematical Distress Risk Score calculation
- [ ] Telemetry dashboard with live charts or gauges
- [ ] Covert code-word spotter
- [ ] Silent alert dispatch simulation modal
- [ ] Voice baseline calibration
- [ ] Multi-signal temporal co-occurrence filter
- [ ] Mobile/VoIP integrations

---

## 6. Current Architecture
The system architecture enforces a strict one-way data flow:
```
AudioInput (Browser Mic)
  ↓
AudioProcessing (Framing & FFT)
  ↓
FeatureExtractor (Pitch, RMS, Silence, ZCR)
  ↓
Baseline (User Normal Mean & StdDev)
  ↓
SignalAnalyzer (Pitch strain, Whisper, Silence counters)
  ↓
RiskEngine (Multi-signal temporal fusion: 0–100)
  ↓
AlertEngine (Threshold hold-down & silent dispatch simulation)
  ↓
Dashboard (Pure presentation UI)
```
**Crucial Architectural Invariant:** Keep `audio/` and `analysis/` completely decoupled from React hooks and DOM components. The core engine must remain pure TypeScript.

---

## 7. Important Product Decisions
- **Decision 001:** Name is **Sanket** (Signal/Hint).
- **Decision 002:** Browser microphone is strictly the prototype input layer. Final product is mobile background audio/call monitoring.
- **Decision 003:** The core engine is input-agnostic and reusable.
- **Decision 004:** No single acoustic signal can trigger an emergency alert. Multi-signal correlation is mandatory.
- **Decision 005:** Transparent heuristic rule-based math is used instead of fake opaque ML.
- **Decision 006:** Local-first, zero-cloud audio streaming for complete privacy.

---

## 8. Important Constraints
- **Hackathon Scope:** Must be fully functional within ~24 hours. Avoid over-engineering.
- **No Heavy ML Bloat:** Do not pull in massive 100MB+ TensorFlow/PyTorch runtimes unless strictly necessary and verified.
- **No Backend / No DB / No Auth:** Keep entirely client-side for rapid prototype execution.
- **Local Audio Only:** Never transmit raw audio over the network.

---

## 9. Current Known Limitations
- Background noise (fans, air conditioning, traffic) can pollute raw acoustic signals; bandpass filtering and personal baselines are required.
- Browser `getUserMedia` requires explicit user permission and does not run when the browser tab is suspended without special flags.
- Web Speech API (for code-word detection in Phase 5) depends on browser platform support (Chrome/Edge recommended).

---

## 10. Files & Folders That Matter
- [docs/PROJECT_CONTEXT.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/PROJECT_CONTEXT.md): Primary source of truth.
- [docs/ARCHITECTURE.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/ARCHITECTURE.md): Technical specs & data contracts.
- [docs/PROGRESS.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/PROGRESS.md): Current implementation state.
- [docs/ROADMAP.md](file:///c:/Users/VISHESH/Desktop/SANKET/docs/ROADMAP.md): Next steps queue.
- [src/App.tsx](file:///c:/Users/VISHESH/Desktop/SANKET/src/App.tsx): UI shell entry.
- [src/audio/](file:///c:/Users/VISHESH/Desktop/SANKET/src/audio/): Target for Phase 1 audio capture.
- [src/analysis/](file:///c:/Users/VISHESH/Desktop/SANKET/src/analysis/): Target for Phase 2/3 detection engine.

---

## 11. Next Phase
**Phase 1 — Browser Microphone + Live Audio Analysis**
- Implement `AudioInput` service to request and capture mic input via `navigator.mediaDevices.getUserMedia`.
- Initialize `AudioContext` and `AnalyserNode`.
- Produce continuous `AudioFrame` structures with frequency and time-domain arrays.
- Connect "START MONITORING" / "STOP MONITORING" button in UI to this service.

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
