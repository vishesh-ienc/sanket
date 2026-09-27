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

### Template for Future Decisions
```markdown
### DECISION XXX: [Title]
- **Date:** YYYY-MM-DD
- **Status:** [Proposed | Accepted | Superseded by DECISION YYY]
- **Context:** [Why does this decision need to be made?]
- **Decision:** [What was decided?]
- **Consequences:** [What are the positive and negative implications?]
```

