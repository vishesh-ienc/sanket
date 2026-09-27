/**
 * Sanket Covert Code-Word Configuration Component (Phase 5)
 *
 * Compact safety HUD panel allowing users to configure, arm/disarm,
 * and test covert distress phrases.
 *
 * Features:
 * - Custom phrase configuration with local React state
 * - Armed / Disarmed status toggle
 * - Visual detection telemetry indicator with contextual score impact (+25 pts)
 * - Quick evaluator transcript simulation buttons for live demonstrations
 * - Explicit local-matching privacy disclosure
 */

import { useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Send,
  Sparkles,
  Check,
  Lock,
} from 'lucide-react';
import type { CodeWordDetectorConfig, CodeWordDetection } from '../analysis/types';

interface CodeWordConfigProps {
  config: CodeWordDetectorConfig;
  latestDetection: CodeWordDetection | null;
  onUpdatePhrase: (phrase: string) => void;
  onToggleEnabled: () => void;
  onTestTranscript: (text: string) => void;
}

export function CodeWordConfig({
  config,
  latestDetection,
  onUpdatePhrase,
  onToggleEnabled,
  onTestTranscript,
}: CodeWordConfigProps) {
  const [inputPhrase, setInputPhrase] = useState(config.phrase);
  const [testText, setTestText] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSavePhrase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPhrase.trim()) return;
    onUpdatePhrase(inputPhrase.trim());
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleRunTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testText.trim()) return;
    onTestTranscript(testText.trim());
  };

  const handleQuickTest = (phrase: string) => {
    setTestText(phrase);
    onTestTranscript(phrase);
  };

  const isDetected = latestDetection?.detected === true;

  return (
    <div className="codeword-config-card" id="codeword-config-panel">
      {/* Panel Header */}
      <div className="codeword-header">
        <div className="codeword-title-group">
          <div className="codeword-icon-wrap">
            <KeyRound size={16} />
          </div>
          <div>
            <h2 className="codeword-title">Covert Code-Word Detection</h2>
            <span className="codeword-subtitle">Contextual distress phrase spotter</span>
          </div>
        </div>

        {/* Arm / Disarm Status Button */}
        <button
          type="button"
          className={`codeword-arm-btn ${config.enabled ? 'armed' : 'disarmed'}`}
          id="codeword-toggle-btn"
          onClick={onToggleEnabled}
          title={config.enabled ? 'Click to disable code-word detection' : 'Click to arm code-word detection'}
        >
          {config.enabled ? (
            <>
              <ShieldCheck size={14} />
              <span>CODE WORD ARMED</span>
            </>
          ) : (
            <>
              <ShieldAlert size={14} />
              <span>CODE WORD DISABLED</span>
            </>
          )}
        </button>
      </div>

      <div className="codeword-body-grid">
        {/* Left Column: Phrase Configuration */}
        <div className="codeword-config-col">
          <label htmlFor="codeword-phrase-input" className="codeword-label">
            Configured Trigger Phrase
          </label>
          <form onSubmit={handleSavePhrase} className="codeword-form">
            <input
              id="codeword-phrase-input"
              type="text"
              value={inputPhrase}
              onChange={(e) => setInputPhrase(e.target.value)}
              placeholder="e.g. Remember to feed the cat"
              className="codeword-input"
            />
            <button
              type="submit"
              className="codeword-save-btn"
              id="save-codeword-btn"
              disabled={!inputPhrase.trim() || inputPhrase.trim() === config.phrase}
            >
              {savedNotice ? (
                <>
                  <Check size={14} />
                  <span>SAVED</span>
                </>
              ) : (
                <span>SAVE</span>
              )}
            </button>
          </form>

          {/* Active Status Banner */}
          <div className="codeword-status-banner">
            <span className="status-label">Engine Status:</span>
            <span className={`status-pill ${config.enabled ? 'active' : 'idle'}`}>
              {config.enabled ? 'ARMED & MONITORING' : 'STANDBY'}
            </span>
            <span className="cooldown-tag">Debounce: {config.cooldownMs / 1000}s</span>
          </div>

          {/* Live Detection Alert Banner */}
          {latestDetection && (
            <div
              className={`codeword-detection-alert ${
                isDetected ? 'alert-detected' : 'alert-suppressed'
              }`}
              id="codeword-detection-alert"
            >
              <div className="alert-top">
                <Sparkles size={14} />
                <span className="alert-heading">
                  {isDetected ? 'CODE WORD DETECTED (+25 PTS)' : 'DETECTION EVENT'}
                </span>
                <span className="alert-time">
                  {new Date(latestDetection.timestamp).toLocaleTimeString([], {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
              <div className="alert-message">
                {latestDetection.reason || 'Contextual signal injected into RiskEngine'}
              </div>
              {latestDetection.matchedPhrase && (
                <div className="alert-matched-snippet">
                  Matched snippet: <em>"{latestDetection.matchedPhrase}"</em> (
                  {Math.round(latestDetection.confidence * 100)}% confidence)
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Evaluator Test Source */}
        <div className="codeword-test-col">
          <div className="test-header">
            <span className="test-badge">SIMULATED CODE-WORD INPUT</span>
            <span className="test-sub">Evaluator Manual Test Source</span>
          </div>

          <form onSubmit={handleRunTest} className="test-form">
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Type simulated utterance to test..."
              className="test-input"
            />
            <button
              type="submit"
              className="test-submit-btn"
              id="submit-test-transcript-btn"
              disabled={!testText.trim()}
            >
              <Send size={13} />
              <span>TEST</span>
            </button>
          </form>

          {/* Quick presets for evaluation */}
          <div className="quick-presets-row">
            <span className="presets-label">Quick Test:</span>
            <button
              type="button"
              className="preset-chip"
              onClick={() => handleQuickTest(`Yeah, I'll ${config.phrase} later tonight.`)}
            >
              Exact Trigger
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => handleQuickTest('The weather looks very clear today.')}
            >
              Unrelated
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => handleQuickTest(`Remember to feed the cats`)}
            >
              Fuzzy Plural
            </button>
          </div>

          {/* Privacy & Scope Callout */}
          <div className="codeword-privacy-notice">
            <div className="notice-icon">
              <Lock size={12} />
            </div>
            <p className="notice-text">
              <strong>Local Prototype Matching:</strong> Code-word matching is performed locally
              in the prototype. Browser microphone is the current input layer; speech-to-text source
              integration is environment-dependent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
