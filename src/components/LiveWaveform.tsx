/**
 * Sanket Live Waveform Oscilloscope Component
 * Renders real-time time-domain audio samples directly from Web Audio AnalyserNode.
 * Operates purely on requestAnimationFrame with ZERO React re-renders.
 */

import { useEffect, useRef } from 'react';
import { AudioInputService } from '../audio/audioInput';

interface LiveWaveformProps {
  audioService: AudioInputService | null;
  isActive: boolean;
  height?: number;
}

export function LiveWaveform({ audioService, isActive, height = 120 }: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle High-DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const h = height;
    const centerY = h / 2;

    // Buffer for time-domain samples
    const analyser = audioService?.getAnalyserNode();
    const bufferLength = analyser ? analyser.fftSize : 2048;
    const timeDomainData = new Float32Array(bufferLength);

    const render = () => {
      // Clear background
      ctx.fillStyle = 'rgba(10, 15, 26, 0.95)';
      ctx.fillRect(0, 0, width, h);

      // Draw subtle grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;

      // Center reference zero-axis
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Top and bottom boundary lines
      ctx.beginPath();
      ctx.moveTo(0, h * 0.25);
      ctx.lineTo(width, h * 0.25);
      ctx.moveTo(0, h * 0.75);
      ctx.lineTo(width, h * 0.75);
      ctx.stroke();

      if (isActive && audioService && audioService.getIsRunning()) {
        const currentAnalyser = audioService.getAnalyserNode();
        if (currentAnalyser) {
          currentAnalyser.getFloatTimeDomainData(timeDomainData);

          // Waveform path styling
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#38bdf8'; // Safety neon blue
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
          ctx.beginPath();

          const sliceWidth = width / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            // v is between -1.0 and 1.0
            const v = timeDomainData[i];
            const y = centerY + v * (h / 2) * 0.9;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }

            x += sliceWidth;
          }

          ctx.stroke();
          ctx.shadowBlur = 0; // reset
        }
      } else {
        // Dormant flat line when idle
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [audioService, isActive, height]);

  return (
    <div className="waveform-container">
      <div className="waveform-header">
        <span className="waveform-title">Live PCM Audio Oscilloscope</span>
        <span className="waveform-tag">{isActive ? 'LIVE STREAM' : 'STANDBY'}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="waveform-canvas"
        style={{ width: '100%', height: `${height}px` }}
      />
    </div>
  );
}
