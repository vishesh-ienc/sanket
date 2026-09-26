# Sanket (संकेत)

> **Non-Verbal Distress Detection via Voice Pattern Analysis**  
> Sanket is a multimodal voice distress-risk detection prototype designed to identify potential distress through subtle changes in voice and conversational patterns without requiring physical interaction or explicit panic calls.

[![Phase: Phase 0 Completed](https://img.shields.io/badge/Phase-Phase%200%20(Initialization)-blue)](docs/PROGRESS.md)
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

## Planned Detection Signals

| Signal Channel | Detection Mechanism | Status |
| :--- | :--- | :--- |
| **Pitch Deviation ($F_0$)** | Autocorrelation / YIN algorithm detecting vocal cord tension | 📋 Planned (Phase 2) |
| **RMS Energy Dynamics** | Volume envelope tracking sudden yelling or suppressed whispers | 📋 Planned (Phase 2) |
| **Zero-Crossing Rate (ZCR)** | High-frequency noise ratio to detect forced, breathy whispers | 📋 Planned (Phase 2) |
| **Prolonged Silence / Hesitation** | VAD-based timer detecting conversational freezing | 📋 Planned (Phase 2) |
| **Personal Voice Baseline** | Statistical $Z$-score deviation from user's calibrated norm | 📋 Planned (Phase 7) |
| **Covert Code-Word Phrases** | Local phrase matching (e.g., *"Remember to feed the cat"*) | 📋 Planned (Phase 5) |
| **Multi-Signal Correlation** | Temporal co-occurrence filter to eliminate false alarms | 📋 Planned (Phase 8) |

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
- **Icons & Styling:** Lucide React, Modern Dark Theme Safety HUD (Vanilla CSS / Tailwind)
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
│   └── AGENT_HANDOFF.md        # Onboarding manifest for AI agents & engineers
├── src/
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

- [x] **Phase 0: Project Initialization & Documentation Infrastructure** ✅ `Implemented`
- [ ] **Phase 1: Browser Microphone & Live Audio Analysis** 🚧 `In Development`
- [ ] **Phase 2: Pitch, Energy, Speech Activity & Silence Detection** 📋 `Planned`
- [ ] **Phase 3: Distress Risk Scoring Engine** 📋 `Planned`
- [ ] **Phase 4: Live Sanket Safety Dashboard** 📋 `Planned`
- [ ] **Phase 5: Configurable Code-Word Detection** 📋 `Planned`
- [ ] **Phase 6: Silent Alert Simulation** 📋 `Planned`
- [ ] **Phase 7: Personal Voice Baseline & Calibration** 📋 `Planned`
- [ ] **Phase 8: Multi-Signal Temporal Correlation & False Alarm Reduction** 📋 `Planned`
- [ ] **Phase 9: Polish & Judge Demonstration Flow** 📋 `Planned`
- [ ] **Phase 10: Mobile Deployment Architecture Documentation** 📋 `Planned`

See [docs/ROADMAP.md](docs/ROADMAP.md) for full phase details.

---

## Limitations

- **Ambient Noise Sensitivity:** Sudden background noises (appliances, street traffic) can skew acoustic metrics; requires dynamic noise floors.
- **Microphone Hardware Diversity:** Laptop built-in microphones exhibit different frequency responses and gain levels compared to smartphone or headset microphones.
- **Browser Lifecycle:** Web Audio streams pause if mobile browser tabs are backgrounded without specific media sessions.

---

## Future Deployment & Mobile Bridge

The architecture is specifically structured so the core detection logic in `/src/audio` and `/src/analysis` contains **zero DOM dependencies**. In future production phases, this engine will be wrapped in:
- A React Native native module with Android Foreground Service.
- An iOS background audio daemon with CallKit/VoIP integration.
- Encrypted local SQLite persistence for audit trails.

---

## Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- npm or pnpm

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/vishesh-ienc/sanket.git
cd sanket

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## License

This project is licensed under the MIT License.
