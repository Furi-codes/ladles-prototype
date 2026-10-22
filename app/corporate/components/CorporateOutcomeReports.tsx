"use client";

import { useCallback, useRef, useState } from 'react';
import { corporateOutcomesEnabled } from '@/lib/feature-flags';
import { getCorporateOutcomeReport, loadAllCorporateOutcomeRows } from '@/lib/actions/corporate-outcomes';
import { emptyWorkflowFilters } from '@/lib/actions/corporate-bookings';
import { corporateOutcomesCsv } from '@/lib/corporate-outcomes';
import type { CorporateBookingRow } from '@/lib/corporate-booking-types';
import { corporateDateLabel } from '@/lib/corporate-booking-utils';
import { WorkflowFilters, WorkflowPagination } from './CorporateWorkflowShared';
import { FeatureState, useFeatureData } from '@/app/admin/components/FeatureShared';
import styles from '@/app/admin/admin.module.css';
import management from '@/app/admin/components/management.module.css';
import ui from '../corporate.module.css';
import reportStyles from './corporate-outcomes.module.css';

export default function CorporateOutcomeReports({ admin = false }: { admin?: boolean }) {
  if (!corporateOutcomesEnabled) return <p>Corporate reports are not available yet. Your booking details remain available under My bookings.</p>;
  return <OutcomeWorkspace admin={admin} />;
}
function OutcomeWorkspace({ admin }: { admin: boolean }) {
  const [filters, setFilters] = useState(emptyWorkflowFilters), [page, setPage] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [printRows, setPrintRows] = useState<CorporateBookingRow[] | null>(null);
  const pending = useRef(false);
  const loader = useCallback(() => getCorporateOutcomeReport(filters,page),[filters,page]);
  const { data,loading,error:loadError,reload } = useFeatureData(loader);
  async function output(print: boolean) {
    if (pending.current) return; pending.current = true; setBusy(true); setError('');
    try {
      const rows = await loadAllCorporateOutcomeRows(filters);
      if (!rows.length) throw new Error('No filtered bookings to export or print.');
      if (print) { setPrintRows(rows); await new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))); window.print(); }
      else {
        const url = URL.createObjectURL(new Blob([corporateOutcomesCsv(rows)],{ type:'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = 'corporate-group-report.csv'; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url),1000);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The complete report could not be prepared.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className={management.workspace}><div className={styles.pageHeading}><div><h1 className={styles.pageTitle}>{admin ? 'Corporate reports' : 'Our group participation'}</h1><p className={styles.pageDescription}>Corporate-only bookings, actual group attendance and recorded group hours.</p></div><div className={ui.actions}><button className={styles.primaryButton} disabled={busy || loading || !data?.total || Boolean(loadError)} onClick={() => void output(false)}>{busy ? 'Preparing…' : 'Export CSV'}</button><button className={styles.secondaryButton} disabled={busy || loading || !data?.total || Boolean(loadError)} onClick={() => void output(true)}>Print filtered report</button></div></div>
    <section className={styles.card}><WorkflowFilters value={filters} statuses disabled={busy} change={value => { setFilters(value); setPage(1); setPrintRows(null); }} /><FeatureState loading={loading} error={loadError} retry={() => void reload()} /></section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!loading && !loadError && data && <><div className={reportStyles.metrics}>{[['Matching bookings',data.summary.bookings],['Accepted places',data.summary.accepted_places],['Completed groups',data.summary.completed_groups],['Attendance instances',data.summary.attendance_instances],['Recorded group hours',data.summary.group_hours.toFixed(2)],['Groups without hours',data.summary.groups_without_hours],['Overdue bookings',data.summary.overdue_bookings]].map(([label,value]) => <section className={`${styles.card} ${ui.body}`} key={label}><p>{label}</p><strong>{value}</strong></section>)}</div>
      <section className={styles.card}><OutcomeTable rows={data.rows} /><WorkflowPagination page={page} total={data.total} disabled={busy} change={setPage} /></section>
      <p>Totals cover all matching records, not only this page. Accepted places include completed group reservations. Attendance counts visits, not unique employees. Hours are manually recorded group totals; missing hours are not invented. Cancelled/rejected records remain visible but do not contribute participation totals. CSV/print include every matching row and omit contact details, billing addresses, private notes and payment references.</p>
    </>}
    <section className={reportStyles.printArea}><h1>Ladles of Love · Corporate group report</h1><p>Event dates (South Africa): {filters.from || 'Any'} to {filters.to || 'Any'} · Search: {filters.query || 'All'} · Status: {filters.status || 'All'}</p><p>{printRows ? printRows.length + ' matching group bookings.' : 'Current page only. Use Print filtered report in the app to include all matching bookings.'} Attendance instances are not unique employees. Blank hours mean not recorded. Payments/refunds are external.</p><OutcomeTable rows={printRows || data?.rows || []} /></section>
  </div>;
}
export function OutcomeTable({ rows }: { rows: CorporateBookingRow[] }) {
  return <div className={management.tableViewport}><table className={styles.table}><thead><tr><th>Company / booking</th><th>Event / date (SA)</th><th>Status</th><th>Booked group</th><th>Actual attendees</th><th>Total group hours</th></tr></thead><tbody>{rows.map(row => { const eligible = row.status === 'Completed' && !row.event.cancelled_at && row.event.state !== 'Cancelled'; return <tr key={row.id}><td>{row.contact_snapshot.company_name}<small className={management.subtle}>{row.id}</small></td><td>{row.event.title}<small className={management.subtle}>{corporateDateLabel(row.event.starts_at)}<br />{row.event.location}</small></td><td>{row.status}</td><td>{row.group_size}</td><td>{eligible && row.attendance ? row.attendance.attendance_count : 'Not recorded'}</td><td>{eligible && row.attendance?.group_hours !== null && row.attendance?.group_hours !== undefined ? row.attendance.group_hours.toFixed(2) : 'Not recorded'}</td></tr>; })}{!rows.length && <tr><td colSpan={6}>No matching corporate bookings.</td></tr>}</tbody></table></div>;
}
