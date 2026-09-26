# Sanket — System Technical Architecture

> **Architectural Specification & Modularity Guidelines**  
> This document specifies the technical design, data contracts, and pipeline layering for Sanket.
> **Cardinal Rule:** The audio analysis and risk detection engine MUST remain strictly decoupled from the UI/presentation layer.

---

## 1. High-Level Architectural Pipeline

```
+-------------------------------------------------------------+
|                     1. AUDIO INPUT LAYER                    |
|   (Browser getUserMedia / Mobile Mic / VoIP Audio Stream)   |
+------------------------------+------------------------------+
                               | Audio Streams / PCM Chunks
                               v
+-------------------------------------------------------------+
|                 2. AUDIO PROCESSING LAYER                   |
|   (Sampling Rate, Framing, FFT, Windowing, Buffer Mgmt)     |
+------------------------------+------------------------------+
                               | AudioFrame
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
|                   6. RISK SCORING ENGINE                    |
|    (Multi-Signal Temporal Correlation, Risk Aggregator)     |
+------------------------------+------------------------------+
                               | Distress Risk Score (0-100)
                               v
+-------------------------------------------------------------+
|                   7. RISK CLASSIFICATION                    |
|        (NORMAL, ELEVATED, SUSPECTED_DISTRESS, CRITICAL)     |
+------------------------------+------------------------------+
                               | RiskEvent
                               v
+-------------------------------------------------------------+
|                      8. ALERT ENGINE                        |
|  (Threshold Verification, Debouncing, Silent Dispatch Sim)  |
+------------------------------+------------------------------+
                               | AlertNotification & Telemetry
                               v
+-------------------------------------------------------------+
|                  9. DASHBOARD / EVENT LOG                   |
|     (React UI, Waveform HUD, Anomaly Badges, History Log)   |
+-------------------------------------------------------------+
```

---

## 2. Layer-by-Layer Architectural Breakdown

### 2.1 Audio Input Layer (`AudioInput`)
- **Role:** Abstracts the physical or virtual audio source.
- **Prototype Implementation:** Browser Web Audio API `navigator.mediaDevices.getUserMedia({ audio: true })`.
- **Future Mobile/OS Implementation:** Android `AudioRecord` / iOS `AVAudioEngine` or VoIP call audio tap.
- **Responsibility:** Acquires permissions, handles audio hardware constraints, emits raw continuous PCM audio chunks or streams to downstream consumers.

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

### 2.8 Alert Engine (`AlertEngine`)
- **Role:** Evaluates whether a `RiskEvent` warrants intervention.
- **Features:**
  - **Debouncing & Hold-down Timers:** Requires high risk to persist for a minimum confirmation duration (e.g., 3 consecutive seconds) or receive immediate verification from a code phrase.
  - **Silent Simulation Mode (Prototype):** Dispatches a simulated silent alert payload containing timestamp, approximate simulated GPS coordinates, and contributing acoustic signals.
  - **Cooldown:** Prevents alert spam by enforcing a 60-second lockout between trigger actions.

### 2.9 Dashboard / Event Log
- **Role:** Visual presentation layer for human monitoring and hackathon demonstrations.
- **Responsibility:** Completely decoupled via event listeners or callback subscriptions. Displays:
  - Real-time live status indicator
  - Audio waveform and frequency visualization
  - Real-time Risk Score gauge (0–100)
  - Signal breakdown cards (Pitch, Volume, Silence, Code-Word)
  - Immutable session audit event log

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
