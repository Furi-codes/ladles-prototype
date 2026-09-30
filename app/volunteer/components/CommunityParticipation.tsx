"use client";

import { useEffect, useId, useState } from "react";
import { fetchCommunityParticipation, type CommunityParticipationMonth, type CommunityParticipationPeriod } from "@/lib/actions/volunteer";
import styles from "./CommunityParticipation.module.css";

const periodOptions: { value: CommunityParticipationPeriod; label: string }[] = [
  { value: "latest_6_months", label: "Latest 6 months" },
  { value: "previous_6_months", label: "6–12 months ago" },
  { value: "earlier_6_months", label: "12–18 months ago" },
];

function labelForMonth(monthStart: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", ...options })
    .format(new Date(`${monthStart}T00:00:00Z`));
}

export default function CommunityParticipation({ refreshKey, compact = false, analytics = false }: { refreshKey?: number; compact?: boolean; analytics?: boolean }) {
  const chartSize = compact
    ? { width: 1200, height: 170, left: 60, right: 1140, top: 14, bottom: 134, axisLabelY: 157 }
    : analytics
      ? { width: 900, height: 212, left: 72, right: 850, top: 16, bottom: 164, axisLabelY: 195 }
      : { width: 576, height: 232, left: 52, right: 542, top: 22, bottom: 184, axisLabelY: 211 };
  const { width: chartWidth, height: chartHeight, left: chartLeft, right: chartRight, top: chartTop, bottom: chartBottom, axisLabelY } = chartSize;
  const chartTitleId = useId();
  const [period, setPeriod] = useState<CommunityParticipationPeriod>("latest_6_months");
  const [months, setMonths] = useState<CommunityParticipationMonth[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const periodLabel = periodOptions.find((option) => option.value === period)?.label ?? "Latest 6 months";

  useEffect(() => {
    let active = true;
    async function loadParticipation() {
      setIsLoading(true);
      setError(null);
      const result = await fetchCommunityParticipation(period);
      if (!active) return;
      if (result.error) {
        console.error("Failed to load community participation:", result.error);
        setError("Community participation is not available yet.");
        setMonths([]);
      } else {
        const records = (result.data ?? []).map((month) => ({
          month_start: month.month_start,
          volunteer_count: Number(month.volunteer_count),
        }));
        setMonths(records);
        setSelectedIndex(Math.max(0, records.length - 1));
      }
      setIsLoading(false);
    }
    void loadParticipation();
    return () => { active = false; };
  }, [period, refreshKey]);

  const selected = months[selectedIndex] ?? null;
  const maximum = Math.max(1, Math.ceil(Math.max(...months.map((month) => month.volunteer_count), 0) / 5) * 5);
  const points = months.map((month, index) => {
    const x = months.length <= 1
      ? (chartLeft + chartRight) / 2
      : chartLeft + ((chartRight - chartLeft) * index) / (months.length - 1);
    const y = chartBottom - ((chartBottom - chartTop) * month.volunteer_count) / maximum;
    return { ...month, x, y };
  });
  const trend = points.map((point) => `${point.x},${point.y}`).join(" ");
  const selectedPoint = points[selectedIndex];

  return <section className={`${styles.card} ${compact ? styles.compact : ""} ${analytics ? styles.analytics : ""}`} aria-labelledby={chartTitleId}>
    <div className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>Community impact</p>
        <h2 id={chartTitleId}>Volunteer participation</h2>
        <p className={styles.subtitle}>Unique volunteers who recorded a clock-in each month.</p>
      </div>
      <div className={styles.controls}>
        <label className={styles.periodControl}>Period<select value={period} onChange={(event) => setPeriod(event.target.value as CommunityParticipationPeriod)} disabled={isLoading}>{periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <span className={styles.badge}>{isLoading ? "Loading" : "Live data"}</span>
      </div>
    </div>
    {error ? <p className={styles.footnote} role="status">{error}</p> : <div className={styles.body}>
      <div className={styles.chartArea}>
        <div className={styles.chartHeading}><span><i className={styles.legendDot} aria-hidden="true" />Unique volunteers</span><span>{periodLabel}</span></div>
        <svg className={styles.chart} viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`Monthly volunteer participation for ${periodLabel}`}>
          {[0, .5, 1].map((ratio) => {
            const y = chartBottom - (chartBottom - chartTop) * ratio;
            return <line key={ratio} className={styles.gridLine} x1={chartLeft} x2={chartRight} y1={y} y2={y} />;
          })}
          {points.length > 1 && <polyline className={styles.trendLine} points={trend} />}
          {points.map((point, index) => <g key={point.month_start}>
            {index === selectedIndex && <circle className={styles.pointHalo} cx={point.x} cy={point.y} r="12" />}
            <circle className={styles.point} cx={point.x} cy={point.y} r="5" />
            <text className={styles.axisLabel} x={point.x} y={axisLabelY} textAnchor="middle">{labelForMonth(point.month_start, { month: "short" })}</text>
          </g>)}
          {selectedPoint && <text className={styles.pointLabel} x={selectedPoint.x} y={Math.max(16, selectedPoint.y - 16)} textAnchor="middle">{selectedPoint.volunteer_count}</text>}
        </svg>
      </div>
      {!compact && <div className={styles.monthPicker} aria-label="Choose a month">
        {months.map((month, index) => <button key={month.month_start} type="button" className={`${styles.monthButton} ${index === selectedIndex ? styles.selected : ""}`} onClick={() => setSelectedIndex(index)}>
          {labelForMonth(month.month_start, { month: "short" })}<span>{month.volunteer_count}</span>
        </button>)}
      </div>}
      <p className={styles.selectedSummary} aria-live="polite">{selected ? `${labelForMonth(selected.month_start, { month: "long", year: "numeric" })}: ${selected.volunteer_count} volunteer${selected.volunteer_count === 1 ? "" : "s"}.` : "Select a month to view its recorded participation."}</p>
    </div>}
    <p className={styles.footnote}>Only recorded attendance is counted; the chart does not expose volunteer names or contact details.</p>
  </section>;
}
