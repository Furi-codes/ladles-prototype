"use client";
/**
 * Opens or closes new corporate requests and admin acceptance.
 * Contact details are edited centrally in Settings; closing requests leaves existing bookings
 * intact.
 */

import { userFacingError } from '@/lib/errors/user-facing';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { setCorporateBookingAvailability } from '@/lib/contacts/api';
import type { CorporateBookingSettings } from '@/features/corporate/types/bookings';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import styles from '@/styles/admin.module.css';
import management from '@/components/ui/management.module.css';
import ui from '@/styles/corporate.module.css';

export default function CorporateBookingControls({ initial, saved, dirtyChanged }: { initial: CorporateBookingSettings; saved: (settings: CorporateBookingSettings) => void; dirtyChanged: (dirty: boolean) => void }) {
  const [enabled, setEnabled] = useState(initial.booking_enabled);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const pending = useRef(false);
  useUnsavedChanges(enabled !== initial.booking_enabled || busy);
  return <section className={styles.card}><div className={styles.cardHeader}><div><h1 className={styles.cardTitle}>Booking availability</h1><p className={styles.cardHint}>Control new corporate requests and admin acceptance.</p></div></div><div className={ui.body}>
    <p>Booking-team contact details are managed centrally in Settings.</p>
    <div><Link href="/admin/settings?section=contact-settings" className={styles.secondaryButton}>Manage portal contacts</Link></div>
    <form onSubmit={async event => {
      event.preventDefault(); if (pending.current || !window.confirm('Apply this booking availability change? Existing bookings and payment records remain unchanged.')) return;
      pending.current=true;setBusy(true);setError('');setMessage('');
      try { const result = await setCorporateBookingAvailability(enabled); dirtyChanged(false);setMessage('Booking availability saved.');saved(result); }
      catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Booking availability could not be saved.', "Booking availability could not be saved.")); }
      finally { pending.current=false;setBusy(false); }
    }}><fieldset disabled={busy} style={{border:0,padding:0}}><legend className={styles.fieldLabel}>Request availability</legend>
      <label className={management.preference}><input type="checkbox" checked={enabled} onChange={event => {setEnabled(event.target.checked);dirtyChanged(event.target.checked !== initial.booking_enabled);}} />Open new corporate requests and admin acceptance</label>
      <p>Closing requests does not cancel existing bookings. A primary corporate email and phone must be configured before requests can open.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <div className={ui.formFooter}><button type="submit" className={styles.primaryButton}>{busy ? 'Saving…' : 'Save availability'}</button></div>
    </fieldset></form>
  </div></section>;
}
