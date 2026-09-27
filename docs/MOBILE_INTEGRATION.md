# Sanket — Mobile Deployment Architecture & Integration Guide (Phase 10)

> **Status:** Design document. **Nothing in this file is implemented.** The hackathon prototype runs
> in a desktop/mobile browser only. This guide describes how the existing, tested detection engine
> would be carried onto native mobile platforms, and — just as importantly — what the platforms do
> **not** allow, so nobody over-promises in a pitch.
>
> Platform rules change between OS releases. Every platform constraint below must be re-verified
> against current Android/iOS documentation and store policies before implementation.

---

## 1. What Carries Over Unchanged

The prototype was built so the detection logic has **zero DOM / React / Web Audio dependencies**.
These modules are plain TypeScript and are exercised by 730 deterministic Node tests today:

| Module | Role | Mobile reuse |
| :--- | :--- | :--- |
| `analysis/featureFunctions.ts` | RMS, ZCR, spectral centroid, autocorrelation pitch, VAD | As-is |
| `analysis/featureExtractor.ts` | Stateful per-frame feature extraction | As-is |
| `analysis/baselineBuilder.ts`, `baselineDeviation.ts` | Welford baseline, Z-scores | As-is (persist profile in encrypted storage) |
| `analysis/temporalContext.ts` | Transient vs sustained, cross-signal correlation | As-is |
| `analysis/riskEngine.ts` | Multi-signal fusion, EMA, single-signal ceiling | As-is |
| `analysis/codeWordDetector.ts` + `transcriptTypes.ts` | Covert phrase spotting behind a `TranscriptSource` interface | As-is; new transcript adapter |
| `services/incidentManager.ts`, `silentAlertDispatcher.ts` | Latch, gating, incident records | As-is |
| `services/dispatchPayload.ts`, `trustedContacts.ts` | Alert payload + roster | Logic as-is; swap storage backend and add a real transport |

What does **not** carry over: the React hooks/components (`use*.ts`, `components/`), and the two
browser audio adapters (`audio/audioInput.ts`, `audio/audioFileInput.ts`). Those are replaced by a
native audio adapter that produces the same frame contract.

---

## 2. The One Contract a Native Adapter Must Honour

Everything downstream consumes `AudioFrame` (`src/audio/types.ts`) at ~10 Hz:

```typescript
interface AudioFrame {
  timestamp: number;            // monotonic ms
  sampleRate: number;           // Hz of the PCM below
  frameSize: number;            // 2048
  timeDomainData: Float32Array; // latest 2048 mono PCM samples in [-1, 1]
  frequencyData: Float32Array;  // 1024 bins, dBFS, AnalyserNode-equivalent
  rmsEnergy: number;
}
```

The browser gets `frequencyData` from Web Audio's `AnalyserNode` (Blackman window, magnitude / N,
`smoothingTimeConstant = 0.8`, 20·log10). A native adapter must reproduce that transform or the
spectral thresholds drift. This now exists as `src/audio/frameBuilder.ts` (`AudioFrameBuilder`,
`decodePcm16Wav`). It is used by the Node test suites that run the bundled demo call through the real
pipeline. Use the same code on every platform.

Sample-rate note: ZCR is a per-sample fraction, so thresholds assume ~44.1–48 kHz. If a mobile
adapter downsamples (e.g. to 16 kHz for battery), re-tune `zcr` and spectral thresholds, or
calibrate them through the personal baseline.

---

## 3. Recommended Runtime Shape

```
┌──────────────────────── Native layer (Kotlin / Swift) ────────────────────────┐
│  Mic capture (AudioRecord / AVAudioEngine)  →  ring buffer  →  10 Hz tick      │
│  Foreground service (Android) / background audio session (iOS)                 │
│  On-device speech recognizer → text events (optional, see §6)                  │
└───────────────┬───────────────────────────────────────────────┬───────────────┘
                │ PCM frames (2048 samples)                     │ transcript text
                ▼                                               ▼
┌──────────────────────── Shared TypeScript engine (Hermes / JSC) ──────────────┐
│ frameBuilder → FeatureExtractor → Baseline → TemporalContext → RiskEngine     │
│ → IncidentManager → dispatchPayload                                           │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ confirmed incident + payload
                ▼
       Native alert transport (§7)          React Native UI (dashboard, audit)
```

- **React Native** keeps one engine codebase; the analysis cost (one 2048-sample autocorrelation on
  voiced frames at 10 Hz) is modest for Hermes.
- Batch frames across the bridge (e.g. deliver the latest window per tick, not every audio
  callback) to keep bridge traffic flat.
- If profiling shows JS is too slow on low-end devices, port `featureFunctions.ts` first — it is
  the only hot path — and keep the rest in TypeScript.

---

## 4. Android

| Topic | Constraint / approach |
| :--- | :--- |
| Background capture | A **foreground service** with `foregroundServiceType="microphone"` and the matching foreground-service permission is required on recent Android versions, and it must be started while the app is visible. It shows a **persistent notification** — "silent" in Sanket means *no audible alarm*, not *invisible*. |
| Mic indicator | Android 12+ shows a privacy indicator while the mic is in use. Design the UX around it; do not try to hide it. |
| Phone-call audio | Third-party apps **cannot** capture the other party's audio on a cellular call (the `VOICE_CALL` source is restricted to privileged apps). Sanket can analyze the **user's own voice via the device mic** during a call, or audio from its **own** VoIP feature. |
| Mic sharing | Other apps (dialer, voice assistants) can take priority over the mic; handle silenced/interrupted capture and surface it as "monitoring paused", never as "safe". |
| Battery | Keep 10 Hz analysis; skip pitch on unvoiced frames (already done); consider a cheap energy-only duty cycle when the session is silent for long periods. |
| Store policy | Background microphone use gets extra Play review. The consent flow and a narrow, user-started "safety session" (not always-on) make that case much easier. |

---

## 5. iOS

| Topic | Constraint / approach |
| :--- | :--- |
| Background capture | The `audio` background mode plus an active recording `AVAudioSession` keeps capture alive while the app is backgrounded. The system shows the orange mic indicator. |
| Phone-call audio | Apps **cannot** access cellular or other apps' call audio. CallKit only integrates the app's **own** VoIP calls. Same conclusion as Android: analyze the user's own voice, or Sanket's own call channel. |
| Interruptions | Incoming calls, Siri and other audio sessions interrupt capture; observe interruption notifications and report "paused". |
| Silent alert | iOS apps **cannot send SMS without the user tapping send** (`MFMessageComposeViewController`). Truly silent delivery needs a network relay (§7). |

---

## 6. Code-Word Detection On-Device

In the browser, `BrowserSpeechTranscriptSource` already uses Chrome's on-device recognition
(`processLocally`) behind the `TranscriptSource` interface; the demo call feeds a scripted transcript
track through the same interface. Production options, all
**on-device** to keep the zero-cloud-audio promise:

- Android `SpeechRecognizer` on-device recognition (API 31+), or iOS `SFSpeechRecognizer` with
  `requiresOnDeviceRecognition = true`.
- Embedded open models (e.g. Vosk, whisper.cpp tiny) when platform recognizers are unavailable.
- Keyword-spotting mode where supported: only the configured phrase matters, so a small
  constrained grammar is cheaper and more private than open transcription.

Whatever the engine, keep the current invariant: transcripts are matched and **discarded
immediately**; only the detection event (never the text) enters history.

In the browser, cloud recognition (the Chromium default without `processLocally`) is used only after an
explicit user opt-in (DECISION 022).

---

## 7. Alert Delivery (Replacing `SIMULATED_LOCAL`)

`buildSilentAlertPayload()` already produces what would be sent: masked recipients, ordered
rationale, a non-diagnostic message, and a location placeholder. Production needs a transport:

| Option | Silent? | Notes |
| :--- | :--- | :--- |
| Direct SMS from device (Android `SmsManager`) | Yes (Android only) | Needs SMS permission; Play restricts it to default-SMS-handler-type apps. Not available on iOS. |
| Relay service (app → backend → SMS/push/email provider) | Yes, both platforms | Recommended. Only the **alert payload** leaves the device — never audio. Requires auth, rate limiting, delivery receipts, and an honest privacy policy update ("zero cloud *audio*", not "zero cloud"). |
| Share-sheet / compose UI | No | Useful as a manual fallback on the incident screen. |

Location: request it **at incident time only**, with explicit prior consent, and fall back to
"location unavailable" rather than a placeholder in production.

Keep the existing gates intact: confirmed `HIGH_RISK`, transient suppression, and the incident
latch (one alert per sustained event). Add a short, discreet **cancel window** (e.g. a
haptic prompt on a watch) before relay, since the engine produces risk estimates, not certainties.

---

## 8. Storage & Security

| Data | Prototype | Production |
| :--- | :--- | :--- |
| Baseline profile | `localStorage` | Encrypted storage (Android Keystore-backed / iOS Keychain + Data Protection) |
| Alert history (≤ 50, metadata only) | `localStorage` | Encrypted SQLite (e.g. SQLCipher) |
| Trusted contacts | `localStorage` | Encrypted storage; optional sync only to the relay's recipient list |
| Raw audio / transcripts | Never stored | Never stored |

---

## 9. Consent, Ethics & Positioning

- Monitoring starts only from an explicit, user-initiated **safety session**; show clear state
  at all times.
- The engine analyzes whatever the mic hears. Keep processing ephemeral and document that other
  voices may be picked up; check local consent/wiretap law for the target markets.
- Never describe output as detecting danger, lying, or medical state. Keep the existing
  "distress-**risk** estimate" wording and the non-diagnostic disclaimers in every alert.

---

## 10. Suggested Milestones

1. ~~Extract `frameBuilder.ts`~~ (done). Add parity tests (browser `AnalyserNode` vs `frameBuilder`)
   on recorded fixtures.
2. React Native shell running the engine against bundled sample audio (no mic) — proves the port.
3. Android foreground-service mic adapter + pause/interruption handling.
4. iOS background audio adapter.
5. On-device code-word adapter behind `TranscriptSource`.
6. Relay transport + consent flow + encrypted storage; retire `SIMULATED_LOCAL` only after
   field testing of false-positive rates.

## 11. Open Questions (Need Product Input)

- Is a backend relay acceptable, given the "local-first" pitch? (Recommended wording: *zero cloud
  audio*.)
- Target markets (drives consent law, SMS provider, emergency-number integration).
- Wearable confirmation step: in scope for v1 or later?
