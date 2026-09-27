/**
 * Sanket — useLiveSpeech React Hook
 *
 * Runs BrowserSpeechTranscriptSource while live-mic monitoring is active and
 * feeds every transcript into the code-word detector. Holds only the latest
 * utterance in memory for an on-screen caption; nothing is persisted.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserSpeechTranscriptSource,
  checkSpeechSupport,
  installOnDeviceSpeech,
  type SpeechPrivacyMode,
  type SpeechSupport,
} from './speechTranscriptSource';
import type { TranscriptSourceStatus } from './transcriptTypes';

const PREF_KEY = 'sanket_live_speech_v1';

interface LiveSpeechPrefs {
  enabled: boolean;
  /** User explicitly accepted that cloud recognition sends audio to the browser vendor */
  cloudConsent: boolean;
}

function loadPrefs(): LiveSpeechPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<LiveSpeechPrefs>;
      return { enabled: p.enabled !== false, cloudConsent: p.cloudConsent === true };
    }
  } catch {
    /* storage unavailable */
  }
  return { enabled: true, cloudConsent: false };
}

function savePrefs(prefs: LiveSpeechPrefs): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable */
  }
}

export interface UseLiveSpeechOptions {
  lang?: string;
  /** Listen only while this is true (e.g. live microphone monitoring) */
  active: boolean;
  onTranscript: (text: string, isFinal: boolean, sourceId: string) => void;
}

export interface LiveSpeechState {
  support: SpeechSupport | null;
  /** Mode that will be used, or null if live speech can't run privately and no consent */
  mode: SpeechPrivacyMode | null;
  status: TranscriptSourceStatus;
  errorMessage: string | null;
  lastHeard: string | null;
  enabled: boolean;
  cloudConsent: boolean;
  installing: boolean;
  setEnabled: (enabled: boolean) => void;
  setCloudConsent: (consent: boolean) => void;
  installOnDevice: () => Promise<void>;
}

export function useLiveSpeech({ lang = 'en-US', active, onTranscript }: UseLiveSpeechOptions): LiveSpeechState {
  const [support, setSupport] = useState<SpeechSupport | null>(null);
  const [prefs, setPrefs] = useState<LiveSpeechPrefs>(loadPrefs);
  const [status, setStatus] = useState<TranscriptSourceStatus>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    let cancelled = false;
    void checkSpeechSupport(lang).then((s) => {
      if (!cancelled) setSupport(s);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const mode: SpeechPrivacyMode | null = !support?.apiAvailable
    ? null
    : support.onDevice === 'available'
      ? 'on-device'
      : prefs.cloudConsent
        ? 'cloud'
        : null;

  const shouldRun = active && prefs.enabled && mode !== null;

  useEffect(() => {
    if (!shouldRun || !mode) return;
    const source = new BrowserSpeechTranscriptSource({ lang, mode });
    const offStatus = source.onStatusChange((s) => {
      setStatus(s);
      setErrorMessage(source.getErrorMessage());
    });
    const offText = source.onTranscript((e) => {
      setLastHeard(e.text);
      onTranscriptRef.current(e.text, e.isFinal, e.sourceId ?? 'browser-speech');
    });
    source.start();
    return () => {
      offStatus();
      offText();
      source.stop();
      setStatus('IDLE');
      setLastHeard(null);
    };
  }, [shouldRun, mode, lang]);

  const setEnabled = useCallback((enabled: boolean) => {
    setPrefs((p) => {
      const next = { ...p, enabled };
      savePrefs(next);
      return next;
    });
  }, []);

  const setCloudConsent = useCallback((cloudConsent: boolean) => {
    setPrefs((p) => {
      const next = { ...p, cloudConsent };
      savePrefs(next);
      return next;
    });
  }, []);

  const installOnDevice = useCallback(async () => {
    setInstalling(true);
    const ok = await installOnDeviceSpeech(lang);
    setInstalling(false);
    setSupport(await checkSpeechSupport(lang));
    if (!ok) setErrorMessage('The on-device speech pack could not be installed in this browser.');
  }, [lang]);

  return {
    support,
    mode,
    status,
    errorMessage,
    lastHeard,
    enabled: prefs.enabled,
    cloudConsent: prefs.cloudConsent,
    installing,
    setEnabled,
    setCloudConsent,
    installOnDevice,
  };
}
