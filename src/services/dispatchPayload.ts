/**
 * Sanket — Simulated Silent Alert Payload Builder
 *
 * Builds the message a production deployment WOULD send to trusted contacts
 * for a confirmed incident. Pure and deterministic; performs no I/O.
 *
 * Safety & privacy boundaries:
 * - Never transmits: the payload is marked `transmitted: false` and is only
 *   rendered in the local forensic audit.
 * - Never reads device location: coordinates are a fixed, labelled placeholder.
 * - Contact addresses are masked.
 * - Contains no audio, transcript, or configured code-word text.
 */

import type { DistressIncident } from '../analysis/types';
import type { SilentAlertPayload } from './types';
import { maskAddress, type TrustedContact } from './trustedContacts';

/** Fixed placeholder — the prototype never requests geolocation */
export const SIMULATED_COORDINATES = {
  latitude: 12.9716,
  longitude: 77.5946,
  accuracyMeters: 35,
} as const;

const SIGNAL_LABELS: Record<string, string> = {
  pitch: 'pitch deviation',
  rms: 'vocal intensity',
  silence: 'prolonged silence',
  voiceActivity: 'low voice activity',
  spectral: 'spectral strain',
  zcr: 'breath turbulence',
  persistence: 'sustained persistence',
  codeWord: 'covert code word',
};

export function describeSignal(signal: string): string {
  return SIGNAL_LABELS[signal] ?? signal;
}

export function buildSilentAlertPayload(
  incident: DistressIncident,
  contacts: TrustedContact[]
): SilentAlertPayload {
  const triggerRationale = incident.contributingSignals
    .filter((s) => s.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .map((s) => `${describeSignal(s.signal)} (+${s.contribution.toFixed(1)})`);

  const recipients = contacts.map((c) => ({
    contactId: c.id,
    name: c.name,
    channel: c.channel,
    maskedAddress: maskAddress(c.channel, c.address),
  }));

  const when = new Date(incident.timestamp);
  const message =
    `Sanket safety check: a possible distress pattern was detected at ` +
    `${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ` +
    `(risk ${Math.round(incident.riskScore)}/100). Please try to reach them discreetly. ` +
    `This is an automated risk estimate, not a confirmed emergency.`;

  return {
    alertId: `alt-${incident.id.replace(/^inc-/, '')}`,
    incidentId: incident.id,
    timestamp: when.toISOString(),
    riskScore: Math.round(incident.riskScore * 10) / 10,
    triggerRationale,
    simulatedCoordinates: { ...SIMULATED_COORDINATES },
    simulatedDispatchTarget:
      recipients.length === 0
        ? 'No trusted contacts configured'
        : `${recipients.length} trusted contact${recipients.length === 1 ? '' : 's'}`,
    recipients,
    message,
    dispatchMode: 'SIMULATED_LOCAL',
    transmitted: false,
  };
}
