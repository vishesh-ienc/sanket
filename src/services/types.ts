/**
 * Sanket Alert & Simulation Service Contracts
 */

import type { ContactChannel } from './trustedContacts';

export interface SilentAlertRecipient {
  contactId: string;
  name: string;
  channel: ContactChannel;
  /** Masked address — the full address never appears in a payload */
  maskedAddress: string;
}

/**
 * What a production build WOULD transmit to trusted contacts on a confirmed
 * incident. In this prototype it is built locally for the forensic audit and
 * is never sent anywhere (`transmitted` is always false).
 */
export interface SilentAlertPayload {
  alertId: string;
  incidentId: string;
  timestamp: string;
  riskScore: number;
  triggerRationale: string[];
  simulatedCoordinates: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
  };
  simulatedDispatchTarget: string;
  recipients: SilentAlertRecipient[];
  message: string;
  dispatchMode: 'SIMULATED_LOCAL';
  transmitted: false;
}
