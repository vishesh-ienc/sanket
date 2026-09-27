import { useId } from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
  values: number[];
  max?: number;
  threshold?: number;
  className?: string;
  color?: string;
}

/** Minimal area sparkline for the risk trend (0–100). */
export function Sparkline({ values, max = 100, threshold, className, color = 'var(--primary)' }: SparklineProps) {
  const id = useId();
  const w = 300;
  const h = 64;
  const n = Math.max(values.length, 2);
  const pts = values.map((v, i) => [(i / (n - 1)) * w, h - (Math.min(max, Math.max(0, v)) / max) * (h - 4) - 2] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1][0]},${h} L0,${h} Z` : '';
  const ty = threshold !== undefined ? h - (threshold / max) * (h - 4) - 2 : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-16 w-full', className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {ty !== null && (
        <line
          x1={0}
          x2={w}
          y1={ty}
          y2={ty}
          stroke="var(--risk-high)"
          strokeDasharray="4 4"
          strokeWidth={1}
          opacity={0.6}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {pts.length > 1 && (
        <>
          <path d={area} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
