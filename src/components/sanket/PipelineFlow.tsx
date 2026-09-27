import { AudioWaveform, BellRing, ChevronRight, Filter, Gauge, Radio, UserRound } from 'lucide-react';
import { usePipelineContext } from '@/app/PipelineContext';
import { cn } from '@/lib/utils';

/** Horizontal visual of the source-agnostic pipeline, lighting up live stages. */
export function PipelineFlow() {
  const p = usePipelineContext();
  const stages = [
    {
      icon: Radio,
      label: 'Any source',
      sub: p.isSimulating ? 'scenario' : p.sourceKind === 'mic' ? 'microphone' : p.sourceKind === 'conversation' ? 'demo call' : 'file',
      on: p.isActive,
    },
    { icon: AudioWaveform, label: 'Features', sub: 'pitch · energy · ZCR', on: p.isActive },
    {
      icon: UserRound,
      label: 'Baseline',
      sub: p.calibration.calibrationState.status === 'COMPLETE' ? 'personal' : 'default',
      on: p.isActive && p.calibration.calibrationState.status === 'COMPLETE',
    },
    {
      icon: Filter,
      label: 'Temporal filter',
      sub: p.temporalContext?.isTransient ? 'spike filtered' : 'spikes vs sustained',
      on: p.isActive,
    },
    { icon: Gauge, label: 'Risk fusion', sub: `${Math.round(p.evaluation?.riskScore ?? 0)} / 100`, on: p.isActive },
    {
      icon: BellRing,
      label: 'Silent alert',
      sub: p.incidents.currentIncident ? 'raised' : 'gated',
      on: Boolean(p.incidents.currentIncident),
      alert: true,
    },
  ];

  return (
    <section aria-label="Detection pipeline" className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Detection pipeline</h2>
        <span className="text-xs text-muted-foreground">100% on-device</span>
      </div>
      <ol className="flex items-stretch gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
        {stages.map((s, i) => (
          <li key={s.label} className="flex shrink-0 items-center gap-1">
            <div
              className={cn(
                'flex min-w-[8.5rem] items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                s.on && !s.alert && 'border-primary/40 bg-primary/8',
                s.on && s.alert && 'border-risk-high/40 bg-risk-high/10',
              )}
            >
              <s.icon className={cn('size-4 shrink-0', s.on ? (s.alert ? 'text-risk-high' : 'text-primary') : 'text-muted-foreground')} />
              <div className="leading-tight">
                <div className="text-xs font-medium">{s.label}</div>
                <div className="text-[11px] text-muted-foreground">{s.sub}</div>
              </div>
            </div>
            {i < stages.length - 1 && <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />}
          </li>
        ))}
      </ol>
    </section>
  );
}
