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
| **Phase 1** | Browser Microphone & Live Audio Pipeline | **NOT STARTED** |
| **Phase 2** | Pitch, Energy, Speech Activity & Silence Detection | **NOT STARTED** |
| **Phase 3** | Distress Risk Scoring Engine | **NOT STARTED** |
| **Phase 4** | Live Sanket Safety Dashboard | **NOT STARTED** |
| **Phase 5** | Configurable Code-Word Detection | **NOT STARTED** |
| **Phase 6** | Silent Alert Simulation | **NOT STARTED** |
| **Phase 7** | Personal Voice Baseline & Calibration | **NOT STARTED** |
| **Phase 8** | Multi-Signal Temporal Correlation & False Alarm Reduction | **NOT STARTED** |
| **Phase 9** | Polish & Judge Demonstration Flow | **NOT STARTED** |
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
- **Status:** `NOT STARTED`
- **Goal:** Connect the browser `getUserMedia` audio input safely with graceful permission handling, stream lifecycle management, and audio frame generation.
- **Expected Functionality:** User clicks "Start Monitoring", browser requests mic permission, `AudioContext` initializes, raw audio stream is fed into `AnalyserNode` and discretizes into uniform `AudioFrame` buffers. Safe cleanup on stop.
- **Inputs:** User microphone permission and browser audio hardware stream.
- **Outputs:** Stream of typed `AudioFrame` structures (time-domain and frequency-domain arrays).
- **Dependencies:** Phase 0.

---

### Phase 2: Pitch, Energy, Speech Activity & Silence Detection
- **Status:** `NOT STARTED`
- **Goal:** Implement the `FeatureExtractor` module to parse acoustic primitives from `AudioFrame` in real-time.
- **Expected Functionality:** Calculate RMS energy, compute fundamental frequency ($F_0$) via autocorrelation / YIN, calculate Zero-Crossing Rate (ZCR), compute Spectral Centroid, and detect Voice Activity (speech vs. silence).
- **Inputs:** `AudioFrame` stream from Phase 1.
- **Outputs:** Stream of typed `FeatureSet` objects with normalized values.
- **Dependencies:** Phase 1.

---

### Phase 3: Distress Risk Scoring Engine
- **Status:** `NOT STARTED`
- **Goal:** Implement the mathematical core that aggregates acoustic deviations into a composite Distress Risk Score ($0–100$).
- **Expected Functionality:** Rule-based heuristic scoring engine combining vocal strain, energy anomalies, and pause duration. Implements graceful score decay over time when voice returns to normal.
- **Inputs:** `FeatureSet` stream from Phase 2.
- **Outputs:** Continuous numeric Distress Risk Score ($0–100$) and `RiskEvent` emissions.
- **Dependencies:** Phase 2.

---

### Phase 4: Live Sanket Safety Dashboard
- **Status:** `NOT STARTED`
- **Goal:** Create a high-fidelity, dark safety-monitoring interface displaying real-time telemetry.
- **Expected Functionality:** Real-time audio waveform/oscilloscope, risk meter with color states (Green, Yellow, Orange, Red), individual signal breakdown cards, live session timeline.
- **Inputs:** State emissions from `RiskEngine` and `FeatureExtractor`.
- **Outputs:** Interactive, responsive React dashboard with smooth animations.
- **Dependencies:** Phase 3.

---

### Phase 5: Configurable Code-Word Detection
- **Status:** `NOT STARTED`
- **Goal:** Allow users to set a covert distress phrase (e.g., *"Remember to feed the cat"*) that elevates contextual risk upon detection.
- **Expected Functionality:** Configuration modal/input to set trigger phrase; local speech recognition (Web Speech API / pattern matching); triggers a high-confidence contextual signal without alerting bystanders.
- **Inputs:** Audio stream, user-configured trigger string.
- **Outputs:** Contextual signal flag and boost to `RiskEngine`.
- **Dependencies:** Phase 4.

---

### Phase 6: Silent Alert Simulation
- **Status:** `NOT STARTED`
- **Goal:** Simulate the silent dispatch of an emergency alert when the Distress Risk Score enters the Critical zone ($80+$).
- **Expected Functionality:** Confirmation hold-down (avoids instant false triggers), mock GPS coordinate generator, visual alert modal showing mock SMS dispatch to trusted contacts, audio alert freeze, detailed forensic trigger reasons.
- **Inputs:** `RiskEvent` with level `HIGH_DISTRESS_RISK` from Phase 3.
- **Outputs:** Simulated dispatch UI notification, audit event logged with timestamp and trigger telemetry.
- **Dependencies:** Phase 4.

---

### Phase 7: Personal Voice Baseline & Calibration
- **Status:** `NOT STARTED`
- **Goal:** Implement a personal voice calibration mode and rolling baseline to measure relative deviations instead of universal constants.
- **Expected Functionality:** 15–20 second calibration phase where the user speaks naturally; records baseline pitch mean, variance, volume floor; calculates real-time statistical $Z$-scores for subsequent evaluation.
- **Inputs:** User speech frames during calibration mode.
- **Outputs:** `Baseline` profile object storing statistical distribution parameters ($\mu, \sigma$).
- **Dependencies:** Phase 2, Phase 3.

---

### Phase 8: Multi-Signal Temporal Correlation & False Alarm Reduction
- **Status:** `NOT STARTED`
- **Goal:** Harden the scoring engine against false positives caused by laughing, coughing, loud background noises, or standard conversational enthusiasm.
- **Expected Functionality:** Sliding-window temporal co-occurrence matrix; requires at least 2 distinct signal classes to trigger critical escalation; sudden single transient spikes are suppressed.
- **Inputs:** Rolling historical buffer of `FeatureSet` and signal flags over a 10-second window.
- **Outputs:** Filtered, robust Distress Risk Score with reduced false-positive rate.
- **Dependencies:** Phase 3, Phase 7.

---

### Phase 9: Polish & Judge Demonstration Flow
- **Status:** `NOT STARTED`
- **Goal:** Optimize the presentation and provide interactive test controls for a seamless 2–3 minute hackathon judge demonstration.
- **Expected Functionality:** Preset demo scenario selector (Normal Speech, Vocal Strain, Extended Silence, Trigger Phrase, Critical Distress), test audio playback fallback if microphone environment is noisy, pristine layout polish.
- **Inputs:** Full application stack.
- **Outputs:** Seamless, polished end-to-end judge experience.
- **Dependencies:** Phases 1 through 8.

---

### Phase 10: Mobile Deployment Architecture & Future Integration Docs
- **Status:** `NOT STARTED`
- **Goal:** Document the concrete technical bridge from the browser prototype to native iOS/Android background service integration.
- **Expected Functionality:** Architectural blueprints for mobile background audio permissions, battery-efficient downsampling, VoIP call integration, and encrypted on-device storage.
- **Inputs:** Final prototype learnings and architecture.
- **Outputs:** Technical whitepaper and developer guide (`docs/MOBILE_INTEGRATION.md`).
- **Dependencies:** Phase 9.
