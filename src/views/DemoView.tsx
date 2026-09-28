import { CheckCircle2, MessagesSquare, Phone, Play, Square } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { usePipelineContext } from '@/app/PipelineContext';
import { SCENARIOS, type ScenarioInfo } from '@/app/scenarios';
import type { ViewId } from '@/components/shell/nav';
import { LevelBadge } from '@/components/sanket/LevelBadge';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<ScenarioInfo['tone'], string> = {
  calm: 'text-risk-normal',
  elevated: 'text-risk-elevated',
  filtered: 'text-info',
  high: 'text-risk-high',
};

const TONE_BG: Record<ScenarioInfo['tone'], string> = {
  calm: 'bg-risk-normal/10 border-risk-normal/20',
  elevated: 'bg-risk-elevated/10 border-risk-elevated/20',
  filtered: 'bg-info/10 border-info/20',
  high: 'bg-risk-high/10 border-risk-high/20',
};

const SIGNAL_DESCRIPTIONS: Record<string, { what: string; why: string }> = {
  NORMAL_SPEECH: {
    what: 'Baseline acoustic profile at rest',
    why: 'Establishes what "normal" looks like for the engine',
  },
  RECOVERY_NORMALIZING: {
    what: 'Post-episode signal decay curve',
    why: 'Shows how the score smoothly returns to baseline after stress',
  },
  PITCH_STRAIN_ONLY: {
    what: 'Single-channel pitch deviation only',
    why: 'Demonstrates the engine caps risk without multi-signal confirmation',
  },
  EXTENDED_SILENCE: {
    what: 'Sudden mid-call silence pattern',
    why: 'Prolonged silence is a weak signal, not an alert trigger alone',
  },
  WHISPER_STRAIN: {
    what: 'Low-energy breathy turbulence',
    why: 'Captures vocal suppression that loud-threshold detectors miss',
  },
  CODE_WORD_ONLY: {
    what: 'Covert phrase with calm prosody',
    why: 'Code word adds context points but never triggers alone',
  },
  TRANSIENT_PITCH_SPIKE: {
    what: 'Sub-200ms burst (cough, laugh)',
    why: 'Temporal filter absorbs short spikes preventing false alarms',
  },
  TRANSIENT_LOUD_EVENT: {
    what: 'Brief exclamation absorbed by filter',
    why: 'Shows sustained-signal requirement for alert escalation',
  },
  IRREGULAR_PAUSE_PATTERN: {
    what: 'Fragmented erratic pause cadence',
    why: 'Pause pattern is one of Sanket\'s unique non-pitch signals',
  },
  MULTI_SIGNAL_DISTRESS: {
    what: 'Pitch + intensity + strain + breathiness combined',
    why: 'Multi-signal corroboration is the primary alert trigger',
  },
  MULTI_SIGNAL_WITH_CODE_WORD: {
    what: 'Acoustic strain plus covert phrase',
    why: 'Code word amplifies existing risk, not an independent trigger',
  },
};

function ConversationLibrary({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const p = usePipelineContext();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="size-4 text-primary" />
          Live Call Analysis Demo
        </CardTitle>
        <CardDescription>
          Pre-recorded calls analysed by the real engine in real time. The system identifies risk through breath patterns, vocal strain, and code words without the caller ever mentioning danger.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {p.library.length === 0 && <p className="text-sm text-muted-foreground">{p.libraryError ?? 'Loading...'}</p>}
        {p.library.map((c) => (
          <div key={c.id} className="relative flex flex-col gap-4 rounded-xl border bg-gradient-to-br from-primary/5 via-transparent to-transparent p-5 sm:flex-row sm:items-center">
            <div className="absolute inset-0 rounded-xl opacity-0" />
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <MessagesSquare className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {c.title}
                <Badge variant="outline" className="font-mono text-[10px]">{Math.round(c.durationSec)}s</Badge>
                {c.synthetic && (
                  <Badge variant="secondary" className="text-[10px]">Synthetic voices</Badge>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                  <p className="font-medium text-muted-foreground uppercase tracking-wide">What to watch</p>
                  <p className="mt-0.5 text-foreground">Risk score + breathiness signal</p>
                </div>
                <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                  <p className="font-medium text-muted-foreground uppercase tracking-wide">Code phrase</p>
                  <p className="mt-0.5 font-mono text-foreground">"{c.codePhrase}"</p>
                </div>
                <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                  <p className="font-medium text-muted-foreground uppercase tracking-wide">Key signal</p>
                  <p className="mt-0.5 text-foreground">Multi-signal escalation</p>
                </div>
              </div>
            </div>
            <Button
              size="lg"
              onClick={async () => {
                await p.loadConversation(c);
                onNavigate('monitor');
              }}
              disabled={p.conversationLoading}
              className="shrink-0"
            >
              {p.conversationLoading ? <Spinner /> : <Play />} Play Call
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Add your own: drop a WAV + JSON manifest into <code className="rounded bg-muted px-1">public/demo/</code> (see docs).
        </p>
      </CardContent>
    </Card>
  );
}

function ScenarioSimulator() {
  const p = usePipelineContext();
  const groups = [...new Set(SCENARIOS.map((s) => s.group))];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signal Pattern Simulator</CardTitle>
        <CardDescription>
          Inject synthetic acoustic patterns directly into the live engine. Each scenario demonstrates what Sanket measures and why it matters for accurate distress detection.
        </CardDescription>
        <CardAction>
          {p.isSimulating && (
            <Button variant="outline" size="sm" onClick={p.stopSimulation}>
              <Square /> Stop
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g}>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{g}</h3>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {SCENARIOS.filter((s) => s.group === g).map((s) => {
                const active = p.scenario === s.key;
                const info = SIGNAL_DESCRIPTIONS[s.key];
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => (active ? p.stopSimulation() : p.selectScenario(s.key))}
                    aria-pressed={active}
                    className={cn(
                      'flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-all hover:shadow-sm',
                      active
                        ? 'border-primary bg-primary/8 ring-1 ring-primary/30 shadow-sm'
                        : 'hover:bg-muted/40',
                      TONE_BG[s.tone],
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-tight">{s.title}</span>
                      {active && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />}
                    </span>
                    {info && (
                      <span className="text-[11px] text-muted-foreground leading-relaxed">
                        <span className="block font-medium text-foreground/70">What it injects:</span>
                        {info.what}
                      </span>
                    )}
                    {info && (
                      <span className="text-[11px] text-muted-foreground leading-relaxed">
                        <span className="block font-medium text-foreground/70">Why it matters:</span>
                        {info.why}
                      </span>
                    )}
                    <span className={cn('text-[11px] font-semibold pt-0.5 border-t border-current/10', TONE_CLASS[s.tone])}>
                      Expected: {s.expectation}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {p.isSimulating && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/6 p-4 text-sm">
            <LevelBadge level={p.evaluation?.riskLevel ?? 'NORMAL'} />
            <span>
              <span className="font-semibold">Simulation active.</span>{' '}
              <span className="text-muted-foreground">Switch to Monitor tab to see all signals and the risk gauge in real time.</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DemoView({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <ConversationLibrary onNavigate={onNavigate} />
      <ScenarioSimulator />
    </div>
  );
}
