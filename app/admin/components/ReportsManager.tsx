"use client";
import { useCallback, useMemo, useState } from 'react';
import { loadReportData, searchReportEvents, searchReportLocations } from '@/lib/actions/corporate';
import { reportAnalytics, reportCsv, dateRanges, dateRangeFilter, type DateRange, type ReportFilter } from '@/lib/reporting';
import { Field, FeatureState, useFeatureData } from './FeatureShared';
import SearchSelector from './SearchSelector';
import styles from '../admin.module.css';
import chartStyles from './Reports.module.css';
import { ReportSummary, MonthlyChart, CorporateCharts } from './ReportCharts';
export default function ReportsManager() {
  const [filter, setFilter] = useState<ReportFilter>(() => dateRangeFilter('Last 30 days'));
  const [preset, setPreset] = useState<DateRange>('Last 30 days');
  const loader = useCallback(async () => ({ filter, result: await loadReportData(filter) }), [filter]);
  const { data, loading, error, reload } = useFeatureData(loader);
  const [eventLabel, setEventLabel] = useState('');
  const [eventQuery, setEventQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [corporateOnly, setCorporateOnly] = useState(false);
  const [company, setCompany] = useState('');
  const invalid = Boolean(filter.from && filter.to && filter.from > filter.to);
  const report = useMemo(() => data && data.filter === filter && !loading && !error && !invalid
    ? reportAnalytics(data.result, filter, corporateOnly, company) : null,
  [data, filter, loading, error, invalid, corporateOnly, company]);
  const rows = report?.rows ?? [];
  function exportCsv() {
    const csv = reportCsv(rows); if (!csv) return;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `ladles-report-${filter.from || 'all'}-${filter.to || 'all'}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function update(key: keyof ReportFilter, value: string) { setPreset('Custom date range'); setFilter(f => ({ ...f, [key]: value })); }
  function changeDateRange(next: DateRange) {
    setPreset(next);
    if (next === 'Custom date range') return;
    const { from, to } = dateRangeFilter(next);
    setFilter(f => ({ ...f, from, to }));
  }
  return <div className={styles.featureStack}><FeatureState error={error} loading={loading} retry={reload} /><>
    <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Reports &amp; Analytics</h2><button className={styles.primaryButton} disabled={!rows.length || loading} onClick={exportCsv}>Export CSV</button></div>
      <div className={`${styles.featureBody} ${styles.formGrid}`}>
        <Field label="Date range"><select className={styles.select} value={preset} onChange={e => changeDateRange(e.target.value as DateRange)}>{dateRanges.map(p => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Participation"><select className={styles.select} value={corporateOnly ? 'corporate' : 'all'} onChange={e => { setCorporateOnly(e.target.value === 'corporate'); setCompany(''); setPreset('Custom date range'); }}><option value="all">Individual and corporate</option><option value="corporate">Corporate only</option></select></Field>
        <p className={`${styles.helper} ${styles.fieldFull}`}>All reports use inclusive event dates in Africa/Johannesburg. Month presets are rolling calendar months through today. Adjust either date for a custom range; a blank boundary includes all available history on that side.</p>
        <Field label="Date From"><input type="date" className={styles.input} value={filter.from} onChange={e => update('from', e.target.value)} /></Field>
        <Field label="Date To"><input type="date" className={styles.input} value={filter.to} onChange={e => update('to', e.target.value)} /></Field>
        <SearchSelector label="Location" value={filter.location} selectedLabel={filter.location} query={locationQuery} onQuery={setLocationQuery} loadOptions={searchReportLocations} onChange={value => update('location', value)} />
        <SearchSelector label="Event" value={filter.event} selectedLabel={eventLabel} query={eventQuery} onQuery={setEventQuery} loadOptions={searchReportEvents} onChange={(value, label) => { update('event', value); setEventLabel(label); }} />
        {corporateOnly && <Field label="Company"><select className={styles.select} value={company} onChange={e => { setCompany(e.target.value); setPreset('Custom date range'); }}><option value="">All companies</option>{(data?.result.companies ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}

      </div>{invalid && <p className={styles.error} role="alert">Date From must be on or before Date To.</p>}
    </section>
    {report && <><div className={chartStyles.root}>
      <ReportSummary report={report} />
      <MonthlyChart report={report} />
      <MonthlyChart report={report} bars />
      <CorporateCharts report={report} />
    </div>
    <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>{corporateOnly ? 'Corporate event participation' : 'Event performance'}</h2></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Event</th><th>Date</th><th>Individual capacity</th><th>Corporate capacity</th><th>Individual reserved</th><th>Corporate reserved</th><th>Total booked participants</th><th>Attendance</th><th>Attendance rate</th><th>Individual hours</th><th>Corporate hours</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.event}</td><td>{r.date}</td><td>{r.capacity}</td><td>{r.corporateCapacity}</td><td>{r.individualReserved}</td><td>{r.corporateReserved}</td><td>{r.bookings}</td><td>{r.attendance}</td><td>{r.rate === null ? '—' : `${r.rate.toFixed(1)}%`}</td><td>{r.individualHours.toFixed(2)}</td><td>{r.corporateHours.toFixed(2)}</td></tr>)}</tbody></table></div>{!loading && !rows.length && <p className={styles.empty}>No events match these filters.</p>}</section>
    </>}
    <details className={styles.card}><summary className={styles.featureBody}>Metric definitions and reporting limitations</summary><div className={`${styles.featureBody} ${styles.featureStack}`}>
      <p className={styles.helper}><strong>Completed Volunteer Hours:</strong> individual attendance with both clock-in and clock-out timestamps contributes recorded worked minutes divided by 60; Completed corporate bookings contribute their manually recorded volunteer hours. Missing minutes add no hours. Cancelled events and corporate bookings contribute nothing.</p>
      <p className={styles.helper}><strong>Active Volunteers:</strong> distinct individual user IDs with a recorded clock-in during the selected event-date range. Corporate records contain group totals, not individual identities, so unique corporate volunteers are unavailable. This card is unavailable in corporate-only mode.</p>
      <p className={styles.helper}><strong>Completed Events:</strong> distinct non-cancelled events with at least one clocked-out individual attendance record with recorded minutes, or a Completed corporate booking with positive attendance. The schema has no Completed event status; this measures recorded completed participation, not administrative event closure.</p>
      <p className={styles.helper}><strong>Attendance Rate:</strong> individual clock-ins plus Completed corporate attendance counts, divided by individual booking records plus non-cancelled corporate team sizes. Pending and Confirmed corporate reservations count as booked participants only. No-shows remain in booked participants but contribute no attendance without a clock-in. Future reservations within a custom range enter the denominator. No booked participants displays a dash.</p>
      <p className={styles.helper}><strong>Capacity:</strong> individual and corporate limits are independent. Individual reserved counts slot-linked bookings; legacy unslotted bookings still contribute participation totals. Corporate reserved counts non-cancelled team sizes, including Completed. Corporate-only/company filters restrict reservations and participation; capacity remains the full event limit.</p>
      <p className={styles.helper}><strong>Shared scope:</strong> cards, monthly charts, company hours and CSV use the selected event dates, location, event and participation filters. Corporate charts use corporate activity; the company filter applies in corporate-only mode. Corporate status shows current booking status for events in the range, regardless of booking creation date, and includes cancelled events/bookings for administrative visibility.</p>
      <p className={styles.helper}>Individual cancellations delete the booking under the existing workflow, so original gross reservations and historical individual cancellation counts cannot be reconstructed. Corporate participants are participation instances and may overlap with individual volunteers. Completed activity excludes cancellations; no reservation is converted into attendance or estimated hours.</p>
    </div></details>
    <button className={styles.secondaryButton} onClick={reload} disabled={loading}>Refresh report</button>
  </></div>;
}
