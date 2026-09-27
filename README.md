# Sanket (संकेत)

> **Non-Verbal Distress Detection via Voice Pattern Analysis**  
> Sanket is a multimodal voice distress-risk detection prototype designed to identify potential distress through subtle changes in voice and conversational patterns without requiring physical interaction or explicit panic calls.

[![Status: Prototype Complete](https://img.shields.io/badge/Status-Prototype%20Complete-blue)](docs/PROGRESS.md)
[![Tests: 730 passing](https://img.shields.io/badge/Tests-730%20passing-emerald)](#running-tests)
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
| **Covert Code-Word Phrases** | Token-aware local phrase matching; live from the mic via **on-device** browser speech recognition (cloud only by explicit opt-in), or from a demo call's transcript track | ✅ Implemented |
| **Customisable Signals** | Enable/disable each signal, tune weights, alert threshold, pitch sensitivity and code-word weight — single-signal ceiling always enforced | ✅ Implemented |
| **Temporal Correlation** | Transient-spike suppression, sustained + cross-signal confirmation | ✅ Implemented |
| **Silent Alert Simulation** | Latched incident, trusted-contact dispatch preview (never sent), forensic audit | ✅ Implemented |

---

## Privacy & Security First

- 🔒 **100% Local Processing:** Audio waveforms are processed in local memory and immediately discarded.
- 🚫 **Zero Cloud Audio Streaming:** No audio recordings are ever transmitted to or stored on external servers.
- 📊 **Telemetry Only:** Only high-level mathematical abstractions (e.g., RMS energy, pitch estimate, silence duration) are logged locally during the session.

---

## Demo Flow Preview (2–3 Minutes)

1. **Monitor → Play demo call.** A built-in 53 s phone call (two synthetic voices) plays through the exact pipeline a live stream would use.
2. **Calm opening (0:00–0:17):** risk stays *Normal*; the live signal tiles barely move.
3. **Voice tightens (0:17–0:25):** pitch, intensity and strain rise; the activity feed logs the escalation.
4. **Distress + code phrase (0:25–):** acoustics alone push risk to *Suspicious* — then the caller slips in *"Remember to feed the cat"*. That corroboration crosses the threshold and a **silent alert** is raised (visual only, nothing sent).
5. **View evidence:** contributing signals, temporal confirmation, dispatch preview for trusted contacts, privacy guarantees.

Or use **Demo → Start tour** for a 6-step guided walkthrough that runs on simulated signals (no mic needed). Full script: [docs/DEMO_FLOW.md](docs/DEMO_FLOW.md).

---

## Technology Stack

- **Frontend:** React 19, TypeScript 6, Vite 8
- **UI:** Tailwind CSS v4 + shadcn/ui (Radix), Lucide icons, Geist / Geist Mono; light, dark and system themes ("Teal Mist" palette from 21st.dev with semantic risk colours)
- **Audio DSP:** Web Audio API (`AudioContext`, `AnalyserNode`), portable frame builder for non-browser sources
- **Speech (code word only):** Web Speech API with `processLocally` on-device recognition
- **Tooling:** Oxlint, Prettier, `tsx`-run deterministic test suites
- **Backend / DB / Auth:** none — everything runs in the browser

---

## Project Structure

```
sanket/
├── docs/                         # Context, architecture, ADRs, demo script, mobile design, handoff
├── public/demo/                  # Built-in demo conversation (WAV + JSON transcript manifest)
├── scripts/
│   └── generate_demo_conversation.py   # Offline Piper-TTS generator for the demo call
├── src/
│   ├── audio/                    # Mic + file adapters, frame builder, demo conversation loader
│   ├── analysis/                 # Features, baseline, temporal filter, risk engine, code word,
│   │                             #   live speech adapter, customisable signal settings
│   ├── services/                 # Incident latch, alert history, trusted contacts, dispatch payload
│   ├── demo/                     # Guided tour state machine
│   ├── app/                      # usePipeline orchestration hook + context, activity feed model
│   ├── views/                    # Monitor · Signals · Incidents · Demo · Settings
│   ├── components/
│   │   ├── sanket/               # Gauge, sparkline, waveform, feed, sheets, source card…
│   │   ├── shell/                # Sidebar, mobile tab bar, top bar, theme toggle
│   │   ├── theme/                # Theme provider (light/dark/system)
│   │   └── ui/                   # shadcn/ui primitives (generated)
│   ├── globals.css               # Tailwind + design tokens
│   └── main.tsx / App.tsx
└── package.json
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
- [x] **Final console:** Source-agnostic audio (microphone or file), trusted contacts
- [x] **UI overhaul:** Tailwind + shadcn app shell, themes, customisable signals, built-in TTS demo call, live on-device code word
- [x] **Phase 10:** Mobile deployment architecture — design doc only, see [docs/MOBILE_INTEGRATION.md](docs/MOBILE_INTEGRATION.md)

See [docs/ROADMAP.md](docs/ROADMAP.md) for full phase details.

---

## Limitations

- **Ambient Noise Sensitivity:** Sudden background noises (appliances, street traffic) can skew acoustic metrics; requires dynamic noise floors.
- **Microphone Hardware Diversity:** Laptop built-in microphones exhibit different frequency responses and gain levels compared to smartphone or headset microphones.
- **Browser Lifecycle:** Web Audio streams pause if mobile browser tabs are backgrounded without specific media sessions.
- **Speech recognition availability:** private on-device recognition needs a recent Chrome with the language pack installed; Firefox has no speech API. Other browsers fall back to typed tests or an explicit cloud opt-in.
- **Synthetic demo voices:** the built-in call is TTS with signal-processed "distress", not a real person; real acted or consented recordings would be more convincing.
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

### Ways to Demo

1. **Built-in call (recommended):** **Monitor → Play demo call.** Captions show what's being said; the silent alert appears
   shortly after the caller says the code phrase (~0:39).
2. **Guided tour:** **Demo → Start tour** — six steps on simulated signals, works without a microphone.
3. **Live microphone:** **Monitor → Mic → Start microphone** and talk. In Chrome, **Settings → Live code-word listening →
   Install** downloads the on-device speech pack once; after that, saying your code phrase is detected privately.
4. **Your own recording:** **Monitor → Upload** any WAV/MP3/OGG (phone recording, VoIP export…).
5. **Scenario simulator:** **Demo → Scenario simulator** — synthetic patterns (cough burst, whisper, multi-signal…).

Tune what counts under **Signals**, and set the code word, baseline and trusted contacts under **Settings**.

### Replacing the Demo Conversation

Drop a consented recording into `public/demo/` with a manifest following `src/audio/demoConversations.ts`
(`cues` with `atSec`/`finalSec`/`speaker`/`text`, a `timeline`, `codePhrase`), and list it in
`DEMO_CONVERSATION_MANIFESTS`. To regenerate the synthetic call, see `scripts/generate_demo_conversation.py`.

### Running Tests

```bash
npm test            # 13 deterministic suites, 730 tests — no browser or mic required
npm run lint        # oxlint
npm run build       # type-check + production bundle
```

---

## License

This project is licensed under the MIT License.
