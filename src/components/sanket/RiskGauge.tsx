import type { RiskLevel } from '@/analysis/types';
import { LEVEL_LABEL } from '@/app/activity';
import { LEVEL_COLOR_VAR } from '@/app/signalMeta';
import { cn } from '@/lib/utils';

interface RiskGaugeProps {
  score: number;
  level: RiskLevel;
  active: boolean;
  alertThreshold?: number;
  size?: number;
  className?: string;
}

const START = 135; // degrees, 0 = 3 o'clock, clockwise
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

/** 270° radial gauge. Colour follows the risk level; a tick marks the alert threshold. */
export function RiskGauge({ score, level, active, alertThreshold = 70, size = 220, className }: RiskGaugeProps) {
  const r = 84;
  const c = 100;
  const clamped = Math.max(0, Math.min(100, score));
  const length = (Math.PI * 2 * r * SWEEP) / 360;
  const color = active ? LEVEL_COLOR_VAR[level] : 'var(--muted-foreground)';
  const threshold = polar(c, c, r, START + (SWEEP * alertThreshold) / 100);
  const thresholdInner = polar(c, c, r - 14, START + (SWEEP * alertThreshold) / 100);

  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      {active && (
        <div
          aria-hidden
          className="absolute inset-6 rounded-full blur-2xl animate-risk-pulse"
          style={{ background: `color-mix(in oklch, ${color} 28%, transparent)` }}
        />
      )}
      <svg
        viewBox="0 0 200 200"
        className="relative size-full -rotate-0"
        role="img"
        aria-label={`Risk score ${Math.round(clamped)} of 100, ${LEVEL_LABEL[level]}`}
      >
        <path d={arcPath(c, c, r, START, START + SWEEP)} fill="none" stroke="var(--muted)" strokeWidth={14} strokeLinecap="round" />
        <path
          d={arcPath(c, c, r, START, START + SWEEP)}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 300ms ease-out, stroke 400ms ease' }}
        />
        <line
          x1={thresholdInner.x}
          y1={thresholdInner.y}
          x2={threshold.x}
          y2={threshold.y}
          stroke="var(--risk-high)"
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.8}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-5xl font-semibold tracking-tight tabular" style={{ color: active ? color : undefined }}>
          {active ? Math.round(clamped) : '—'}
        </span>
        <span className="mt-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {active ? LEVEL_LABEL[level] : 'Standby'}
        </span>
      </div>
    </div>
  );
}
