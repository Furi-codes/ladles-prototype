"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { participationSummary, type AnalyticsData, type ReportFilter } from '@/lib/reporting';
import styles from '../admin.module.css';
import visual from './analytics.module.css';

export default function ParticipationTrend({ data, filter, corporateOnly = false }: { data: AnalyticsData; filter: ReportFilter; corporateOnly?: boolean }) {
  const id = useId();
  const [selected, setSelected] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [data.events.length]);
  const summary = participationSummary(data, filter);
  const points = summary.months;
  const metric = corporateOnly ? 'attendance' : 'uniqueVolunteers';
  const label = corporateOnly ? 'Corporate attendance' : 'Volunteer participation';
  const unit = corporateOnly ? 'attendance instances' : 'unique volunteers';
  const active = points.find(p => p.month === selected) ?? points.at(-1);
  const maximum = Math.max(2, ...points.map(p => p[metric]));
  const top = Math.ceil(maximum / 2) * 2;
  const width = Math.max(300, containerWidth, points.length * 46);
  const x = (index: number) => points.length === 1 ? width / 2 : 44 + index * (width - 88) / Math.max(1, points.length - 1);
  const y = (value: number) => 176 - value / top * 146;
  const path = points.map((p, index) => `${index ? 'L' : 'M'}${x(index)},${y(p[metric])}`).join(' ');
  const monthLabel = (month: string) => new Intl.DateTimeFormat('en-ZA', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
  return <section className={`${styles.card} ${visual.chartCard}`} aria-labelledby={id}>
    <div className={styles.cardHeader}><div><span className={visual.eyebrow}>Participation trends</span><h2 id={id} className={styles.cardTitle}>{label}</h2><p className={styles.cardHint}>{corporateOnly ? 'Completed group attendance, by event month.' : 'Individual volunteers with a clock-in, by event month.'}</p></div></div>
    {!data.events.length ? <p className={styles.empty}>No events match this selection. Try a different period or clear the filters.</p> : <div className={visual.chartBody}>
      <div ref={container} className={visual.chartScroll} tabIndex={0} role="region" aria-label="Monthly chart; scroll horizontally for more months">
        <svg viewBox={`0 0 ${width} 218`} className={visual.lineChart} role="img" aria-label={`${label}. ${points.map(p => `${monthLabel(p.month)}: ${p[metric]}`).join('; ')}`} style={{ width, height: 218 }}>
          {[0, top / 2, top].map(tick => <g key={tick}><line x1="44" x2={width - 44} y1={y(tick)} y2={y(tick)} className={visual.gridLine} /><text x="32" y={y(tick) + 4} textAnchor="end">{tick}</text></g>)}
          {points.length > 1 && <path d={`${path} L${x(points.length - 1)},176 L${x(0)},176 Z`} className={visual.area} />}
          <path d={path} className={visual.trendLine} />
          {points.map((p, index) => <g key={p.month}><circle cx={x(index)} cy={y(p[metric])} r={p.month === active?.month ? 5 : 3.5} className={visual.point}><title>{monthLabel(p.month)}: {p[metric]} {unit}</title></circle><text x={x(index)} y="202" textAnchor="middle">{monthLabel(p.month)}</text></g>)}
        </svg>
      </div>
      <div className={visual.chartSelection}><label>Inspect month <select value={active?.month ?? ''} onChange={e => setSelected(e.target.value)}>{points.map(p => <option key={p.month} value={p.month}>{monthLabel(p.month)}</option>)}</select></label><strong aria-live="polite">{active?.[metric] ?? 0} {unit}</strong></div>
      <p className={visual.note}>{corporateOnly ? 'Group totals are not unique employees.' : 'People are counted once per month; the period total counts each person only once.'}</p>
    </div>}
  </section>;
}
