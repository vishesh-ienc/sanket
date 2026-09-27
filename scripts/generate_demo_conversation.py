"""
Generate Sanket's built-in demo conversation (public/demo/conversation.wav + .json).

A two-person phone call voiced by Piper neural TTS (fully offline), in which
the monitored speaker ("Asha") goes from a calm chat to a strained, pressured
voice and slips the covert code phrase into an innocuous sentence.

Distress is rendered with signal processing on the TTS output, not acted:
  * pitch raised ~1.75x without changing duration (slow synthesis + resample)
  * raised vocal effort (gain into a soft saturator)
  * breath turbulence (high-passed noise)
  * a frozen pause before the code phrase

This is synthetic speech — not a real person and not a real incident.

Usage (from repo root):
    python -m venv .venv-tts && .venv-tts/bin/pip install piper-tts numpy
    .venv-tts/bin/python -m piper.download_voices --download-dir voices \
        en_US-amy-medium en_US-ryan-medium
    .venv-tts/bin/python scripts/generate_demo_conversation.py --voices voices

Replace the output with a real, consented recording at any time: keep the WAV
name and update the JSON cues/segments to match.
"""

import argparse
import json
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice, SynthesisConfig

OUT_RATE = 44100
CODE_PHRASE = "Remember to feed the cat"

# (speaker, text, style, pause_after_sec)
SCRIPT = [
    ("friend", "Hey Asha! Are you on your way back?", "calm", 0.35),
    ("user", "Hi! Yeah, I just left the office. The metro was packed today.", "calm", 0.35),
    ("friend", "Nice. Do you want me to order dinner for us?", "calm", 0.3),
    ("user", "That would be great. Maybe something light, I had a big lunch.", "calm", 0.5),
    ("friend", "Okay. I'll wait for you then.", "calm", 0.6),
    ("user", "Wait. Someone is walking right behind me. I think he followed me off the train.", "tense", 0.25),
    ("friend", "What? Are you okay? Where are you right now?", "calm", 0.3),
    ("user", "I'm fine. I'm fine. I'm just walking faster now. It's really dark on this street.", "distress", 1.6),
    ("friend", "Asha? Hello?", "calm", 0.2),
    ("user", f"Everything is fine. {CODE_PHRASE}, okay?", "distress", 0.25),
    ("friend", "The cat? Asha, what do you mean?", "calm", 0.2),
    ("user", "Just do it. Please. He is still right behind me and I can't stop walking. I can't talk right now.", "distress", 0.3),
    ("user", "Please, just do it now. I'm walking towards the main road.", "distress", 0.6),
    ("friend", "Okay. Okay, I understand. I'm on it.", "calm", 0.8),
]

STYLE = {
    # pitch_factor, drive, noise_mix
    "calm": (1.0, 1.0, 0.0),
    "tense": (1.35, 2.0, 0.08),
    "distress": (1.8, 5.0, 0.26),
}


def synth(voice: PiperVoice, text: str, length_scale: float) -> tuple[np.ndarray, int]:
    chunks = list(voice.synthesize(text, SynthesisConfig(length_scale=length_scale)))
    audio = np.concatenate([c.audio_float_array for c in chunks]).astype(np.float64)
    return audio, chunks[0].sample_rate


def resample(x: np.ndarray, src_rate: float, dst_rate: int) -> np.ndarray:
    n_out = int(round(len(x) * dst_rate / src_rate))
    t_out = np.arange(n_out) * (src_rate / dst_rate)
    return np.interp(t_out, np.arange(len(x)), x)


def render(voice: PiperVoice, text: str, style: str, rng: np.random.Generator) -> np.ndarray:
    pitch, drive, noise_mix = STYLE[style]
    # Synthesize slower by `pitch`, then play back faster by `pitch`:
    # duration is preserved and F0 rises by `pitch`.
    audio, rate = synth(voice, text, length_scale=pitch * (0.92 if style == "distress" else 1.0))
    y = resample(audio, rate * pitch, OUT_RATE)
    y /= max(1e-6, np.max(np.abs(y)))

    if noise_mix > 0:
        white = rng.uniform(-1, 1, len(y))
        breath = white - np.convolve(white, np.ones(4) / 4, mode="same")  # crude high-pass
        envelope = np.convolve(np.abs(y), np.ones(441) / 441, mode="same")
        envelope /= max(1e-6, envelope.max())
        y = (1 - noise_mix) * y + noise_mix * breath * np.clip(envelope * 3, 0, 1)

    base_level = 0.32 if style == "calm" else 0.55
    return 0.95 * np.tanh(drive * base_level * y) / np.tanh(drive * base_level)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voices", default="voices", help="directory with Piper .onnx voices")
    parser.add_argument("--out", default="public/demo", help="output directory")
    args = parser.parse_args()

    voices = {
        "user": PiperVoice.load(str(Path(args.voices) / "en_US-amy-medium.onnx")),
        "friend": PiperVoice.load(str(Path(args.voices) / "en_US-ryan-medium.onnx")),
    }
    rng = np.random.default_rng(7)

    parts: list[np.ndarray] = [np.zeros(int(0.4 * OUT_RATE))]
    cursor = 0.4
    cues = []
    segments = []
    for speaker, text, style, pause in SCRIPT:
        clip = render(voices[speaker], text, style, rng)
        if speaker == "friend":
            clip *= 0.55  # remote party is quieter on the monitored device
        cues.append({
            "atSec": round(cursor, 2),
            # A recognizer emits a final result once the sentence ends
            "finalSec": round(cursor + len(clip) / OUT_RATE, 2),
            "speaker": speaker,
            "text": text,
        })
        if speaker == "user":
            segments.append({"startSec": round(cursor, 2), "endSec": round(cursor + len(clip) / OUT_RATE, 2), "tone": style})
        parts.append(clip)
        cursor += len(clip) / OUT_RATE
        parts.append(np.zeros(int(pause * OUT_RATE)))
        cursor += pause

    audio = np.concatenate(parts)
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out / "conversation.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(OUT_RATE)
        w.writeframes(pcm.tobytes())

    duration = round(len(audio) / OUT_RATE, 2)
    first_tense = next(s["startSec"] for s in segments if s["tone"] != "calm")
    first_distress = next(s["startSec"] for s in segments if s["tone"] == "distress")
    meta = {
        "id": "walk-home-call",
        "title": "Walk-home phone call",
        "description": "Two friends on a call. The monitored speaker notices she is being followed; "
        "her voice tightens and she slips the covert code phrase into the conversation.",
        "audio": "demo/conversation.wav",
        "durationSec": duration,
        "codePhrase": CODE_PHRASE,
        "synthetic": True,
        "credits": "Synthetic speech generated offline with Piper TTS (voices: amy, ryan). Not a real person.",
        "timeline": [
            {"startSec": 0, "endSec": first_tense, "label": "Calm conversation", "expectation": "Risk stays NORMAL", "tone": "calm"},
            {"startSec": first_tense, "endSec": first_distress, "label": "Voice tightens", "expectation": "Signals begin to rise", "tone": "transition"},
            {"startSec": first_distress, "endSec": duration, "label": "Distress + code phrase", "expectation": "Multi-signal HIGH_RISK → silent alert", "tone": "distress"},
        ],
        "cues": cues,
    }
    (out / "conversation.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"wrote {out/'conversation.wav'} ({duration}s) and conversation.json")


if __name__ == "__main__":
    main()
