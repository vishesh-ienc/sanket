# Sanket (संकेत)

> **Non-Verbal Distress Detection via Voice Pattern Analysis**  
> Sanket is a multimodal voice distress-risk detection prototype designed to identify potential distress through subtle changes in voice and conversational patterns without requiring physical interaction or explicit panic calls.

[![Status: Prototype Complete](https://img.shields.io/badge/Status-Prototype%20Complete-blue)](docs/PROGRESS.md)
[![Tests: 646 passing](https://img.shields.io/badge/Tests-646%20passing-emerald)](#running-tests)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Local First](https://img.shields.io/badge/Privacy-100%25%20On--Device-green)](#privacy--security-first)

---

## ⚠️ Important Product Positioning

> **What Sanket Is:**  
> A multimodal voice distress-**RISK** detection system estimating potential distress from deviations across multiple permitted voice signals and contextual indicators.

> **What Sanket Is NOT:**  
> "Do not claim that Sanket can definitively determine that a person is in danger. It estimates distress risk from multiple signals."  
> No single acoustic feature is treated as proof of an emergency. Sanket does not claim to diagnose psychological states or guarantee emergency intervention.

---

## The Problem

In high-distress scenarios (domestic coercion, rideshare intimidation, medical crises, or home intrusions), victims often **cannot press physical panic buttons**, unlock their phones, or scream for help without escalating danger. 

Physical panic buttons and explicit 911/112 dials fail when:
- The device is physically out of reach or being actively watched by an aggressor.
- The victim cannot speak openly without provoking violence.
- Users hesitate to trigger irreversible alarms out of fear of false-positive embarrassment.

---

## The Solution

Voice is often the only active communication channel during an incident (e.g., an ongoing phone call or open voice channel). Under acute distress, physiological vocal tension, breathing irregularities, and conversational hesitations occur involuntarily.

**Sanket** analyzes permitted audio streams for non-verbal acoustic signals, cross-correlates deviations against a personal baseline, and computes an explainable **Distress Risk Score (0–100)** to trigger discrete silent alerts.

---

## How It Works

```
Permitted Audio Input (Browser Mic / Mobile Mic / VoIP)
                       ↓
Audio Framing & Filtering (Web Audio DSP, Bandpass)
                       ↓
Acoustic Feature Extraction (Pitch/F0, RMS Energy, ZCR, Silence)
                       ↓
Personal Baseline Comparison (Z-score deviation from normal voice)
                       ↓
Signal Analysis & Context (Acoustic strain, sudden whisper, code-words)
                       ↓
Risk Fusion Engine (Temporal correlation across multiple signals)
                       ↓
Distress Risk Score (0 – 100)
                       ↓
Silent Alert Simulation (Debounced mock dispatch to trusted contacts)
```

---

## Architecture Overview

```
[Audio Input Layer]     --> Browser Web Audio API (Prototype) / Mobile Daemon (Production)
       ↓
[Audio Processing]      --> 2048-sample windowing, Hamming filters, AnalyserNode FFT
       ↓
[Feature Extraction]    --> Pitch (Autocorrelation/YIN), RMS Volume, ZCR, Spectral Centroid
       ↓
[Baseline Layer]        --> Personal rolling mean (μ) and variance (σ) normalization
       ↓
[Signal Analysis]       --> Strain detector, drop detector, silence timer, trigger phrases
       ↓
[Risk Scoring Engine]   --> Multi-signal temporal sliding-window fusion with natural decay
       ↓
[Risk Classification]   --> NORMAL | ELEVATED | SUSPECTED | CRITICAL
       ↓
[Alert Engine]          --> Debouncing, confirmation hold-down, silent payload dispatch
       ↓
[Dashboard HUD]         --> Decoupled visual telemetry and forensic event log
```

Detailed technical specs are available in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Current Prototype vs. Intended Deployment

> "The browser microphone is the prototype input layer. The underlying detection engine is designed to be input-agnostic and could later receive permitted mobile microphone, call, or VoIP audio depending on platform capabilities and permissions."

| Feature | Hackathon Prototype | Intended Mobile/Production Deployment |
| :--- | :--- | :--- |
| **Audio Input** | Browser `getUserMedia` | Mobile background audio service / Call Audio / VoIP |
| **Processing** | Client-side Web Audio API | On-device DSP & mobile background daemon |
| **Engine** | Explainable heuristic scoring | Hybrid heuristic + edge quantized neural model |
| **Alert Action** | Simulated UI Dispatch Notification | Silent SMS / Webhook / Emergency contact relay |
| **Baseline** | In-session live calibration | Rolling multi-day baseline with circadian tuning |

---

## Detection Signals

| Signal Channel | Detection Mechanism | Status |
| :--- | :--- | :--- |
| **Pitch Deviation ($F_0$)** | Autocorrelation pitch estimate vs reference / personal baseline | ✅ Implemented |
| **RMS Energy Dynamics** | Loudness spikes and suppressed whispers | ✅ Implemented |
| **Zero-Crossing Rate (ZCR)** | Breathy / turbulent airflow indicator | ✅ Implemented |
| **Spectral Centroid** | High-frequency vocal strain | ✅ Implemented |
| **Prolonged Silence / Voice Activity** | VAD-based freeze and low-voicing detection | ✅ Implemented |
| **Personal Voice Baseline** | Welford mean/σ calibration → Z-score deviations | ✅ Implemented |
| **Covert Code-Word Phrases** | Token-aware local phrase matching (transcript input is simulated — no speech-to-text yet) | ✅ Implemented |
| **Temporal Correlation** | Transient-spike suppression, sustained + cross-signal confirmation | ✅ Implemented |
| **Silent Alert Simulation** | Latched incident, trusted-contact dispatch preview (never sent), forensic audit | ✅ Implemented |

---

## Privacy & Security First

- 🔒 **100% Local Processing:** Audio waveforms are processed in local memory and immediately discarded.
- 🚫 **Zero Cloud Audio Streaming:** No audio recordings are ever transmitted to or stored on external servers.
- 📊 **Telemetry Only:** Only high-level mathematical abstractions (e.g., RMS energy, pitch estimate, silence duration) are logged locally during the session.

---

## Demo Flow Preview (2–3 Minutes)

1. **Scene 1 (Normal Speech):** Calm talking $\rightarrow$ Risk: Low ($<15$) $\rightarrow$ Green HUD $\rightarrow$ No alert.
2. **Scene 2 (Isolated Pitch/Volume Spike):** Loud cheer/excitement $\rightarrow$ Pitch spikes, but only single signal triggers $\rightarrow$ Risk: Elevated ($35$) $\rightarrow$ No alert.
3. **Scene 3 (Prolonged Silence):** Abrupt conversational freeze $\rightarrow$ Silence counter increments $\rightarrow$ Risk: Suspected ($55$).
4. **Scene 4 (Covert Code-Word):** Speaking secret phrase casually: *"Feed the cat"* $\rightarrow$ Contextual signal triggered $\rightarrow$ Risk: High ($75$).
5. **Scene 5 (Multi-Signal Critical Event):** Strained whisper + code phrase + hesitation $\rightarrow$ Risk: Critical ($>80$) $\rightarrow$ **Silent Alert Simulator Dispatches Notification!**

Full script documented in [docs/DEMO_FLOW.md](docs/DEMO_FLOW.md).

---

## Technology Stack

- **Frontend Core:** React 19, TypeScript
- **Tooling & Bundler:** Vite, Oxlint
- **Audio DSP:** Browser Web Audio API (`AudioContext`, `AnalyserNode`)
- **Icons & Styling:** Lucide React, dark safety-HUD design system in vanilla CSS (`src/index.css`)
- **Backend / DB / Auth:** None in this phase (Zero-friction local execution)

---

## Project Structure

```
sanket/
├── docs/
│   ├── PROJECT_CONTEXT.md      # Primary source of truth
│   ├── ARCHITECTURE.md         # Technical design & data contracts
│   ├── ROADMAP.md              # 11-phase development roadmap
│   ├── PROGRESS.md             # Real-time implementation status
│   ├── DECISIONS.md            # Architecture Decision Records (ADRs)
│   ├── DEMO_FLOW.md            # Judge demonstration script
│   ├── MOBILE_INTEGRATION.md   # Phase 10 native deployment design
│   └── AGENT_HANDOFF.md        # Onboarding manifest for AI agents & engineers
├── src/
│   ├── demo/                   # Guided judge tour state machine
│   ├── components/             # React presentation components
│   ├── audio/                  # Web Audio capture & frame processing
│   ├── analysis/               # Feature extraction, baseline, and risk scoring
│   ├── services/               # State coordination & alert simulation
│   ├── utils/                  # Mathematical and audio utilities
│   ├── App.tsx                 # Main application shell
│   ├── main.tsx                # Entry point
│   └── index.css               # Design system & dark theme variables
├── public/                     # Static assets
├── package.json                # Project dependencies
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite configuration
└── README.md                   # This document
```

---

## Development Roadmap Status

- [x] **Phase 0–1:** Project setup, browser microphone & live audio pipeline
- [x] **Phase 2:** Pitch, energy, speech activity & silence features
- [x] **Phase 3:** Multi-signal distress risk engine
- [x] **Phase 4:** Live safety dashboard
- [x] **Phase 5:** Configurable code-word detection
- [x] **Phase 6:** Personal voice baseline & calibration
- [x] **Phase 7:** Silent alert dispatch & forensic event system
- [x] **Phase 8:** Temporal correlation & false-alarm reduction
- [x] **Phase 9:** Guided judge demonstration flow
- [x] **Final console:** Source-agnostic audio (microphone or file), built-in sample call, trusted contacts
- [x] **Phase 10:** Mobile deployment architecture — design doc only, see [docs/MOBILE_INTEGRATION.md](docs/MOBILE_INTEGRATION.md)

See [docs/ROADMAP.md](docs/ROADMAP.md) for full phase details.

---

## Limitations

- **Ambient Noise Sensitivity:** Sudden background noises (appliances, street traffic) can skew acoustic metrics; requires dynamic noise floors.
- **Microphone Hardware Diversity:** Laptop built-in microphones exhibit different frequency responses and gain levels compared to smartphone or headset microphones.
- **Browser Lifecycle:** Web Audio streams pause if mobile browser tabs are backgrounded without specific media sessions.
- **No Speech-to-Text:** Code-word detection is fed by typed or scripted transcripts; on-device recognition is a future adapter (see [docs/MOBILE_INTEGRATION.md](docs/MOBILE_INTEGRATION.md)).
- **Acoustic Ceiling by Design:** Acoustic channels alone top out just below `HIGH_RISK`; a corroborating signal (code word, prolonged silence, low voice activity) is required for an alert.
- **Simulated Alerts:** No SMS, email, or emergency service is ever contacted; the dispatch payload is a local preview.

---

## Future Deployment & Mobile Bridge

The architecture is specifically structured so the core detection logic in `/src/audio` and `/src/analysis` contains **zero DOM dependencies**. In future production phases, this engine will be wrapped in:
- A React Native native module with Android Foreground Service.
- An iOS background audio daemon with CallKit/VoIP integration.
- Encrypted local SQLite persistence for audit trails.

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm
- A Chromium-based browser or Firefox (microphone access requires `localhost` or HTTPS)

### Install & Run

```bash
git clone https://github.com/vishesh-ienc/sanket.git
cd sanket
npm install
npm run dev          # http://localhost:5173
```

### Three Ways to Demo

1. **Guided tour (no mic needed to follow along):** click **START GUIDED TOUR** and step through
   baseline → normal speech → transient spike (suppressed) → sustained multi-signal distress →
   silent alert → forensic audit. Synthetic scenario data drives the engine, so it works even if
   microphone access is denied.
2. **Sample call (recommended for judges):** open **Simulated Call Audio → USE SAMPLE CALL → PLAY**.
   A 36-second call synthesized in the browser goes from calm to strained; the scripted transcript
   slips in the code word at 0:22, and the silent alert latches shortly after.
3. **Live microphone:** **Live Microphone → START MONITORING** and talk. Open
   **CONFIGURE PARAMETERS** to calibrate your personal baseline, set the code word, and add trusted
   contacts (stored locally, never messaged).

### Running Tests

```bash
npm test            # 10 deterministic suites, 646 tests — no browser or mic required
npm run lint        # oxlint
npm run build       # type-check + production bundle
```

---

## License

This project is licensed under the MIT License.
