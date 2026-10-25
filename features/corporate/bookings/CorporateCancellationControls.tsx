"use client";
/**
 * Handles corporate event cancellation and the change-request availability setting.
 * Cancelling an event requires a reason so affected companies receive an explanation with the
 * update.
 */

import { userFacingError } from '@/lib/errors/user-facing';

import { useRef, useState } from 'react';
import { cancelCorporateEvent, configureCorporateChanges } from '@/features/corporate/services/bookings';
import type { CorporateBookingSettings, CorporateEvent } from '@/features/corporate/types/bookings';
import { corporateDateLabel } from '@/features/corporate/utils/bookings';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import styles from '@/styles/admin.module.css';
import management from '@/components/ui/management.module.css';
import ui from '@/styles/corporate.module.css';

/** Event-wide cancellation is one checked transaction, not a browser loop over bookings. */
export function CorporateCancelEventForm({ event, dirtyChanged, committed }: { event: CorporateEvent; dirtyChanged: (dirty: boolean) => void; committed: () => void }) {
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  return <form aria-busy={busy} onChange={() => dirtyChanged(true)} onSubmit={async submit => {
    submit.preventDefault(); if (pending.current) return;
    if (!window.confirm(`Cancel ${event.title} and all its open bookings? Held places will be released, companies notified and proposals to move here declined. Payment/history stays recorded; refunds happen externally. This cannot be undone by republishing.`)) return;
    pending.current = true; setBusy(true); dirtyChanged(true); setError('');
    try { await cancelCorporateEvent(event, reason); dirtyChanged(false); committed(); }
    catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Cancellation could not be saved. Refresh and check the event before retrying.', "Cancellation could not be saved. Refresh and check the event before retrying.")); }
    finally { pending.current = false; setBusy(false); }
  }}><h2>Cancel corporate event</h2><p>{event.title} · {corporateDateLabel(event.starts_at)} · {event.location}</p><p>This cancels all open bookings on this event, retains receipts/history and sends an in-app update to each affected company. Refunds must be arranged externally.</p><fieldset disabled={busy} className={styles.formGrid} style={{ border: 0, padding: 0 }}><legend>Cancellation details</legend><label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>Reason / external refund and payment follow-up</span><textarea className={styles.input} required maxLength={800} value={reason} onChange={change => setReason(change.target.value)} /></label>{error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}<button className={styles.dangerButton}>{busy ? 'Cancelling…' : 'Cancel event & open bookings'}</button></fieldset></form>;
}

export function CorporateChangesControls({ initial, saved, dirtyChanged }: { initial: CorporateBookingSettings; saved: (settings: CorporateBookingSettings) => void; dirtyChanged: (dirty: boolean) => void }) {
  const [enabled, setEnabled] = useState(initial.changes_enabled ?? false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  useUnsavedChanges(enabled !== Boolean(initial.changes_enabled));
  return <section className={`${styles.card} ${ui.body}`}><h2>Booking changes & cancellation</h2><p>Choose whether companies may submit booking-change requests. Closing this stops new proposals and amendment approvals; existing cancellation requests can still be reviewed, and admins can cancel events.</p><form onSubmit={async event => {
    event.preventDefault(); if (pending.current || !window.confirm('Update change-request availability? Existing reservations and payment records remain unchanged.')) return;
    pending.current = true; setBusy(true); setError('');
    try { const result = await configureCorporateChanges(enabled); dirtyChanged(false); saved(result); }
    catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Change controls could not be saved.', "Change controls could not be saved.")); }
    finally { pending.current = false; setBusy(false); }
  }}><label className={management.preference}><input type="checkbox" disabled={busy} checked={enabled} onChange={event => { setEnabled(event.target.checked); dirtyChanged(event.target.checked !== Boolean(initial.changes_enabled)); }} />Open corporate change/cancellation requests and amendment approvals</label>{error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save change controls'}</button></form></section>;
}
