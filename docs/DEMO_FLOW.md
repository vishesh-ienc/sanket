# Sanket — Judge Demonstration Script & Presentation Flow

> **2–3 Minute Hackathon Demo Playbook**  
> This document details the exact narrative, spoken dialogue, and system responses for demonstrating Sanket to hackathon judges.  
> **Important Disclaimer:** Make clear to judges that this is an engineering prototype demonstrating multi-signal acoustic risk estimation, not a scientifically or medically validated emergency diagnostic system.

---

## Demo Overview

- **Target Duration:** 2 minutes 30 seconds
- **Objective:** Convincingly prove that Sanket detects potential distress risk without false alarms by correlating multiple voice anomalies rather than relying on a single acoustic trigger.
- **Setup:** Laptop with active browser microphone, dashboard open, ambient calibration pre-set.

---

## Scene-by-Scene Walkthrough

### SCENE 1: Normal Conversational Baseline (0:00 – 0:35)
- **Presenter Action:**  
  Click **"START MONITORING"**. Speak in a calm, natural conversational tone to the judges:  
  *"Hi everyone, I'm presenting Sanket. Notice that as I speak normally, the audio visualizer reflects my voice, the system tracks my baseline pitch and volume, and the Distress Risk Score hovers safely below 15."*
- **System State:**  
  - Pitch ($F_0$): ~110–140 Hz (steady)
  - RMS Energy: Normal conversational range
  - Voice Activity: Periodic normal pauses (<1.0s)
  - **Distress Risk Score:** `12 / 100` (Level: `NORMAL` — Green HUD)
  - **Alert Engine:** Inactive.

---

### SCENE 2: Single Isolated Signal Deviation (0:35 – 1:05)
- **Presenter Action:**  
  Demonstrate intentional vocal strain or sudden loud speech without true distress:  
  *"Now, suppose I get excited, laugh, or speak loudly: 'Look at that goal! That was incredible!'"*
- **System State:**  
  - Pitch ($F_0$): Spikes to 240+ Hz (Strain indicator turns Yellow)
  - RMS Energy: Spikes momentarily
  - Cadence: Normal conversational continuation
  - **Distress Risk Score:** Climbs to `38 / 100` (Level: `ELEVATED_ATTENTION` — Yellow HUD)
  - **Alert Engine:** **NO ALERT TRIGGERED.**
- **Presenter Commentary:**  
  *"Notice the score elevated slightly, but no emergency alert fired. Why? Because excitement or loud volume alone is not proof of danger. Sanket requires multi-signal confirmation."*

---

### SCENE 3: Prolonged Unnatural Silence / Freezing (1:05 – 1:35)
- **Presenter Action:**  
  After talking, suddenly stop speaking completely for 4–5 seconds while maintaining an active call/session context.
- **System State:**  
  - Voice Activity: False
  - Silence Duration Counter: Ticks up: `1.5s... 3.0s... 4.8s...`
  - Silence Anomaly Flag: Orange
  - **Distress Risk Score:** Gradually increases to `58 / 100` (Level: `SUSPECTED_DISTRESS` — Orange HUD)
  - **Alert Engine:** Inactive, armed in confirmation window.
- **Presenter Commentary:**  
  *"In coercive or threatening situations, victims often freeze or are forced to stay silent. The pause counter tracks this deviation from natural conversational rhythm, raising our suspicion index."*

---

### SCENE 4: Covert Code-Word Activation (1:35 – 2:05)
- **Presenter Action:**  
  Speak calmly, embedding the pre-configured secret trigger phrase into a natural sentence:  
  *"Yeah, everything's fine... just remember to feed the cat when you get home."*
- **System State:**  
  - Code-Word Detector: Trigger detected (`"feed the cat"` matched)
  - Confidence Score: `95%`
  - Contextual Signal Indicator: Bright Orange badge active
  - **Distress Risk Score:** Escalates sharply to `76 / 100`.
- **Presenter Commentary:**  
  *"Sanket allows users to configure a benign covert phrase. To an eavesdropper or aggressor, this sounds like normal everyday speech. To Sanket, it is a high-confidence contextual signal."*

---

### SCENE 5: Multi-Signal Critical Event & Silent Alert Dispatch (2:05 – 2:30)
- **Presenter Action:**  
  Combine strained, suppressed whisper/pitch elevation with hesitation:  
  *(Strained voice, trembling tone)* *"I... I need to go now... please..."*
- **System State:**  
  - Pitch Strain: Anomaly detected ($Z > 2.8$)
  - Energy Envelope: Drop with high zero-crossing rate (strained whisper)
  - Code phrase: Recurrent contextual flag
  - **Distress Risk Score:** Crosses threshold to `88 / 100` (Level: `HIGH_DISTRESS_RISK` — Pulsing Crimson HUD)
  - **Alert Engine:** **SILENT ALERT DISPATCHED!**
  - **UI Response:**
    - Silent Alert notification card slides into view
    - Displays mock emergency dispatch payload:
      - Lat/Long: `37.7749° N, 122.4194° W` (Simulated GPS)
      - Timestamp: Current ISO string
      - Primary Trigger Rationale: `[Pitch Anomaly + Whisper Strain + Contextual Code-Word]`
      - Target: `SMS dispatched silently to Primary Trusted Contact (+1-555-0199)`
- **Presenter Closing Summary:**  
  *"Sanket silently mobilized help without making a sound, without requiring the user to tap a button or unlock a screen, and without alarming anyone nearby. Thank you!"*

---

## Judge Q&A Defense Talking Points

| Expected Judge Question | Recommended Response |
| :--- | :--- |
| **"Could someone cough or yell and trigger an alert?"** | *"No. As shown in Scene 2, isolated pitch or volume spikes only elevate the score to the low-30s. Critical alert escalation strictly requires multi-signal temporal correlation over our sliding window."* |
| **"Are you recording and sending my voice to a server?"** | *"No. Sanket processes all audio frames locally in memory using the Web Audio API. Audio buffers are discarded immediately after analytical feature extraction. Zero audio leaves the client."* |
| **"Why browser instead of mobile?"** | *"The browser is our rapid hackathon prototype layer. The core detection engine is pure TypeScript and completely input-agnostic. In Phase 10, we detail our mobile background service architecture."* |
