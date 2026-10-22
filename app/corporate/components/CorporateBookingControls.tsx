"use client";

import { useState } from 'react';
import { configureCorporateBookings } from '@/lib/actions/corporate-bookings';
import type { CorporateBookingSettings } from '@/lib/corporate-booking-types';
import { useUnsavedChanges } from '@/app/components/useUnsavedChanges';
import styles from '@/app/admin/admin.module.css';
import management from '@/app/admin/components/management.module.css';
import ui from '../corporate.module.css';

export default function CorporateBookingControls({ initial, saved, dirtyChanged }: { initial: CorporateBookingSettings; saved: (settings: CorporateBookingSettings) => void; dirtyChanged: (dirty: boolean) => void }) {
  const [enabled, setEnabled] = useState(initial.booking_enabled), [email, setEmail] = useState(initial.booking_contact_email), [phone, setPhone] = useState(initial.booking_contact_phone);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  useUnsavedChanges(enabled !== initial.booking_enabled || email !== initial.booking_contact_email || phone !== initial.booking_contact_phone);
  return <section className={`${styles.card} ${ui.body}`}><h1 className={styles.pageTitle}>Booking settings</h1><p>Only use approved Ladles booking contact details. No default email or phone is invented. Both are required before new requests and acceptance are opened.</p><form onChange={() => dirtyChanged(true)} onSubmit={async event => {
    event.preventDefault(); if (busy || !window.confirm('Apply these booking contact and availability controls? Existing accepted places, history and payment records remain unchanged.')) return;
    setBusy(true); setError('');
    try { const result = await configureCorporateBookings(enabled, email, phone); dirtyChanged(false); setMessage('Booking controls saved.'); saved(result); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Booking controls could not be saved.'); }
    finally { setBusy(false); }
  }}><fieldset disabled={busy} className={styles.formGrid} style={{ border: 0, padding: 0 }}><legend>Booking contact and availability</legend><label className={styles.field}><span className={styles.fieldLabel}>Booking team email</span><input className={styles.input} type="email" required={enabled} maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label><label className={styles.field}><span className={styles.fieldLabel}>Booking team phone</span><input className={styles.input} type="tel" required={enabled} maxLength={25} value={phone} onChange={event => setPhone(event.target.value)} /></label><label className={`${management.preference} ${styles.fieldFull}`}><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />Open new corporate requests and admin acceptance</label><p className={styles.fieldFull}>Closing this stops new requests/acceptance, not existing payment follow-up. Payments are arranged externally. Configure the contact details before opening requests.</p>{error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}{message && <p className={styles.fieldFull} role="status">{message}</p>}<button className={styles.primaryButton}>{busy ? 'Saving…' : 'Save booking controls'}</button></fieldset></form></section>;
}
