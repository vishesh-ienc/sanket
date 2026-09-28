"""
Generate Sanket's built-in demo conversation (public/demo/conversation.wav + .json).

A realistic two-person phone call where the monitored speaker ("Asha") stays
outwardly casual while under duress:
  1. Calm everyday check-in between friends.
  2. Asha begins walking faster and breathing heavily.
  3. Under audible breathlessness and strained, elevated pitch, she covertly slips
     the pre-agreed code word into an innocent-sounding reminder ("Remember to feed the cat").
  4. The remote friend answers casually, while Sanket fuses the multi-signal acoustic distress
     (heavy breathing, vocal tension, pitch perturbation) + the covert code word to trigger
     the silent emergency alert.

Zero overt distress words (no "he is following me") — strictly covert distress.
"""

import asyncio
import json
import wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt
import edge_tts
import miniaudio

OUT_RATE = 44100
CODE_PHRASE = "Remember to feed the cat"

# (speaker, text, style, pause_after_sec)
SCRIPT = [
    # 1. Calm conversation
    ("friend", "Hey Asha! Are you on your way back?", "calm", 0.35),
    ("user", "Hi! Yeah, I just left the office. Taking the path through the park.", "calm", 0.35),
    ("friend", "Nice. Do you want me to order dinner for us?", "calm", 0.3),
    ("user", "That would be great. Maybe something light, I had a big lunch.", "calm", 0.35),
    ("friend", "Okay. I will wait for you then.", "calm", 0.45),

    # 2. Transition (walking faster, breathing starts getting heavier)
    ("user", "Thanks. I am just walking a bit faster to beat the dark.", "tense", 0.35),
    ("friend", "All right. Take your time.", "calm", 0.35),

    # 3. Distress (heavy breathing, strained pitch, slips code word)
    ("user", f"Yeah. Oh, and hey... um... {CODE_PHRASE}, okay?", "distress", 0.25),
    ("friend", "Sure, will do!", "calm", 0.2),
    ("user", "Yeah... just hurrying home... almost there.", "distress", 0.4),
    ("friend", "Okay, see you soon!", "calm", 0.6),
]


def generate_breath(sample_rate: int, duration_sec: float, kind: str = "exhale", intensity: float = 0.35, rng = None) -> np.ndarray:
    if rng is None:
        rng = np.random.default_rng(42)
    n = int(sample_rate * duration_sec)
    noise = rng.standard_normal(n)
    sos = butter(4, [600, 2400], btype="bandpass", fs=sample_rate, output="sos")
    filtered = sosfilt(sos, noise)
    t = np.linspace(0, 1, n)
    if kind == "inhale":
        env = (np.sin(np.pi * t * 0.5) ** 2.2) * np.exp(-0.3 * t)
    else:
        env = (np.sin(np.pi * t) ** 0.85) * np.exp(-1.4 * t)
    env /= max(1e-6, np.max(env))
    return (filtered * env * intensity).astype(np.float64)


def resample(x: np.ndarray, factor: float) -> np.ndarray:
    n_out = int(round(len(x) / factor))
    t_out = np.arange(n_out) * factor
    return np.interp(t_out, np.arange(len(x)), x)


async def synth_line(speaker: str, text: str, style: str, rng: np.random.Generator):
    voice = "en-US-AvaNeural" if speaker == "user" else "en-US-GuyNeural"
    rate_str = "-40%" if style == "distress" else "-20%" if style == "tense" else "+0%"
    comm = edge_tts.Communicate(text, voice, rate=rate_str)
    chunks = [c["data"] async for c in comm.stream() if c["type"] == "audio"]
    raw = b"".join(chunks)
    dec = miniaudio.decode(raw)
    samples = np.array(dec.samples, dtype=np.float64) / 32768.0
    if dec.nchannels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)
    if dec.sample_rate != OUT_RATE:
        n_out = int(round(len(samples) * OUT_RATE / dec.sample_rate))
        t_out = np.arange(n_out) * (dec.sample_rate / OUT_RATE)
        samples = np.interp(t_out, np.arange(len(samples)), samples)

    if style == "calm":
        samples = samples / max(1e-6, np.max(np.abs(samples)))
        base_level = 0.35
        drive = 1.0
        return 0.95 * np.tanh(drive * base_level * samples) / np.tanh(drive * base_level)

    pitch_factor = 1.75 if style == "distress" else 1.30
    y = resample(samples, pitch_factor)
    y /= max(1e-6, np.max(np.abs(y)))

    noise_mix = 0.28 if style == "distress" else 0.10
    drive = 4.8 if style == "distress" else 2.0
    base_level = 0.55 if style == "distress" else 0.40

    white = rng.uniform(-1, 1, len(y))
    breath = white - np.convolve(white, np.ones(4) / 4, mode="same")
    envelope = np.convolve(np.abs(y), np.ones(441) / 441, mode="same")
    envelope /= max(1e-6, envelope.max())
    y = (1 - noise_mix) * y + noise_mix * breath * np.clip(envelope * 3, 0, 1)

    return 0.95 * np.tanh(drive * base_level * y) / np.tanh(drive * base_level)


async def main():
    rng = np.random.default_rng(7)
    parts = [np.zeros(int(0.4 * OUT_RATE))]
    cursor = 0.4
    cues = []
    segments = []

    for idx, (speaker, text, style, pause) in enumerate(SCRIPT):
        if speaker == "user" and style in ("tense", "distress"):
            b_dur = 0.35 if style == "tense" else 0.45
            b_kind = "inhale" if idx % 2 == 0 else "exhale"
            breath = generate_breath(OUT_RATE, b_dur, kind=b_kind, intensity=0.35, rng=rng)
            parts.append(breath)
            cursor += b_dur

        clip = await synth_line(speaker, text, style, rng)
        if speaker == "friend":
            clip *= 0.55

        dur = len(clip) / OUT_RATE
        cues.append({
            "atSec": round(cursor, 2),
            "finalSec": round(cursor + dur, 2),
            "speaker": speaker,
            "text": text,
        })
        if speaker == "user":
            segments.append({
                "startSec": round(cursor, 2),
                "endSec": round(cursor + dur, 2),
                "tone": style,
            })
        parts.append(clip)
        cursor += dur

        parts.append(np.zeros(int(pause * OUT_RATE)))
        cursor += pause

    audio = np.concatenate(parts)
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    out = Path("public/demo")
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
        "description": "Two friends on a casual phone call. While keeping her conversation seemingly normal, the monitored speaker begins breathing heavily under duress and casually slips the covert code phrase into the call.",
        "audio": "demo/conversation.wav",
        "durationSec": duration,
        "codePhrase": CODE_PHRASE,
        "synthetic": True,
        "credits": "Synthetic speech generated offline with neural TTS (voices: Ava, Guy). Not a real person.",
        "timeline": [
            {"startSec": 0, "endSec": first_tense, "label": "Calm conversation", "expectation": "Risk stays NORMAL", "tone": "calm"},
            {"startSec": first_tense, "endSec": first_distress, "label": "Voice tightens", "expectation": "Signals begin to rise", "tone": "transition"},
            {"startSec": first_distress, "endSec": duration, "label": "Distress + code phrase", "expectation": "Multi-signal HIGH_RISK → silent alert", "tone": "distress"},
        ],
        "cues": cues,
    }
    (out / "conversation.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"Generated {out / 'conversation.wav'} ({duration}s) and {out / 'conversation.json'}")


if __name__ == "__main__":
    asyncio.run(main())
