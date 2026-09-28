# Sanket, Demonstration Script & Presentation Flow

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
> *"Sanket is not a single-purpose phone app, it is a voice distress-risk detection engine. It accepts any normalized audio stream, whether from a live microphone, a pre-recorded call recording, or a future authorized communication adapter, and detects potential distress by measuring multi-signal deviations from an individual voice baseline."*

---

## 2. Core Demonstration Flow: Built-in Conversation (~2 min)

The site ships with a pre-recorded 53-second phone call (`public/demo/conversation.wav`, two synthetic
voices generated offline with Piper TTS). It is decoded in the browser into the same `AudioFrame`s a live
microphone produces. Tip: open the site once beforehand so the audio is cached.

1. **Orientation (10 s), Monitor view.**
   *"This is Sanket's console. The source card at the top says it all: phone, VoIP, mic or a recording -
   any voice stream goes through the same pipeline."* Point at the **Detection pipeline** strip at the bottom.

2. **Play the call (0:00–0:17, calm).** Click **Play demo call**. Captions show both speakers. The risk
   gauge stays green (*Normal*); the **Live signals** tiles barely move.

3. **Voice tightens (0:17–0:25).** Asha notices she's being followed. Pitch, intensity and strain tiles light
   up; the **Live activity** feed logs *Risk rose to Elevated*. *"No single signal can raise an alert."*

4. **Distress (0:25–0:33).** Acoustics alone take the score into *Suspicious* (~60–65), but not past the
   alert line on the sparkline. *"This is the multi-signal ceiling doing its job."*

5. **The code phrase (0:33–0:36).** Asha says *"Everything is fine. Remember to feed the cat, okay?"* The
   code-word row flips to **+25 context** and the feed logs *Code word detected*. That corroboration pushes
   the score over 70 and the **Silent alert** banner appears (~0:39), visual only, no sound.

6. **Evidence (30 s).** Click **View evidence** (or the alert in the feed). Walk the three tabs:
   - **Evidence:** contributing signals ranked, σ-deviation from the personal baseline, temporal confirmation.
   - **Dispatch:** what *would* be sent to trusted contacts, masked numbers, discreet message, placeholder
     location, marked *Not sent · simulated*. (Add a contact under **Settings** beforehand for a fuller demo.)
   - **Privacy:** no audio stored, no transcripts, nobody contacted, estimate not diagnosis.

7. **Customisable signals (20 s).** Open **Signals**. Toggle a signal off or drag a weight; point at the
   *Single-signal ceiling* card: *"However you tune it, one signal can never alert on its own."*

8. **Source independence (10 s).** Back on Monitor, switch to **Mic** (or **Upload**), same engine, no changes.
   In Chrome, with the on-device speech pack installed (**Settings → Live code-word listening**), say the code
   phrase out loud; it's recognised on the device.

---

## 3. Alternative: 6-Step Guided Tour (no microphone needed)

**Demo → Start tour.** Each step drives the engine with a simulated scenario, and the tour card shows a live
readout (score, level, temporal filter state, latest event).

| Step | Scene | Demonstrates | Expected |
| :---: | :--- | :--- | :--- |
| 1 | Personal baseline | Relative Z-scores vs static thresholds | Demo profile applied (165 Hz ± 14.5) |
| 2 | Normal conversation | Calm reference | *Normal*, stable |
| 3 | Transient spike (cough/laugh) | False-positive filter | Feed: *Short spike filtered*, no alert |
| 4 | Sustained multi-signal distress | Cross-channel persistence | Score climbs past 70 |
| 5 | Silent alert | Visual-only local alert | Banner latches once |
| 6 | Forensic review | Explainable evidence | Evidence sheet opens automatically |

The **Scenario simulator** on the same page has 11 individual patterns for Q&A ("what if they just cough?").

---

## 4. Judge Q&A Defense Talking Points

| Expected Judge Question | Recommended Response |
| :--- | :--- |
| **"Is that a real person in the demo call?"** | *"No, it's synthetic speech generated offline, with the strain applied by signal processing. We deliberately didn't use a real person's voice. Teams can drop in a consented recording without code changes."* |
| **"Does speech recognition send my voice to Google?"** | *"Not by default. Sanket asks Chrome for on-device recognition (`processLocally`). Cloud recognition is off unless the user explicitly opts in, with a warning."* |
| **"Is Sanket a mobile phone app?"** | *"Sanket is designed as an audio-source-agnostic detection engine. While mobile or VoIP devices represent possible future sources, the engine itself operates on normalized audio frames and can be fed by live microphones, pre-recorded audio files, or any authorized communication stream."* |
| **"Could someone cough, yell, or laugh and trigger an alert?"** | *"No. The Phase 8 Temporal Context Analyzer filters isolated 1–2 frame spikes as TRANSIENT_SPIKE. Alert dispatch strictly requires multi-frame sustained persistence and multi-signal corroboration."* |
| **"Are you recording or uploading my voice to an external cloud/AI server?"** | *"No. Sanket processes all audio frames locally in memory using the Web Audio API. Audio buffers are discarded immediately after analytical feature extraction. Zero audio or transcripts leave the client."* |
| **"Why is a personal baseline necessary?"** | *"Without a baseline, someone who naturally speaks with a higher pitch or softer volume would generate false alarms. Sanket calibrates mean and standard deviation to measure relative deviations (Z-scores) from their personal norm."* |
| **"Why is the alert silent instead of sounding an alarm?"** | *"In coercive, hostage, or domestic violence situations, an audible alarm or screen popup can immediately escalate danger from an aggressor. A silent local dispatch protects the user."* |
| **"Does Sanket claim to detect emergencies with certainty?"** | *"No. Sanket calculates an algorithmic voice distress-risk estimate based on acoustic deviations. It provides explainable evidence for human review rather than making unverified medical or emergency claims."* |
