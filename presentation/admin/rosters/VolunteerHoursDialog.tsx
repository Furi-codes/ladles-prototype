"use client";

/**
 * Lets an admin approve actual attendance after checking a volunteer's email.
 * The database checks the role, shift boundaries and original record again before saving.
 */
import { useEffect, useRef, useState } from 'react';
import type { AttendanceRecord, Booking, Event, EventSlot } from '@/business/shared/types';
import { formatWorkedTime } from '@/business/shared/dates/attendance';
import { approveVolunteerHours } from '@/business/admin/services/management';
import { rosterShiftTimes, validateApprovedTimes } from '@/business/admin/hours';
import { userFacingError } from '@/business/shared/errors/user-facing';
import styles from '@/presentation/styles/admin.module.css';

type Props = {
  booking: Booking;
  event: Event;
  slot?: EventSlot;
  attendance?: AttendanceRecord;
  onClose: () => void;
  onSaved: () => void;
};

export default function VolunteerHoursDialog({ booking, event, slot, attendance, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The ref changes immediately, so a second click cannot submit before React updates busy.
  const pending = useRef(false);
  // Saved timestamps are converted to SA time; the admin's browser timezone must not alter them.
  const timeValue = (value?: string | null) => value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '';
  const [arrival, setArrival] = useState(timeValue(attendance?.clocked_in_at));
  const [departure, setDeparture] = useState(timeValue(attendance?.clocked_out_at));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shift = rosterShiftTimes(event, booking, slot);
  // Preview the same duration that will be approved; the database checks it again on save.
  const approval = validateApprovedTimes(event.date, shift, arrival, departure);

  useEffect(() => { dialog.current?.showModal(); }, []);

  /** Validate the form, save through the protected endpoint, then ask the roster to reload. */
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    if (approval.error || !approval.start || !approval.end) { setError(approval.error); return; }
    if (reason.trim().length < 5) { setError('Enter a reason of at least 5 characters.'); return; }
    pending.current = true;
    setBusy(true); setError('');
    try {
      await approveVolunteerHours(booking, attendance, approval.start, approval.end, reason.trim());
      onSaved();
    } catch (failure) {
      // Show useful validation messages while keeping technical backend details out of the form.
      setError(userFacingError(failure, 'Hours could not be approved. Please try again.'));
    } finally { pending.current = false; setBusy(false); }
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="approve-volunteer-hours" onCancel={event => { event.preventDefault(); if (!pending.current) onClose(); }}>
    <h2 id="approve-volunteer-hours" className={styles.cardTitle}>Approve volunteer hours</h2>
    <p><strong>{booking.volunteer_name}</strong><br />{event.title} · {event.date} · {booking.selected_slot}</p>
    <p className={styles.cardHint}>Enter the times you verified with the volunteer. Approval marks this booking completed and updates their verified hours. Times are in South African time.</p>
    <p>Currently recorded: {attendance ? formatWorkedTime(attendance.worked_minutes) : 'No attendance recorded'}</p>
    <form onSubmit={save}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className={styles.formGrid}>
          <div className={styles.field}><label className={styles.fieldLabel} htmlFor="hours-arrival">Actual arrival time</label><input autoFocus id="hours-arrival" type="time" step="60" required className={styles.input} value={arrival} onChange={event => setArrival(event.target.value)} /></div>
          <div className={styles.field}><label className={styles.fieldLabel} htmlFor="hours-departure">Actual departure time</label><input id="hours-departure" type="time" step="60" required className={styles.input} value={departure} onChange={event => setDeparture(event.target.value)} /></div>
        </div>
        <div className={styles.field}><label className={styles.fieldLabel} htmlFor="hours-reason">Reason for approval or correction</label><textarea id="hours-reason" required minLength={5} maxLength={300} rows={3} className={styles.textarea} placeholder="For example: volunteer emailed to confirm they forgot to clock out." value={reason} onChange={event => setReason(event.target.value)} /></div>
        <p role="status">{arrival && departure ? approval.error || `Hours to approve: ${formatWorkedTime(approval.minutes)}` : 'Provide both times to calculate the approved hours.'}</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={Boolean(approval.error) || reason.trim().length < 5}>{busy ? 'Approving…' : 'Approve hours'}</button></div>
      </fieldset>
    </form>
  </dialog>;
}
