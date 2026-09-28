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

SCRIPT = [
    # 1. Calm conversation (opening stays strictly NORMAL, score < 20)
    ("friend", "Hey Asha! Are you on your way back?", "calm", 0.35),
    ("user", "Hi! Yeah, I just left the office. Taking the path through the park.", "calm", 0.35),
    ("friend", "Nice. Do you want me to order dinner for us?", "calm", 0.30),
    ("user", "That would be great. Maybe something light, I had a big lunch.", "calm", 0.35),
    ("friend", "Okay. I will wait for you then.", "calm", 0.45),

    # 2. Transition (walking a bit faster, slight breathing shifts)
    ("breath", 0.35, "inhale", 0.30),
    ("user", "Thanks. I am just walking a bit faster to beat the dark.", "tense", 0.35),
    ("friend", "All right. Take your time.", "calm", 0.35),

    # 3. Distress (outwardly normal call, but breathing heavier from walking fast, slips code phrase)
    ("breath", 0.45, "exhale", 0.40),
    ("user", f"Yeah. Oh, and hey... um... {CODE_PHRASE}, okay?", "distress", 0.25),
    ("friend", "Sure, will do!", "calm", 0.20),
    ("breath", 0.45, "inhale", 0.40),
    ("user", "Yeah... just hurrying home... almost there.", "distress", 0.30),
    ("breath", 0.50, "exhale", 0.35),
    ("friend", "Okay, see you soon!", "calm", 0.60),
]

def generate_breath(sample_rate: int, duration_sec: float, kind: str = "exhale", intensity: float = 0.35, rng=None) -> np.ndarray:
    if rng is None:
        rng = np.random.default_rng(42)
    n = int(sample_rate * duration_sec)
    noise = rng.standard_normal(n)
    sos = butter(3, [1200, 3600], btype="bandpass", fs=sample_rate, output="sos")
    filtered = sosfilt(sos, noise)
    t = np.linspace(0, 1, n)
    if kind == "inhale":
        env = (np.sin(np.pi * t * 0.5) ** 1.8) * np.exp(-0.15 * t)
    else:
        env = (np.sin(np.pi * t) ** 0.85) * np.exp(-1.1 * t)
    env /= max(1e-6, np.max(env))
    return (filtered * env * intensity).astype(np.float64)

async def synth_line(speaker: str, text: str, style: str, rng: np.random.Generator):
    voice = "en-US-AvaNeural" if speaker == "user" else "en-US-GuyNeural"
    # Ava stays 100% Ava: NO pitch_factor resampling, NO chipmunk effect, NO slow-mo rate!
    # Pitch boost via edge-tts neural vocoder:
    pitch_str = "+30Hz" if style == "distress" else "+10Hz" if style == "tense" else "+0Hz"
    rate_str = "+0%"
    comm = edge_tts.Communicate(text, voice, rate=rate_str, pitch=pitch_str)
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

    samples = samples / max(1e-6, np.max(np.abs(samples)))
    base_level = 0.48 if style == "distress" else 0.40 if style == "tense" else 0.36

    # In distress/tense: add gentle, natural telephone mic airflow / breathiness
    # (High frequencies 2.2k-6.5k Hz: sounds like breath on a phone mic, preserves Ava's voice completely)
    if speaker == "user" and style in ("tense", "distress"):
        b_noise = rng.standard_normal(len(samples))
        sos_b = butter(3, [2200, 6500], btype="bandpass", fs=OUT_RATE, output="sos")
        b_filt = sosfilt(sos_b, b_noise)
        b_filt /= max(1e-6, np.max(np.abs(b_filt)))
        mix = 0.09 if style == "distress" else 0.03
        samples = samples + mix * b_filt

    return 0.95 * np.tanh(1.0 * base_level * samples) / np.tanh(1.0 * base_level)

async def generate():
    rng = np.random.default_rng(7)
    parts = [np.zeros(int(0.4 * OUT_RATE))]
    cursor = 0.4
    cues = []
    segments = []

    for item in SCRIPT:
        if item[0] == "breath":
            _, dur, kind, intensity = item
            b_clip = generate_breath(OUT_RATE, dur, kind=kind, intensity=intensity, rng=rng)
            parts.append(b_clip)
            cursor += dur
            continue

        speaker, text, style, pause = item
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
        "title": "Walk-Home Phone Call",
        "description": "Two friends on a casual phone call. The dialogue sounds completely normal throughout, with no overt mention of danger. The monitored speaker is walking briskly and slips the pre-set code phrase into the conversation. Sanket's risk engine detects subtle respiratory shifts, vocal tension, and the covert code phrase to conclude high risk.",
        "audio": "demo/conversation.wav",
        "durationSec": duration,
        "codePhrase": CODE_PHRASE,
        "synthetic": True,
        "credits": "Synthetic speech generated offline with neural TTS (voices: Ava, Guy). Not a real person.",
        "timeline": [
            {"startSec": 0, "endSec": first_tense, "label": "Normal conversation", "expectation": "Risk stays NORMAL", "tone": "calm"},
            {"startSec": first_tense, "endSec": first_distress, "label": "Pace increases slightly", "expectation": "Engine detects subtle breathing shifts", "tone": "transition"},
            {"startSec": first_distress, "endSec": duration, "label": "Code phrase window", "expectation": "Multi-signal trigger and silent alert", "tone": "distress"},
        ],
        "cues": cues,
    }
    (out / "conversation.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"Generated clean normal conversation: {duration}s")

if __name__ == "__main__":
    asyncio.run(generate())
