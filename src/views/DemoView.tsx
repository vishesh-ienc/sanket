import { ArrowLeft, ArrowRight, CheckCircle2, Flag, MessagesSquare, Play, Presentation, Square } from 'lucide-react';
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

function LiveReadout() {
  const p = usePipelineContext();
  const ev = p.evaluation;
  const tc = p.temporalContext;
  const latest = p.events[0];
  const filter = tc?.isMultiSignal ? 'Multi-signal' : tc?.isSustained ? 'Sustained' : tc?.isTransient ? 'Spike filtered' : 'Stable';
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[auto_auto_1fr] sm:items-center sm:gap-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-2xl font-semibold tabular">{Math.round(ev?.riskScore ?? 0)}</span>
        {ev && <LevelBadge level={ev.riskLevel} />}
      </div>
      <div className="text-xs">
        <div className="text-muted-foreground">Temporal filter</div>
        <div className="font-medium">{filter}</div>
      </div>
      <div className="col-span-2 min-w-0 text-xs sm:col-span-1">
        <div className="text-muted-foreground">Latest event</div>
        <div className="truncate font-medium">{latest ? latest.title : '—'}</div>
      </div>
    </div>
  );
}

function GuidedTour({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const { tour } = usePipelineContext();
  const { state, steps } = tour;

  if (!state.isActive || !state.step) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-5 bg-gradient-to-br from-primary/12 via-transparent to-transparent p-6 sm:flex-row sm:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Presentation className="size-6" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Guided tour · 6 steps · ~2 minutes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Baseline → normal voice → a cough that's filtered out → sustained multi-signal distress → silent alert → evidence. Runs on
              simulated signals, so no microphone is needed.
            </p>
          </div>
          <Button size="lg" onClick={tour.start}>
            <Play /> Start tour
          </Button>
        </CardContent>
      </Card>
    );
  }

  const step = state.step;
  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Step {state.stepIndex + 1} of {state.totalSteps}
        </CardDescription>
        <CardTitle className="text-lg">{step.title}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={tour.exit}>
            <Square /> Exit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ol className="grid grid-cols-6 gap-1.5" aria-label="Tour progress">
          {steps.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => tour.goTo(i)}
                aria-label={s.title}
                aria-current={i === state.stepIndex ? 'step' : undefined}
                className={cn(
                  'h-1.5 w-full rounded-full transition-colors',
                  i < state.stepIndex ? 'bg-primary' : i === state.stepIndex ? 'bg-primary/60' : 'bg-muted',
                )}
              />
            </li>
          ))}
        </ol>

        <p className="text-sm leading-relaxed">{step.narration}</p>
        <LiveReadout />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Why it matters</p>
            <p className="mt-1">{step.keyDifferentiator}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Watch for</p>
            <p className="mt-1">{step.expectedOutcome}</p>
          </div>
        </div>

        {tour.awaitingConfirmation && (
          <p className="flex items-center gap-2 rounded-lg border border-risk-elevated/40 bg-risk-elevated/10 p-3 text-sm">
            <Spinner className="text-risk-elevated" /> Waiting for sustained confirmation — the alert latches once risk holds above the
            threshold.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" onClick={tour.prev} disabled={state.isFirst}>
            <ArrowLeft /> Back
          </Button>
          <Button variant="ghost" onClick={() => onNavigate('monitor')}>
            Watch on Monitor
          </Button>
          {state.isLast ? (
            <Button onClick={tour.exit}>
              <Flag /> Finish
            </Button>
          ) : (
            <Button onClick={tour.next}>
              Next <ArrowRight />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ConversationLibrary({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const p = usePipelineContext();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Built-in conversations</CardTitle>
        <CardDescription>Pre-recorded calls bundled with the site, analysed exactly like a live stream.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {p.library.length === 0 && <p className="text-sm text-muted-foreground">{p.libraryError ?? 'Loading…'}</p>}
        {p.library.map((c) => (
          <div key={c.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <MessagesSquare className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {c.title}
                <Badge variant="outline">{Math.round(c.durationSec)} s</Badge>
                {c.synthetic && <Badge variant="secondary">Synthetic voices</Badge>}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Code phrase in this call: <span className="font-medium text-foreground">“{c.codePhrase}”</span>
              </p>
            </div>
            <Button
              onClick={async () => {
                await p.loadConversation(c);
                onNavigate('monitor');
              }}
              disabled={p.conversationLoading}
            >
              {p.conversationLoading ? <Spinner /> : <Play />} Play
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
        <CardTitle>Scenario simulator</CardTitle>
        <CardDescription>Synthetic signal patterns that drive the real engine — no audio needed.</CardDescription>
        <CardAction>
          {p.isSimulating && (
            <Button variant="outline" size="sm" onClick={p.stopSimulation}>
              <Square /> Stop
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {groups.map((g) => (
          <section key={g}>
            <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{g}</h3>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {SCENARIOS.filter((s) => s.group === g).map((s) => {
                const active = p.scenario === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => (active ? p.stopSimulation() : p.selectScenario(s.key))}
                    aria-pressed={active}
                    className={cn(
                      'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
                      active && 'border-primary bg-primary/8 ring-1 ring-primary/40',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{s.title}</span>
                      {active && <CheckCircle2 className="size-4 text-primary" />}
                    </span>
                    <span className="text-xs text-muted-foreground">{s.description}</span>
                    <span className={cn('text-xs font-medium', TONE_CLASS[s.tone])}>{s.expectation}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

export function DemoView({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <GuidedTour onNavigate={onNavigate} />
      <ConversationLibrary onNavigate={onNavigate} />
      <ScenarioSimulator />
    </div>
  );
}
