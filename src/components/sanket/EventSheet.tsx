import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { ActivityEvent } from '@/app/activity';
import { LevelBadge } from './LevelBadge';
import { SignalBars } from './SignalBars';
import { useIsMobile } from '@/hooks/use-mobile';

interface EventSheetProps {
  event: ActivityEvent | null;
  onOpenChange: (open: boolean) => void;
  onOpenIncident: (incidentId: string) => void;
}

export function EventSheet({ event, onOpenChange, onOpenIncident }: EventSheetProps) {
  const isMobile = useIsMobile();
  return (
    <Sheet open={event !== null} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? 'bottom' : 'right'} className="max-h-[85svh] w-full gap-0 overflow-y-auto sm:max-w-md">
        {event && (
          <>
            <SheetHeader>
              <SheetTitle>{event.title}</SheetTitle>
              <SheetDescription>{event.detail}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono tabular">{new Date(event.timestamp).toLocaleTimeString()}</span>
                {event.level && <LevelBadge level={event.level} />}
                {event.score !== undefined && <span className="font-mono tabular">score {event.score.toFixed(1)}</span>}
              </div>

              {event.temporal && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">Why no alert</p>
                  <p className="mt-1 text-muted-foreground">{event.temporal.explanation}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Transient</dt>
                      <dd className="font-mono tabular">{event.temporal.transientFrames} fr</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Sustained</dt>
                      <dd className="font-mono tabular">{event.temporal.sustainedFrames} fr</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Correlation</dt>
                      <dd className="font-mono tabular">{Math.round(event.temporal.multiSignalCorrelation * 100)}%</dd>
                    </div>
                  </dl>
                </div>
              )}

              {event.signals && (
                <section>
                  <h3 className="mb-3 text-sm font-medium">Contributing signals</h3>
                  <SignalBars signals={event.signals} />
                </section>
              )}

              {event.kind === 'code-word' && (
                <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Only the fact that your phrase matched is recorded — never the words that were spoken.
                </p>
              )}

              {event.incidentId && (
                <>
                  <Separator />
                  <Button onClick={() => onOpenIncident(event.incidentId!)}>Open full evidence</Button>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
