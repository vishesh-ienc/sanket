/**
 * Sanket Alert & Simulation Service Contracts
 */

export interface SilentAlertPayload {
  alertId: string;
  timestamp: string;
  riskScore: number;
  triggerRationale: string[];
  simulatedCoordinates: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
  };
  simulatedDispatchTarget: string;
}
