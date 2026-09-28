import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Filter,
  KeyRound,
  Radio,
  UserCheck,
  Mic,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { TONE_CLASS, relativeTime, type ActivityEvent, type ActivityKind } from '@/app/activity';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  'level-up': ArrowUpRight,
  'level-down': ArrowDownRight,
  'transient-filtered': Filter,
  'code-word': KeyRound,
  incident: BellRing,
  'incident-resolved': CheckCircle2,
  source: Radio,
  calibration: UserCheck,
  speech: Mic,
};

function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

interface ActivityFeedProps {
  events: ActivityEvent[];
  onSelect: (event: ActivityEvent) => void;
  limit?: number;
  className?: string;
}

export function ActivityFeed({ events, onSelect, limit, className }: ActivityFeedProps) {
  const now = useNow();
  const shown = limit ? events.slice(0, limit) : events;

  return (
    <ol className={cn('flex flex-col', className)} aria-live="polite" aria-label="Live activity">
      {shown.map((e, i) => {
        const Icon = KIND_ICON[e.kind];
        return (
          <li key={e.id} className={cn(i === 0 && 'animate-in fade-in slide-in-from-top-1 duration-300')}>
            <button
              type="button"
              onClick={() => onSelect(e)}
              className={cn(
                'group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
                i === 0 && 'bg-muted/25'
              )}
            >
              <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-md', TONE_CLASS[e.tone])}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <span className="truncate">{e.title}</span>
                    {i === 0 && (
                      <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-semibold tracking-wider text-primary uppercase">
                        Latest
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular">{relativeTime(e.timestamp, now)}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{e.detail}</span>
              </span>
              <ChevronRight className="mt-1.5 size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
