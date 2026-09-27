import { RotateCcw, ShieldCheck, Waves } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { usePipelineContext } from '@/app/PipelineContext';
import { SIGNAL_META } from '@/app/signalMeta';
import {
  MAX_ALERT_THRESHOLD,
  MAX_CODE_WORD_BOOST,
  MAX_SIGNAL_WEIGHT,
  MIN_ALERT_THRESHOLD,
  SIGNAL_IDS,
  enabledSignalCount,
  singleSignalCeiling,
  type SignalId,
  type SignalSettings,
} from '@/analysis/signalSettings';
import { cn } from '@/lib/utils';

function SettingSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm tabular">
          {value}
          {unit}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function SignalsView() {
  const p = usePipelineContext();
  const s = p.signalSettings;
  const contributions = new Map((p.evaluation?.contributingSignals ?? []).map((c) => [c.signal, c.contribution]));

  const update = (fn: (draft: SignalSettings) => void) => {
    const next: SignalSettings = JSON.parse(JSON.stringify(s));
    fn(next);
    p.setSignalSettings(next);
  };
  const setSignal = (id: SignalId, patch: Partial<SignalSettings['signals'][SignalId]>) =>
    update((d) => Object.assign(d.signals[id], patch));

  const ceiling = singleSignalCeiling(s);
  const tc = p.temporalContext;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Detection profile</CardTitle>
          <CardDescription>Choose which signals count and how much. Changes apply instantly to the live engine.</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={p.resetSignalSettings}>
              <RotateCcw /> Reset
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Signals enabled</div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular">{enabledSignalCount(s)} / 6</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Alert threshold</div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular">{s.alertThreshold}</div>
          </div>
          <div className="rounded-lg border border-risk-normal/30 bg-risk-normal/6 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-risk-normal" /> Single-signal ceiling
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular">
              {ceiling} <span className="text-sm font-normal text-muted-foreground">&lt; {s.alertThreshold}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            However you tune it, one signal on its own can never raise an alert — weights are capped so the strongest single signal plus
            persistence stays below the alert threshold.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SIGNAL_IDS.map((id) => {
          const meta = SIGNAL_META[id];
          const cfg = s.signals[id];
          const contrib = contributions.get(id) ?? 0;
          const enabled = cfg.enabled && cfg.weight > 0;
          return (
            <Card key={id} size="sm" className={cn(!cfg.enabled && 'opacity-70')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
                    <meta.icon className="size-4" />
                  </span>
                  {meta.label}
                </CardTitle>
                <CardAction>
                  <Switch
                    checked={cfg.enabled}
                    onCheckedChange={(v) => setSignal(id, { enabled: v })}
                    aria-label={`Enable ${meta.label}`}
                  />
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-xs text-muted-foreground">{meta.description}</p>
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-2 text-xs">
                  <span className="text-muted-foreground">Now</span>
                  <span className="font-mono tabular">{p.isActive ? meta.read(p.features) : '—'}</span>
                  <span className={cn('font-mono tabular', contrib > 0 ? 'text-risk-suspicious' : 'text-muted-foreground')}>
                    {enabled ? `+${contrib.toFixed(1)} / ${cfg.weight}` : 'off'}
                  </span>
                </div>
                <SettingSlider
                  label="Weight"
                  value={cfg.weight}
                  min={0}
                  max={MAX_SIGNAL_WEIGHT}
                  unit=" pts"
                  hint={meta.reference}
                  onChange={(v) => setSignal(id, { weight: v })}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sensitivity</CardTitle>
            <CardDescription>Global tuning for how quickly Sanket escalates.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <SettingSlider
              label="Alert threshold"
              value={s.alertThreshold}
              min={MIN_ALERT_THRESHOLD}
              max={MAX_ALERT_THRESHOLD}
              hint="Score a sustained, confirmed event must reach before a silent alert. Lower = more sensitive."
              onChange={(v) => update((d) => (d.alertThreshold = v))}
            />
            <SettingSlider
              label="Pitch sensitivity"
              value={s.pitchDeviationThreshold}
              min={10}
              max={120}
              unit=" Hz"
              hint="How far above your normal pitch the voice must rise before pitch starts to count."
              onChange={(v) => update((d) => (d.pitchDeviationThreshold = v))}
            />
            <SettingSlider
              label="Code-word weight"
              value={s.codeWordBoost}
              min={0}
              max={MAX_CODE_WORD_BOOST}
              unit=" pts"
              hint="Context added for ~15 s after your covert phrase is heard. It corroborates — it cannot alert alone."
              onChange={(v) => update((d) => (d.codeWordBoost = v))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waves className="size-4 text-primary" /> False-positive filter
            </CardTitle>
            <CardDescription>Separates a cough or laugh from sustained distress.</CardDescription>
            <CardAction>
              {tc?.isMultiSignal ? (
                <Badge className="bg-risk-high/15 text-risk-high">Multi-signal</Badge>
              ) : tc?.isSustained ? (
                <Badge className="bg-risk-suspicious/15 text-risk-suspicious">Sustained</Badge>
              ) : tc?.isTransient ? (
                <Badge className="bg-info/15 text-info">Spike filtered</Badge>
              ) : (
                <Badge variant="outline">Stable</Badge>
              )}
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-2">
              {[
                ['Sustained', `${tc?.sustainedFrames ?? 0} frames`],
                ['Transient', `${tc?.transientFrames ?? 0} frames`],
                ['Cross-signal', `${Math.round((tc?.multiSignalCorrelation ?? 0) * 100)}%`],
                ['Pause regularity', tc?.breathingPattern ? `${Math.round(tc.breathingPattern.regularityScore * 100)}%` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold tabular">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">{p.isActive ? tc?.explanation : 'Start a source to see the filter at work.'}</p>
            <p className="text-xs text-muted-foreground">Pause regularity is a conversational-rhythm proxy, not a medical measurement.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
