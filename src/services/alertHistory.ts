/**
 * Sanket — Alert History Service (Phase 7)
 *
 * Maintains a local, bounded audit log of distress incidents and simulated alerts.
 *
 * Privacy Invariants:
 * - Stores ONLY derived incident metadata, timestamps, and statistical scores.
 * - NEVER stores raw audio, PCM samples, or complete audio recordings.
 * - Bounded to a maximum of 50 incidents to protect local storage capacity.
 * - Handles missing or malformed localStorage gracefully without throwing.
 */

import type { DistressIncident, IncidentStatus } from '../analysis/types';

export const ALERT_HISTORY_STORAGE_KEY = 'sanket_alert_history_v1';
export const MAX_ALERT_HISTORY_ITEMS = 50;

/**
 * Storage interface abstraction supporting window.localStorage or mock storage.
 */
interface SimpleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// In-memory cache
let inMemoryHistory: DistressIncident[] = [];
let isInitialized = false;
let customStorage: SimpleStorage | null | undefined = undefined;

/**
 * Resolves the active storage backend.
 * Falls back to in-memory if window or localStorage is unavailable.
 */
function getStorage(): SimpleStorage | null {
  if (customStorage !== undefined) {
    return customStorage;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      // Test read/write in case of security restriction in iframe / incognito
      const testKey = '__sanket_test_storage__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Overrides the storage backend (primarily used for unit testing).
 */
export function setStorageBackend(storage: SimpleStorage | null | undefined): void {
  customStorage = storage;
  isInitialized = false;
  inMemoryHistory = [];
}

/**
 * Validates that an item parsed from storage conforms to DistressIncident structure.
 */
function isValidIncident(item: unknown): item is DistressIncident {
  if (!item || typeof item !== 'object') return false;
  const inc = item as Partial<DistressIncident>;
  return (
    typeof inc.id === 'string' &&
    typeof inc.timestamp === 'number' &&
    typeof inc.riskScore === 'number' &&
    typeof inc.riskLevel === 'string' &&
    Array.isArray(inc.contributingSignals) &&
    typeof inc.status === 'string'
  );
}

/**
 * Loads incidents from storage into memory.
 */
function ensureInitialized(): void {
  if (isInitialized) return;
  isInitialized = true;

  const storage = getStorage();
  if (!storage) {
    inMemoryHistory = [];
    return;
  }

  try {
    const raw = storage.getItem(ALERT_HISTORY_STORAGE_KEY);
    if (!raw) {
      inMemoryHistory = [];
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Filter out corrupted entries and clamp to max capacity
      inMemoryHistory = parsed.filter(isValidIncident).slice(0, MAX_ALERT_HISTORY_ITEMS);
    } else {
      inMemoryHistory = [];
    }
  } catch {
    // Malformed JSON: fall back to empty array safely
    inMemoryHistory = [];
  }
}

/**
 * Persists in-memory history to the storage backend safely.
 */
function persist(): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const serialized = JSON.stringify(inMemoryHistory.slice(0, MAX_ALERT_HISTORY_ITEMS));
    storage.setItem(ALERT_HISTORY_STORAGE_KEY, serialized);
  } catch {
    // QuotaExceededError or private browsing restrictions
  }
}

/**
 * Retrieves all recorded incidents, sorted newest first.
 */
export function getIncidents(): DistressIncident[] {
  ensureInitialized();
  return [...inMemoryHistory];
}

/**
 * Retrieves an incident by its unique ID.
 */
export function getIncidentById(id: string): DistressIncident | undefined {
  ensureInitialized();
  return inMemoryHistory.find((inc) => inc.id === id);
}

/**
 * Records a new distress incident at the top of history.
 * Bounded to MAX_ALERT_HISTORY_ITEMS.
 */
export function addIncident(incident: DistressIncident): void {
  ensureInitialized();
  // Filter out any existing incident with the exact same ID (upsert)
  const existingIndex = inMemoryHistory.findIndex((inc) => inc.id === incident.id);
  if (existingIndex >= 0) {
    inMemoryHistory[existingIndex] = incident;
  } else {
    inMemoryHistory.unshift(incident);
  }

  if (inMemoryHistory.length > MAX_ALERT_HISTORY_ITEMS) {
    inMemoryHistory = inMemoryHistory.slice(0, MAX_ALERT_HISTORY_ITEMS);
  }

  persist();
}

/**
 * Updates the status of an existing incident.
 */
export function updateIncidentStatus(id: string, status: IncidentStatus): boolean {
  ensureInitialized();
  const index = inMemoryHistory.findIndex((inc) => inc.id === id);
  if (index === -1) return false;

  inMemoryHistory[index] = {
    ...inMemoryHistory[index],
    status,
  };
  persist();
  return true;
}

/**
 * Marks an incident as ACKNOWLEDGED.
 */
export function acknowledgeIncident(id: string): boolean {
  return updateIncidentStatus(id, 'ACKNOWLEDGED');
}

/**
 * Marks an incident as RESOLVED.
 */
export function resolveIncident(id: string): boolean {
  return updateIncidentStatus(id, 'RESOLVED');
}

/**
 * Clears all recorded alert history.
 */
export function clearHistory(): void {
  inMemoryHistory = [];
  isInitialized = true;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(ALERT_HISTORY_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
  }
}
