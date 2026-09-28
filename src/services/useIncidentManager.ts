/**
 * Sanket, useIncidentManager React Hook (Phase 7)
 *
 * Connects the IncidentManager state machine with React lifecycle.
 * Manages active incident presentation, local alert history, and modal views.
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  RiskEvaluation,
  IncidentContext,
  DistressIncident,
  SilentAlertEvent,
} from '../analysis/types';
import { IncidentManager } from './incidentManager';
import {
  getIncidents,
  acknowledgeIncident as ackHistory,
  resolveIncident as resolveHistory,
  clearHistory as clearHistoryStorage,
} from './alertHistory';

/**
 * The analysis pipeline stamps frames with the monotonic `performance.now()`
 * clock (ideal for temporal math). Incidents are persisted and shown to humans,
 * so we convert to Unix epoch ms at this boundary.
 */
function toWallClock(timestamp: number): number {
  return timestamp < 1e12 ? Math.round(performance.timeOrigin + timestamp) : timestamp;
}

/** ~4 s at 10 Hz: an incident stays open through the natural dips of real speech */
const INCIDENT_RELEASE_FRAMES = 40;

export interface UseIncidentManagerOptions {
  context?: IncidentContext;
  isActive?: boolean;
}

export interface UseIncidentManagerReturn {
  currentIncident: DistressIncident | null;
  latestAlert: SilentAlertEvent | null;
  alertHistory: DistressIncident[];
  alertDispatched: boolean;
  isModalOpen: boolean;
  modalIncident: DistressIncident | null;
  acknowledgeIncident: (id?: string) => void;
  resolveIncident: (id?: string) => void;
  resetIncidentLatch: () => void;
  clearAlertHistory: () => void;
  openModal: (incident?: DistressIncident | null) => void;
  closeModal: () => void;
}

export function useIncidentManager(
  evaluation: RiskEvaluation | null,
  options: UseIncidentManagerOptions = {}
): UseIncidentManagerReturn {
  const { context, isActive = true } = options;
  const [manager] = useState(() => new IncidentManager({ releaseFrames: INCIDENT_RELEASE_FRAMES }));

  const [currentIncident, setCurrentIncident] = useState<DistressIncident | null>(null);
  const [latestAlert, setLatestAlert] = useState<SilentAlertEvent | null>(null);
  const [alertHistory, setAlertHistory] = useState<DistressIncident[]>(() => getIncidents());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalIncident, setModalIncident] = useState<DistressIncident | null>(null);

  // Process evaluation updates through the incident state machine
  useEffect(() => {
    if (!isActive) {
      if (manager.isLatched()) {
        manager.resetLatch();
        const timer = setTimeout(() => {
          setCurrentIncident(null);
          setAlertHistory(getIncidents());
        }, 0);
        return () => clearTimeout(timer);
      }
      return;
    }

    const result = manager.processEvaluation(
      evaluation && { ...evaluation, timestamp: toWallClock(evaluation.timestamp) },
      context
    );

    if (result.isNewIncident && result.incident) {
      const inc = result.incident;
      const alt = result.alert;
      const timer = setTimeout(() => {
        setCurrentIncident(inc);
        setLatestAlert(alt);
        setAlertHistory(getIncidents());
      }, 0);
      return () => clearTimeout(timer);
    } else if (result.incident !== currentIncident) {
      const inc = result.incident;
      const timer = setTimeout(() => {
        setCurrentIncident(inc);
        setAlertHistory(getIncidents());
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [evaluation, context, isActive, currentIncident, manager]);

  const acknowledgeIncident = useCallback((id?: string) => {
    manager.acknowledgeCurrentIncident();
    if (id) {
      ackHistory(id);
    }
    setCurrentIncident((prev) => (prev ? { ...prev, status: 'ACKNOWLEDGED' } : null));
    setAlertHistory(getIncidents());
  }, [manager]);

  const resolveIncident = useCallback((id?: string) => {
    manager.resolveCurrentIncident();
    if (id) {
      resolveHistory(id);
    }
    setCurrentIncident(null);
    setAlertHistory(getIncidents());
    if (modalIncident?.id === (id || currentIncident?.id)) {
      setModalIncident((prev) => (prev ? { ...prev, status: 'RESOLVED' } : null));
    }
  }, [currentIncident, modalIncident, manager]);

  const resetIncidentLatch = useCallback(() => {
    manager.resetLatch();
    setCurrentIncident(null);
    setAlertHistory(getIncidents());
  }, [manager]);

  const clearAlertHistory = useCallback(() => {
    clearHistoryStorage();
    setAlertHistory([]);
  }, []);

  const openModal = useCallback((incident?: DistressIncident | null) => {
    const target = incident || currentIncident;
    if (target) {
      setModalIncident(target);
      setIsModalOpen(true);
    }
  }, [currentIncident]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return {
    currentIncident,
    latestAlert,
    alertHistory,
    alertDispatched: currentIncident !== null && currentIncident.alertDispatched,
    isModalOpen,
    modalIncident,
    acknowledgeIncident,
    resolveIncident,
    resetIncidentLatch,
    clearAlertHistory,
    openModal,
    closeModal,
  };
}
