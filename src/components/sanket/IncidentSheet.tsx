import { useState } from 'react';
import { Check, CheckCheck, KeyRound, Layers, Lock, Mail, MapPin, MessageSquare, Send, ShieldCheck, Timer, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DistressIncident } from '@/analysis/types';
import type { TrustedContact } from '@/services/trustedContacts';
import { buildSilentAlertPayload } from '@/services/dispatchPayload';
import { SignalBars } from './SignalBars';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface IncidentSheetProps {
  incident: DistressIncident | null;
  open: boolean;
  onClose: () => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  contacts: TrustedContact[];
}

const STATUS_CLASS: Record<DistressIncident['status'], string> = {
  ACTIVE: 'bg-risk-high/15 text-risk-high',
  ACKNOWLEDGED: 'bg-risk-elevated/15 text-risk-elevated',
  RESOLVED: 'bg-risk-normal/15 text-risk-normal',
};

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Timer; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function deviationText(incident: DistressIncident, signal: string): string | null {
  const d = incident.baselineDeviations;
  if (!incident.baselineAvailable || !d) return null;
  const v = d[signal as keyof typeof d];
  if (v === undefined) return null;
  return signal === 'silence' ? `${v.toFixed(1)}× your normal pause` : `${v.toFixed(1)}σ from your baseline`;
}

export function IncidentSheet({ incident, open, onClose, onAcknowledge, onResolve, contacts }: IncidentSheetProps) {
  const isMobile = useIsMobile();
  const [showJson, setShowJson] = useState(false);
  const payload = incident ? buildSilentAlertPayload(incident, contacts) : null;

  return (
    <Sheet open={open && incident !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={isMobile ? 'bottom' : 'right'} className="max-h-[92svh] w-full gap-0 overflow-y-auto sm:max-w-xl">
        {incident && payload && (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_CLASS[incident.status])}>
                  {incident.status.toLowerCase()}
                </span>
                {incident.source === 'SIMULATION' && <Badge variant="outline">Demo source</Badge>}
              </div>
              <SheetTitle className="text-lg">Silent alert evidence</SheetTitle>
              <SheetDescription>
                {new Date(incident.timestamp).toLocaleString()} · peak risk{' '}
                <span className="font-mono font-medium text-risk-high tabular">{incident.riskScore.toFixed(1)}</span>
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="evidence" className="px-4 pt-4 pb-6">
              <TabsList className="w-full">
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
                <TabsTrigger value="privacy">Privacy</TabsTrigger>
              </TabsList>

              <TabsContent value="evidence" className="mt-4 flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-2">
                  <Stat icon={Timer} label="Persistence" value={`${incident.persistenceFrames} frames`} hint="Sustained abnormal window" />
                  <Stat
                    icon={Layers}
                    label="Channels"
                    value={`${incident.confirmedSignals.filter((s) => s !== 'persistence').length} signals`}
                    hint="Co-occurring anomalies"
                  />
                  <Stat
                    icon={KeyRound}
                    label="Code word"
                    value={incident.codeWordDetected ? 'Detected' : 'Not detected'}
                    hint={incident.codeWordDetected ? 'Contextual corroboration' : 'Acoustic evidence only'}
                  />
                  <Stat
                    icon={ShieldCheck}
                    label="Baseline"
                    value={incident.baselineAvailable ? 'Personal' : 'Default'}
                    hint={incident.baselineAvailable ? 'Measured against you' : 'Generic references'}
                  />
                </div>

                <section>
                  <h3 className="mb-3 text-sm font-medium">Contributing signals</h3>
                  <SignalBars
                    signals={incident.contributingSignals.map((s) => {
                      const dev = deviationText(incident, s.signal);
                      return dev ? { ...s, reason: `${s.reason} · ${dev}` } : s;
                    })}
                  />
                </section>

                {incident.temporalContext && (
                  <section className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p className="font-medium">Temporal confirmation</p>
                    <p className="mt-1 text-muted-foreground">{incident.temporalContext.explanation}</p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground tabular">
                      sustained {incident.temporalContext.sustainedFrames} fr · correlation{' '}
                      {Math.round(incident.temporalContext.multiSignalCorrelation * 100)}%
                    </p>
                  </section>
                )}

                {incident.featureSnapshot && (
                  <section>
                    <h3 className="mb-2 text-sm font-medium">Acoustic snapshot</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs tabular sm:grid-cols-3">
                      <dt className="text-muted-foreground">Pitch</dt>
                      <dd>{incident.featureSnapshot.pitchHz ? `${incident.featureSnapshot.pitchHz.toFixed(0)} Hz` : 'unvoiced'}</dd>
                      <dt className="text-muted-foreground">RMS</dt>
                      <dd>{incident.featureSnapshot.rms.toFixed(3)}</dd>
                      <dt className="text-muted-foreground">Silence</dt>
                      <dd>{incident.featureSnapshot.silenceDurationSec.toFixed(1)} s</dd>
                      <dt className="text-muted-foreground">Centroid</dt>
                      <dd>
                        {incident.featureSnapshot.spectralCentroid ? `${Math.round(incident.featureSnapshot.spectralCentroid)} Hz` : '—'}
                      </dd>
                      <dt className="text-muted-foreground">ZCR</dt>
                      <dd>{incident.featureSnapshot.zeroCrossingRate.toFixed(3)}</dd>
                    </dl>
                  </section>
                )}
              </TabsContent>

              <TabsContent value="dispatch" className="mt-4 flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  What a production build would send. Built locally for this audit —{' '}
                  <strong className="text-foreground">never transmitted</strong>.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Send className="size-4 text-muted-foreground" />
                  {payload.recipients.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No trusted contacts yet — add them in Settings.</span>
                  ) : (
                    payload.recipients.map((r) => (
                      <span key={r.contactId} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
                        {r.channel === 'SMS' ? <MessageSquare className="size-3" /> : <Mail className="size-3" />}
                        {r.name}
                        <span className="font-mono text-muted-foreground">{r.maskedAddress}</span>
                      </span>
                    ))
                  )}
                  <Badge variant="secondary">Not sent · simulated</Badge>
                </div>
                <blockquote className="rounded-r-lg border-l-4 border-primary bg-primary/5 p-3 text-sm">{payload.message}</blockquote>
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  Placeholder location {payload.simulatedCoordinates.latitude.toFixed(4)},{' '}
                  {payload.simulatedCoordinates.longitude.toFixed(4)} — device location is never accessed.
                </p>
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowJson((v) => !v)}>
                  {showJson ? 'Hide raw payload' : 'Show raw payload (JSON)'}
                </Button>
                {showJson && (
                  <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                )}
              </TabsContent>

              <TabsContent value="privacy" className="mt-4 flex flex-col gap-3 text-sm">
                {[
                  { icon: Lock, t: 'No audio stored', d: 'Only derived scores, timestamps and feature summaries are kept on this device.' },
                  {
                    icon: Users,
                    t: 'No one was contacted',
                    d: 'Alerts are simulated. No SMS, email, police or emergency service is ever reached.',
                  },
                  { icon: KeyRound, t: 'No transcripts', d: 'Speech is matched against your code word and immediately discarded.' },
                  {
                    icon: ShieldCheck,
                    t: 'A risk estimate, not a diagnosis',
                    d: 'Sanket estimates distress risk from multiple signals; it cannot confirm danger.',
                  },
                ].map(({ icon: Icon, t, d }) => (
                  <div key={t} className="flex gap-3 rounded-lg border p-3">
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">{t}</p>
                      <p className="text-muted-foreground">{d}</p>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>

            {incident.status !== 'RESOLVED' && (
              <SheetFooter className="sticky bottom-0 flex-row gap-2 border-t bg-background">
                {incident.status === 'ACTIVE' && (
                  <Button variant="outline" className="flex-1" onClick={() => onAcknowledge(incident.id)}>
                    <Check /> Acknowledge
                  </Button>
                )}
                <Button className="flex-1" onClick={() => onResolve(incident.id)}>
                  <CheckCheck /> Mark resolved
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
