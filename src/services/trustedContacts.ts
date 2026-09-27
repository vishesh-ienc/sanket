/**
 * Sanket — Trusted Contacts Service
 *
 * Local roster of people who WOULD receive a silent alert in a production
 * deployment. In this prototype nothing is ever sent: contacts are used only
 * to build the simulated dispatch payload shown in the forensic audit.
 *
 * Privacy Invariants:
 * - Stored only in this browser's localStorage; never transmitted.
 * - Addresses are masked whenever they are displayed in alert payloads.
 * - Bounded to MAX_TRUSTED_CONTACTS entries.
 * - Malformed or unavailable storage degrades to an empty list without throwing.
 */

export type ContactChannel = 'SMS' | 'EMAIL';

export interface TrustedContact {
  id: string;
  name: string;
  channel: ContactChannel;
  /** Phone number (SMS) or email address (EMAIL) */
  address: string;
}

export interface TrustedContactInput {
  name: string;
  channel: ContactChannel;
  address: string;
}

export const TRUSTED_CONTACTS_STORAGE_KEY = 'sanket_trusted_contacts_v1';
export const MAX_TRUSTED_CONTACTS = 5;

interface SimpleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): SimpleStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

const PHONE_CHARS = /^\+?[0-9\s\-().]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ContactValidation = { ok: true } | { ok: false; error: string };

export function validateContact(
  input: TrustedContactInput,
  existing: TrustedContact[] = []
): ContactValidation {
  const name = input.name.trim();
  const address = input.address.trim();

  if (existing.length >= MAX_TRUSTED_CONTACTS) {
    return { ok: false, error: `Up to ${MAX_TRUSTED_CONTACTS} trusted contacts are supported.` };
  }
  if (name.length === 0) return { ok: false, error: 'Enter a name for this contact.' };
  if (name.length > 40) return { ok: false, error: 'Name must be 40 characters or fewer.' };

  const digitCount = address.replace(/[^0-9]/g, '').length;
  if (input.channel === 'SMS' && (!PHONE_CHARS.test(address) || digitCount < 7 || digitCount > 15)) {
    return { ok: false, error: 'Enter a valid phone number (digits, optional leading +).' };
  }
  if (input.channel === 'EMAIL' && !EMAIL_PATTERN.test(address)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const normalized = normalizeAddress(input.channel, address);
  if (existing.some((c) => c.channel === input.channel && normalizeAddress(c.channel, c.address) === normalized)) {
    return { ok: false, error: 'This contact is already on your list.' };
  }

  return { ok: true };
}

function normalizeAddress(channel: ContactChannel, address: string): string {
  return channel === 'SMS' ? address.replace(/[^0-9+]/g, '') : address.trim().toLowerCase();
}

/**
 * Masks an address for display in alert payloads:
 *   +91 98765 43210  →  •••••••3210
 *   priya@example.com → p••••@example.com
 */
export function maskAddress(channel: ContactChannel, address: string): string {
  if (channel === 'SMS') {
    const digits = address.replace(/[^0-9]/g, '');
    return `${'•'.repeat(Math.max(3, digits.length - 4))}${digits.slice(-4)}`;
  }
  const [user, domain] = address.split('@');
  if (!domain) return '•••';
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(3, user.length - 1))}@${domain}`;
}

function isValidStoredContact(item: unknown): item is TrustedContact {
  if (!item || typeof item !== 'object') return false;
  const c = item as Partial<TrustedContact>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    (c.channel === 'SMS' || c.channel === 'EMAIL') &&
    typeof c.address === 'string'
  );
}

export function loadContacts(storage: SimpleStorage | null = defaultStorage()): TrustedContact[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(TRUSTED_CONTACTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidStoredContact).slice(0, MAX_TRUSTED_CONTACTS);
  } catch {
    return [];
  }
}

export function saveContacts(
  contacts: TrustedContact[],
  storage: SimpleStorage | null = defaultStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(TRUSTED_CONTACTS_STORAGE_KEY, JSON.stringify(contacts.slice(0, MAX_TRUSTED_CONTACTS)));
    return true;
  } catch {
    return false;
  }
}

let contactCounter = 0;

export function createContact(input: TrustedContactInput, now: number = Date.now()): TrustedContact {
  contactCounter = (contactCounter + 1) % 10000;
  return {
    id: `tc-${now}-${contactCounter}`,
    name: input.name.trim(),
    channel: input.channel,
    address: input.address.trim(),
  };
}
