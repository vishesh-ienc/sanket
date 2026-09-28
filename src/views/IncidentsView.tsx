import { BellRing, ChevronRight, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { usePipelineContext } from '@/app/PipelineContext';
import { SIGNAL_LABEL } from '@/app/activity';
import type { DistressIncident } from '@/analysis/types';
import type { ViewId } from '@/components/shell/nav';
import { cn } from '@/lib/utils';

const STATUS: Record<DistressIncident['status'], { label: string; cls: string }> = {
  ACTIVE: { label: 'Active', cls: 'bg-risk-high/15 text-risk-high' },
  ACKNOWLEDGED: { label: 'Acknowledged', cls: 'bg-risk-elevated/15 text-risk-elevated' },
  RESOLVED: { label: 'Resolved', cls: 'bg-risk-normal/15 text-risk-normal' },
};

export function IncidentsView({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const p = usePipelineContext();
  const history = p.incidents.alertHistory;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Silent alerts</CardTitle>
        <CardDescription>Stored only in this browser (max 50). Metadata only, never audio.</CardDescription>
        <CardAction>
          {history.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Trash2 /> Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear alert history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes all {history.length} stored incidents from this device. It cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={p.incidents.clearAlertHistory}>Clear history</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        {history.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShieldCheck />
              </EmptyMedia>
              <EmptyTitle>No alerts yet</EmptyTitle>
              <EmptyDescription>
                A silent alert appears here when several signals stay abnormal together. Try the demo call to see one.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => onNavigate('monitor')}>Go to Monitor</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((inc) => {
              const signals = inc.confirmedSignals.filter((s) => s !== 'persistence');
              return (
                <li key={inc.id}>
                  <button
                    type="button"
                    onClick={() => p.incidents.openModal(inc)}
                    className="group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-risk-high/12 font-mono text-sm font-semibold text-risk-high tabular">
                      {Math.round(inc.riskScore)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS[inc.status].cls)}>
                          {STATUS[inc.status].label}
                        </span>
                        {inc.source === 'SIMULATION' && <Badge variant="outline">Demo</Badge>}
                        {inc.codeWordDetected && (
                          <Badge variant="secondary">
                            <KeyRound /> Code word
                          </Badge>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {signals.map((s) => SIGNAL_LABEL[s] ?? s).join(' · ')}
                      </span>
                    </span>
                    <span className="hidden text-right text-xs text-muted-foreground sm:block">
                      <span className="block">
                        {new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="block">{new Date(inc.timestamp).toLocaleDateString()}</span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {history.length > 0 && (
        <p className="flex items-center gap-2 px-4 text-xs text-muted-foreground">
          <BellRing className="size-3.5" /> Alerts are simulated, nobody is contacted.
        </p>
      )}
    </Card>
  );
}
