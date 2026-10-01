"use client";
import { useState } from 'react';
import { formatWorkedTime } from '@/lib/attendance-utils';
import type { AttendanceRecord, Booking, Event } from '@/lib/types';
import styles from '../volunteer.module.css';
import ui from './experience.module.css';

export default function VolunteerHistory({ bookings, attendance, events, userId }: { bookings: Booking[]; attendance: AttendanceRecord[]; events: Event[]; userId?: string }) {
  const [filter, setFilter] = useState('All activity');
  const [limit, setLimit] = useState(8);
  const byEvent = new Map(events.map(e => [e.id, e]));
  const byBooking = new Map(attendance.map(a => [a.booking_id, a]));
  const rows = bookings.filter(b => b.user_id === userId && (filter === 'All activity' || b.status === filter)).sort((a,b) => (byEvent.get(b.event_id)?.date ?? '').localeCompare(byEvent.get(a.event_id)?.date ?? '') || b.id - a.id);
  return <section className={styles.card}>
    <div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Your volunteering history</h2><p className={styles.cardHint}>Your bookings, attendance and verified time, newest first.</p></div><label className={ui.filterLabel}>Show<select className={styles.select} value={filter} onChange={e => { setFilter(e.target.value); setLimit(8); }}>{['All activity', 'Completed', 'Present', 'Confirmed', 'No show'].map(s => <option key={s} value={s}>{s === 'Present' ? 'Clock-out needed' : s}</option>)}</select></label></div>
    {!rows.length ? <p className={styles.emptySmall}>No {filter === 'All activity' ? 'volunteering activity' : 'matching shifts'} yet.</p> : <div className={ui.historyList}>{rows.slice(0, limit).map(b => {
      const event = byEvent.get(b.event_id), record = byBooking.get(b.id);
      return <article key={b.id} className={ui.historyRow}><div><h3>{event?.title ?? 'Event unavailable'}</h3><p>{event?.date ?? 'Date unavailable'} · {b.selected_slot || 'Time unavailable'}</p><p>{event?.location}</p></div><div className={ui.historyStatus}><span className={ui.badge}>{event?.status === 'Cancelled' ? 'Event cancelled' : b.status === 'Present' ? 'Clock-out needed' : b.status}</span><strong>{b.status === 'Completed' ? formatWorkedTime(record?.worked_minutes ?? null) : 'Hours not finalised'}</strong></div></article>;
    })}</div>}
    {rows.length > limit && <div className={ui.body}><button className={styles.secondaryButton} onClick={() => setLimit(n => n + 8)}>Show more ({rows.length - limit} remaining)</button></div>}
  </section>;
}
