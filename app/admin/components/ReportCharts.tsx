"use client";
import { useEffect, useId, useRef, useState } from 'react';
import type { ReportAnalytics } from '@/lib/reporting';
import styles from './Reports.module.css';
import admin from '../admin.module.css';
import Icon from './Icon';

const format = (value: number) => value.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
const seriesColors = ['var(--report-booked)', 'var(--report-attended)'];
const statusColors = ['var(--report-pending)', 'var(--report-confirmed)', 'var(--report-completed)', 'var(--report-cancelled)'];
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-ZA', { month: 'short', year: '2-digit', timeZone: 'Africa/Johannesburg' });

export function ReportSummary({ report }: { report: ReportAnalytics }) {
  const cards = [
    ['Completed Volunteer Hours', format(report.hours), 'Recorded individual and corporate hours'],
    ['Active Volunteers', report.activeVolunteers === null ? 'Unavailable' : format(report.activeVolunteers), 'Unique individual volunteers with a clock-in; corporate identities unavailable'],
    ['Completed Events', format(report.completedEvents), 'Events with recorded completed participation'],
    ['Attendance Rate', report.attendanceRate === null ? '—' : `${format(report.attendanceRate)}%`, 'Recorded attendees ÷ booked participants'],
  ];
  return <div className={`${admin.stats} ${styles.summary}`}>{cards.map(([label, value, help], i) => <section className={`${admin.card} ${admin.stat} ${styles.metric}`} key={label}><div className={admin.statTop}><h3 className={`${admin.statLabel} ${styles.metricLabel}`}>{label}</h3><span className={admin.statIcon}><Icon name={(['activity', 'users', 'calendar', 'activity'] as const)[i]} size={16} /></span></div><div className={admin.statValue}>{value}</div><div className={admin.statNote}>{help}</div></section>)}</div>;
}

function DataTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  return <details className={styles.data}><summary className={admin.helper}>View data: {title}</summary><div className={`${admin.tableWrap} ${styles.tableScroll}`} tabIndex={0} role="region" aria-label={`${title} data`}><table className={`${admin.table} ${styles.dataTable}`}><caption className={admin.helper}>{title}</caption><thead><tr>{headers.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 ? <th scope="row" className={styles.rowHeading} key={j}>{cell}</th> : <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div></details>;
}

export function MonthlyChart({ report, bars = false }: { report: ReportAnalytics; bars?: boolean }) {
  const id = useId();
  const [tip, setTip] = useState('');
  const plot = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(520);
  const title = bars ? 'Booked vs Attended' : 'Volunteer Hours Over Time';
  const months = report.monthly;
  const hasData = months.some(m => bars ? m.booked > 0 || m.attended > 0 : m.hours > 0);
  const max = Math.max(1, ...months.map(m => bars ? Math.max(m.booked, m.attended) : m.hours));
  const top = Math.ceil(max / 4) * 4;
  useEffect(() => {
    if (!plot.current) return;
    const observer = new ResizeObserver(([entry]) => setPlotWidth(Math.floor(entry.contentRect.width)));
    observer.observe(plot.current);
    return () => observer.disconnect();
  }, [hasData]);
  const width = Math.max(280, plotWidth);
  const step = (width - 76) / Math.max(months.length, 1);
  const labelEvery = Math.max(1, Math.ceil(months.length / Math.max(1, Math.floor((width - 76) / 64))));
  const barWidth = Math.min(18, step * 0.34);
  const x = (i: number) => 56 + step * (i + 0.5);
  const y = (v: number) => 215 - v / top * 175;
  return <section className={`${admin.card} ${styles.chart}`} aria-labelledby={id}>
    <div className={admin.cardHeader}><div><h2 id={id} className={admin.cardTitle}>{title}</h2><p className={admin.cardHint}>{bars ? 'Booked and attended participants across individual and corporate activity, by event month' : 'Completed individual and corporate volunteer hours, by event month'}</p></div></div>
    <div className={admin.featureBody}>
    <div className={styles.legend}><span><i style={{ background: seriesColors[0] }} />{bars ? 'Booked participants' : 'Recorded volunteer hours'}</span>{bars && <span><i style={{ background: seriesColors[1] }} />Attended participants</span>}</div>
    {!hasData ? <p className={admin.empty}>{bars ? 'No booked participants or recorded attendance in this range.' : 'No completed volunteer hours recorded in this range.'}</p> : <>
      <div ref={plot} className={styles.plotScroll} tabIndex={0} role="region" aria-label={`${title}. Focus a month or open its data table for exact values.`}>
        <svg viewBox={`0 0 ${width} 270`} style={{ minWidth: width }} role="group" aria-label={`${title}; exact values are available in the data table`}>
          <text x="10" y="16" className={styles.axis}>{bars ? 'Participants' : 'Recorded volunteer hours'}</text>
          {[0, 1, 2, 3, 4].map(t => <g key={t}><line x1="50" x2={width - 12} y1={y(top * t / 4)} y2={y(top * t / 4)} className={styles.gridLine} /><text x="43" y={y(top * t / 4) + 4} textAnchor="end" className={styles.axis}>{format(top * t / 4)}</text></g>)}
          {!bars && <polyline fill="none" stroke={seriesColors[0]} strokeWidth="3" points={months.map((m, i) => `${x(i)},${y(m.hours)}`).join(' ')} />}
          {months.map((m, i) => {
            const label = `${monthLabel(m.month)}: ${bars ? `${format(m.booked)} booked participants, ${format(m.attended)} attended participants` : `${format(m.hours)} completed hours`}`;
            return <g key={m.month} tabIndex={0} role="img" aria-label={label} onMouseEnter={() => setTip(label)} onMouseLeave={() => setTip('')} onFocus={() => setTip(label)} onBlur={() => setTip('')} onClick={() => setTip(label)}>
              <title>{label}</title><rect x={x(i) - step / 2} y="32" width={step} height="190" fill="transparent" />
              {bars ? <><rect x={x(i) - barWidth - 1} y={y(m.booked)} width={barWidth} height={215 - y(m.booked)} rx="2" fill={seriesColors[0]} /><rect x={x(i) + 1} y={y(m.attended)} width={barWidth} height={215 - y(m.attended)} rx="2" fill={seriesColors[1]} /></> : <circle cx={x(i)} cy={y(m.hours)} r="4" fill={seriesColors[0]} />}
              {i % labelEvery === 0 && <text x={x(i)} y="240" textAnchor="middle" className={styles.axis}>{monthLabel(m.month)}</text>}
            </g>;
          })}<text x={width / 2} y="263" textAnchor="middle" className={styles.axis}>Event month</text>
        </svg>
      </div><p className={`${admin.helper} ${styles.tooltip}`} role="status">{tip || 'Hover, tap or focus a month to inspect its values.'}</p>
    </>}
    <DataTable title={title} headers={bars ? ['Month', 'Booked participants', 'Attended participants'] : ['Month', 'Completed hours']} rows={months.map(m => bars ? [monthLabel(m.month), m.booked, m.attended] : [monthLabel(m.month), format(m.hours)])} />
    </div>
  </section>;
}

export function CorporateCharts({ report }: { report: ReportAnalytics }) {
  const total = report.statuses.reduce((sum, s) => sum + s.count, 0);
  const max = report.companies[0]?.hours ?? 1;
  return <div className={styles.chartGrid}>
    <section className={`${admin.card} ${styles.chart}`}><div className={admin.cardHeader}><div><h2 className={admin.cardTitle}>Corporate Contributions</h2><p className={admin.cardHint}>Completed corporate volunteer hours by company</p></div></div><div className={admin.featureBody}>
      {!report.companies.length ? <p className={admin.empty}>No completed corporate hours recorded in this range.</p> : <div className={styles.companyBars}>{report.companies.map(c => <div key={c.id} className={styles.companyRow} tabIndex={0} title={`${c.name}: ${format(c.hours)} completed hours`}><div><span>{c.name}</span><strong>{format(c.hours)} h</strong></div><div className={styles.track}><div style={{ width: `${100 * c.hours / max}%` }} /></div></div>)}</div>}
      <DataTable title="Corporate Contributions" headers={['Company', 'Completed hours']} rows={report.companies.map(c => [c.name, format(c.hours)])} />
    </div></section>
    <section className={`${admin.card} ${styles.chart}`}><div className={admin.cardHeader}><div><h2 className={admin.cardTitle}>Corporate Booking Status</h2><p className={admin.cardHint}>Current status of bookings for events in the selected range; includes cancellations</p></div></div><div className={admin.featureBody}>
      {!total ? <p className={admin.empty}>No corporate bookings for events in this range.</p> : <svg className={styles.donut} viewBox="0 0 220 220" role="img" aria-label={`${total} corporate bookings; counts and percentages below`}><circle cx="110" cy="110" r="78" fill="none" stroke="var(--report-track)" strokeWidth="28" />{report.statuses.map((s, i) => {
        const length = 100 * s.count / total;
        const start = 100 * report.statuses.slice(0, i).reduce((sum, item) => sum + item.count, 0) / total;
        return s.count ? <circle key={s.status} cx="110" cy="110" r="78" fill="none" stroke={statusColors[i]} strokeWidth="28" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} transform="rotate(-90 110 110)"><title>{`${s.status}: ${s.count} (${format(length)}%)`}</title></circle> : null;
      })}<text x="110" y="110" textAnchor="middle" className={styles.donutValue}>{total}</text><text x="110" y="134" textAnchor="middle" className={styles.axis}>bookings</text></svg>}
      <ul className={styles.statusList}>{report.statuses.map((s, i) => <li key={s.status}><span><i style={{ background: statusColors[i] }} />{s.status}</span><strong>{s.count} <small>({total ? format(100 * s.count / total) : '0'}%)</small></strong></li>)}</ul>
      <DataTable title="Corporate Booking Status" headers={['Status', 'Bookings', 'Percentage']} rows={report.statuses.map(s => [s.status, s.count, `${total ? format(100 * s.count / total) : '0'}%`])} />
    </div></section>
  </div>;
}
