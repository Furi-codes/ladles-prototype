"use client";

import { useEffect, useState } from 'react';
import type { CorporateWorkflowFilters, CorporateWorkflowAction, CorporateBookingSettings } from '@/lib/corporate-booking-types';
import { corporateDateLabel } from '@/lib/corporate-booking-utils';
import { corporateChangesEnabled } from '@/lib/feature-flags';
import styles from '@/app/admin/admin.module.css';
import management from '@/app/admin/components/management.module.css';
import ui from '../corporate.module.css';

export function useWorkflowClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  return now;
}
export function WorkflowFilters({ value, change, statuses = false, disabled = false }: { value: CorporateWorkflowFilters; change: (value: CorporateWorkflowFilters) => void; statuses?: boolean; disabled?: boolean }) {
  return <div className={management.filters}><label>Search<input className={styles.input} type="search" maxLength={180} placeholder={statuses ? 'Company, booking ID or event' : 'Corporate event or location'} disabled={disabled} value={value.query} onChange={event => change({ ...value, query: event.target.value })} /></label>
    {statuses && <label>Status<select className={styles.select} disabled={disabled} value={value.status || ''} onChange={event => change({ ...value, status: event.target.value as CorporateWorkflowFilters['status'] })}><option value="">All statuses</option>{['Requested','Pending payment','Pending additional payment','Confirmed','Completed','Rejected','Cancelled','Overdue',...(corporateChangesEnabled ? ['Change requested','Cancellation requested'] : [])].map(status => <option key={status}>{status}</option>)}</select></label>}
    <label>From date<input className={styles.input} type="date" disabled={disabled} value={value.from} onChange={event => change({ ...value, from: event.target.value })} /></label><label>To date<input className={styles.input} type="date" disabled={disabled} value={value.to} onChange={event => change({ ...value, to: event.target.value })} /></label>
    <button className={styles.secondaryButton} disabled={disabled} onClick={() => change({ query: '', from: '', to: '', status: '' })}>Clear filters</button>
  </div>;
}
export function WorkflowPagination({ page, total, change, disabled = false }: { page: number; total: number; change: (page: number) => void; disabled?: boolean }) {
  return <div className={management.filters}><button className={styles.secondaryButton} disabled={page === 1 || disabled} onClick={() => change(page - 1)}>Previous</button><span role="status">{total} results · Page {page}</span><button className={styles.secondaryButton} disabled={page * 10 >= total || disabled} onClick={() => change(page + 1)}>Next</button></div>;
}
export function BookingContact({ settings }: { settings: CorporateBookingSettings }) {
  return <section className={`${styles.card} ${ui.body}`}><h2>Contact the booking team</h2><p>Payment arrangements and any refund discussions happen externally. The portal does not process payments or send payment emails.</p><div className={ui.actions}>{settings.booking_contact_email && <a className={styles.secondaryButton} href={'mailto:' + settings.booking_contact_email}>Email booking team</a>}{settings.booking_contact_phone && <a className={styles.secondaryButton} href={'tel:' + settings.booking_contact_phone.replace(/[^+0-9]/g,'')}>Call booking team</a>}</div>{(!settings.booking_contact_email || !settings.booking_contact_phone) && <p>Approved booking contact details have not been configured yet.</p>}</section>;
}
export function WorkflowHistory({ rows }: { rows: CorporateWorkflowAction[] }) {
  return <section><h2>Latest booking actions</h2><p>The latest 50 actions. Full history remains stored in the database.</p><ol className={ui.history}>{rows.map(row => <li key={row.id}><strong>{row.action}</strong><time dateTime={row.created_at}>{corporateDateLabel(row.created_at)} · {row.actor_name}</time><p>{row.reason}</p><details><summary>Recorded details</summary><pre className={ui.recordedDetails}>{JSON.stringify({ before: row.before_values, after: row.after_values }, null, 2)}</pre></details></li>)}</ol></section>;
}
