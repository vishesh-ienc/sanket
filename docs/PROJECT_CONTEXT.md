# Sanket, Project Context & Primary Source of Truth

> **Primary Source of Truth**  
> This document defines the mission, conceptual boundaries, architecture, limitations, and operational roadmap for Project Sanket. All incoming engineers, coding agents, and collaborators must treat this document as authoritative.

---

## 1. Project Overview & Name

- **Project Name:** **Sanket** (संकेत, Sanskrit/Hindi for *Signal*, *Hint*, or *Gesture*)
- **Tagline:** Non-Verbal Distress Detection via Voice Pattern Analysis
- **Domain:** Personal Safety, Assistive Audio Intelligence, Human-Centric Risk Estimation

---

## 2. Problem Statement

In hostile, coercive, or high-distress scenarios (domestic coercion, kidnapping, harassment during rideshares or late-night commutes, medical emergencies, or home invasions), victims are frequently **unable to press physical panic buttons**, unlock their phones, dial emergency services (e.g., 911/112), or openly plead for help without alerting or provoking an aggressor.

Traditional emergency response tools suffer from critical failure modes:
1. **Physical friction:** Requiring physical interaction with a device that might be out of reach or actively monitored by an assailant.
2. **Binary assumptions:** Assuming the victim can speak explicitly ("Help me!") or make unambiguous emergency calls.
3. **High false alarm stigma:** Many people hesitate to trigger drastic panic systems until it is too late out of fear of social embarrassment or false alarms.

---

## 3. Why the Problem Matters

Voice is often the only permitted or active transmission channel during an ongoing incident-for example, during a phone call with a family member, a speakerphone conversation, or a voice chat while walking home. When people are under acute psychological stress or coercive restraint:
- Vocal pitch deviates significantly from baseline due to laryngeal muscle tension.
- Respiration patterns alter, causing shallow breathing, abrupt vocal drop-offs, or gasps.
- Speech cadence fractures into unnatural hesitation or abrupt, prolonged silences.
- Coded language or covert trigger phrases may be slipped into otherwise innocuous conversational sentences.

A system that reliably monitors permitted acoustic streams for multiple non-verbal distress indicators can provide an automated, discrete safety net.

---

## 4. Product Concept

Sanket is a **multimodal voice distress-risk detection system**. Instead of monitoring or transcribing full private conversations to cloud servers, Sanket analyzes local audio frames for acoustic and temporal anomalies:

1. **Acoustic Strain & Prosody Shifts:** Real-time estimation of fundamental frequency ($F_0$ / pitch), vocal tremor, and energy envelope dynamics.
2. **Conversational Temporal Flow:** Detection of atypical speech-to-pause ratios, interrupted utterances, and unnaturally prolonged silences under active audio sessions.
3. **Configurable Covert Trigger Phrases:** Local, low-resource detection of user-defined safe phrases (e.g., *"Did you feed the cat today?"*) that signal covert distress without alerting bystanders.
4. **Multi-Signal Risk Fusion:** A heuristic scoring engine that fuses these indicators over a sliding time window to produce a composite **Distress Risk Score** rather than relying on any single anomaly.

---

## 5. Critical Product Positioning & What Sanket Does NOT Claim

> [!IMPORTANT]
> **What Sanket is:**
> Sanket is a multimodal voice distress-**RISK** detection system. The system estimates potential distress based on deviations across multiple permitted voice signals and contextual indicators.

> [!CAUTION]
> **What Sanket is NOT:**
> "Do not claim that Sanket can definitively determine that a person is in danger. It estimates distress risk from multiple signals."
> 
> - Sanket is **NOT** a certified medical diagnosis tool.
> - Sanket is **NOT** an infallible police or military emergency classification system.
> - Sanket does **NOT** claim to "know" whether someone is scared, lying, or experiencing a certified life-or-death crisis.
> - **No single acoustic feature should ever be treated as proof of an emergency.** Acoustic strain can be caused by excitement, exercise, a cold, anger, or poor microphone quality. Only multi-signal correlation elevates the estimated risk level.

---

## 6. Hackathon Objective & Current Prototype Scope

### Hackathon Goal
To design, build, and demonstrate a **convincing, genuinely working browser-based prototype within approximately one day**, proving that multi-signal voice risk estimation can operate locally, transparently, and responsively in real-time.

### Prototype vs. Intended Production Deployment

> [!NOTE]
> "The browser microphone is the prototype input layer. The underlying detection engine is designed to be input-agnostic and could later receive permitted mobile microphone, call, or VoIP audio depending on platform capabilities and permissions."

| Dimension | Hackathon Prototype | Intended Final Production Product |
| :--- | :--- | :--- |
| **Audio Input** | Browser `getUserMedia` Microphone Stream | OS-level permitted mobile background audio / Call Audio / VoIP / Smart Wearables |
| **Runtime Target** | Modern Desktop / Laptop Web Browser | Mobile daemon (iOS / Android Background Service), On-device DSP |
| **Scoring Engine** | Transparent heuristic / rule-based multi-signal fusion | Hybrid heuristic + embedded on-device edge ML / quantized acoustic models |
| **Alert Action** | Simulated UI Silent Alert, dispatch mockups, contact event log | Background SMS dispatch, Webhook to emergency contact, silent GPS relay |
| **Baseline** | In-session live baseline calibration (10–30s ambient / normal speech) | Long-term personalized rolling voice baseline with circadian adjustments |
| **Persistence** | In-memory session state / local storage | Encrypted on-device SQLite database / zero-cloud storage |

---

## 7. Target User & Use Cases

- **Night Commuters & Solo Walkers:** Users speaking on the phone or keeping a passive safety session active while traveling through unfamiliar areas.
- **Rideshare Passengers & Drivers:** Covert monitoring during rideshare trips where overt emergency calls could escalate violence.
- **Vulnerable Individuals:** Individuals living with domestic violence risks who need discreet escalation pathways.
- **Lone Workers & Field Agents:** Delivery personnel, field nurses, utility workers operating alone in high-risk zones.

---

## 8. Core Architecture & Major System Components

The system is strictly divided into decoupled, modular layers:

```
[AUDIO INPUT LAYER]
   Browser Web Audio API (Prototype) / Mobile Mic / VoIP Stream (Production)
          ↓
[AUDIO PROCESSING LAYER]
   Sample rate normalization, windowing (Hamming/Hann), FFT / Web Audio AnalyserNode
          ↓
[FEATURE EXTRACTION LAYER]
   Pitch / F0, Energy / RMS, Spectral Centroid, Zero-Crossing Rate, Silence Ratio
          ↓
[PERSONAL BASELINE LAYER]
   Rolling normal-speech statistics (mean, variance, normal conversational dynamic range)
          ↓
[SIGNAL ANALYSIS LAYER]
   Pitch anomaly detector, energy spike/drop detector, prolonged silence detector, keyword spotter
          ↓
[RISK SCORING ENGINE]
   Temporal sliding-window correlation, multi-signal weighting, decay mechanics
          ↓
[RISK CLASSIFICATION]
   Normal (0–29) → Elevated Attention (30–59) → Suspected Distress (60–79) → High Distress Risk (80–100)
          ↓
[SILENT ALERT ENGINE]
   Cooldown timer, threshold verification, simulation dispatch payload (GPS + timestamp + reason)
          ↓
[DASHBOARD / EVENT LOG]
   Real-time telemetry, visual safety HUD, transparent trigger inspection, event audit log
```

---

## 9. Detection Philosophy & False Alarm Reduction

1. **Defense in Depth (Multi-Signal Requirement):**
   A loud yell alone is not treated as distress (could be watching sports). A long silence alone is not distress (could be reading). Distress risk surges only when **atypical acoustic strain + unnatural cadence + code phrase or silence** correlate across an active window.
2. **Graceful Decay:**
   Spikes in risk must naturally decay over time if subsequent frames return to normal conversational patterns.
3. **Local Personal Baseline:**
   Everyone has a different natural vocal pitch, cadence, and volume. Detection must measure deviations from the *user's baseline*, not an arbitrary universal constant.
4. **Explainable Heuristics:**
   Rather than opaque "black-box" predictions, Sanket surfaces exactly which signals contributed to a score (e.g., `+30 Pitch Deviation (z=2.8)`, `+25 Prolonged Silence (4.2s)`).

---

## 10. Privacy Philosophy (Local-First)

- **Zero Cloud Audio Streaming:** Audio raw waveforms should never leave the local client device.
- **No Remote Eavesdropping:** Audio frames are processed ephemerally in RAM and immediately discarded.
- **Transparent Logging:** Only high-level mathematical telemetry (RMS energy, estimated pitch, anomaly flags) is retained in the session event log.

---

## 11. Current Technology Stack

- **Framework:** React 19 + TypeScript
- **Bundler & Tooling:** Vite, Oxlint
- **Audio Processing:** Browser Web Audio API (`AudioContext`, `AnalyserNode`, `ScriptProcessorNode` / `AudioWorklet`)
- **UI Styling:** Tailwind CSS v4 + shadcn/ui, light/dark/system themes with semantic risk colours (see DECISION 021)
- **State Management:** Reactive React hooks / modular service subscriptions (no heavy external state libraries required)
- **Backend / Database / Auth:** None in this phase (Zero friction, completely client-side for rapid hackathon execution)

---

## 12. Current Development Status

- **Status:** Hackathon prototype complete (Phases 0–10; Phase 10 is a design document).
- **Working:** Source-agnostic audio (microphone, built-in demo conversation, uploaded file, or simulated scenarios), feature extraction, personal baseline, customisable multi-signal risk engine, temporal false-positive filter, code-word detection (live on-device speech in Chrome, or the demo call's transcript track), latched silent-alert simulation with trusted-contact dispatch preview, forensic evidence, and a guided judge tour, all in a responsive themed app shell.
- **Not built:** Native mobile apps, real alert transport, live speech outside Chrome's on-device engine. See `docs/PROGRESS.md` and `docs/MOBILE_INTEGRATION.md`.

---

## 13. Hackathon 2–3 Minute Demo Concept

A realistic live demonstration flow:
1. **Normal Conversation:** User speaks normally. System shows normal baseline, low risk ($<20$), system steady.
2. **Single Signal Deviation:** User speaks loudly or with high pitch (e.g., excitement). Pitch indicator spikes, but overall risk remains low/medium ($<40$). No alert.
3. **Prolonged Silence:** User abruptly stops talking while an emergency would prevent speech. Silence counter increments, risk climbs ($60+$).
4. **Covert Code Word:** User calmly utters the covert code phrase: *"Remember to feed the cat."* Code-word detector triggers immediate contextual confidence boost.
5. **Multi-Signal Critical Event:** Combined pitch fracture, prolonged hesitation, and code phrase push Distress Risk Score $>80$. The **Silent Alert Simulator** triggers instantly, displaying silent notification dispatch with mock coordinates and acoustic trigger rationale.

---

## 14. Future Extensions Beyond Hackathon

1. **Native Mobile App (React Native / Swift / Kotlin):** Background audio service listening during active phone calls or locked phone mode.
2. **On-Device Whisper/Vosk Keyword Spotting:** Lightweight local speech-to-text models for broader phrase recognition.
3. **Hardware Integrations:** Wearable haptic confirmations (subtle smartwatch vibration asking "Are you safe?" with single tap dismiss).
4. **Emergency SMS / Webhook Gateway:** Direct integration with Twilio or local emergency dispatch APIs.
