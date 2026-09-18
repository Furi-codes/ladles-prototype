"use client";
import { useCallback, useState } from 'react';
import { loadReportData, searchReportEvents, searchReportLocations } from '@/lib/actions/corporate';
import { corporateImpact, selectedReportRows, reportCsv, reportPresets, presetFilter, type ReportPreset, type ReportFilter } from '@/lib/reporting';
import { Field, FeatureState, useFeatureData } from './FeatureShared';
import SearchSelector from './SearchSelector';
import styles from '../admin.module.css';
export default function ReportsManager() {
  const [filter, setFilter] = useState<ReportFilter>(() => presetFilter('Recent Activity'));
  const [preset, setPreset] = useState<ReportPreset>('Recent Activity');
  const loader = useCallback(() => loadReportData(filter), [filter]);
  const { data, loading, error, reload } = useFeatureData(loader);
  const [eventLabel, setEventLabel] = useState('');
  const [eventQuery, setEventQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [corporateOnly, setCorporateOnly] = useState(false);
  const [company, setCompany] = useState('');
  const invalid = Boolean(filter.from && filter.to && filter.from > filter.to);
  const rows = data && !loading ? selectedReportRows(data, filter, corporateOnly, company) : [];
  const impact = data ? corporateImpact(data.corporate, data.events, company, filter) : null;
  const total = (key: 'bookings' | 'attendance' | 'individualHours' | 'corporateHours' | 'groups' | 'confirmed') => rows.reduce((n, r) => n + r[key], 0);
  function exportCsv() {
    const csv = reportCsv(rows); if (!csv) return;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `ladles-report-${filter.from || 'all'}-${filter.to || 'all'}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function update(key: keyof ReportFilter, value: string) { setPreset('Custom Report'); setFilter(f => ({ ...f, [key]: value })); }
  return <div className={styles.featureStack}><FeatureState error={error} loading={loading} retry={reload} /><>
    <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Reports &amp; Analytics</h2><button className={styles.primaryButton} disabled={!rows.length || loading} onClick={exportCsv}>Export CSV</button></div>
      <div className={`${styles.featureBody} ${styles.formGrid}`}>
        <Field label="Report preset"><select className={styles.select} value={preset} onChange={e => { const next = e.target.value as ReportPreset; setPreset(next); setFilter(presetFilter(next)); setCompany(''); setCorporateOnly(next === 'Corporate Participation'); setEventQuery(''); setLocationQuery(''); setEventLabel(''); }}>{reportPresets.map(p => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Participation"><select className={styles.select} value={corporateOnly ? 'corporate' : 'all'} onChange={e => { setCorporateOnly(e.target.value === 'corporate'); setCompany(''); setPreset('Custom Report'); }}><option value="all">Individual and corporate</option><option value="corporate">Corporate only</option></select></Field>
        <p className={`${styles.helper} ${styles.fieldFull}`}>Recent Activity covers the last 30 days; Event Attendance covers 90 days. Monthly Volunteer Activity, Volunteer Hours and Corporate Participation start at the beginning of this month. Dates use Africa/Johannesburg and refer to event dates. Adjust any filter to create a Custom Report.</p>
        <Field label="Date From"><input type="date" className={styles.input} value={filter.from} onChange={e => update('from', e.target.value)} /></Field>
        <Field label="Date To"><input type="date" className={styles.input} value={filter.to} onChange={e => update('to', e.target.value)} /></Field>
        <SearchSelector label="Location" value={filter.location} selectedLabel={filter.location} query={locationQuery} onQuery={setLocationQuery} loadOptions={searchReportLocations} onChange={value => update('location', value)} />
        <SearchSelector label="Event" value={filter.event} selectedLabel={eventLabel} query={eventQuery} onQuery={setEventQuery} loadOptions={searchReportEvents} onChange={(value, label) => { update('event', value); setEventLabel(label); }} />
        {corporateOnly && <Field label="Company"><select className={styles.select} value={company} onChange={e => { setCompany(e.target.value); setPreset('Custom Report'); }}><option value="">All companies</option>{(data?.companies ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}

      </div>{invalid && <p className={styles.error} role="alert">Date From must be on or before Date To.</p>}
    </section>
    {data && !loading && <><div className={styles.stats}>{[
      ['Reserved volunteer places', total('bookings')], ['Verified individual hours', total('individualHours').toFixed(2)],
      ['Recorded corporate hours', total('corporateHours').toFixed(2)], ['Recorded attendance rate', total('bookings') ? `${(100 * total('attendance') / total('bookings')).toFixed(1)}%` : '—'],
      ['Total events', rows.length], ['Confirmed booking records', total('confirmed')], ['Corporate groups', total('groups')], ['Recorded attendees', total('attendance')],
    ].map(([label, value]) => <div key={label} className={`${styles.card} ${styles.stat}`}><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div></div>)}</div>
    <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>{corporateOnly ? 'Corporate event participation' : 'Event performance'}</h2></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Event</th><th>Date</th><th>Capacity</th><th>Reserved places</th><th>Attendance</th><th>Attendance rate</th><th>Individual hours</th><th>Corporate hours</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.event}</td><td>{r.date}</td><td>{r.capacity}</td><td>{r.bookings}</td><td>{r.attendance}</td><td>{r.rate === null ? '—' : `${r.rate.toFixed(1)}%`}</td><td>{r.individualHours.toFixed(2)}</td><td>{r.corporateHours.toFixed(2)}</td></tr>)}</tbody></table></div>{!loading && !rows.length && <p className={styles.empty}>No events match these filters.</p>}</section>
    <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Corporate impact</h2></div><div className={styles.featureBody}><Field label="Company (selects corporate-only report)"><select className={styles.select} value={company} onChange={e => { setCompany(e.target.value); setCorporateOnly(true); setPreset('Custom Report'); }}><option value="">All companies</option>{(data?.companies ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>{impact && !invalid && !loading && <p className={styles.helper}>Employee places reserved: <strong>{impact.participating}</strong> · Events supported: <strong>{impact.events}</strong> · Recorded attendance: <strong>{impact.attendance}</strong> · Recorded corporate hours: <strong>{impact.hours.toFixed(2)}</strong></p>}<p className={styles.helper}>Uses the event date, location and event filters above. Employee places are participation instances, not unique employees. Cancelled group bookings are excluded.</p></div></section>
    </>}
    <p className={styles.helper}>Individual hours = recorded worked minutes ÷ 60; missing minutes contribute no verified hours. Corporate hours are manually recorded for Completed groups. Attendance = individual clock-ins + completed corporate attendance. Rate = recorded attendance ÷ reserved places, including future reservations in the selected period. Cancelled events remain visible as history. Confirmed records count individual bookings and corporate groups, not team members. Corporate-only reports exclude individual bookings and hours; capacity remains the full event slot capacity. The company filter applies to corporate-only rows and CSV. CSV contains the displayed filtered event performance report, with separate individual and corporate hours.</p>
    <button className={styles.secondaryButton} onClick={reload} disabled={loading}>Refresh report</button>
  </></div>;
}
