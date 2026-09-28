/**
 * Sanket, Built-in Demo Conversation Library
 *
 * Pre-recorded conversations bundled with the site (under /public/demo) that
 * drive the source-agnostic pipeline exactly like a live microphone would.
 * Each entry is an audio file plus a JSON manifest carrying a transcript track
 * (fed to the code-word detector as each utterance finishes) and a storyline.
 *
 * To add or replace a recording: drop `<id>.wav` + `<id>.json` into
 * public/demo/ following `DemoConversation`, and list the manifest below.
 */

export interface DemoConversationCue {
  /** Utterance start (captions) */
  atSec: number;
  /** Utterance end, when a recognizer would emit the final text */
  finalSec: number;
  speaker: 'user' | 'friend';
  text: string;
}

export interface DemoConversationSegment {
  startSec: number;
  endSec: number;
  label: string;
  expectation: string;
  tone: 'calm' | 'transition' | 'distress';
}

export interface DemoConversation {
  id: string;
  title: string;
  description: string;
  /** Path relative to the site root, e.g. "demo/conversation.wav" */
  audio: string;
  durationSec: number;
  /** Covert phrase spoken in the recording */
  codePhrase: string;
  synthetic: boolean;
  credits: string;
  timeline: DemoConversationSegment[];
  cues: DemoConversationCue[];
}

/** Manifests shipped with the site */
export const DEMO_CONVERSATION_MANIFESTS = ['demo/conversation.json'];

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export async function fetchDemoConversation(manifestPath: string): Promise<DemoConversation> {
  const res = await fetch(assetUrl(manifestPath));
  if (!res.ok) throw new Error(`Could not load demo manifest (${res.status})`);
  return (await res.json()) as DemoConversation;
}

export async function fetchDemoConversationAudio(conversation: DemoConversation): Promise<File> {
  const res = await fetch(assetUrl(conversation.audio));
  if (!res.ok) throw new Error(`Could not load demo audio (${res.status})`);
  const blob = await res.blob();
  const name = conversation.audio.split('/').pop() ?? `${conversation.id}.wav`;
  return new File([blob], name, { type: blob.type || 'audio/wav' });
}

/** Latest caption whose utterance has started at `timeSec` */
export function activeCue(conversation: DemoConversation, timeSec: number): DemoConversationCue | null {
  let current: DemoConversationCue | null = null;
  for (const cue of conversation.cues) {
    if (cue.atSec <= timeSec) current = cue;
    else break;
  }
  return current;
}
