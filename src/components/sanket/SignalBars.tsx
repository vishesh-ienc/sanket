import type { SignalContribution } from '@/analysis/types';
import { SIGNAL_META } from '@/app/signalMeta';
import { cn } from '@/lib/utils';

/** Ranked list of signal contributions with proportional bars (used in sheets). */
export function SignalBars({ signals, className }: { signals: SignalContribution[]; className?: string }) {
  const active = signals.filter((s) => s.contribution > 0).sort((a, b) => b.contribution - a.contribution);
  if (active.length === 0) {
    return <p className={cn('text-sm text-muted-foreground', className)}>No signals were contributing at this moment.</p>;
  }
  const max = Math.max(35, ...active.map((s) => s.contribution));
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {active.map((s) => {
        const meta = SIGNAL_META[s.signal as keyof typeof SIGNAL_META];
        const Icon = meta?.icon;
        return (
          <li key={s.signal} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 font-medium">
                {Icon && <Icon className="size-3.5 text-muted-foreground" />}
                {meta?.label ?? s.signal}
              </span>
              <span className="font-mono text-xs tabular text-muted-foreground">+{s.contribution.toFixed(1)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(s.contribution / max) * 100}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{s.reason}</p>
          </li>
        );
      })}
    </ul>
  );
}
