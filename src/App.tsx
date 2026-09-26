import { useState } from 'react';
import { Activity, Shield, Radio, Info, Lock } from 'lucide-react';

export function App() {
  const [sessionState, setSessionState] = useState<'IDLE' | 'PREPARED'>('IDLE');

  const handleStartMonitoring = () => {
    setSessionState('PREPARED');
  };

  return (
    <div className="app-container">
      {/* Top Protocol Badge */}
      <div className="top-pill">
        <span className="top-pill-dot"></span>
        <span>Acoustic Risk Estimation Pipeline</span>
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

        {/* System Status Display */}
        <div className="status-badge-container">
          <div className="status-beacon">
            <span className="status-beacon-ping"></span>
            <span className="status-beacon-core"></span>
          </div>
          <span className="status-label">Status:</span>
          <span className="status-value">SYSTEM READY</span>
        </div>

        {/* Primary Action Button */}
        <div>
          <button
            type="button"
            className="cta-button"
            id="start-monitoring-btn"
            onClick={handleStartMonitoring}
          >
            <Radio size={18} />
            <span>START MONITORING</span>
          </button>
        </div>

        {sessionState === 'PREPARED' && (
          <p className="cta-button-notice" role="status">
            ✓ System primed. Web Audio capture pipeline scheduled for Phase 1.
          </p>
        )}

        {/* Prototype Scope & Input Declaration Section */}
        <section className="notice-box" aria-label="Prototype Scope">
          <div className="notice-header">
            <Info size={14} />
            <span>Operational Mode</span>
          </div>
          <p className="notice-text">
            <span className="notice-emphasis">Prototype mode — browser microphone input</span>
            <br />
            The browser microphone serves as the prototype audio-input layer. The underlying
            detection engine is strictly decoupled and designed to receive permitted mobile
            microphone, call, or VoIP audio in production deployment.
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
          <span>Decoupled DSP Engine</span>
        </div>
        <div className="footer-item">
          <span>Phase 0: Ready</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
