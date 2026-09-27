/**
 * Sanket — Trusted Contacts Panel
 *
 * Configures who WOULD receive a silent alert in production. In this
 * prototype contacts are stored only in this browser and are never messaged;
 * they appear as masked recipients in the simulated dispatch payload.
 */

import React, { useState } from 'react';
import { Users, UserPlus, Trash2, MessageSquare, Mail, Lock, AlertCircle } from 'lucide-react';
import {
  MAX_TRUSTED_CONTACTS,
  maskAddress,
  type ContactChannel,
  type ContactValidation,
  type TrustedContact,
  type TrustedContactInput,
} from '../services/trustedContacts';

interface TrustedContactsPanelProps {
  contacts: TrustedContact[];
  onAdd: (input: TrustedContactInput) => ContactValidation;
  onRemove: (id: string) => void;
}

export const TrustedContactsPanel: React.FC<TrustedContactsPanelProps> = ({
  contacts,
  onAdd,
  onRemove,
}) => {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<ContactChannel>('SMS');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isFull = contacts.length >= MAX_TRUSTED_CONTACTS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onAdd({ name, channel, address });
    if (result.ok) {
      setName('');
      setAddress('');
      setError(null);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="console-card contacts-card" id="trusted-contacts-panel">
      <div className="card-header">
        <div className="card-title-group">
          <Users size={16} className="card-icon" />
          <h2 className="card-title">Trusted Contacts</h2>
          <span className="card-badge">
            {contacts.length}/{MAX_TRUSTED_CONTACTS} configured
          </span>
        </div>
        <span className="contacts-sim-badge">
          <Lock size={11} />
          SIMULATED — NEVER MESSAGED
        </span>
      </div>

      <p className="contacts-desc">
        People who would receive a discreet alert on a confirmed high-risk event. In this prototype
        they are stored only in this browser and appear as masked recipients in the forensic
        dispatch preview.
      </p>

      <div className="contacts-body">
        <form className="contacts-form" onSubmit={handleSubmit} noValidate>
          <div className="contacts-field">
            <label htmlFor="contact-name-input" className="contacts-label">Name</label>
            <input
              id="contact-name-input"
              className="contacts-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya (sister)"
              maxLength={40}
              disabled={isFull}
            />
          </div>

          <div className="contacts-field">
            <span className="contacts-label" id="contact-channel-label">Channel</span>
            <div className="contacts-channel-toggle" role="radiogroup" aria-labelledby="contact-channel-label">
              {(['SMS', 'EMAIL'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  role="radio"
                  aria-checked={channel === ch}
                  className={`contacts-channel-btn ${channel === ch ? 'active' : ''}`}
                  onClick={() => setChannel(ch)}
                  disabled={isFull}
                >
                  {ch === 'SMS' ? <MessageSquare size={12} /> : <Mail size={12} />}
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="contacts-field contacts-field-grow">
            <label htmlFor="contact-address-input" className="contacts-label">
              {channel === 'SMS' ? 'Phone number' : 'Email address'}
            </label>
            <input
              id="contact-address-input"
              className="contacts-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={channel === 'SMS' ? '+91 98765 43210' : 'name@example.com'}
              inputMode={channel === 'SMS' ? 'tel' : 'email'}
              disabled={isFull}
            />
          </div>

          <button
            type="submit"
            className="contacts-add-btn"
            id="add-contact-btn"
            disabled={isFull || !name.trim() || !address.trim()}
          >
            <UserPlus size={14} />
            <span>ADD</span>
          </button>
        </form>

        {error && (
          <div className="contacts-error" role="alert">
            <AlertCircle size={13} />
            <span>{error}</span>
          </div>
        )}

        {contacts.length === 0 ? (
          <div className="contacts-empty">
            <Users size={18} />
            <span>
              No trusted contacts yet. Alerts will still be logged locally, but the dispatch preview
              will show no recipients.
            </span>
          </div>
        ) : (
          <ul className="contacts-list">
            {contacts.map((c) => (
              <li key={c.id} className="contacts-item">
                <span className="contacts-item-icon">
                  {c.channel === 'SMS' ? <MessageSquare size={13} /> : <Mail size={13} />}
                </span>
                <span className="contacts-item-name">{c.name}</span>
                <span className="contacts-item-address">{maskAddress(c.channel, c.address)}</span>
                <button
                  type="button"
                  className="contacts-remove-btn"
                  onClick={() => onRemove(c.id)}
                  aria-label={`Remove ${c.name}`}
                  title={`Remove ${c.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
