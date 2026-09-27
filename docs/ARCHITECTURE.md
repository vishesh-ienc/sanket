# Sanket — System Technical Architecture

> **Architectural Specification & Modularity Guidelines**  
> This document specifies the technical design, data contracts, and pipeline layering for Sanket.
> **Cardinal Rule:** The audio analysis and risk detection engine MUST remain strictly decoupled from the UI/presentation layer.

---

## 1. High-Level Architectural Pipeline

```
+-------------------------------------------------------------+
|              1. DUAL AUDIO SOURCE ADAPTER LAYER             |
|   (Source A: Live Microphone | Source B: Pre-recorded Audio)|
|   (Future: Any authorized audio stream adapted to frames)   |
+------------------------------+------------------------------+
                               | Normalized Audio Frames
                               v
+-------------------------------------------------------------+
|                 2. AUDIO PROCESSING LAYER                   |
|   (Sampling Rate, Framing, FFT, Windowing, Buffer Mgmt)     |
+------------------------------+------------------------------+
                               | AudioFrame (2048 FFT)
                               v
+-------------------------------------------------------------+
|                3. FEATURE EXTRACTION LAYER                  |
|    (Pitch/F0, RMS Energy, Spectral Centroid, ZCR, VAD)      |
+------------------------------+------------------------------+
                               | FeatureSet
                               v
+-------------------------------------------------------------+
|                      4. BASELINE LAYER                      |
|       (Personal Calibration, Rolling Mean & Variance)       |
+------------------------------+------------------------------+
                               | Deviations & Normalized Z-Scores
                               v
+-------------------------------------------------------------+
|                  5. SIGNAL ANALYSIS LAYER                   |
|   (Acoustic Strain, Voice Drop, Prolonged Silence, CodeWord)|
+------------------------------+------------------------------+
                               | SignalConfidence & AnomalyFlags
                               v
+-------------------------------------------------------------+
|          5b. TEMPORAL CONTEXT & FALSE-POSITIVE FILTER       |
|    (Transient Spike Suppression, Sustained Anomaly Tracker) |
+------------------------------+------------------------------+
                               | Filtered Temporal State
                               v
+-------------------------------------------------------------+
|                   6. RISK SCORING ENGINE                    |
|    (Multi-Signal Temporal Correlation, Risk Aggregator)     |
+------------------------------+------------------------------+
                               | Distress Risk Score (0-100)
                               v
+-------------------------------------------------------------+
|                   7. RISK CLASSIFICATION                    |
|        (NORMAL, ELEVATED, SUSPECTED_DISTRESS, HIGH_RISK)    |
+------------------------------+------------------------------+
                               | RiskEvent & Confirmation Gate
                               v
+-------------------------------------------------------------+
|                      8. ALERT ENGINE                        |
|  (Threshold Verification, Debouncing, Silent Dispatch Sim)  |
+------------------------------+------------------------------+
                               | SilentAlertEvent & Telemetry
                               v
+-------------------------------------------------------------+
|                  9. DEMONSTRATION CONSOLE                   |
|  (Source Selector, Waveform, Signal Breakdown, Forensics)   |
+------------------------------+------------------------------+
```

---

## 2. Layer-by-Layer Architectural Breakdown

### 2.1 Audio Input Layer (`AudioInput` & `AudioFileInput`)
- **Role:** Abstracts the physical or pre-recorded audio source. The detection engine is completely source-agnostic.
- **Implemented Adapters:**
  - **Live Microphone (`AudioInputService`):** Browser Web Audio API `navigator.mediaDevices.getUserMedia({ audio: true })`.
  - **Pre-recorded Call Audio (`AudioFileInputService`):** In-browser decoding of `.wav`, `.mp3`, or `.ogg` audio files into uniform PCM frames, feeding the identical downstream analysis pipeline.
- **Conceptual Future Sources:** Any authorized communication stream (e.g., VoIP streams, telephone audio taps where legally permitted, interview recordings). Mobile is considered solely as one potential future source, not an existing native implementation.
- **Responsibility:** Normalizes diverse audio inputs into uniform `AudioFrame` structures consumed identically by the feature extractor.

### 2.2 Audio Processing Layer (`AudioProcessing`)
- **Role:** Transforms continuous raw time-domain audio into uniform analytical frames.
- **Components:**
  - **AnalyserNode & BiquadFilters:** Bandpass filtering (filtering out rumble below 80Hz and noise above 4000Hz where human fundamental vocal stress manifests).
  - **Frame Chunking:** Discretizes audio into sliding windows (e.g., 2048 samples at 44.1kHz / 48kHz, ~46ms frames with 50% overlap).
- **Output:** Emits typed `AudioFrame` structures:
  ```typescript
  interface AudioFrame {
    timestamp: number;
    sampleRate: number;
    timeDomainData: Float32Array;
    frequencyData: Float32Array;
  }
  ```

### 2.3 Feature Extraction Layer (`FeatureExtractor`)
- **Role:** Extracts acoustic primitives from every `AudioFrame`.
- **Extracted Primitives:**
  - **RMS Energy (Volume):** Root-mean-square amplitude calculation for volume dynamics.
  - **Pitch ($F_0$ Fundamental Frequency):** Autocorrelation or YIN algorithm to estimate vocal cord vibration frequency (typical human range: 85Hz - 350Hz).
  - **Zero-Crossing Rate (ZCR):** Measure of unvoiced speech, whispers, or breathiness.
  - **Spectral Centroid:** Brightness / spectral distribution of the sound energy.
  - **Voice Activity Detection (VAD):** Heuristic gate separating active vocal utterances from ambient background noise.
- **Output:** Emits typed `FeatureSet` structures:
  ```typescript
  interface FeatureSet {
    timestamp: number;
    rmsEnergy: number;
    pitchHz: number | null; // null if unvoiced
    zeroCrossingRate: number;
    spectralCentroid: number;
    isSpeech: boolean;
  }
  ```

### 2.4 Baseline Layer (`Baseline`)
- **Role:** Maintains a localized dynamic statistical profile of the user's normal vocal state.
- **Calibration Mode:** Initial 15–30 seconds of conversational speech records natural pitch range, typical RMS, and baseline cadence.
- **Adaptive Rolling Baseline:** Computes running mean ($\mu$) and standard deviation ($\sigma$) to calculate statistical $Z$-scores:
  $$Z = \frac{\text{observed} - \mu}{\sigma}$$
- **Why it matters:** A person who naturally speaks in a higher register or louder volume will not generate false positives; detection focuses on *relative deviation* from their established norm.

### 2.5 Signal Analysis Layer (`SignalAnalyzer`)
- **Role:** Interprets statistical feature deviations as specific safety signals.
- **Detectors:**
  - **Pitch Strain Detector:** Flags rapid pitch spikes ($Z_{pitch} > 2.5$) or voice tremors indicative of acute laryngeal tension.
  - **Energy Drop / Whisper Detector:** Flags sudden, unnatural reduction in speech volume accompanied by high ZCR (indicative of forced whispers).
  - **Prolonged Silence Detector:** Tracks the duration of silence ($t_{silence}$) after active conversational turns.
  - **Code-Word Detector (Contextual):** Matches spoken trigger phrases configured by the user (using Web Speech API or local pattern matching).
- **Output:** Set of individual signal anomalies with confidence values $[0.0, 1.0]$.

### 2.5b Temporal Context & False-Positive Reduction (`TemporalContextAnalyzer`)
- **Role:** Evaluates short-term temporal stability, transient vocal spikes, cross-signal temporal correlation, and voice-derived pause regularity.
- **Components:**
  - **Bounded Ring-Buffer:** Maintains rolling window of derived feature observations (default 30 frames, zero raw audio retention).
  - **Transient Spike Detection:** Identifies isolated 1–2 frame anomalies (e.g. coughs, laughs, single pitch bursts) and tags them `TRANSIENT_SPIKE` (`isTransient: true`).
  - **Sustained Anomaly Tracking:** Requires $\ge 3$ consecutive frames of anomalous features before marking `SUSTAINED_ANOMALY` (`isSustained: true`).
  - **Cross-Signal Correlation:** Computes co-occurrence metric across 10-frame window; flags `isMultiSignal: true` when $\ge 2$ independent channels are anomalous within the temporal correlation window.
  - **Voice-Derived Pause Regularity Proxy:** Analyzes pause count, mean duration, and variance across 40-frame window. Flags `BREATHING_PATTERN_ANOMALY` for erratic conversational turn-pacing or prolonged freezes ($> 3.5s$). Strictly disclaimed as conversational turn-pacing proxy, NOT medical/respiratory sensing.
- **False-Positive Suppression Gate:** Isolated transient spikes (`isTransient && !isSustained && !isMultiSignal`) are held back by `IncidentManager` from triggering emergency alert dispatch. Sustained or multi-signal crises are never suppressed. The existing `RiskEngine` remains the sole authority for scoring.

### 2.6 Risk Scoring Engine (`RiskEngine`)
- **Role:** Temporal multi-signal fusion.
- **Principles:**
  - **No Single Point of Failure:** No individual signal alone can escalate the risk to "CRITICAL".
  - **Temporal Correlation Window:** Evaluates signals over a rolling 5-to-10 second sliding buffer.
  - **Exponential Risk Decay:** Elevated scores decay gracefully if consecutive frames exhibit normal baseline behavior.
  - **Mathematical Formulation:**
    $$\text{RiskScore}(t) = \sum_{i} w_i \cdot \text{Signal}_i(t) \cdot \text{TemporalBonus} + \text{DecayedScore}(t-1)$$
- **Output:** A composite numeric Distress Risk Score from $0$ to $100$.

### 2.7 Risk Classification
- **Role:** Maps continuous scores to discreet operational threat levels:
  - `0 - 29`: **NORMAL** (Standard ambient or calm conversation)
  - `30 - 59`: **ELEVATED_ATTENTION** (Single anomaly detected, e.g. elevated pitch or sudden pause)
  - `60 - 79`: **SUSPECTED_DISTRESS** (Multiple correlated deviations across pitch, cadence, and volume)
  - `80 - 100`: **HIGH_DISTRESS_RISK** (Co-occurrence of extreme strain, prolonged freezing, or confirmed code-word)
- **Output:** Typed `RiskEvent`:
  ```typescript
  interface RiskEvent {
    id: string;
    timestamp: number;
    score: number;
    level: 'NORMAL' | 'ELEVATED' | 'SUSPECTED' | 'CRITICAL';
    contributingSignals: string[];
    details: Record<string, unknown>;
  }
  ```

### 2.8 Alert Engine & Incident Management (`silentAlertDispatcher`, `incidentManager`, `alertHistory`)
- **Role:** Evaluates whether a confirmed `HIGH_RISK` `RiskEvaluation` warrants an incident record and simulated silent alert.
- **Implemented Modules:**
  - **`silentAlertDispatcher`:** Pure deterministic service strictly requiring `riskLevel === 'HIGH_RISK'` AND `isConfirmed === true`. Emits typed `SilentAlertEvent` in `SIMULATED_LOCAL` mode. Never contacts police or external emergency services, plays zero audio, and triggers zero OS popups.
  - **`incidentManager`:** Incident latch state machine. Dispatches exactly once per incident; prevents duplicate alert emissions during sustained crises; automatically unlatches and marks incident `RESOLVED` when risk normalizes; cleanly handles subsequent re-triggering.
  - **`alertHistory`:** Bounded local storage audit log (`sanket_alert_history_v1`, clamped to 50 items) with robust error resilience for corrupted or unavailable browser storage.
  - **`ForensicEventModal` & `IncidentBanner`:** Presentation components rendering explainable forensic telemetry (contributing signals, personal baseline Z-scores, feature snapshot, confirmation hold-down) with strict privacy guarantees (zero raw audio retention).

### 2.9 Dashboard / Event Log
- **Role:** Visual presentation layer for human monitoring and hackathon demonstrations.
- **Responsibility:** Completely decoupled via event listeners or callback subscriptions. Displays:
  - Real-time live status indicator
  - Audio waveform and frequency visualization
  - Real-time Risk Score gauge (0–100)
  - Signal breakdown cards (Pitch, Volume, Silence, Code-Word)
  - Immutable session audit event log

### 2.10 Guided Judge Demonstration State Machine (`DemoController`, `JudgeDemoPanel`)
- **Role:** Orchestrates a deterministic 6-step walkthrough for hackathon judges and technical evaluators.
- **Components:**
  - **`DemoController`:** Pure TypeScript state machine operating on declarative step definitions (`DEMO_STEPS`). Decoupled from React and browser APIs for complete offline testability.
  - **Sequential Walkthrough:**
    1. `BASELINE_CALIBRATION`: Activates personal baseline profile ($165\text{Hz } \mu, \pm 14.5\text{Hz } \sigma$).
    2. `NORMAL_MONITORING`: Reference state with calm conversational speech (Score: 8–15).
    3. `TRANSIENT_EVENT`: Demonstrates Phase 8 false-positive reduction; isolated pitch/RMS spike is suppressed.
    4. `MULTI_SIGNAL_DISTRESS`: Sustained multi-signal deviation climbs to confirmed `HIGH_RISK`.
    5. `SILENT_ALERT`: `IncidentManager` latches and dispatches silent local alert; `IncidentBanner` appears.
    6. `FORENSIC_REVIEW`: Inspects `ForensicEventModal` with full telemetry and zero raw audio privacy verification.
  - **`JudgeDemoPanel`:** Glassmorphic HUD panel rendered as ROW 0 executive command center with progress step flow, narration box, judge highlight pill, and bidirectional navigation.

---

## 3. Strict Separation of Concerns

```
[Audio Input / DSP / Analysis Core] 
           │
           │ (Pure TS/JS, zero DOM/React dependencies)
           ▼
     EventEmitter / Observable State
           │
           │ (UI Subscribes to events)
           ▼
[React UI / Components / Hooks]
```

By enforcing that all audio extraction, baseline calculations, and risk calculations reside in plain TypeScript modules under `/src/audio` and `/src/analysis`, the entire engine can be packaged into a Node module, React Native library, or web worker without rewriting business logic.
