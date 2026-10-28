"use client";

/**
 * Lets admin record or correct a group's actual attendance after its session ends.
 * Hours describe the whole event once, not hours multiplied by attendees; the saved booking is
 * passed back to refresh the review.
 */

import { userFacingError } from '@/business/shared/errors/user-facing';

import { useRef, useState } from 'react';
import { corporateOutcomesEnabled } from '@/business/shared/config/features';
import { canRecordCorporateAttendance, cleanCorporateAttendance } from '@/business/corporate/utils/outcomes';
import { recordCorporateAttendance } from '@/business/corporate/services/reports';
import type { CorporateBookingRow } from '@/business/corporate/types/bookings';
import { useWorkflowClock } from '@/presentation/corporate/shared/CorporateWorkflowShared';
import { corporateDateLabel } from '@/business/corporate/utils/bookings';
import styles from '@/presentation/styles/admin.module.css';
import ui from '@/presentation/styles/corporate.module.css';

export default function CorporateAttendance({ booking, admin, dirtyChanged, committed, initialOpen = false }: { booking: CorporateBookingRow; admin: boolean; dirtyChanged: (value: boolean) => void; committed: (booking: CorporateBookingRow) => Promise<void>; initialOpen?: boolean }) {
  const [open, setOpen] = useState(() => initialOpen && corporateOutcomesEnabled && admin && !booking.attendance && canRecordCorporateAttendance(booking)), [dirty, setDirty] = useState(false);
  const now = useWorkflowClock(), record = booking.attendance;
  const reportDirty = (value: boolean) => { setDirty(value); dirtyChanged(value); };
  return <section><h2>Group attendance & completion</h2>{record ? <div className={ui.notice}><p><strong>{record.attendance_count}</strong> actual attendees · <strong>{record.event_hours == null ? 'Event hours not recorded' : record.event_hours + ' event hours'}</strong></p><p>{record.note}</p><p>Recorded by {record.recorded_by_name} · {corporateDateLabel(record.updated_at)}</p></div> : <p>No group attendance has been recorded. Booked group size is not proof of attendance.</p>}
    {corporateOutcomesEnabled && admin && canRecordCorporateAttendance(booking, now) && <button className={styles.primaryButton} onClick={() => { if (dirty && !window.confirm('Discard unsaved attendance changes?')) return; setOpen(!open); reportDirty(false); }}>{open ? 'Close attendance form' : record ? 'Correct group attendance' : 'Record attendance & complete'}</button>}
    {open && <CorporateAttendanceForm booking={booking} dirtyChanged={reportDirty} committed={async saved => { reportDirty(false); setOpen(false); await committed(saved); }} />}
    {!corporateOutcomesEnabled && admin && <p>Corporate attendance recording is not available yet. Existing booking and payment records are unchanged.</p>}
    {admin && !canRecordCorporateAttendance(booking, now) && <p>Recording becomes available after the event ends, for confirmed/completed bookings with no unresolved change or cancellation request.</p>}
    <p>Record how many hours the event lasted. A two-hour event is recorded as 2 hours regardless of group size. Blank means not recorded.</p>
  </section>;
}
/**
 * Collect actual attendees and optional whole-event hours. Reuse the same key for an unchanged
 * retry so a lost response does not create a second attendance action.
 */
export function CorporateAttendanceForm({ booking, dirtyChanged, committed }: { booking: CorporateBookingRow; dirtyChanged: (value: boolean) => void; committed: (booking: CorporateBookingRow) => Promise<void> }) {
  const [count, setCount] = useState(booking.attendance ? String(booking.attendance.attendance_count) : '');
  const [hours, setHours] = useState(booking.attendance?.event_hours === null || booking.attendance?.event_hours === undefined ? '' : String(booking.attendance.event_hours));
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false), intent = useRef<{ payload: string; key: string } | null>(null);
  return <form onChange={() => dirtyChanged(true)} aria-busy={busy} onSubmit={async event => {
    event.preventDefault(); if (pending.current) return; setError('');
    try {
      const input = cleanCorporateAttendance(booking.group_size,count,hours,note);
      if (!canRecordCorporateAttendance(booking)) throw new Error('This booking cannot be completed yet. Refresh and check its status and event end time.');
      if (!window.confirm('Save attendance and event hours, and mark this booking completed?')) return;
      // An unchanged retry reuses its key. Editing the payload starts a new attendance intent.
      const payload = JSON.stringify([booking.id,booking.version,input]);
      if (intent.current?.payload !== payload) intent.current = { payload,key:crypto.randomUUID() };
      pending.current = true; setBusy(true); dirtyChanged(true);
      const saved = await recordCorporateAttendance(booking,count,hours,note,intent.current.key);
      dirtyChanged(false); await committed(saved);
    } catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Attendance could not be saved. Refresh and check before changing your totals.', "Attendance could not be saved. Refresh and check before changing your totals.")); }
    finally { pending.current = false; setBusy(false); }
  }}><fieldset className={styles.formGrid} disabled={busy} style={{ border:0,padding:0,minWidth:0 }}><legend>{booking.attendance ? 'Correct attendance and event hours' : 'Attendance and event hours'}</legend>
    <label className={styles.field}><span className={styles.fieldLabel}>Actual attendees (zero allowed)</span><input className={styles.input} type="number" required min={0} max={booking.group_size} step={1} value={count} onChange={event => setCount(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Event hours</span><input className={styles.input} type="number" min={0} max={24} step={1} value={hours} onChange={event => setHours(event.target.value)} placeholder="Leave blank if not recorded" /></label>
    <label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>{booking.attendance ? 'Correction reason' : 'Attendance notes'}</span><textarea className={styles.input} required maxLength={800} value={note} onChange={event => setNote(event.target.value)} /></label>
    {error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}<div className={ui.formFooter}><button type="submit" className={styles.primaryButton}>{busy ? 'Saving…' : 'Save attendance & complete'}</button></div>
  </fieldset></form>;
}
