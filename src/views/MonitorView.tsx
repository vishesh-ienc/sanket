import { useState, useMemo } from 'react';
import { ArrowRight, Radio, Sparkles, Trash2 } from 'lucide-react';
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
import { PipelineFlow } from '@/components/sanket/PipelineFlow';
import type { ActivityEvent } from '@/app/activity';
import type { ViewId } from '@/components/shell/nav';
import { cn } from '@/lib/utils';

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
    <Card>
      <CardHeader>
        <CardTitle>Distress risk</CardTitle>
        <CardDescription>Multi-signal estimate, updated 10× per second</CardDescription>
        <CardAction>{p.isActive && <LevelBadge level={level} />}</CardAction>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <RiskGauge score={ev?.riskScore ?? 0} level={level} active={p.isActive} alertThreshold={p.signalSettings.alertThreshold} />
        <div className="grid w-full grid-cols-3 divide-x rounded-lg border text-center">
          <div className="p-2">
            <div className="font-mono text-base font-semibold tabular">{p.isActive ? channels : '—'}</div>
            <div className="text-[11px] text-muted-foreground">signals</div>
          </div>
          <div className="p-2">
            <div className="font-mono text-base font-semibold tabular">{p.isActive ? (ev?.persistenceFrames ?? 0) : '—'}</div>
            <div className="text-[11px] text-muted-foreground">frames held</div>
          </div>
          <div className="p-2">
            <div className="font-mono text-base font-semibold tabular">{p.signalSettings.alertThreshold}</div>
            <div className="text-[11px] text-muted-foreground">alert at</div>
          </div>
        </div>
        {p.scoreHistory.length > 1 && (
          <div className="w-full">
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Last 15 s</span>
              <span className="text-risk-high">— alert threshold</span>
            </div>
            <Sparkline values={p.scoreHistory} threshold={p.signalSettings.alertThreshold} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SignalStrip({ onCustomise }: { onCustomise: () => void }) {
  const p = usePipelineContext();
  const contributions = new Map((p.evaluation?.contributingSignals ?? []).map((c) => [c.signal, c.contribution]));
  const codeWord = contributions.get('codeWord') ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live signals</CardTitle>
        <CardDescription>What the engine is hearing right now</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onCustomise}>
            Customise <ArrowRight />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                  'rounded-lg border p-3 transition-colors',
                  hot && 'border-risk-suspicious/40 bg-risk-suspicious/6',
                  !enabled && 'opacity-50',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <meta.icon className="size-3.5" />
                    {meta.short}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular">{enabled ? `+${contrib.toFixed(0)}` : 'off'}</span>
                </div>
                <div className="mt-1.5 font-mono text-sm font-semibold tabular">{p.isActive ? meta.read(p.features) : '—'}</div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
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
            'mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors',
            codeWord > 0 ? 'border-risk-suspicious/40 bg-risk-suspicious/8 text-foreground' : 'text-muted-foreground',
          )}
        >
          <span className="flex items-center gap-1.5">
            <SIGNAL_META.codeWord.icon className="size-3.5" />
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

  const alertEvents = useMemo(
    () => p.events.filter((e) => ['incident', 'code-word', 'level-up', 'level-down'].includes(e.kind)),
    [p.events]
  );
  const displayedEvents = filter === 'alerts' ? alertEvents : p.events;

  return (
    <Card className="flex h-[420px] max-h-[420px] flex-col overflow-hidden sm:h-[460px] sm:max-h-[460px]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle>Live activity</CardTitle>
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
              onClick={p.clearEvents}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">Things appear here as they trigger — tap for details</CardDescription>
      </CardHeader>

      {p.events.length > 0 && (
        <div className="flex items-center gap-1.5 border-b px-4 pb-2 pt-0.5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              filter === 'all'
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            All ({p.events.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('alerts')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              filter === 'alerts'
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            Alerts & Risk ({alertEvents.length})
          </button>
        </div>
      )}

      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        {p.events.length === 0 ? (
          <Empty className="flex-1 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Radio />
              </EmptyMedia>
              <EmptyTitle>Nothing yet</EmptyTitle>
              <EmptyDescription>Play the demo call or start the microphone — detections will stream in here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : displayedEvents.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-xs text-muted-foreground">
            No alert or risk level events recorded yet.
          </div>
        ) : (
          <ScrollArea className="h-full flex-1 pr-1">
            <ActivityFeed events={displayedEvents} onSelect={onSelectEvent} />
          </ScrollArea>
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
            <span className="text-muted-foreground">Play the built-in call below, or take the 6-step guided tour.</span>
          </p>
          <Button variant="outline" size="sm" onClick={() => onNavigate('demo')}>
            Guided tour <ArrowRight />
          </Button>
        </div>
      )}

      {/* Phone order: risk → source → activity → signals. Desktop: two columns. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr]">
        <div className="order-2 min-w-0 lg:order-none lg:col-start-1 lg:row-start-1">
          <SourceCard />
        </div>
        <div className="order-1 min-w-0 lg:order-none lg:col-start-2 lg:row-start-1">
          <RiskCard />
        </div>
        <div className="order-4 min-w-0 lg:order-none lg:col-start-1 lg:row-start-2">
          <SignalStrip onCustomise={() => onNavigate('signals')} />
        </div>
        <div className="order-3 min-w-0 lg:order-none lg:col-start-2 lg:row-start-2">
          <FeedCard onSelectEvent={onSelectEvent} />
        </div>
      </div>

      <PipelineFlow />
    </div>
  );
}
