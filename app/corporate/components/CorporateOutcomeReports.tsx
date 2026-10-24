"use client";

import { useCallback, useRef, useState } from 'react';
import { corporateOutcomesEnabled } from '@/lib/feature-flags';
import { getCorporateOutcomeReport, loadAllCorporateOutcomeRows } from '@/lib/actions/corporate-outcomes';
import { emptyWorkflowFilters } from '@/lib/actions/corporate-bookings';
import { corporateOutcomesCsv } from '@/lib/corporate-outcomes';
import type { CorporateBookingRow } from '@/lib/corporate-booking-types';
import { corporateDateLabel } from '@/lib/corporate-booking-utils';
import { WorkflowFilters, WorkflowPagination } from './CorporateWorkflowShared';
import { FeatureState } from '@/app/admin/components/FeatureShared';
import { useCorporateFeatureData as useFeatureData } from './useCorporateFeatureData';
import styles from '@/app/admin/admin.module.css';
import management from '@/app/admin/components/management.module.css';
import ui from '../corporate.module.css';
import reportStyles from './corporate-outcomes.module.css';

export default function CorporateOutcomeReports({ admin = false }: { admin?: boolean }) {
  if (!corporateOutcomesEnabled) return <p>Corporate reports are not available yet. Your booking details remain available under My bookings.</p>;
  return <OutcomeWorkspace admin={admin} />;
}
function OutcomeWorkspace({ admin }: { admin: boolean }) {
  // Completion reports are not a payment work queue. The same fixed scope drives
  // the rows, server totals, every export page and printing, including after Clear filters.
  const [filters, setFilters] = useState({ ...emptyWorkflowFilters, status: 'Completed' as const }), [page, setPage] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState('');
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
  return <div className={[management.workspace,ui.workspace].join(' ')}><div className={`${styles.pageHeading} ${management.workspaceHeading}`}><div><h1 className={styles.pageTitle}>{admin ? 'Corporate reports' : 'Group reports'}</h1><p className={styles.pageDescription}>Completed bookings, actual attendees and whole event hours. {admin ? 'Manage payments and overdue bookings in Booking requests.' : 'Manage payments and overdue bookings in My bookings.'}</p></div><div className={ui.actions}><button className={styles.primaryButton} disabled={busy || loading || !data?.total || Boolean(loadError)} onClick={() => void output(false)}>{busy ? 'Preparing…' : 'Export CSV'}</button><button className={styles.secondaryButton} disabled={busy || loading || !data?.total || Boolean(loadError)} onClick={() => void output(true)}>Print filtered report</button></div></div>
    <section className={styles.card}><WorkflowFilters value={filters} disabled={busy} change={value => { setFilters({ ...value, status: 'Completed' }); setPage(1); setPrintRows(null); }} /><FeatureState loading={loading} error={loadError} retry={() => void reload()} /></section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!loading && !loadError && data && <><div className={reportStyles.metrics}>{[['Completed bookings',data.summary.completed_groups],['Actual attendees',data.summary.attendance_instances],['Event hours',data.summary.event_hours],['Bookings awaiting hours',data.summary.groups_without_hours]].map(([label,value]) => <section className={`${styles.card} ${ui.body}`} key={label}><p>{label}</p><strong>{value}</strong></section>)}</div>
      <section className={styles.card}><OutcomeTable rows={data.rows} /><WorkflowPagination page={page} total={data.total} disabled={busy} change={setPage} /></section>
      <details className={ui.reportHelp}><summary>How these totals are calculated</summary><p>Only completed bookings are included. Dates filter by the event date in South Africa. Totals and exports cover every matching booking, not just this page. Actual attendees count attendance at each completed booking, not unique employees. A two-hour session with twelve attendees records 2 event hours, not 24. Hours are whole numbers; missing hours are not treated as a recorded zero. Exports omit contact details, billing addresses, private notes and payment references.</p></details>
    </>}
    <section data-corporate-report className={reportStyles.printArea}><h1>Ladles of Love · Corporate group report</h1><p>Event dates (South Africa): {filters.from || 'Any'} to {filters.to || 'Any'} · Search: {filters.query || 'All'} · Status: {filters.status || 'All'}</p><p>{printRows ? printRows.length + ' matching group bookings.' : 'Current page only. Use Print filtered report in the app to include all matching bookings.'} Attendance instances are not unique employees. Event hours are whole hours per booking; blank means not recorded. Payments/refunds are external.</p><OutcomeTable rows={printRows || data?.rows || []} /></section>
  </div>;
}
export function OutcomeTable({ rows }: { rows: CorporateBookingRow[] }) {
  return <div className={`${management.tableViewport} ${ui.responsiveTable}`}><table role="table" aria-label="Completed corporate bookings" className={styles.table}><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Company / booking</th><th role="columnheader" scope="col">Event / date (SA)</th><th role="columnheader" scope="col">Status</th><th role="columnheader" scope="col">Booked group</th><th role="columnheader" scope="col">Actual attendees</th><th role="columnheader" scope="col">Event hours</th></tr></thead><tbody role="rowgroup">{rows.map(row => { const eligible = row.status === 'Completed' && !row.event.cancelled_at && row.event.state !== 'Cancelled'; return <tr role="row" key={row.id}><td role="cell" data-label="Company / booking">{row.contact_snapshot.company_name}<small className={management.subtle}>{row.id}</small></td><td role="cell" data-label="Event / date (SA)">{row.event.title}<small className={management.subtle}>{corporateDateLabel(row.event.starts_at)}<br />{row.event.location}</small></td><td role="cell" data-label="Status">{row.status}</td><td role="cell" data-label="Booked group">{row.group_size}</td><td role="cell" data-label="Actual attendees">{eligible && row.attendance ? row.attendance.attendance_count : 'Not recorded'}</td><td role="cell" data-label="Event hours">{eligible && row.attendance?.event_hours !== null && row.attendance?.event_hours !== undefined ? row.attendance.event_hours : 'Not recorded'}</td></tr>; })}{!rows.length && <tr role="row"><td role="cell" colSpan={6}>No matching corporate bookings.</td></tr>}</tbody></table></div>;
}
