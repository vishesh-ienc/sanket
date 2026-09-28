import { useState, useMemo } from 'react';
import { ArrowRight, Radio, Sparkles, Trash2, ChevronDown } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { usePipelineContext } from '@/app/PipelineContext';
import { SIGNAL_META } from '@/app/signalMeta';
import { SIGNAL_IDS } from '@/analysis/signalSettings';
import { RiskGauge } from '@/components/sanket/RiskGauge';
import { Sparkline } from '@/components/sanket/Sparkline';
import { LevelBadge } from '@/components/sanket/LevelBadge';
import { ActivityFeed } from '@/components/sanket/ActivityFeed';
import { SourceCard } from '@/components/sanket/SourceCard';
import type { ActivityEvent } from '@/app/activity';
import type { ViewId } from '@/components/shell/nav';
import { cn } from '@/lib/utils';

const FEED_PAGE_SIZE = 15;

interface MonitorViewProps {
  onSelectEvent: (e: ActivityEvent) => void;
  onNavigate: (v: ViewId) => void;
}

function RiskCard() {
  const p = usePipelineContext();
  const ev = p.evaluation;
  const level = ev?.riskLevel ?? 'NORMAL';
  const channels = ev?.contributingSignals.filter((s) => s.contribution > 0 && s.signal !== 'persistence').length ?? 0;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b bg-muted/15 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Distress Risk</CardTitle>
            <CardDescription className="text-xs">Multi-signal acoustic and linguistic estimate</CardDescription>
          </div>
          {p.isActive ? (
            <LevelBadge level={level} />
          ) : (
            <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
              Standby
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 p-4 pt-5">
        <RiskGauge
          score={ev?.riskScore ?? 0}
          level={level}
          active={p.isActive}
          alertThreshold={p.signalSettings.alertThreshold}
          size={175}
        />
        <div className="grid w-full grid-cols-3 divide-x rounded-lg border bg-muted/20 text-center">
          <div className="p-2">
            <div className="font-mono text-base font-semibold tabular">{p.isActive ? channels : '—'}</div>
            <div className="text-[11px] text-muted-foreground">signals</div>
          </div>
          <div className="p-2">
            <div className="font-mono text-base font-semibold tabular">{p.isActive ? (ev?.persistenceFrames ?? 0) : '—'}</div>
            <div className="text-[11px] text-muted-foreground">frames held</div>
          </div>
          <div className="p-2">
            <div className="font-mono text-base font-semibold text-risk-high tabular">{p.signalSettings.alertThreshold}</div>
            <div className="text-[11px] text-muted-foreground">alert at</div>
          </div>
        </div>
        <div className="w-full rounded-lg border bg-muted/15 p-2.5">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Last 15s trajectory</span>
            <span className="text-risk-high">alert ({p.signalSettings.alertThreshold})</span>
          </div>
          <Sparkline
            values={p.scoreHistory.length > 1 ? p.scoreHistory : [0, 0]}
            threshold={p.signalSettings.alertThreshold}
            className={cn('h-14 w-full', !p.isActive && 'opacity-40')}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SignalStrip({ onCustomise }: { onCustomise: () => void }) {
  const p = usePipelineContext();
  const contributions = new Map((p.evaluation?.contributingSignals ?? []).map((c) => [c.signal, c.contribution]));
  const codeWord = contributions.get('codeWord') ?? 0;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle>Live Signals</CardTitle>
        <CardDescription>What the engine is hearing right now</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onCustomise}>
            Customise <ArrowRight />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 pt-0">
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {SIGNAL_IDS.map((id) => {
            const meta = SIGNAL_META[id];
            const setting = p.signalSettings.signals[id];
            const enabled = setting.enabled && setting.weight > 0;
            const contrib = contributions.get(id) ?? 0;
            const pct = enabled ? Math.min(100, (contrib / setting.weight) * 100) : 0;
            const hot = pct > 0;
            return (
              <li
                key={id}
                className={cn(
                  'flex flex-col justify-between rounded-lg border p-2.5 transition-colors',
                  hot && 'border-risk-suspicious/40 bg-risk-suspicious/6',
                  !enabled && 'opacity-50',
                )}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground truncate">
                    <meta.icon className="size-3.5 shrink-0" />
                    <span className="truncate">{meta.short}</span>
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground tabular shrink-0">{enabled ? `+${contrib.toFixed(0)}` : 'off'}</span>
                </div>
                <div className="my-1 font-mono text-sm font-semibold tabular">{p.isActive ? meta.read(p.features) : '—'}</div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-300', hot ? 'bg-risk-suspicious' : 'bg-primary/40')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <div
          className={cn(
            'flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors shrink-0',
            codeWord > 0 ? 'border-risk-suspicious/40 bg-risk-suspicious/8 text-foreground' : 'text-muted-foreground',
          )}
        >
          <span className="flex items-center gap-1.5">
            <SIGNAL_META.codeWord.icon className="size-3.5 shrink-0" />
            Code word {p.codeWord.config.enabled ? 'armed' : 'disarmed'}
          </span>
          <span className="font-mono tabular">{codeWord > 0 ? `+${codeWord.toFixed(0)} context` : 'not heard'}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function FeedCard({ onSelectEvent }: { onSelectEvent: (e: ActivityEvent) => void }) {
  const p = usePipelineContext();
  const [filter, setFilter] = useState<'all' | 'alerts'>('all');
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);

  const alertEvents = useMemo(
    () => p.events.filter((e) => ['incident', 'code-word', 'level-up', 'level-down'].includes(e.kind)),
    [p.events],
  );
  const sourceEvents = filter === 'alerts' ? alertEvents : p.events;
  const displayedEvents = sourceEvents.slice(0, visibleCount);
  const hasMore = sourceEvents.length > visibleCount;

  // Reset visible count when filter or events change drastically
  const handleFilterChange = (f: 'all' | 'alerts') => {
    setFilter(f);
    setVisibleCount(FEED_PAGE_SIZE);
  };

  return (
    <Card className="flex flex-col overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle>Live Activity</CardTitle>
            {p.events.length > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px] tabular">
                {p.events.length}
              </Badge>
            )}
          </div>
          {p.events.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear activity"
              title="Clear activity feed"
              onClick={() => { p.clearEvents(); setVisibleCount(FEED_PAGE_SIZE); }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">Events stream in as they trigger. Tap for details.</CardDescription>
      </CardHeader>

      {p.events.length > 0 && (
        <div className="flex items-center gap-1.5 border-b px-4 pb-2 pt-0.5 shrink-0">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              filter === 'all'
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            All ({p.events.length})
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('alerts')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              filter === 'alerts'
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            Alerts and Risk ({alertEvents.length})
          </button>
        </div>
      )}

      <CardContent className="flex min-h-0 flex-col overflow-hidden p-2">
        {p.events.length === 0 ? (
          <Empty className="flex-1 border-0 min-h-[200px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Radio />
              </EmptyMedia>
              <EmptyTitle>Nothing yet</EmptyTitle>
              <EmptyDescription>Play the demo call or start the microphone. Detections will stream in here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : displayedEvents.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-xs text-muted-foreground min-h-[120px]">
            No alert or risk level events recorded yet.
          </div>
        ) : (
          <div className="flex flex-col">
            <ScrollArea className="max-h-[320px] pr-1">
              <ActivityFeed events={displayedEvents} onSelect={onSelectEvent} />
            </ScrollArea>
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + FEED_PAGE_SIZE)}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <ChevronDown className="size-3.5" />
                Show {Math.min(FEED_PAGE_SIZE, sourceEvents.length - visibleCount)} more
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MonitorView({ onSelectEvent, onNavigate }: MonitorViewProps) {
  const p = usePipelineContext();
  return (
    <div className="flex flex-col gap-4">
      {!p.isActive && p.events.length === 0 && (
        <div className="flex flex-col gap-3 rounded-xl border bg-gradient-to-br from-primary/10 via-transparent to-transparent p-4 sm:flex-row sm:items-center">
          <Sparkles className="size-5 shrink-0 text-primary" />
          <p className="flex-1 text-sm">
            <span className="font-medium">New here?</span>{' '}
            <span className="text-muted-foreground">Play the built-in call to see the engine analyse a real scenario in real time.</span>
          </p>
          <Button variant="outline" size="sm" onClick={() => onNavigate('demo')}>
            Try Demo <ArrowRight />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        <div className="flex flex-col gap-4 lg:col-span-7 xl:col-span-8 min-w-0">
          <SourceCard />
          <SignalStrip onCustomise={() => onNavigate('signals')} />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4 min-w-0">
          <RiskCard />
          <FeedCard onSelectEvent={onSelectEvent} />
        </div>
      </div>
    </div>
  );
}
