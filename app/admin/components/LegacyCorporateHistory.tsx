"use client";

import { useState } from 'react';
import Link from 'next/link';
import { loadCorporateData } from '@/lib/actions/corporate';
import { FeatureState, useFeatureData } from './FeatureShared';
import styles from '../admin.module.css';
import ui from './management.module.css';

/** Keep the old CSR records visible without offering a second, shared-volunteer-capacity booking form. */
export default function LegacyCorporateHistory() {
  const { data, loading, error, reload } = useFeatureData(loadCorporateData);
  const [query, setQuery] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const companies = data?.companies.filter(company => `${company.name} ${company.contact_name || ''} ${company.contact_email || ''}`.toLowerCase().includes(query.trim().toLowerCase())) || [];
  const companyIds = new Set(companies.map(company => company.id));
  const bookings = data?.bookings.filter(booking => companyIds.has(booking.company_id) && (!status || booking.status === status)) || [];
  const pages = Math.max(1, Math.ceil(bookings.length / 10)), current = Math.min(page, pages);
  return <div className={ui.workspace}><div><h1 className={styles.pageTitle}>Legacy CSR history</h1><p className={styles.pageDescription}>Read-only records from the previous admin-managed CSR workflow.</p></div>
    <div className={ui.note}>These groups use the existing volunteer event slots. Their history and capacity reservations are retained. New corporate bookings use independent corporate events. Review any active legacy bookings with the database maintainer before enabling the new workflow in production; do not delete them to free places.</div>
    <Link className={styles.primaryButton} href="/admin/corporate-bookings">Open new corporate booking workflow</Link><FeatureState loading={loading} error={error} retry={() => void reload()} />
    {!loading && !error && data && <><section className={styles.card}><div className={ui.filters}><label>Search legacy company / contact<input className={styles.input} type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label><label>Booking status<select className={styles.select} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{['Pending','Confirmed','Completed','Cancelled'].map(value => <option key={value}>{value}</option>)}</select></label></div><p className={ui.count}>{bookings.length} historical bookings · Page {current} of {pages}</p><div className={ui.tableViewport}><table className={styles.table}><thead><tr><th>Company</th><th>Volunteer event / range (legacy)</th><th>Group / status</th><th>Recorded attendance / hours</th><th>Notes / history</th></tr></thead><tbody>{bookings.slice((current - 1) * 10, current * 10).map(booking => {
      const company = data.companies.find(row => row.id === booking.company_id), event = data.events.find(row => row.id === booking.event_id), slot = data.slots.find(row => row.id === booking.event_slot_id);
      return <tr key={booking.id}><td>{company?.name || 'Legacy company'}<small className={ui.subtle}>{booking.contact_name || company?.contact_name}<br />{booking.contact_email || company?.contact_email}</small></td><td>{event?.title || 'Historical event'}<br />{event?.date} · {slot?.start_time}–{slot?.end_time}</td><td>{booking.team_size} people<br />{booking.status}</td><td>{booking.attendance_count ?? 'Not recorded'} / {booking.volunteer_hours ?? 'Hours not recorded'}</td><td>{booking.notes || 'No notes'}{booking.cancellation_reason && <p>{booking.cancellation_reason}</p>}<small className={ui.subtle}>Created {booking.created_at}<br />Updated {booking.updated_at}</small></td></tr>;
    })}{!bookings.length && <tr><td colSpan={5}>No matching legacy bookings.</td></tr>}</tbody></table></div><div className={ui.filters}><button className={styles.secondaryButton} disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button><button className={styles.secondaryButton} disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button></div></section>
    <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Legacy company records</h2></div><div className={ui.tableViewport}><table className={styles.table}><thead><tr><th>Company</th><th>Main contact</th><th>Contact details</th><th>Notes</th></tr></thead><tbody>{companies.map(company => <tr key={company.id}><td>{company.name}<small className={ui.subtle}>{company.industry} · {company.relationship_status}</small></td><td>{company.contact_name}</td><td>{company.contact_email}<br />{company.contact_phone}</td><td><details><summary>View retained notes</summary><p>{company.notes || 'No company notes'}</p>{data.notes.filter(note => note.company_id === company.id).map(note => <p key={note.id}>{note.body}<small className={ui.subtle}>{note.created_at}</small></p>)}</details></td></tr>)}</tbody></table></div></section></>}
  </div>;
}
