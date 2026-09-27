# Sanket — Demonstration Script & Presentation Flow

> **Audio-Source-Agnostic Voice Distress-Risk Detection Console**  
> This playbook details the judge demonstration narrative, system flow, and evaluation sequence for Sanket.  
> **Important Disclaimer:** Sanket is an engineering prototype demonstrating multimodal acoustic distress-risk estimation. It is an algorithmic estimation tool, not an emergency certification or medical diagnostic system.

---

## 1. Product Positioning & Executive Summary

**What is Sanket?**  
Sanket is a **configurable voice distress-risk detection system**. It is designed to be attached to various audio sources; the underlying feature extraction, baseline deviation tracking, and risk classification engine are **entirely source-agnostic**.

```
                AUDIO SOURCES
                     │
    ┌────────────────┼────────────────┐
    │                │                │
Live Microphone  Simulated Call Audio  Future Authorized Stream
    │                │                │
    └────────────────┼────────────────┘
                     ▼
           NORMALIZED AUDIO FRAME
                     ▼
             FEATURE EXTRACTION
                     ▼
           PERSONAL VOICE BASELINE
                     ▼
          MULTI-SIGNAL CORRELATION
                     ▼
        TEMPORAL CONTEXT FILTERING
                     ▼
            RISK CLASSIFICATION
                     ▼
           SILENT LOCAL ALERT
                     ▼
             FORENSIC AUDIT
```

**Key Judge Message (10–15 Seconds):**  
> *"Sanket is not a single-purpose phone app — it is a voice distress-risk detection engine. It accepts any normalized audio stream — whether from a live microphone, a pre-recorded call recording, or a future authorized communication adapter — and detects potential distress by measuring multi-signal deviations from an individual voice baseline."*

---

## 2. Core Demonstration Flow: Prepared Audio File Input

The primary demonstration allows evaluators to feed a prepared audio recording into the identical live analysis pipeline:

1. **Orientation (5 seconds):**
   - Presenter: *"This is the Sanket detection console. Notice the audio source selector at the top."*
   - Judge sees the clean top-level Audio Source panel with tabs: `Live Microphone` and `Simulated Call Audio`.

2. **Select Audio Source (10 seconds):**
   - Click the **"Simulated Call Audio"** tab.
   - Click **"USE SAMPLE CALL"** (built-in, synthesized in the browser — no file needed), or **"LOAD YOUR OWN FILE"** for a prepared `.wav` / `.mp3` / `.ogg`.
   - The audio is decoded in-browser using Web Audio API into the identical `AudioFrame` format consumed by the feature extractor.
   - With the sample call, a storyline strip shows the segments (calm 0:00–0:14 → voice tightens → sustained distress 0:18–0:36) and live **SIMULATED TRANSCRIPT** captions. Say so out loud: the prototype has no speech-to-text, so the call carries a scripted transcript.
   - *Optional prep:* under **CONFIGURE PARAMETERS**, add one or two trusted contacts so the forensic modal shows a populated dispatch preview.

3. **Begin Playback & Observe Normal Conversation (20 seconds):**
   - Click **"PLAY"**.
   - Normal conversation plays through the pipeline.
   - The **PCM Oscilloscope** shows live waveform dynamics.
   - The **Central Risk Score Gauge** remains in the green zone (`0–25 NORMAL`).
   - The **Multi-Signal Breakdown** shows nominal pitch and energy within standard bounds.
   - The **Temporal Context** card indicates `TEMPORALLY STABLE`.

4. **Distress Acoustic Deviations Begin (20 seconds):**
   - As distress-related acoustic deviations emerge in the audio (acute pitch elevation, vocal strain, irregular pausing):
   - The **Signal Breakdown** bars dynamically rise:
     - Pitch Deviation climbs ($>2.0\sigma$ from baseline).
     - Vocal Intensity exhibits sustained compression or strain.
     - Conversational turn pacing exhibits irregular pause patterns.
   - The **Temporal Context** evaluates cross-signal correlation across a rolling 30-frame window.

5. **Risk Classification & Escalation (15 seconds):**
   - When multiple independent acoustic channels deviate simultaneously and persist beyond transient thresholds:
   - Temporal status switches to `SUSTAINED & MULTI-SIGNAL`.
   - Risk score climbs through `ELEVATED` (35+) and `SUSPICIOUS` (50+) into `HIGH_RISK` (70+).
   - The central HUD pulses with confirmation badges.

6. **Silent Distress Alert Triggered (10 seconds):**
   - Upon confirmed HIGH_RISK, the **Incident Banner** appears at the top:
     - Status: `CONFIRMED HIGH-RISK EVENT`.
     - Subtext: *"Alert generated after sustained multi-signal confirmation • Simulated local alert • Zero external transmission."*
     - No audible siren sounds (simulated silent dispatch to prevent endangering a victim).

   - With the sample call: acoustics alone push the score into `SUSPICIOUS` (~65–68). At **0:22** the caller says the code phrase inside an innocuous sentence; that corroborating signal pushes the score past 70 and the alert latches a moment later. This is the multi-signal story: no single channel, however extreme, triggers an alert.

7. **Forensic Evidence Inspection (30 seconds):**
   - Click **"VIEW EVIDENCE"** on the banner.
   - The **Forensic Event Modal** displays:
     - Exact timestamp and event ID.
     - Contributing signals with point-by-point breakdown.
     - Baseline deviation $Z$-scores.
     - Short-term temporal correlation and pause regularity metrics.
     - **Silent Alert Dispatch Preview:** masked trusted-contact recipients, the discreet message, a placeholder location, and the raw JSON payload — marked `NOT SENT • SIMULATED`.
     - Privacy Guarantee: Zero raw audio streaming, zero raw audio storage, local DSP only.

8. **Source Independence Proof (10 seconds):**
   - Switch the source tab to **"Live Microphone"**.
   - Show that the exact same feature extraction, baseline comparison, and risk engine execute against real-time microphone input with no code or architectural changes.

---

## 3. Alternative: Interactive 6-Step Guided Demonstration

For rapid evaluations without external files, the top **Judge Demonstration Panel** provides an automated 6-scene walkthrough:

| Step | Scene Name | Demonstrates | System Response |
| :---: | :--- | :--- | :--- |
| **1** | Personal Baseline Calibration | Relative $Z$-score tracking vs static thresholds | Activates preset vocal profile ($165\text{ Hz } \mu, \pm 14.5\text{ Hz } \sigma$) |
| **2** | Normal Conversational Speech | Calm baseline reference state | Score `8–15` (NORMAL), stable temporal context |
| **3** | Transient Vocal Spike | False-positive reduction via temporal filter | Cough/laugh burst flagged as `TRANSIENT_SPIKE`, alert suppressed |
| **4** | Sustained Multi-Signal Distress | Cross-channel co-occurrence & persistence | Pitch + Energy + Spectral deviations sustain; score $>70$ |
| **5** | Silent Alert Dispatch | Silent local dispatch without audible danger | Prominent `SILENT DISTRESS ALERT` banner latches locally |
| **6** | Forensic Incident Audit | Explainable evidence with zero raw audio | Forensic modal reveals contributing signals & $Z$-scores |

---

## 4. Judge Q&A Defense Talking Points

| Expected Judge Question | Recommended Response |
| :--- | :--- |
| **"Is Sanket a mobile phone app?"** | *"Sanket is designed as an audio-source-agnostic detection engine. While mobile or VoIP devices represent possible future sources, the engine itself operates on normalized audio frames and can be fed by live microphones, pre-recorded audio files, or any authorized communication stream."* |
| **"Could someone cough, yell, or laugh and trigger an alert?"** | *"No. The Phase 8 Temporal Context Analyzer filters isolated 1–2 frame spikes as TRANSIENT_SPIKE. Alert dispatch strictly requires multi-frame sustained persistence and multi-signal corroboration."* |
| **"Are you recording or uploading my voice to an external cloud/AI server?"** | *"No. Sanket processes all audio frames locally in memory using the Web Audio API. Audio buffers are discarded immediately after analytical feature extraction. Zero audio or transcripts leave the client."* |
| **"Why is a personal baseline necessary?"** | *"Without a baseline, someone who naturally speaks with a higher pitch or softer volume would generate false alarms. Sanket calibrates mean and standard deviation to measure relative deviations (Z-scores) from their personal norm."* |
| **"Why is the alert silent instead of sounding an alarm?"** | *"In coercive, hostage, or domestic violence situations, an audible alarm or screen popup can immediately escalate danger from an aggressor. A silent local dispatch protects the user."* |
| **"Does Sanket claim to detect emergencies with certainty?"** | *"No. Sanket calculates an algorithmic voice distress-risk estimate based on acoustic deviations. It provides explainable evidence for human review rather than making unverified medical or emergency claims."* |
