/**
 * Sanket Main Application Shell — Phase 1 Audio Foundation
 * Demonstrates real microphone input, live waveform oscilloscope, and basic activity metering.
 * Strictly decoupled from low-level Web Audio API via useAudioMonitor hook.
 */

import { Shield, Radio, Square, Info, Lock, Activity, AlertCircle, Loader2 } from 'lucide-react';
import { useAudioMonitor } from './audio/useAudioMonitor';
import { LiveWaveform } from './components/LiveWaveform';
import { AudioActivityMeter } from './components/AudioActivityMeter';

export function App() {
  const {
    monitoringState,
    activity,
    error,
    startMonitoring,
    stopMonitoring,
    audioService,
  } = useAudioMonitor({
    activeThresholdRms: 0.02,
  });

  const isLive = monitoringState === 'MONITORING_ACTIVE';
  const isRequesting = monitoringState === 'REQUESTING_PERMISSION';
  const isDenied = monitoringState === 'PERMISSION_DENIED';
  const isError = monitoringState === 'ERROR' || monitoringState === 'NOT_SUPPORTED';

  const getStatusDisplay = () => {
    switch (monitoringState) {
      case 'REQUESTING_PERMISSION':
        return {
          containerClass: 'status-badge-requesting status-requesting',
          label: 'REQUESTING MICROPHONE',
        };
      case 'MONITORING_ACTIVE':
        return {
          containerClass: 'status-badge-active status-active',
          label: 'MONITORING ACTIVE',
        };
      case 'PERMISSION_DENIED':
        return {
          containerClass: 'status-badge-denied status-denied',
          label: 'MICROPHONE ACCESS DENIED',
        };
      case 'NOT_SUPPORTED':
        return {
          containerClass: 'status-badge-error status-error',
          label: 'MICROPHONE NOT SUPPORTED',
        };
      case 'ERROR':
        return {
          containerClass: 'status-badge-error status-error',
          label: 'MICROPHONE ERROR',
        };
      case 'SYSTEM_READY':
      default:
        return {
          containerClass: 'status-badge-ready status-ready',
          label: 'SYSTEM READY',
        };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="app-container">
      {/* Top Protocol Badge */}
      <div className="top-pill">
        <span className="top-pill-dot" />
        <span>Phase 1 — Browser Microphone Audio Engine</span>
      </div>

      {/* Main Safety HUD Card */}
      <main className="hero-card">
        {/* Brand Icon */}
        <div className="brand-mark">
          <Shield size={32} strokeWidth={2.2} />
        </div>

        {/* Project Branding */}
        <h1 className="brand-title">SANKET</h1>
        <p className="brand-subtitle">Voice Distress-Risk Detection</p>

        {/* Dynamic System Status Indicator */}
        <div className={`status-badge-container ${status.containerClass}`}>
          <div className="status-beacon">
            <span className="status-beacon-ping" />
            <span className="status-beacon-core" />
          </div>
          <span className="status-label">Status:</span>
          <span className="status-value">{status.label}</span>
        </div>

        {/* Error / Permission Guidance Banner */}
        {error && (
          <div className="error-banner" role="alert">
            <div className="error-banner-header">
              <AlertCircle size={16} />
              <span>{isDenied ? 'Microphone Permission Required' : 'Audio Hardware Notice'}</span>
            </div>
            <p className="error-banner-body">{error.userMessage}</p>
          </div>
        )}

        {/* Real-time Oscilloscope Waveform */}
        <LiveWaveform
          audioService={audioService}
          isActive={isLive}
          height={110}
        />

        {/* Basic Audio Activity & RMS Level Meter */}
        <AudioActivityMeter
          activity={activity}
          isActive={isLive}
        />

        {/* Primary Action Button Controls */}
        <div className="cta-button-group">
          {isLive ? (
            <button
              type="button"
              className="cta-button cta-button-stop"
              id="stop-monitoring-btn"
              onClick={stopMonitoring}
            >
              <Square size={16} fill="currentColor" />
              <span>STOP MONITORING</span>
            </button>
          ) : isDenied || isError ? (
            <button
              type="button"
              className="cta-button cta-button-retry"
              id="retry-monitoring-btn"
              onClick={startMonitoring}
            >
              <Radio size={18} />
              <span>RETRY ACCESS</span>
            </button>
          ) : (
            <button
              type="button"
              className="cta-button cta-button-start"
              id="start-monitoring-btn"
              disabled={isRequesting}
              onClick={startMonitoring}
            >
              {isRequesting ? (
                <>
                  <Loader2 size={18} className="spin-animation" />
                  <span>INITIALIZING...</span>
                </>
              ) : (
                <>
                  <Radio size={18} />
                  <span>START MONITORING</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Prototype Scope & Input Declaration Section */}
        <section className="notice-box" aria-label="Prototype Scope">
          <div className="notice-header">
            <Info size={14} />
            <span>Operational Mode</span>
          </div>
          <p className="notice-text">
            <span className="notice-emphasis">Prototype mode — browser microphone input</span>
            <br />
            The browser microphone serves as the prototype audio-input layer. Real-time time-domain
            samples and RMS levels are captured locally via the Web Audio API. The underlying
            detection pipeline is decoupled and input-agnostic.
          </p>
        </section>
      </main>

      {/* Telemetry and Security Footer */}
      <footer className="footer-bar">
        <div className="footer-item">
          <Lock size={12} />
          <span>Local-First Processing</span>
        </div>
        <div className="footer-item">
          <Activity size={12} />
          <span>Real-time Web Audio DSP</span>
        </div>
        <div className="footer-item">
          <span>Phase 1: Active</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
