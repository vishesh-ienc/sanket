/**
 * Sanket — useTrustedContacts React Hook
 *
 * Manages the local trusted-contact roster with localStorage persistence.
 */

import { useState, useCallback } from 'react';
import {
  createContact,
  loadContacts,
  saveContacts,
  validateContact,
  type ContactValidation,
  type TrustedContact,
  type TrustedContactInput,
} from './trustedContacts';

export interface UseTrustedContactsReturn {
  contacts: TrustedContact[];
  addContact: (input: TrustedContactInput) => ContactValidation;
  removeContact: (id: string) => void;
}

export function useTrustedContacts(): UseTrustedContactsReturn {
  const [contacts, setContacts] = useState<TrustedContact[]>(() => loadContacts());

  const addContact = useCallback(
    (input: TrustedContactInput): ContactValidation => {
      const validation = validateContact(input, contacts);
      if (!validation.ok) return validation;
      const next = [...contacts, createContact(input)];
      setContacts(next);
      saveContacts(next);
      return validation;
    },
    [contacts]
  );

  const removeContact = useCallback((id: string) => {
    setContacts((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveContacts(next);
      return next;
    });
  }, []);

  return { contacts, addContact, removeContact };
}
