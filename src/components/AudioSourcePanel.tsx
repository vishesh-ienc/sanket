/**
 * Sanket — Audio Source Panel
 *
 * Allows the judge/evaluator to switch between:
 *   (A) Live Microphone (getUserMedia)
 *   (B) Simulated Call Audio (pre-recorded file through same pipeline)
 *
 * This reinforces the product positioning:
 *   "Sanket is audio-source-agnostic — the same detection engine
 *    processes any normalized audio stream."
 */

import React, { useRef } from 'react';
import {
  Mic,
  FileAudio,
  Play,
  Pause,
  RotateCcw,
  Upload,
  Radio,
  Square,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { MonitoringState } from '../audio/types';
import type { FilePlaybackStatus } from '../audio/audioFileInput';

export type AudioSourceMode = 'MICROPHONE' | 'FILE';

interface AudioSourcePanelProps {
  activeSource: AudioSourceMode;
  onSelectSource: (source: AudioSourceMode) => void;

  // Microphone props
  monitoringState: MonitoringState;
  onStartMic: () => void;
  onStopMic: () => void;
  micError: { userMessage: string } | null;

  // File props
  fileStatus: FilePlaybackStatus;
  onLoadFile: (file: File) => void;
  onPlayFile: () => void;
  onPauseFile: () => void;
  onRestartFile: () => void;
}

export const AudioSourcePanel: React.FC<AudioSourcePanelProps> = ({
  activeSource,
  onSelectSource,
  monitoringState,
  onStartMic,
  onStopMic,
  micError,
  fileStatus,
  onLoadFile,
  onPlayFile,
  onPauseFile,
  onRestartFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMicLive = monitoringState === 'MONITORING_ACTIVE';
  const isMicRequesting = monitoringState === 'REQUESTING_PERMISSION';
  const isMicError =
    monitoringState === 'PERMISSION_DENIED' ||
    monitoringState === 'ERROR' ||
    monitoringState === 'NOT_SUPPORTED';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadFile(file);
      // Auto-switch source to FILE mode
      onSelectSource('FILE');
    }
    // Reset input so the same file can be re-loaded
    e.target.value = '';
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const fileProgress =
    fileStatus.durationSec && fileStatus.durationSec > 0
      ? (fileStatus.currentTimeSec / fileStatus.durationSec) * 100
      : 0;

  return (
    <div className="audio-source-panel" id="audio-source-panel">
      {/* Panel Header */}
      <div className="asp-header">
        <div className="asp-title-group">
          <div className="asp-icon-badge">
            <Radio size={14} />
          </div>
          <div>
            <h2 className="asp-title">AUDIO SOURCE</h2>
            <span className="asp-subtitle">Detection engine processes any audio stream identically</span>
          </div>
        </div>
        <div className="asp-source-badge">
          SOURCE-AGNOSTIC PIPELINE
        </div>
      </div>

      {/* Source Selector Tabs */}
      <div className="asp-tab-row">
        {/* Tab A: Microphone */}
        <button
          type="button"
          id="source-tab-microphone"
          className={`asp-tab ${activeSource === 'MICROPHONE' ? 'asp-tab-active' : ''}`}
          onClick={() => onSelectSource('MICROPHONE')}
        >
          <Mic size={15} />
          <span>Live Microphone</span>
          {isMicLive && <span className="asp-tab-live-dot" />}
        </button>

        {/* Tab B: Simulated Call Audio */}
        <button
          type="button"
          id="source-tab-file"
          className={`asp-tab ${activeSource === 'FILE' ? 'asp-tab-active' : ''}`}
          onClick={() => onSelectSource('FILE')}
        >
          <FileAudio size={15} />
          <span>Simulated Call Audio</span>
          {fileStatus.state === 'PLAYING' && <span className="asp-tab-live-dot asp-tab-file-dot" />}
        </button>
      </div>

      {/* Source-specific controls */}
      <div className="asp-control-area">
        {activeSource === 'MICROPHONE' ? (
          /* ── Microphone Controls ── */
          <div className="asp-mic-controls">
            <div className="asp-source-desc">
              <p>
                Direct browser microphone input via <code>getUserMedia</code> + Web Audio API.
                Audio is processed locally — zero cloud streaming.
              </p>
            </div>

            {micError && (
              <div className="asp-error-inline">
                <AlertCircle size={13} />
                <span>{micError.userMessage}</span>
              </div>
            )}

            <div className="asp-mic-action-row">
              {isMicLive ? (
                <button
                  type="button"
                  id="stop-mic-btn"
                  className="asp-btn asp-btn-stop"
                  onClick={onStopMic}
                >
                  <Square size={13} fill="currentColor" />
                  <span>HALT MONITORING</span>
                </button>
              ) : (
                <button
                  type="button"
                  id="start-mic-btn"
                  className="asp-btn asp-btn-start"
                  onClick={onStartMic}
                  disabled={isMicRequesting}
                >
                  {isMicRequesting ? (
                    <>
                      <Loader2 size={13} className="spin-animation" />
                      <span>INITIALIZING DSP...</span>
                    </>
                  ) : (
                    <>
                      <Radio size={13} />
                      <span>{isMicError ? 'RETRY AUDIO ACCESS' : 'START MONITORING'}</span>
                    </>
                  )}
                </button>
              )}

              <div className={`asp-mic-status ${isMicLive ? 'asp-status-live' : isMicError ? 'asp-status-error' : 'asp-status-idle'}`}>
                <span className="asp-status-dot" />
                <span>{isMicLive ? 'LIVE' : isMicRequesting ? 'REQUESTING...' : isMicError ? 'ERROR' : 'STANDBY'}</span>
              </div>
            </div>
          </div>
        ) : (
          /* ── File / Simulated Call Audio Controls ── */
          <div className="asp-file-controls">
            <div className="asp-source-desc">
              <p>
                Load a pre-recorded audio file (WAV / MP3 / OGG). The <strong>identical</strong> detection
                pipeline processes it — demonstrating source-agnostic operation.
              </p>
            </div>

            {/* File loader row */}
            <div className="asp-file-loader-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="audio-file-input"
              />
              <button
                type="button"
                id="load-audio-file-btn"
                className="asp-btn asp-btn-load"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={13} />
                <span>LOAD AUDIO FILE</span>
              </button>

              {fileStatus.fileName && (
                <span className="asp-file-name" title={fileStatus.fileName ?? ''}>
                  <FileAudio size={12} />
                  {fileStatus.fileName}
                </span>
              )}
            </div>

            {/* Playback controls — only visible when a file is loaded */}
            {(fileStatus.state === 'READY' ||
              fileStatus.state === 'PLAYING' ||
              fileStatus.state === 'PAUSED' ||
              fileStatus.state === 'ENDED') && (
              <div className="asp-playback-row">
                {/* Play / Pause */}
                {fileStatus.state === 'PLAYING' ? (
                  <button
                    type="button"
                    id="pause-file-btn"
                    className="asp-btn asp-btn-pause"
                    onClick={onPauseFile}
                  >
                    <Pause size={13} fill="currentColor" />
                    <span>PAUSE</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    id="play-file-btn"
                    className="asp-btn asp-btn-play"
                    onClick={onPlayFile}
                  >
                    <Play size={13} fill="currentColor" />
                    <span>{fileStatus.state === 'ENDED' ? 'REPLAY' : 'PLAY'}</span>
                  </button>
                )}

                {/* Restart */}
                <button
                  type="button"
                  id="restart-file-btn"
                  className="asp-btn asp-btn-ghost"
                  onClick={onRestartFile}
                  title="Restart from beginning"
                >
                  <RotateCcw size={13} />
                  <span>RESTART</span>
                </button>

                {/* Progress bar */}
                {fileStatus.durationSec && (
                  <div className="asp-progress-wrap">
                    <div className="asp-progress-bar">
                      <div
                        className="asp-progress-fill"
                        style={{ width: `${fileProgress}%` }}
                      />
                    </div>
                    <span className="asp-progress-time">
                      {formatTime(fileStatus.currentTimeSec)} / {formatTime(fileStatus.durationSec ?? 0)}
                    </span>
                  </div>
                )}

                {/* State badge */}
                <div className={`asp-mic-status ${fileStatus.state === 'PLAYING' ? 'asp-status-live asp-status-file-live' : 'asp-status-idle'}`}>
                  <span className="asp-status-dot" />
                  <span>
                    {fileStatus.state === 'PLAYING'
                      ? 'ANALYZING'
                      : fileStatus.state === 'ENDED'
                      ? 'COMPLETE'
                      : fileStatus.state.toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {fileStatus.state === 'LOADING' && (
              <div className="asp-loading-row">
                <Loader2 size={14} className="spin-animation" />
                <span>Decoding audio file...</span>
              </div>
            )}

            {fileStatus.state === 'ERROR' && (
              <div className="asp-error-inline">
                <AlertCircle size={13} />
                <span>{fileStatus.errorMessage}</span>
              </div>
            )}

            {/* Hint: no file loaded yet */}
            {fileStatus.state === 'IDLE' && (
              <div className="asp-file-hint">
                <CheckCircle2 size={13} />
                <span>
                  No file loaded. Click <strong>LOAD AUDIO FILE</strong> to select a WAV, MP3, or OGG file.
                  Any audio file will be processed by the same distress-risk detection pipeline.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
