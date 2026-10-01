"use client";
import { useState } from 'react';
import { saveCorporateBooking, type loadCorporateData } from '@/lib/actions/corporate';
import { logAdminAction } from '@/lib/actions/audit';
import type { CorporateBooking, CorporateCompany, CorporateStatus } from '@/lib/types';
import { Field } from './FeatureShared';
import styles from '../admin.module.css';
import ui from './management.module.css';
export default function CorporateBookingForm({ company, data, reload }: { company: CorporateCompany; data: Awaited<ReturnType<typeof loadCorporateData>>; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<CorporateBooking | 'new' | null>(null);
  const [status, setStatus] = useState<CorporateStatus>('Pending');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [bookingFilter, setBookingFilter] = useState('');
  const companyBookings = data.bookings.filter(b => b.company_id === company.id);
  const visibleBookings = companyBookings.filter(b => !bookingFilter || b.status === bookingFilter);
  const initial = editing && editing !== 'new' ? editing : null;
  function edit(booking: CorporateBooking | 'new') { setEditing(booking); setStatus(booking === 'new' ? 'Pending' : booking.status); setMessage(''); }
  async function save(form: FormData) {
    setBusy(true); setMessage('');
    try {
      const saved = await saveCorporateBooking(initial?.id ?? null, { company_id: company.id, event_slot_id: Number(form.get('event_slot_id')), team_size: Number(form.get('team_size')), status,
        contact_name: String(form.get('contact_name') ?? '').trim() || null, contact_email: String(form.get('contact_email') ?? '').trim() || null,
        notes: String(form.get('notes') ?? '').trim() || null, attendance_count: status === 'Completed' ? Number(form.get('attendance_count')) : null,
        volunteer_hours: status === 'Completed' ? Number(form.get('volunteer_hours')) : null });
      await logAdminAction({
        action: initial ? 'CORPORATE_BOOKING_UPDATED' : 'CORPORATE_BOOKING_CREATED',
        entityType: 'CORPORATE_BOOKING',
        entityId: saved.id,
        entityLabel: company.name,
        details: { event_slot_id: saved.event_slot_id, team_size: saved.team_size, status: saved.status },
      });
      setEditing(null); await reload(); setMessage('Corporate booking saved.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save booking.'); } finally { setBusy(false); }
  }
  return <div className={styles.featureStack}>
    <div className={styles.cardHeader}><h3 className={styles.cardTitle}>Group bookings</h3><button className={styles.primaryButton} onClick={() => edit('new')}>Book group</button></div>
    {message && <p role="status" className={styles.helper}>{message}</p>}
    <div className={ui.filters}><label>Booking status<select className={styles.select} value={bookingFilter} onChange={e => setBookingFilter(e.target.value)}><option value="">All bookings</option>{['Pending','Confirmed','Completed','Cancelled'].map(s => <option key={s}>{s}</option>)}</select></label><span className={styles.helper}>{visibleBookings.length} of {companyBookings.length} group bookings</span></div>
    <div className={ui.tableViewport} tabIndex={0} role="region" aria-label="Group bookings"><table className={styles.table}><thead><tr><th>Event / shift</th><th>Team</th><th>Status</th><th>Recorded attendance</th><th>Volunteer hours</th><th>Action</th></tr></thead><tbody>{visibleBookings.map(b => {
      const event = data.events.find(e => e.id === b.event_id); const slot = data.slots.find(s => s.id === b.event_slot_id);
      return <tr key={b.id}><td>{event?.title}<br />{event?.date} · {slot?.start_time.slice(0,5)}–{slot?.end_time.slice(0,5)}{event?.status === 'Cancelled' && <p>Event cancelled</p>}</td><td>{b.team_size}</td><td><span className={`${styles.status} ${b.status === 'Cancelled' ? styles.statusCancelled : b.status === 'Completed' ? styles.statusCompleted : styles.statusConfirmed}`}>{b.status}</span></td><td>{b.attendance_count ?? 'Not recorded'}</td><td>{b.volunteer_hours ?? 'Not recorded'}</td><td><button className={styles.secondaryButton} onClick={() => edit(b)}>Manage</button></td></tr>;
    })}{!visibleBookings.length && <tr><td colSpan={6}><p className={styles.empty}>No group bookings in this view.</p></td></tr>}</tbody></table></div>
    {editing && <form action={save} key={initial?.id ?? 'new'} className={styles.formGrid}>
      <h3 className={ui.formSection}>{initial ? 'Manage group booking' : 'New group booking'} · {company.name}</h3>
      <Field label="Event shift"><select className={styles.select} required name="event_slot_id" defaultValue={initial?.event_slot_id ?? ''}><option value="">Select a shift</option>{data.slots.filter(s => s.id === initial?.event_slot_id || data.events.some(e => e.id === s.event_id && e.status !== 'Cancelled')).map(s => { const event = data.events.find(e => e.id === s.event_id); return <option key={s.id} value={s.id}>{event?.title} · {event?.date} · {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)} (capacity {s.capacity})</option>; })}</select></Field>
      <Field label="Team size"><input className={styles.input} name="team_size" type="number" min="1" step="1" max="2147483647" required defaultValue={initial?.team_size ?? 1} /></Field>
      <Field label="Contact name"><input className={styles.input} name="contact_name" defaultValue={initial?.contact_name ?? company.contact_name ?? ''} /></Field>
      <Field label="Contact email"><input className={styles.input} name="contact_email" type="email" defaultValue={initial?.contact_email ?? company.contact_email ?? ''} /></Field>
      <Field label="Status"><select className={styles.select} value={status} onChange={e => setStatus(e.target.value as CorporateStatus)}>{(initial ? ['Pending','Confirmed','Completed','Cancelled'] : ['Pending','Confirmed']).map(s => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Booking notes"><textarea className={styles.textarea} name="notes" defaultValue={initial?.notes ?? ''} /></Field>
      {status === 'Completed' && <><h3 className={ui.formSection}>Recorded group participation</h3><Field label="Actual attendance"><input className={styles.input} name="attendance_count" type="number" min="0" step="1" required defaultValue={initial?.attendance_count ?? ''} /></Field><Field label="Total corporate volunteer hours"><input className={styles.input} name="volunteer_hours" type="number" min="0" step="0.01" required defaultValue={initial?.volunteer_hours ?? ''} /></Field></>}
      <p className={`${styles.helper} ${styles.fieldFull}`}>Pending and Confirmed teams reserve places. Cancellation releases places and retains history. Completed groups retain their reservation and require actual attendance. Capacity is checked when you save.</p>
      <div className={styles.formActions}><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setEditing(null)}>Close</button><button className={styles.primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save booking'}</button></div>
    </form>}
  </div>;
}
