/**
 * Sanket, Trusted Contacts & Simulated Dispatch Payload Tests
 *
 * Covers:
 *   1. Contact validation (names, phone, email, duplicates, capacity)
 *   2. Address masking
 *   3. Storage persistence & resilience (missing, malformed, throwing storage)
 *   4. Payload construction (recipients, rationale ordering, message)
 *   5. Safety & privacy invariants (never transmitted, no raw addresses,
 *      no audio / code-word text, placeholder coordinates)
 *
 * No browser, DOM, microphone, or network required.
 */

import {
  validateContact,
  maskAddress,
  loadContacts,
  saveContacts,
  createContact,
  MAX_TRUSTED_CONTACTS,
  TRUSTED_CONTACTS_STORAGE_KEY,
  type TrustedContact,
} from '../trustedContacts';
import { buildSilentAlertPayload, SIMULATED_COORDINATES } from '../dispatchPayload';
import type { DistressIncident } from '../../analysis/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string): void {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

function printSection(label: string): void {
  console.log(`\n─── ${label} ───`);
}

class MemoryStorage {
  public data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const throwingStorage = {
  getItem(): string | null {
    throw new Error('SecurityError');
  },
  setItem(): void {
    throw new Error('QuotaExceededError');
  },
};

function makeIncident(overrides: Partial<DistressIncident> = {}): DistressIncident {
  return {
    id: 'inc-1727438100000-00042',
    timestamp: 1727438100000,
    riskScore: 84.37,
    riskLevel: 'HIGH_RISK',
    contributingSignals: [
      { signal: 'rms', contribution: 15, reason: 'Vocal intensity deviation' },
      { signal: 'pitch', contribution: 20, reason: 'Pitch 410 Hz' },
      { signal: 'silence', contribution: 0, reason: 'none' },
      { signal: 'codeWord', contribution: 25, reason: 'Configured distress phrase detected' },
    ],
    confirmedSignals: ['rms', 'pitch', 'codeWord'],
    persistenceFrames: 12,
    baselineAvailable: false,
    codeWordDetected: true,
    status: 'ACTIVE',
    source: 'MICROPHONE',
    alertDispatched: true,
    ...overrides,
  };
}

function runTests(): void {
  printSection('1. Validation');
  assert(validateContact({ name: 'Priya', channel: 'SMS', address: '+91 98765 43210' }).ok, 'Accepts international phone');
  assert(validateContact({ name: 'Priya', channel: 'SMS', address: '(555) 123-4567' }).ok, 'Accepts formatted phone');
  assert(!validateContact({ name: 'Priya', channel: 'SMS', address: '12ab' }).ok, 'Rejects malformed phone');
  assert(validateContact({ name: 'Sam', channel: 'EMAIL', address: 'sam@example.com' }).ok, 'Accepts email');
  assert(!validateContact({ name: 'Sam', channel: 'EMAIL', address: 'sam@example' }).ok, 'Rejects email without TLD');
  assert(!validateContact({ name: '   ', channel: 'EMAIL', address: 'a@b.co' }).ok, 'Rejects blank name');
  assert(!validateContact({ name: 'x'.repeat(41), channel: 'EMAIL', address: 'a@b.co' }).ok, 'Rejects overlong name');

  const existing: TrustedContact[] = [createContact({ name: 'Priya', channel: 'SMS', address: '+91 98765 43210' })];
  assert(
    !validateContact({ name: 'Dup', channel: 'SMS', address: '+919876543210' }, existing).ok,
    'Rejects duplicate phone regardless of formatting'
  );
  assert(
    !validateContact({ name: 'Dup', channel: 'EMAIL', address: 'SAM@Example.com' }, [
      createContact({ name: 'Sam', channel: 'EMAIL', address: 'sam@example.com' }),
    ]).ok,
    'Rejects duplicate email case-insensitively'
  );
  const full = Array.from({ length: MAX_TRUSTED_CONTACTS }, (_, i) =>
    createContact({ name: `C${i}`, channel: 'EMAIL', address: `c${i}@example.com` })
  );
  const overCap = validateContact({ name: 'Extra', channel: 'EMAIL', address: 'x@example.com' }, full);
  assert(!overCap.ok, `Rejects contacts beyond capacity (${MAX_TRUSTED_CONTACTS})`);

  const a = createContact({ name: ' Priya ', channel: 'SMS', address: ' +91 98765 43210 ' });
  const b = createContact({ name: 'Priya', channel: 'SMS', address: '+91 98765 43210' });
  assert(a.name === 'Priya' && a.address === '+91 98765 43210', 'createContact trims fields');
  assert(a.id !== b.id, 'createContact generates unique IDs');

  printSection('2. Masking');
  assert(maskAddress('SMS', '+91 98765 43210') === '••••••••3210', 'Phone masked to last 4 digits');
  assert(maskAddress('EMAIL', 'priya@example.com') === 'p••••@example.com', 'Email local part masked');
  assert(maskAddress('EMAIL', 'a@x.io') === 'a•••@x.io', 'Short email still masked');
  assert(maskAddress('EMAIL', 'invalid') === '•••', 'Malformed email fully masked');

  printSection('3. Storage');
  const mem = new MemoryStorage();
  assert(loadContacts(mem).length === 0, 'Empty storage → empty list');
  assert(saveContacts(existing, mem), 'saveContacts succeeds');
  assert(mem.data.has(TRUSTED_CONTACTS_STORAGE_KEY), 'Stored under versioned key');
  const reloaded = loadContacts(mem);
  assert(reloaded.length === 1 && reloaded[0].name === 'Priya', 'Round-trips contacts');

  mem.setItem(TRUSTED_CONTACTS_STORAGE_KEY, '{not json');
  assert(loadContacts(mem).length === 0, 'Malformed JSON → empty list');
  mem.setItem(TRUSTED_CONTACTS_STORAGE_KEY, JSON.stringify({ a: 1 }));
  assert(loadContacts(mem).length === 0, 'Non-array JSON → empty list');
  mem.setItem(
    TRUSTED_CONTACTS_STORAGE_KEY,
    JSON.stringify([{ id: 'x', name: 'Ok', channel: 'SMS', address: '123' }, { id: 1 }, { channel: 'FAX' }])
  );
  assert(loadContacts(mem).length === 1, 'Invalid entries filtered out');
  mem.setItem(TRUSTED_CONTACTS_STORAGE_KEY, JSON.stringify(full.concat(full)));
  assert(loadContacts(mem).length === MAX_TRUSTED_CONTACTS, 'Loaded list clamped to capacity');

  assert(loadContacts(throwingStorage).length === 0, 'Throwing storage read → empty list');
  assert(saveContacts(existing, throwingStorage) === false, 'Throwing storage write → false, no throw');
  assert(loadContacts(null).length === 0 && saveContacts(existing, null) === false, 'Null storage handled');

  printSection('4. Payload');
  const contacts = [
    createContact({ name: 'Priya', channel: 'SMS', address: '+91 98765 43210' }),
    createContact({ name: 'Sam', channel: 'EMAIL', address: 'sam@example.com' }),
  ];
  const incident = makeIncident();
  const payload = buildSilentAlertPayload(incident, contacts);

  assert(payload.incidentId === incident.id, 'Payload references incident ID');
  assert(payload.alertId === 'alt-1727438100000-00042', 'Alert ID derived from incident ID');
  assert(payload.timestamp === new Date(incident.timestamp).toISOString(), 'Timestamp is ISO-8601');
  assert(payload.riskScore === 84.4, 'Risk score rounded to 1 decimal');
  assert(payload.recipients.length === 2, 'All contacts become recipients');
  assert(payload.simulatedDispatchTarget === '2 trusted contacts', 'Dispatch target summary pluralised');
  assert(payload.triggerRationale.length === 3, 'Zero-contribution signals excluded from rationale');
  assert(payload.triggerRationale[0].startsWith('covert code word'), 'Rationale ordered by contribution (largest first)');
  assert(payload.message.includes('not a confirmed emergency'), 'Message carries non-diagnostic disclaimer');
  assert(payload.message.includes('84/100'), 'Message includes rounded risk score');

  const empty = buildSilentAlertPayload(incident, []);
  assert(empty.recipients.length === 0, 'No contacts → no recipients');
  assert(empty.simulatedDispatchTarget === 'No trusted contacts configured', 'Empty roster described honestly');
  const single = buildSilentAlertPayload(incident, [contacts[0]]);
  assert(single.simulatedDispatchTarget === '1 trusted contact', 'Singular dispatch target');

  printSection('5. Safety & Privacy Invariants');
  const serialized = JSON.stringify(payload);
  assert(payload.transmitted === false, 'Payload is never marked transmitted');
  assert(payload.dispatchMode === 'SIMULATED_LOCAL', 'Dispatch mode is SIMULATED_LOCAL');
  assert(!serialized.includes('98765 43210') && !serialized.includes('9876543210'), 'Raw phone number absent');
  assert(!serialized.includes('sam@example.com'), 'Raw email absent');
  assert(!/feed the cat/i.test(serialized), 'Configured code-word text absent');
  assert(!/timeDomain|pcm|audio data/i.test(serialized), 'No audio data in payload');
  assert(
    payload.simulatedCoordinates.latitude === SIMULATED_COORDINATES.latitude &&
      payload.simulatedCoordinates.longitude === SIMULATED_COORDINATES.longitude,
    'Coordinates are the fixed placeholder, not device location'
  );
  const p2 = buildSilentAlertPayload(incident, contacts);
  assert(JSON.stringify(p2) === serialized, 'Payload construction is deterministic');

  console.log('\n════════════════════════════════════════');
  console.log('  Sanket Trusted Contacts & Dispatch Payload Tests');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runTests();
