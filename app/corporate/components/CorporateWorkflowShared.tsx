"use client";

import { useEffect, useState } from 'react';
import type { CorporateWorkflowFilters, CorporateWorkflowAction } from '@/lib/corporate-booking-types';
import { corporateDateLabel } from '@/lib/corporate-booking-utils';
import { corporateHistoryChanges } from '@/lib/corporate-history';
import { corporateChangesEnabled } from '@/lib/feature-flags';
import styles from '@/app/admin/admin.module.css';
import management from '@/app/admin/components/management.module.css';
import ui from '../corporate.module.css';

export function useWorkflowClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 30000);
    // Background tabs may pause timers. Catch up as soon as the user returns.
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  return now;
}
export function WorkflowFilters({ value, change, statuses = false, disabled = false }: { value: CorporateWorkflowFilters; change: (value: CorporateWorkflowFilters) => void; statuses?: boolean; disabled?: boolean }) {
  const bookingStatuses = ['Requested', 'Pending payment', 'Confirmed', 'Completed', 'Rejected', 'Cancelled'];
  const attentionFilters = ['Overdue', 'Pending additional payment', ...(corporateChangesEnabled ? ['Change requested', 'Cancellation requested'] : [])];
  // One grouped control keeps pagination and results on a single protected server filter.
  const selectFilter = (status: string) => change({ ...value, status: status as CorporateWorkflowFilters['status'] });
  return <div className={management.filters}><label>Search<input className={styles.input} type="search" maxLength={180} placeholder={statuses ? 'Company, booking ID or event' : 'Corporate event or location'} disabled={disabled} value={value.query} onChange={event => change({ ...value, query: event.target.value })} /></label>
    {statuses && <>
      <label>Filter bookings<select className={styles.select} disabled={disabled} value={value.status || ''} onChange={event => selectFilter(event.target.value)}><option value="">All bookings</option><optgroup label="Booking status">{bookingStatuses.map(status => <option key={status}>{status}</option>)}</optgroup><optgroup label="Needs attention">{attentionFilters.map(status => <option key={status} value={status}>{status === 'Overdue' ? 'Payment overdue' : status === 'Pending additional payment' ? 'Additional payment needed' : status}</option>)}</optgroup></select></label>
    </>}
    <label>From date<input className={styles.input} type="date" disabled={disabled} value={value.from} onChange={event => change({ ...value, from: event.target.value })} /></label><label>To date<input className={styles.input} type="date" disabled={disabled} value={value.to} onChange={event => change({ ...value, to: event.target.value })} /></label>
    <button className={styles.secondaryButton} disabled={disabled} onClick={() => change({ query: '', from: '', to: '', status: '' })}>Clear filters</button>
    {statuses && <p className={ui.filterHint}>Choose one status or attention filter. Search and dates narrow the same results; overdue is a flag, not a cancellation.</p>}
  </div>;
}
export function WorkflowPagination({ page, total, change, disabled = false }: { page: number; total: number; change: (page: number) => void; disabled?: boolean }) {
  // Keep Previous available if the last page becomes empty after a record changes.
  if (total <= 10 && page === 1) return null;
  return <nav className={ui.pagination} aria-label="Results pages"><button type="button" className={styles.secondaryButton} disabled={page === 1 || disabled} onClick={() => change(page - 1)}>Previous</button><span role="status">{total} results · Page {page}</span><button type="button" className={styles.secondaryButton} disabled={page * 10 >= total || disabled} onClick={() => change(page + 1)}>Next</button></nav>;
}
export function WorkflowHistory({ rows }: { rows: CorporateWorkflowAction[] }) {
  return <section className={ui.historySection} aria-label="Booking activity"><h2>Booking activity</h2><p>The latest updates, including who made each change and when.</p>{rows.length ? <ol className={ui.history}>{rows.map(row => <li key={row.id}><strong>{row.action}</strong><time dateTime={row.created_at}>{corporateDateLabel(row.created_at)} · {row.actor_name}</time>{row.reason && <p>{row.reason}</p>}<div className={ui.historyChanges}>{corporateHistoryChanges(row.before_values,row.after_values).map(change => <p key={change.label}>{change.label}: {change.before} → <strong>{change.after}</strong></p>)}</div></li>)}</ol> : <p className={ui.emptyState}>No booking activity recorded yet.</p>}</section>;
}
