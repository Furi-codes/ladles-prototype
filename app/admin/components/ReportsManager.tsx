"use client";
import { useState } from 'react';
import { loadReportData } from '@/lib/actions/corporate';
import { corporateImpact, performanceRows, reportCsv, type ReportFilter } from '@/lib/reporting';
import { Field, FeatureState, useFeatureData } from './FeatureShared';
import styles from '../admin.module.css';
export default function ReportsManager() {
  const { data, loading, error, reload } = useFeatureData(loadReportData);
  const [filter, setFilter] = useState<ReportFilter>({ from: '', to: '', location: '', event: '' });
  const [company, setCompany] = useState('');
  const invalid = Boolean(filter.from && filter.to && filter.from > filter.to);
  const rows = data && !invalid ? performanceRows(data.events, data.slots, data.bookings, data.attendance, data.corporate, filter) : [];
  const impact = data ? corporateImpact(data.corporate, data.events, company, filter) : null;
  const total = (key: 'bookings' | 'attendance' | 'individualHours' | 'corporateHours' | 'groups' | 'confirmed') => rows.reduce((n, r) => n + r[key], 0);
  function exportCsv() {
    const csv = reportCsv(rows); if (!csv) return;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `ladles-report-${filter.from || 'all'}-${filter.to || 'all'}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function update(key: keyof ReportFilter, value: string) { setFilter(f => ({ ...f, [key]: value })); }
  return <div className={styles.featureStack}><FeatureState error={error} loading={loading} retry={reload} />{data && <>
    <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Reports &amp; Analytics</h2><button className={styles.primaryButton} disabled={!rows.length || loading} onClick={exportCsv}>Export CSV</button></div>
      <div className={`${styles.featureBody} ${styles.formGrid}`}>
        <Field label="Date From"><input type="date" className={styles.input} value={filter.from} onChange={e => update('from', e.target.value)} /></Field>
        <Field label="Date To"><input type="date" className={styles.input} value={filter.to} onChange={e => update('to', e.target.value)} /></Field>
        <Field label="Location"><select className={styles.select} value={filter.location} onChange={e => update('location', e.target.value)}><option value="">All Locations</option>{Array.from(new Set(data.events.map(e => e.location).filter(Boolean))).sort().map(l => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Event"><select className={styles.select} value={filter.event} onChange={e => update('event', e.target.value)}><option value="">All Events</option>{data.events.map(e => <option key={e.id} value={e.id}>{e.title} · {e.date}</option>)}</select></Field>
      </div>{invalid && <p className={styles.error} role="alert">Date From must be on or before Date To.</p>}
    </section>
    <div className={styles.stats}>{[
      ['Reserved volunteer places', total('bookings')], ['Verified individual hours', total('individualHours').toFixed(2)],
      ['Recorded corporate hours', total('corporateHours').toFixed(2)], ['Recorded attendance rate', total('bookings') ? `${(100 * total('attendance') / total('bookings')).toFixed(1)}%` : '—'],
      ['Total events', rows.length], ['Confirmed booking records', total('confirmed')], ['Corporate groups', total('groups')], ['Recorded attendees', total('attendance')],
    ].map(([label, value]) => <div key={label} className={`${styles.card} ${styles.stat}`}><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div></div>)}</div>
    <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Event performance</h2></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Event</th><th>Date</th><th>Capacity</th><th>Reserved places</th><th>Attendance</th><th>Attendance rate</th><th>Individual hours</th><th>Corporate hours</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.event}</td><td>{r.date}</td><td>{r.capacity}</td><td>{r.bookings}</td><td>{r.attendance}</td><td>{r.rate === null ? '—' : `${r.rate.toFixed(1)}%`}</td><td>{r.individualHours.toFixed(2)}</td><td>{r.corporateHours.toFixed(2)}</td></tr>)}</tbody></table></div>{!rows.length && <p className={styles.empty}>No events match these filters.</p>}</section>
    <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Corporate impact</h2></div><div className={styles.featureBody}><Field label="Company"><select className={styles.select} value={company} onChange={e => setCompany(e.target.value)}><option value="">All companies</option>{data.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>{impact && !invalid && <p className={styles.helper}>Employee places reserved: <strong>{impact.participating}</strong> · Events supported: <strong>{impact.events}</strong> · Recorded attendance: <strong>{impact.attendance}</strong> · Recorded corporate hours: <strong>{impact.hours.toFixed(2)}</strong></p>}<p className={styles.helper}>Uses the event date, location and event filters above. Employee places are participation instances, not unique employees. Cancelled group bookings are excluded.</p></div></section>
    <p className={styles.helper}>Individual hours = recorded worked minutes ÷ 60; missing minutes contribute no verified hours. Corporate hours are manually recorded for Completed groups. Attendance = individual clock-ins + completed corporate attendance. Rate = recorded attendance ÷ reserved places, including future reservations in the selected period. Cancelled events remain visible as history. Confirmed records count individual bookings and corporate groups, not team members. CSV contains the filtered event performance report, with separate individual and corporate hours.</p>
    <button className={styles.secondaryButton} onClick={reload} disabled={loading}>Refresh report</button>
  </>}</div>;
}
