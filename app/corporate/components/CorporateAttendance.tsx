"use client";

import { useRef, useState } from 'react';
import { corporateOutcomesEnabled } from '@/lib/feature-flags';
import { canRecordCorporateAttendance, cleanCorporateAttendance } from '@/lib/corporate-outcomes';
import { recordCorporateAttendance } from '@/lib/actions/corporate-outcomes';
import type { CorporateBookingRow } from '@/lib/corporate-booking-types';
import { useWorkflowClock } from './CorporateWorkflowShared';
import { corporateDateLabel } from '@/lib/corporate-booking-utils';
import styles from '@/app/admin/admin.module.css';
import ui from '../corporate.module.css';

export default function CorporateAttendance({ booking, admin, dirtyChanged, committed }: { booking: CorporateBookingRow; admin: boolean; dirtyChanged: (value: boolean) => void; committed: (booking: CorporateBookingRow) => Promise<void> }) {
  const [open, setOpen] = useState(false), [dirty, setDirty] = useState(false);
  const now = useWorkflowClock(), record = booking.attendance;
  const reportDirty = (value: boolean) => { setDirty(value); dirtyChanged(value); };
  return <section><h2>Group attendance & completion</h2>{record ? <div className={ui.notice}><p><strong>{record.attendance_count}</strong> actual attendees · <strong>{record.group_hours === null ? 'Hours not recorded' : record.group_hours.toFixed(2) + ' total group hours'}</strong></p><p>{record.note}</p><p>Recorded by {record.recorded_by_name} · {corporateDateLabel(record.updated_at)}</p></div> : <p>No group attendance has been recorded. Booked group size is not proof of attendance.</p>}
    {corporateOutcomesEnabled && admin && canRecordCorporateAttendance(booking, now) && <button className={styles.primaryButton} onClick={() => { if (dirty && !window.confirm('Discard unsaved attendance changes?')) return; setOpen(!open); reportDirty(false); }}>{open ? 'Close attendance form' : record ? 'Correct group attendance' : 'Record attendance & complete'}</button>}
    {open && <CorporateAttendanceForm booking={booking} dirtyChanged={reportDirty} committed={async saved => { reportDirty(false); setOpen(false); await committed(saved); }} />}
    {!corporateOutcomesEnabled && admin && <p>Corporate attendance recording is not available yet. Existing booking and payment records are unchanged.</p>}
    {admin && !canRecordCorporateAttendance(booking, now) && <p>Recording becomes available after the event ends, for confirmed/completed bookings with no unresolved change or cancellation request.</p>}
    <p>Hours are the combined hours for the whole group, not the event duration. Blank means not recorded; zero is a recorded value. Previous attendance corrections and payment records remain in history.</p>
  </section>;
}
export function CorporateAttendanceForm({ booking, dirtyChanged, committed }: { booking: CorporateBookingRow; dirtyChanged: (value: boolean) => void; committed: (booking: CorporateBookingRow) => Promise<void> }) {
  const [count, setCount] = useState(booking.attendance ? String(booking.attendance.attendance_count) : '');
  const [hours, setHours] = useState(booking.attendance?.group_hours === null || booking.attendance?.group_hours === undefined ? '' : String(booking.attendance.group_hours));
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false), intent = useRef<{ payload: string; key: string } | null>(null);
  return <form onChange={() => dirtyChanged(true)} aria-busy={busy} onSubmit={async event => {
    event.preventDefault(); if (pending.current) return; setError('');
    try {
      const input = cleanCorporateAttendance(booking.group_size,count,hours,note);
      if (!canRecordCorporateAttendance(booking)) throw new Error('This booking cannot be completed yet. Refresh and check its status and event end time.');
      if (!window.confirm('Save these actual group totals and mark the booking completed? Previous receipts and correction history will be retained.')) return;
      const payload = JSON.stringify([booking.id,booking.version,input]);
      if (intent.current?.payload !== payload) intent.current = { payload,key:crypto.randomUUID() };
      pending.current = true; setBusy(true); dirtyChanged(true);
      const saved = await recordCorporateAttendance(booking,count,hours,note,intent.current.key);
      dirtyChanged(false); await committed(saved);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Attendance could not be saved. Refresh and check before changing your totals.'); }
    finally { pending.current = false; setBusy(false); }
  }}><fieldset className={styles.formGrid} disabled={busy} style={{ border:0,padding:0,minWidth:0 }}><legend>{booking.attendance ? 'Correct recorded totals' : 'Actual group totals'}</legend>
    <label className={styles.field}><span className={styles.fieldLabel}>Actual attendees (zero allowed)</span><input className={styles.input} type="number" required min={0} max={booking.group_size} step={1} value={count} onChange={event => setCount(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Total group volunteer hours (optional)</span><input className={styles.input} type="number" min={0} max="9999999999.99" step="0.01" value={hours} onChange={event => setHours(event.target.value)} placeholder="Leave blank if not recorded" /></label>
    <label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>{booking.attendance ? 'Correction reason' : 'Attendance notes'}</span><textarea className={styles.input} required maxLength={800} value={note} onChange={event => setNote(event.target.value)} /></label>
    {error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}<button className={styles.primaryButton}>{busy ? 'Saving…' : 'Save attendance & complete'}</button>
  </fieldset></form>;
}
