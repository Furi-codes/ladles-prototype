"use client";
/**
 * Shows monthly participation as discrete columns using the existing report totals.
 * Zero months keep a baseline marker, and choosing a month changes only the inspection summary.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { participationSummary, type AnalyticsData, type ReportFilter } from '@/features/admin/utils/reporting';
import styles from '@/styles/admin.module.css';
import visual from '@/features/admin/analytics/analytics.module.css';

export default function ParticipationTrend({ data, filter, corporateOnly = false }: { data: AnalyticsData; filter: ReportFilter; corporateOnly?: boolean }) {
  const id = useId();
  const [selected, setSelected] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [data.events.length]);

  const points = participationSummary(data, filter).months;
  const metric = corporateOnly ? 'attendance' : 'uniqueVolunteers';
  const label = corporateOnly ? 'Corporate attendance' : 'Volunteer participation';
  const countLabel = (count: number) => corporateOnly ? `attendance instance${count === 1 ? '' : 's'}` : `unique volunteer${count === 1 ? '' : 's'}`;
  const active = points.find(point => point.month === selected) ?? points.at(-1);
  const top = Math.ceil(Math.max(2, ...points.map(point => point[metric])) / 2) * 2;
  const width = Math.max(300, containerWidth, points.length * 56 + 64);
  const baseline = 186;
  const columnWidth = (width - 88) / Math.max(1, points.length);
  const barWidth = Math.min(44, columnWidth * .52);
  const x = (index: number) => 44 + (index + .5) * columnWidth;
  const y = (value: number) => baseline - value / top * 154;
  const monthLabel = (month: string) => new Intl.DateTimeFormat('en-ZA', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

  return <section className={`${styles.card} ${visual.chartCard}`} aria-labelledby={id}>
    <div className={`${styles.cardHeader} ${visual.participationHeader}`}>
      <div><span className={visual.eyebrow}>Monthly activity</span><h2 id={id} className={styles.cardTitle}>{label}</h2><p className={styles.cardHint}>{corporateOnly ? 'Recorded attendance, by event month.' : 'Volunteers who attended, by event month.'}</p></div>
      {active && <div className={visual.participationSummary} aria-live="polite" aria-atomic="true"><strong>{active[metric]}</strong><div><span>{countLabel(active[metric])}</span><small>{monthLabel(active.month)}</small></div></div>}
    </div>
    {!data.events.length || !points.length ? <p className={styles.empty}>No events match this selection. Try a different period or clear the filters.</p> : <div className={visual.chartBody}>
      <div className={visual.plotLegend}><span><i aria-hidden="true" />{corporateOnly ? 'Recorded attendance' : 'Monthly volunteers'}</span><span>Select a month below</span></div>
      <div ref={container} className={visual.chartScroll} tabIndex={0} role="region" aria-label="Monthly participation; scroll horizontally for more months">
        <svg viewBox={`0 0 ${width} 204`} className={visual.monthlyChart} role="img" aria-label={`${label}. ${points.map(point => `${monthLabel(point.month)}: ${point[metric]} ${countLabel(point[metric])}`).join('; ')}`} style={{ width, height: 204 }}>
          <defs><linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--portal-accent)" stopOpacity=".65" /><stop offset="100%" stopColor="var(--portal-accent)" /></linearGradient></defs>
          {[0, top / 2, top].map(tick => <g key={tick}><line x1="44" x2={width - 44} y1={y(tick)} y2={y(tick)} stroke="var(--portal-line)" className={visual.gridLine} /><text x="29" y={y(tick) + 4} textAnchor="end" fill="var(--portal-muted)" className={visual.axisLabel}>{tick}</text></g>)}
          <g className={visual.monthlyPlot}>{points.map((point, index) => <g key={point.month}>
            {point.month === active?.month && <rect x={x(index) - columnWidth * .42} y="16" width={columnWidth * .84} height={baseline - 10} rx="10" fill="var(--portal-soft)" className={visual.monthGuide} />}
            {point[metric] > 0 ? <rect x={x(index) - barWidth / 2} y={y(point[metric])} width={barWidth} height={baseline - y(point[metric])} rx="6" fill={`url(#${id}-bar)`} className={visual.monthlyBar} data-active={point.month === active?.month}><title>{monthLabel(point.month)}: {point[metric]} {countLabel(point[metric])}</title></rect>
              : <line x1={x(index) - 10} x2={x(index) + 10} y1={baseline} y2={baseline} stroke="var(--portal-muted)" className={visual.zeroMarker} />}
            <text x={x(index)} y={y(point[metric]) - 10} textAnchor="middle" fill="var(--portal-ink)" className={visual.barValue}>{point[metric]}</text>
          </g>)}</g>
        </svg>
        <div className={visual.monthChoices} role="group" aria-label="Inspect a month" style={{ width, gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
          {points.map(point => <button type="button" key={point.month} aria-pressed={point.month === active?.month} aria-label={`${monthLabel(point.month)}: ${point[metric]} ${countLabel(point[metric])}`} onClick={() => setSelected(point.month)}>{monthLabel(point.month)}</button>)}
        </div>
      </div>
      <p className={visual.note}>{corporateOnly ? 'Group totals are not unique employees.' : 'Each volunteer is counted once per month. Period totals count each person once across all months.'}</p>
    </div>}
  </section>;
}
