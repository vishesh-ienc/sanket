# Sanket — Architecture Decision Records (ADRs)

> **Architectural Decisions Log**  
> This file tracks foundational technical, product, and architectural decisions for Sanket.  
> **Rule for Collaborators:** Do not rewrite or delete past decisions. If a decision is superseded, record a new decision that explicitly references and amends the previous one.

---

### DECISION 001: Project Name = Sanket
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** The project requires a clear, culturally grounded, and technically relevant identity.
- **Decision:** The project is named **Sanket** (संकेत), meaning *Signal*, *Hint*, or *Gesture* in Sanskrit/Hindi. It emphasizes subtle, non-verbal indicators of distress rather than overt, panicked screams.
- **Consequences:** All repositories, documentation, UI headers, and source code namespaces will standardize on "Sanket".

---

### DECISION 002: Browser Microphone is Prototype Input Layer, Not Final Product
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Building native mobile background audio listeners and VoIP interceptors within a 24-hour hackathon introduces massive platform permission complexities (iOS background audio entitlements, Android foreground service constraints).
- **Decision:** The browser microphone (`navigator.mediaDevices.getUserMedia`) will serve as the physical audio input layer exclusively for the hackathon prototype. The production vision remains mobile-first and background-first.
- **Consequences:** The UI and documentation must clearly state: *"Prototype mode — browser microphone input"*.

---

### DECISION 003: Detection Engine Must Remain Strictly Input-Agnostic
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** If the detection logic is tightly bound to DOM elements, browser events, or `MediaStream` objects, porting the system to a native mobile app or server-side VoIP daemon would require a complete rewrite.
- **Decision:** The core detection pipeline (`FeatureExtractor`, `Baseline`, `SignalAnalyzer`, `RiskEngine`) will operate on generic PCM audio buffers and abstract `AudioFrame` structures, maintaining complete isolation from the browser DOM and React UI.
- **Consequences:** Clean separation of concerns; the core engine can be reused across Web, React Native, Node.js, or Web Workers without code modifications.

---

### DECISION 004: No Single Acoustic Signal Shall Trigger an Emergency Conclusion
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Human voice is naturally variable. A person may scream with joy during a football game, speak in a high register when excited, or remain silent while reading a book. Treating any single metric (e.g., high pitch alone or silence alone) as an emergency would produce overwhelming false alarms.
- **Decision:** Critical distress risk classification ($80–100$) requires multi-signal temporal correlation—a co-occurrence of multiple distinct anomaly channels (e.g., vocal strain + abnormal cadence + contextual trigger or prolonged hesitation) across an active time window.
- **Consequences:** Defense-in-depth architecture, drastically reduced false alarm rate, and realistic product positioning.

---

### DECISION 005: Heuristic/Rule-Based Scoring Over Opaque "Fake AI" Models
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Machine learning models for voice stress often require extensive curated clinical datasets and on-device neural runtimes (ONNX/TensorFlow Lite) that are brittle and opaque during rapid prototype development. Teams often fake ML predictions using random number generators or unvalidated black-box calls.
- **Decision:** The hackathon prototype will implement an honest, transparent, deterministic rule-based heuristic scoring engine based on established acoustic research (pitch variation $F_0$, zero-crossing rate, RMS energy deviation, and silence timing).
- **Consequences:** Full explainability (we can show judges the exact mathematical breakdown of *why* the risk score rose), predictable debugging, zero inference latency, and total transparency without deceptive claims.

---

### DECISION 006: Local-First / Privacy-First Processing
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Transmitting raw ambient audio or private conversations to cloud servers raises severe privacy, regulatory (GDPR/HIPAA), and latency concerns.
- **Decision:** All audio processing, feature extraction, and risk evaluation must happen strictly on-device in local memory. Raw audio frames are ephemeral and immediately discarded after analytical features are extracted. Zero audio data is transmitted to external servers.
- **Consequences:** Maximum user trust, instant real-time response (<50ms latency), and offline operational capability.

---

### DECISION 007: Expose `AnalyserNode` Directly for Canvas Waveform Rendering
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** The `LiveWaveform` component needs to call `getFloatTimeDomainData()` at every `requestAnimationFrame` tick (~60fps). Copying a 2048-element `Float32Array` through React state on every tick would cause significant garbage collection pressure and unnecessary React re-renders.
- **Decision:** `AudioInputService.getAnalyserNode()` exposes the `AnalyserNode` instance directly to the canvas rendering component. The canvas draw loop reads directly from the analyser without involving React state. React state is only updated for lower-frequency UI telemetry (~20Hz RMS/activity reads).
- **Consequences:** The `LiveWaveform` component holds a reference to `audioService` (not the raw node) and calls `getAnalyserNode()` inside the effect, preserving the architectural boundary while eliminating unnecessary buffer copies.

---

### DECISION 008: Autocorrelation (Not YIN or External Library) for Pitch Estimation
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Pitch estimation is required for Phase 2. Options considered: (a) normalized autocorrelation, (b) YIN algorithm (more accurate but more complex), (c) external DSP library (heavyweight, adds bundle size and dependencies).
- **Decision:** Implement normalized biased autocorrelation directly in `featureFunctions.ts`. YIN's main advantage is reducing octave errors; for a hackathon prototype where pitch deviation patterns matter more than absolute precision, autocorrelation at ±15–20 Hz accuracy is sufficient. No external library is introduced.
- **Consequences:** Zero new runtime dependencies; fully auditable ~40 lines of code; marginal pitch accuracy reduction vs YIN at extreme frequencies, acceptable for prototype use. Pitch estimates are returned as `null` (not `0`) when confidence is insufficient, preventing incorrect zero-pitch readings from corrupting the future risk engine.

---

### DECISION 009: FeatureExtractor Stores Temporal State Internally (Not in React)
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Silence duration, speech segment count, and cumulative speech duration are cross-frame accumulators. React state updates are throttled and asynchronous, making them unsuitable for accumulating sub-100ms measurements accurately.
- **Decision:** `FeatureExtractor` maintains a private `TemporalState` object updated synchronously on every `processFrame()` call. React state (`useFeatureExtractor`) receives a snapshot of the latest `FeatureSet` at the hook's interval rate (10Hz), not on every raw audio frame.
- **Consequences:** Accurate temporal accumulation independent of React render cycle; clean separation between the analysis engine and UI layer; `FeatureExtractor` is independently testable without React.

### DECISION 010: Multi-Signal Decision Engine with Exponential Moving Average
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Distress risk cannot be judged on single-frame instantaneous observations or isolated acoustic anomalies. Vocal spikes occur in normal conversational emphasis or laughter, and silence happens naturally during pauses. The system requires temporal stability, gradual decay upon recovery, and bounded evidence accumulation.
- **Decision:** The `RiskEngine` calculates linear bounded contributions per signal channel (pitch, RMS, silence, VAD/timing, spectral centroid, ZCR), adds a persistence bonus for sustained consecutive abnormal frames, and applies an exponential moving average (EMA) smoother (`decayFactor: 0.78`). When signals normalize, the score decays exponentially toward zero rather than abruptly resetting.
- **Consequences:** Transparent and deterministic scoring; no sudden jumpy alert state; natural recovery when speech returns to normal; explicit prototype heuristic design without opaque or hallucinating ML models.

---

### DECISION 011: Strict Single-Signal Ceiling Guarantee
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Product positioning mandates that Sanket must never trigger emergency escalation based on any single acoustic feature (e.g., a cough, shouting, or long pause).
- **Decision:** Every individual signal channel is assigned a hard weight ceiling ≤ 20 out of 100. Even with maximum temporal persistence (15), the mathematical ceiling for any isolated signal is 35/100. Because `HIGH_RISK` requires a score ≥ 70, it is mathematically impossible for any single signal alone to cause a `HIGH_RISK` event. Escalation strictly requires multi-signal co-occurrence (at least 3–4 corroborating anomaly channels simultaneously active and temporally confirmed).
- **Consequences:** Eliminates single points of false-positive failure; provides a provable mathematical safety invariant covered by automated unit tests; reinforces the core product principle that Sanket measures multi-signal distress risk rather than claiming certainty.

---

### DECISION 012: Decoupled Token-Aware Code-Word Spotter with Bounded Contextual Boost and Suppression Cooldown
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Victims of coercion or domestic distress often slip covert trigger phrases into natural conversations (e.g. *"Remember to feed the cat"*). However:
  1. Full continuous cloud speech transcription compromises privacy and regulatory compliance.
  2. Browser `SpeechRecognition` is non-standard, platform-dependent, and unavailable in headless/node environments.
  3. Naive substring matching creates catastrophic false positives (e.g. "cat" matching inside "catastrophe" or single common words like "the" triggering alerts).
  4. Speech recognizers repeatedly re-emit partial transcripts during an utterance, risking repeated alert stacking.
  5. A code word must provide high-confidence contextual evidence without bypassing the multi-signal risk engine or independently triggering false emergency dispatches.
- **Decision:**
  1. The `CodeWordDetector` operates on generic `TranscriptEvent` inputs completely decoupled from React, the DOM, and browser speech APIs.
  2. Implement token-aware normalization and bounded sliding-window phrase matching with strict word boundary enforcement.
  3. Support configurable morphological fuzzy tolerance for minor speech-recognition variations (plurals/verb suffixes) without permitting loose partial matches.
  4. Enforce a 5000ms cooldown debounce window to suppress duplicate recognizer emissions.
  5. Enforce zero transcript retention: raw transcripts are processed ephemerally and immediately discarded; no conversation log is kept.
  6. Code-word detections inject a strictly bounded external boost (+25 pts) into the `RiskEngine` via `injectExternalSignal()`. An isolated code word elevates score to 25 (`ELEVATED`), remaining well below `HIGH_RISK` (70). Reaching `HIGH_RISK` strictly requires multi-signal corroboration (acoustic strain, RMS drop, prolonged silence, or sustained persistence).
- **Consequences:** The code-word detector is 100% locally testable, private, immune to partial-word false triggers, and mathematically bounded within Sanket's multi-signal safety architecture.

---

### DECISION 013: Welford's Online Algorithm and Statistical Z-Score Calibration with Zero Raw Audio Retention
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Every user has unique vocal physiology—natural fundamental frequency ($F_0$), dynamic vocal energy, speaking tempo, and vocal tract resonance. Hardcoded static acoustic thresholds cause false positives for naturally high-pitched or quiet speakers and false negatives for deep-voiced speakers in distress. However:
  1. Storing raw audio waveforms or spectral frames violates Sanket's core privacy guarantees.
  2. Multi-pass variance calculation on long recordings consumes unbounded memory.
  3. Calibration must adapt seamlessly without breaking the 100-point risk score scale or the single-signal ceiling invariant.
- **Decision:**
  1. Use Welford's online one-pass algorithm to compute running means and sample standard deviations for pitch, RMS energy, spectral centroid, and zero-crossing rate from feature frames during a 5–30 second calibration phase.
  2. Reject silent/unvoiced frames (RMS < 0.015 or isSpeech = false) from vocal statistics to prevent silence from skewing baseline pitch and resonance.
  3. Zero raw audio retention: audio frames are processed ephemerally and discarded; only statistical scalars (`pitchMean`, `pitchStdDev`, `rmsMean`, `rmsStdDev`, `zcrMean`, `spectralMean`, etc.) and metadata are stored.
  4. Standardize deviation measurement using statistical Z-scores ($Z = (x - \mu) / \sigma$), clamped to $[0, 1]$.
  5. Translate calibrated baseline profiles into personalized `RiskEngineConfig` parameters via `baselineToRiskEngineConfig()`, keeping the existing 0–100 risk score and multi-signal thresholds fully intact.
- **Consequences:** Provides true personalized sensitivity with mathematical stability; ensures zero raw audio is ever stored or transmitted; preserves backward compatibility and allows graceful fallback to default population baselines.

---

### DECISION 014: Simulated Local Silent Alert Dispatch, Incident Latching, and Bounded Metadata-Only Forensic Audit Log
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** When the multi-signal `RiskEngine` detects sustained confirmed `HIGH_RISK`, the application must demonstrate full end-to-end safety workflow capabilities to users and evaluators without:
  1. Making real emergency phone calls, SMS, or dispatching actual first responders.
  2. Generating audible sounds or notification popups that could endanger an individual in a coercion or domestic threat situation.
  3. Generating a flood of duplicate alert records every 100ms frame while the sustained incident remains active.
  4. Persisting raw audio or conversation logs that compromise user privacy.
- **Decision:**
  1. **Strict Dispatch Gating:** A silent alert requires both `riskLevel === 'HIGH_RISK'` and `isConfirmed === true` (multi-frame temporal confirmation).
  2. **SIMULATED_LOCAL Dispatch Mode:** Alerts are purely local simulation objects (`SilentAlertEvent`) with `dispatchMode: 'SIMULATED_LOCAL'`. No external network requests, telephony, or audible audio cues are emitted.
  3. **Incident Latch State Machine:** Once a confirmed `HIGH_RISK` event triggers an incident, the system latches. During the entire continuous crisis window, live peak metrics are updated in-place without generating duplicate alert dispatches or redundant history entries.
  4. **Automatic Normalization & Unlatching:** When risk falls below `HIGH_RISK`, the active incident automatically transitions to `RESOLVED` and the latch resets, allowing future crisis events to cleanly generate fresh incident IDs.
  5. **Bounded Local Audit Log:** The `alertHistory` service limits storage to 50 items under `sanket_alert_history_v1`. It persists only derived scores, timestamps, and contributing signals; raw audio, PCM samples, and waveform buffers are strictly excluded.
- **Consequences:** The prototype provides a complete, realistic safety response workflow while preserving absolute user privacy, zero bystander alert risks, zero alert flooding, and complete offline testability.

---

### DECISION 015: Bounded Temporal Context Ring-Buffer, Transient Spike Suppression Gate, and Voice-Derived Prosodic Regularity Proxy
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Everyday vocal acoustic events—such as coughing, hearty laughing, sudden throat-clearing, or loud bursts of conversational laughter—can produce sharp, isolated spikes in RMS energy and fundamental frequency ($F_0$). If evaluated frame-by-frame in isolation, these transient bursts can produce borderline risk elevations that trigger false emergency incidents. However:
  1. We must NOT build a machine-learning model or heavy neural network that breaks real-time browser execution.
  2. We must NOT create a competing second risk score or rewrite the existing authoritative `RiskEngine`.
  3. We must NOT claim medical or respiratory diagnosis from browser microphone streams.
  4. We must NOT retain raw audio buffers in memory.
- **Decision:**
  1. **Pure Heuristic Sliding Window:** Implement `TemporalContextAnalyzer` using a compact bounded ring-buffer (30 frames) storing only derived scalar features and channel anomaly flags.
  2. **Transient vs Sustained Separation:** Classify anomalies lasting $\le 2$ frames as `TRANSIENT_SPIKE` (`isTransient: true`), requiring $\ge 3$ consecutive frames for `SUSTAINED_ANOMALY` (`isSustained: true`).
  3. **Cross-Signal Temporal Correlation:** Track co-occurrence of distinct anomalous channels across a 10-frame window; multi-signal events (`isMultiSignal: true`) require $\ge 2$ independent channels.
  4. **Voice-Derived Pause Regularity Proxy:** Track speech-to-pause transitions over a 40-frame window to identify prolonged freezes ($> 3.5s$) or erratic pause variances ($> 2.0$). Strictly document and label this in code and UI as a *voice-derived conversational turn-pacing proxy*, NOT medical respiratory sensing.
  5. **Contextual Gating in IncidentManager:** Prevent isolated transient spikes (`isTransient && !isSustained && !isMultiSignal`) from triggering emergency alert dispatch. Sustained or multi-signal crises are never suppressed.
- **Consequences:** Eliminates false alarms caused by short, isolated vocal bursts without compromising sensitivity to genuine multi-signal or sustained distress; maintains zero raw audio retention; strictly preserves single-authority risk scoring.

---

### DECISION 016: Guided Judge Demonstration State Machine and Event-Driven Scenario Sequencing
- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** In a 2–3 minute hackathon judging presentation, evaluators must quickly and clearly comprehend Sanket's core architectural differentiators: personal baseline calibration, normal conversational reference, transient spike filtering, multi-signal distress persistence, silent local dispatch, and forensic explainability. Relying on unpredictable live microphone utterances or forcing judges to manually hunt through disparate buttons introduces demo friction and risk.
- **Decision:**
  1. **Deterministic Step State Machine:** Implement `DemoController` as an isolated pure TypeScript state machine decoupled from React and DOM APIs.
  2. **6-Step Pedagogical Sequence:**
     - Step 1: Personal Baseline Calibration (auto-applies realistic baseline profile).
     - Step 2: Normal Conversational Speech (establishes calm reference state).
     - Step 3: Transient Vocal Spike (proves Phase 8 false-positive suppression).
     - Step 4: Sustained Multi-Signal Distress (proves multi-channel persistence and risk escalation).
     - Step 5: Silent Emergency Alert Dispatch (proves local silent dispatch without audible sirens).
     - Step 6: Forensic Incident Audit (opens forensic telemetry modal with privacy guarantees).
  3. **Event-Driven Transition Handlers:** Trigger scenario switches and state updates synchronously from user interaction events rather than cascading `useEffect` renders.
  4. **Executive Dashboard Placement:** Render `JudgeDemoPanel` prominently as ROW 0 of the console layout with visual progress tracking chips and bidirectional navigation.
- **Consequences:** Gives judges an intuitive, friction-free walkthrough that clearly highlights why Sanket's multi-signal architecture prevents false alarms while protecting user safety; preserves full offline testability and determinism.

---

### DECISION 017: Built-in Synthesized Sample Call with Scripted Transcript Track
- **Date:** 2026-09-28
- **Status:** Superseded in the UI by DECISION 023 (the synthesized tone call remains as an engine regression test)
- **Context:** The primary demo flow (`DEMO_FLOW.md` §2) requires a prepared recording, but none shipped with the repository. Committing a real person's voice raises consent issues, and binary fixtures bloat the repo. Separately, the risk engine's acoustic channels saturate at ~70 combined, so a purely acoustic recording sits at the HIGH_RISK boundary by design (single-signal ceiling, DECISION 011).
- **Decision:**
  1. Synthesize a deterministic 36 s voice-like call in the browser (`src/audio/sampleRecording.ts`), encoded to WAV and fed through the unchanged `AudioFileInputService`.
  2. Ship a scripted transcript track whose covert-phrase cue uses the user's configured code word, fed to the real `CodeWordDetector` as the playhead passes. Label it `SIMULATED TRANSCRIPT` in the UI.
  3. Verify it end-to-end in Node with an AnalyserNode-equivalent FFT harness: acoustic-only must escalate but never reach HIGH_RISK; with the phrase, exactly one latched alert.
- **Consequences:** Judges can run the file-based demo with one click and no assets; the demo tells the honest multi-signal story (acoustics raise risk, corroboration triggers the alert). The synthetic voice is not a realistic human recording and must not be presented as one.

---

### DECISION 018: Trusted Contacts & Simulated Dispatch Payload (Never Transmitted)
- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Documentation promised a simulated dispatch to trusted contacts with location, timestamp and rationale; `SilentAlertPayload` existed but was unused.
- **Decision:** Store up to 5 contacts in localStorage only; build a pure, deterministic payload (`services/dispatchPayload.ts`) with masked addresses, ordered rationale, a non-diagnostic message and fixed placeholder coordinates. Never request geolocation. Payload is always `transmitted: false` / `SIMULATED_LOCAL` and is shown only in the forensic modal.
- **Consequences:** Completes the alert story without any network or location access. Production transport options are documented in `MOBILE_INTEGRATION.md` §7.

---

### DECISION 019: Keep the Vanilla-CSS Design System (No Tailwind / shadcn Migration)
- **Date:** 2026-09-28
- **Status:** Superseded by DECISION 021
- **Context:** The console already has a cohesive dark safety-HUD design system (~4.5k lines in `src/index.css`, shared tokens on `:root`). A shadcn/ui component library would require adding Tailwind and would mix two component styles across ~25 components.
- **Decision:** Extend the existing design language for all new UI (sample-call storyline, trusted contacts, dispatch preview, awaiting-confirmation cue) using the existing tokens and class conventions.
- **Consequences:** Visual consistency and no new build tooling. A future migration to a component library should be a deliberate, whole-app decision.

---

### DECISION 020: No Browser Web Speech API for Live Code-Word Detection
- **Date:** 2026-09-28
- **Status:** Superseded by DECISION 022
- **Context:** Wiring `SpeechRecognition` would make the code word work live from the mic, but Chromium's implementation may send audio to a cloud recognizer, contradicting the zero-cloud-audio positioning.
- **Decision:** Keep transcript input simulated (manual test input, demo presets, sample-call track) in the prototype; specify on-device recognizers for production.
- **Consequences:** Live-mic code-word detection is not available in the browser demo. Revisit if an explicitly on-device browser recognizer is adopted, with an opt-in disclosure.

---

### DECISION 021: Tailwind v4 + shadcn/ui App Shell with Navigation
- **Date:** 2026-09-28
- **Status:** Accepted (supersedes DECISION 019)
- **Context:** The product owner asked for a far less cluttered, more appealing UI with light/dark themes, working cleanly on phones and desktops, built with the team's shadcn and 21st.dev tooling. The single long page showed every panel at once.
- **Decision:** Migrate the whole UI (not piecemeal) to Tailwind v4 + shadcn/ui (Radix, `radix-nova` style). Split it into five views behind a collapsible sidebar (bottom tab bar on phones): Monitor, Signals, Incidents, Demo, Settings. Details open in sheets (activity event → detail; incident → evidence with Evidence / Dispatch / Privacy tabs). Theme tokens are based on the 21st.dev "Teal Mist" palette, plus semantic `--risk-*` colours. A small in-house ThemeProvider plus a no-flash script replaces `next-themes`, whose injected script triggers a React 19 console error. Secondary views are lazy-loaded.
- **Consequences:** One consistent component style; the old 4.5k-line `index.css` and 16 legacy components are removed. `src/components/ui/` is generated code (excluded from lint). Pipeline orchestration moved from `App.tsx` into `src/app/usePipeline.ts` behind `PipelineContext`.

---

### DECISION 022: Live Code Word via On-Device Web Speech; Cloud Only by Opt-in
- **Date:** 2026-09-28
- **Status:** Accepted (supersedes DECISION 020)
- **Context:** Live code-word detection is a key demo feature, but default Web Speech recognition in Chromium may send microphone audio to a cloud service. Chrome now supports on-device recognition (`SpeechRecognition.available/install({langs, processLocally: true})`, `recognition.processLocally = true`).
- **Decision:** `BrowserSpeechTranscriptSource` implements `TranscriptSource`. It runs only while the live microphone is active and uses on-device mode whenever `available()` reports it (Settings offers **Install** when `downloadable`). Cloud mode requires an explicit, persisted opt-in behind a warning. Transcripts go straight to `CodeWordDetector` and are discarded; the UI shows only the most recent utterance in memory.
- **Consequences:** Private live detection in recent Chrome (verified: `install()` → `downloading` → `available`). Browsers without on-device support (and Firefox, which has no API) fall back to the typed test or an explicit opt-in.

---

### DECISION 023: Bundled TTS Demo Conversation with Transcript Manifest
- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** The team wants the site to be a self-contained demo: a pre-downloaded conversation proving the pipeline accepts voice from anywhere.
- **Decision:** Ship `public/demo/conversation.{wav,json}`, a 53 s two-voice call generated offline with Piper TTS (`scripts/generate_demo_conversation.py`). "Distress" is applied through signal processing (pitch ×1.8 at constant duration, raised effort, breath noise). The manifest carries timeline segments and transcript cues; each cue is fed to the detector at `finalSec`, when a recognizer would finalise it. The synthetic origin is disclosed in the UI.
- **Consequences:** One-click demo with realistic speech dynamics, tested end to end (acoustic-only never alerts; with the phrase, exactly one alert). A real, consented recording can replace it with no code change.

---

### DECISION 024: Contextual External Signals Are Sustained, Not One-Shot
- **Date:** 2026-09-28
- **Status:** Accepted (deliberate, minimal change to `RiskEngine`, which the handoff asked agents not to modify)
- **Context:** A detected code word was added once to the smoothed score and forgotten by the EMA (×0.78 per frame) in under a second. With natural speech it could not corroborate anything.
- **Decision:** An injected signal contributes to the raw score for `EXTERNAL_HOLD_FRAMES` (150 frames ≈ 15 s): full weight, then a linear fade over the last 5 s. It does not count toward persistence.
- **Consequences:** The code word behaves as sustained context. On its own it plateaus at its weight (25), well below HIGH_RISK, so the single-signal ceiling holds. All 59 original engine tests still pass; new tests cover the hold and fade.

---

### DECISION 025: Incident Latch Hysteresis
- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Real speech makes the score dip between phrases. The latch released on the first dip, and one incident produced 10 alerts on the demo call.
- **Decision:** `IncidentManager` accepts `releaseFrames`; the app uses 40 (~4 s) below HIGH_RISK before resolving. The default of 0 preserves the original behaviour and its tests.
- **Consequences:** Exactly one alert per episode on the demo call (tested). The UI also keeps the alert banner until the user dismisses it, even after the incident auto-resolves.

---

### DECISION 026: Customisable Signals with an Enforced Single-Signal Ceiling
- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** The team wanted a dashboard with customisable signals. Unbounded weights would break DECISION 011's guarantee that no single signal can alert.
- **Decision:** `signalSettings.ts` lets users enable or disable each signal and set weights (0–35), the alert threshold (60–90), pitch sensitivity and code-word weight (0–35). Values are sanitised and persisted, then applied through `RiskEngine.updateConfig`. Clamping guarantees max single weight + persistence (15) ≤ 50 < the minimum threshold of 60.
- **Consequences:** Judges can tune the engine live without being able to configure it into a single-signal alarm (tested at extreme values). Spectral/ZCR thresholds remain hard-coded in the engine. Temporal-context channel detection does not yet follow the enable toggles.

---

### Template for Future Decisions
```markdown
### DECISION XXX: [Title]
- **Date:** YYYY-MM-DD
- **Status:** [Proposed | Accepted | Superseded by DECISION YYY]
- **Context:** [Why does this decision need to be made?]
- **Decision:** [What was decided?]
- **Consequences:** [What are the positive and negative implications?]
```



