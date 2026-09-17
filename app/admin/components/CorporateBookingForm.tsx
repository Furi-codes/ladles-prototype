"use client";
import { useState } from 'react';
import { saveCorporateBooking, type loadCorporateData } from '@/lib/actions/corporate';
import type { CorporateBooking, CorporateCompany, CorporateStatus } from '@/lib/types';
import { Field } from './FeatureShared';
import styles from '../admin.module.css';
export default function CorporateBookingForm({ company, data, reload }: { company: CorporateCompany; data: Awaited<ReturnType<typeof loadCorporateData>>; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<CorporateBooking | 'new' | null>(null);
  const [status, setStatus] = useState<CorporateStatus>('Pending');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const initial = editing && editing !== 'new' ? editing : null;
  function edit(booking: CorporateBooking | 'new') { setEditing(booking); setStatus(booking === 'new' ? 'Pending' : booking.status); setMessage(''); }
  async function save(form: FormData) {
    setBusy(true); setMessage('');
    try {
      await saveCorporateBooking(initial?.id ?? null, { company_id: company.id, event_slot_id: Number(form.get('event_slot_id')), team_size: Number(form.get('team_size')), status,
        contact_name: String(form.get('contact_name') ?? '').trim() || null, contact_email: String(form.get('contact_email') ?? '').trim() || null,
        notes: String(form.get('notes') ?? '').trim() || null, attendance_count: status === 'Completed' ? Number(form.get('attendance_count')) : null,
        volunteer_hours: status === 'Completed' ? Number(form.get('volunteer_hours')) : null });
      setEditing(null); await reload(); setMessage('Corporate booking saved.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save booking.'); } finally { setBusy(false); }
  }
  return <div className={styles.featureStack}>
    <div className={styles.cardHeader}><h3 className={styles.cardTitle}>Group bookings</h3><button className={styles.primaryButton} onClick={() => edit('new')}>Book group</button></div>
    {message && <p role="status" className={styles.helper}>{message}</p>}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Event / shift</th><th>Team</th><th>Status</th><th>Attendance / hours</th><th>Action</th></tr></thead><tbody>{data.bookings.filter(b => b.company_id === company.id).map(b => {
      const event = data.events.find(e => e.id === b.event_id); const slot = data.slots.find(s => s.id === b.event_slot_id);
      return <tr key={b.id}><td>{event?.title}<br />{event?.date} · {slot?.start_time.slice(0,5)}–{slot?.end_time.slice(0,5)}{event?.status === 'Cancelled' && <p>Event cancelled</p>}</td><td>{b.team_size}</td><td><span className={`${styles.status} ${b.status === 'Cancelled' ? styles.statusCancelled : b.status === 'Completed' ? styles.statusCompleted : styles.statusConfirmed}`}>{b.status}</span></td><td>{b.attendance_count ?? '—'} / {b.volunteer_hours ?? '—'}</td><td><button className={styles.secondaryButton} onClick={() => edit(b)}>Manage</button></td></tr>;
    })}</tbody></table></div>
    {editing && <form action={save} key={initial?.id ?? 'new'} className={styles.formGrid}>
      <Field label="Event shift"><select className={styles.select} required name="event_slot_id" defaultValue={initial?.event_slot_id ?? ''}><option value="">Select a shift</option>{data.slots.filter(s => s.id === initial?.event_slot_id || data.events.some(e => e.id === s.event_id && e.status !== 'Cancelled')).map(s => { const event = data.events.find(e => e.id === s.event_id); return <option key={s.id} value={s.id}>{event?.title} · {event?.date} · {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)} (capacity {s.capacity})</option>; })}</select></Field>
      <Field label="Team size"><input className={styles.input} name="team_size" type="number" min="1" step="1" max="2147483647" required defaultValue={initial?.team_size ?? 1} /></Field>
      <Field label="Contact name"><input className={styles.input} name="contact_name" defaultValue={initial?.contact_name ?? company.contact_name ?? ''} /></Field>
      <Field label="Contact email"><input className={styles.input} name="contact_email" type="email" defaultValue={initial?.contact_email ?? company.contact_email ?? ''} /></Field>
      <Field label="Status"><select className={styles.select} value={status} onChange={e => setStatus(e.target.value as CorporateStatus)}>{(initial ? ['Pending','Confirmed','Completed','Cancelled'] : ['Pending','Confirmed']).map(s => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Booking notes"><textarea className={styles.textarea} name="notes" defaultValue={initial?.notes ?? ''} /></Field>
      {status === 'Completed' && <><Field label="Actual attendance"><input className={styles.input} name="attendance_count" type="number" min="0" step="1" required defaultValue={initial?.attendance_count ?? ''} /></Field><Field label="Total corporate volunteer hours"><input className={styles.input} name="volunteer_hours" type="number" min="0" step="0.01" required defaultValue={initial?.volunteer_hours ?? ''} /></Field></>}
      <p className={`${styles.helper} ${styles.fieldFull}`}>Pending and Confirmed teams reserve places. Cancellation releases places and retains history. Completed groups retain their reservation and require actual attendance. Capacity is checked when you save.</p>
      <div className={styles.formActions}><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setEditing(null)}>Close</button><button className={styles.primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save booking'}</button></div>
    </form>}
  </div>;
}
