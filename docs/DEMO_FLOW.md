# Sanket — Judge Demonstration Script & Presentation Flow

> **2–3 Minute Hackathon Demo Playbook (Phase 9 Edition)**  
> This document details the exact narrative, interactive tour controls, and system responses for demonstrating Sanket to hackathon judges.  
> **Important Disclaimer:** Make clear to judges that this is an engineering prototype demonstrating multi-signal acoustic risk estimation, not a scientifically or medically validated emergency diagnostic system.

---

## 1. Demo Overview

- **Target Duration:** 2 minutes 30 seconds
- **Objective:** Convincingly prove that Sanket detects potential distress risk without false alarms by correlating multiple voice anomalies relative to a personal voice baseline, filtering transient acoustic spikes, and dispatching simulated silent alerts.
- **Controls:** Interactive **Judge Demonstration Panel** located at the top of the Sanket Console, supporting step-by-step sequential evaluation or one-click live scenarios.

---

## 2. Interactive 6-Step Guided Demonstration Sequence

The **Judge Demonstration Panel** in the dashboard guides evaluators through 6 structured scenes with one-click transitions:

### STEP 1 — PERSONAL BASELINE CALIBRATION
- **Goal:** Demonstrate personal vocal calibration.
- **Presenter Narration:**  
  *"First, Sanket establishes the user's natural vocal baseline (pitch mean & variance, dynamic energy, conversational cadence). This ensures sensitivity without false alarms."*
- **Judge Highlight:**  
  *Static thresholds fail for naturally high-pitched or soft-spoken individuals. Sanket measures relative deviation ($Z$-scores) from personal norms.*
- **System Response:**  
  - Baseline profile active ($165\text{Hz } \mu, \pm 14.5\text{Hz } \sigma$).
  - Baseline step in visual pipeline glows active.
  - Personalized deviation monitoring initialized.

---

### STEP 2 — NORMAL CONVERSATIONAL SPEECH
- **Goal:** Show calm conversational reference state.
- **Presenter Narration:**  
  *"During normal conversation, voice features remain within standard deviation bounds. The Risk Engine maintains a low risk score."*
- **Judge Highlight:**  
  *Zero alarm fatigue. Natural conversational inflections, laughter variations, and pauses hover safely in the normal zone.*
- **System Response:**  
  - Risk Score: `8–15 / 100` (`NORMAL`, Green HUD).
  - Temporal Context: `STABLE`.
  - Alert Engine: Inactive.

---

### STEP 3 — TRANSIENT VOCAL SPIKE FILTERING
- **Goal:** Demonstrate false-positive reduction (Phase 8).
- **Presenter Narration:**  
  *"An isolated vocal spike (coughing, hearty laugh burst, or sudden throat-clearing) occurs. Phase 8 Temporal Context recognizes it as a TRANSIENT_SPIKE and suppresses alert dispatch."*
- **Judge Highlight:**  
  *Single-frame anomalies do not equal danger. Temporal stability requires multi-frame persistence before escalating risk.*
- **System Response:**  
  - Temporal Filter badge: `TRANSIENT SPIKE`.
  - IncidentManager gate: 0 incidents created, 0 alerts dispatched.
  - Explainability: *"Transient vocal spike — isolated burst, monitoring continues without escalation."*

---

### STEP 4 — SUSTAINED MULTI-SIGNAL DISTRESS
- **Goal:** Demonstrate multi-signal co-occurrence and temporal persistence.
- **Presenter Narration:**  
  *"Multiple acoustic channels (acute pitch strain, high acoustic energy, spectral distortion) deviate simultaneously and sustain across consecutive frames."*
- **Judge Highlight:**  
  *Multi-signal co-occurrence and temporal persistence eliminate single points of failure, confirming genuine distress evidence.*
- **System Response:**  
  - Temporal Context: `SUSTAINED & MULTI-SIGNAL`.
  - Risk Score climbs steadily past 70 into confirmed `HIGH_RISK`.
  - Risk Score Gauge pulses red with persistence confirmation.

---

### STEP 5 — SILENT EMERGENCY ALERT DISPATCH
- **Goal:** Show silent local dispatch without bystander danger.
- **Presenter Narration:**  
  *"Upon confirmed HIGH_RISK, IncidentManager latches and dispatches a silent alert locally. The prominent Incident Banner appears with zero audible sound."*
- **Judge Highlight:**  
  *Silent dispatch protects victims in coercion or domestic threat situations where audible sirens or popups endanger life.*
- **System Response:**  
  - Top `IncidentBanner` appears silently: displaying score, timestamp, confirmed signal count, and source.
  - Alert latch prevents duplicate alert spam while tracking live peak metrics in place.

---

### STEP 6 — FORENSIC INCIDENT AUDIT & PRIVACY
- **Goal:** Transparent, explainable auditability with zero raw audio retention.
- **Presenter Narration:**  
  *"Inspect the generated incident audit record. The forensic modal reveals contributing signals, baseline Z-scores, and confirms zero raw audio retention."*
- **Judge Highlight:**  
  *Provides complete explainability for emergency responders and legal review while maintaining zero audio recordings on device.*
- **System Response:**  
  - `ForensicEventModal` opens with full event breakdown:
    - Event ID (`inc-...`), timestamp, origin tag.
    - Contributing signals breakdown table with exact points added.
    - Baseline deviation $Z$-scores ($> 2.0\sigma$).
    - Temporal correlation statistics (sustained frames, channel co-occurrence).
    - Privacy Declaration: Zero raw audio or complete transcripts retained.

---

## 3. Judge Q&A Defense Talking Points

| Expected Judge Question | Recommended Response |
| :--- | :--- |
| **"Could someone cough, yell, or laugh and trigger an alert?"** | *"No. As shown in Step 3, Phase 8 Temporal Context Analyzer filters isolated 1–2 frame spikes as TRANSIENT_SPIKE. Alert dispatch strictly requires multi-frame sustained persistence and multi-signal corroboration."* |
| **"Are you recording or uploading my voice to an external cloud/AI server?"** | *"No. Sanket processes all audio frames locally in memory using the Web Audio API. Audio buffers are discarded immediately after analytical feature extraction. Zero audio or transcripts leave the client."* |
| **"Why is a personal baseline necessary?"** | *"Without a baseline, someone who naturally speaks with a higher pitch or softer volume would generate false alarms. Sanket calibrates mean and standard deviation to measure relative deviations (Z-scores) from their personal norm."* |
| **"Why is the alert silent instead of sounding an alarm?"** | *"In coercive, hostage, or domestic violence situations, an audible alarm or screen popup can immediately escalate danger from an aggressor. A silent local dispatch protects the user."* |
| **"How will this run on mobile devices?"** | *"The analytical engine is pure TypeScript with zero DOM dependencies. In mobile deployment, the Web Audio layer is swapped for native background audio services (Android AudioRecord / iOS AVAudioEngine) operating at low power."* |
