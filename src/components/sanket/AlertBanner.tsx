import { BellRing, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DistressIncident } from '@/analysis/types';

interface AlertBannerProps {
  incident: DistressIncident | null;
  /** Incident is still latched (risk still high) */
  live: boolean;
  recipients: number;
  onView: () => void;
  onAcknowledge: () => void;
}

/** Silent, visual-only alert shown on every view while an incident is active. */
export function AlertBanner({ incident, live, recipients, onView, onAcknowledge }: AlertBannerProps) {
  if (!incident) return null;
  const acknowledged = incident.status === 'ACKNOWLEDGED';
  const pulsing = live && !acknowledged;

  return (
    <div
      role="alert"
      className="animate-in fade-in slide-in-from-top-2 mx-4 mt-4 flex flex-col gap-3 rounded-xl border border-risk-high/30 bg-risk-high/8 p-4 sm:flex-row sm:items-center md:mx-6"
    >
      <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-risk-high/15 text-risk-high">
        {pulsing && <span className="absolute inset-0 animate-ping rounded-full bg-risk-high/20" />}
        <BellRing className="relative size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-risk-high">
          Silent alert raised · peak risk {incident.riskScore.toFixed(0)}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {live ? 'Sustained multi-signal pattern confirmed.' : 'Risk has since eased.'}{' '}
          {recipients > 0
            ? `Prepared for ${recipients} trusted contact${recipients === 1 ? '' : 's'} — simulated, nothing was sent.`
            : 'Simulated locally — nothing was sent.'}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onAcknowledge}>
          <Check /> {incident.status === 'ACTIVE' ? 'Acknowledge' : 'Dismiss'}
        </Button>
        <Button size="sm" className="bg-risk-high text-white hover:bg-risk-high/90" onClick={onView}>
          View evidence
        </Button>
      </div>
    </div>
  );
}
