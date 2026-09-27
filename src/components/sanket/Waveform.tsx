import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WaveformProps {
  analyser: AnalyserNode | null;
  active: boolean;
  className?: string;
}

/**
 * Live oscilloscope drawn from the active source's AnalyserNode at display
 * refresh rate, with zero React re-renders. Colours come from theme tokens.
 */
export function Waveform({ analyser, active, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    const buffer = new Float32Array(analyser?.fftSize ?? 2048);

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const styles = getComputedStyle(canvas);
      const primary = styles.getPropertyValue('--primary').trim() || '#14b8a6';
      const muted = styles.getPropertyValue('--border').trim() || '#ccc';
      const mid = height / 2;

      ctx.strokeStyle = muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(width, mid);
      ctx.stroke();

      if (active && analyser) {
        analyser.getFloatTimeDomainData(buffer);
        ctx.strokeStyle = primary;
        ctx.lineWidth = 1.75;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const step = width / buffer.length;
        for (let i = 0; i < buffer.length; i++) {
          const y = mid + buffer[i] * mid * 0.95;
          if (i === 0) ctx.moveTo(0, y);
          else ctx.lineTo(i * step, y);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser, active]);

  return <canvas ref={canvasRef} className={cn('h-20 w-full', className)} aria-label="Live audio waveform" role="img" />;
}
