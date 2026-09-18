"use client";

import { useId, useState } from "react";
import styles from "./CommunityParticipation.module.css";

// Fixed sample values keep the preview stable between renders. No live data is used.
const SAMPLE_COUNTS = [42, 68, 91];

function getPreviewMonths() {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg", year: "numeric", month: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value) - 1;
  return SAMPLE_COUNTS.map((count, index) => {
    const date = new Date(Date.UTC(year, month - 2 + index, 1));
    return {
      count,
      shortLabel: new Intl.DateTimeFormat("en-ZA", { month: "short", timeZone: "UTC" }).format(date),
      label: new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }).format(date),
    };
  });
}

export default function CommunityParticipation() {
  const gradientId = useId();
  const [months] = useState(getPreviewMonths);
  const [selectedIndex, setSelectedIndex] = useState(2);
  const selected = months[selectedIndex];
  const previous = months[selectedIndex - 1];
  const growth = previous ? ((selected.count - previous.count) / previous.count * 100).toFixed(1) : null;
  const maximum = Math.ceil(Math.max(...SAMPLE_COUNTS) / 25) * 25;
  const points = months.map((month, index) => ({ x: 54 + index * 234, y: 188 - month.count / maximum * 154 }));
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return <section className={styles.card} aria-labelledby="community-title">
    <div className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>Growing together</p>
        <h2 id="community-title">Our volunteer community</h2>
        <p className={styles.subtitle}>See how participation is growing, month by month.</p>
      </div>
      <span className={styles.badge}>Sample data</span>
    </div>
    <div className={styles.body}>
      <div className={styles.summary} aria-live="polite" aria-atomic="true">
        <span className={styles.number}>{selected.count}</span>
        <span className={styles.metric}>unique volunteers</span>
        <span className={styles.period}>{selected.label}{selectedIndex === 2 ? " (current month)" : ""}</span>
        {growth !== null ? <div className={styles.growth}>
          <span className={styles.growthBadge}>+{growth}%</span>
          <span>vs {previous.shortLabel}</span>
        </div> : <p className={styles.summaryNote}>Starting point for this three-month preview.</p>}
        <p className={styles.summaryNote}>Illustrative attendance figures</p>
      </div>
      <div className={styles.chartArea}>
        <div className={styles.chartHeading}><span><i className={styles.legendDot} aria-hidden="true" />Volunteer participation</span><span>3-month comparison</span></div>
        <svg className={styles.chart} viewBox="0 0 576 222" role="img" aria-labelledby={`${gradientId}-title ${gradientId}-description`}>
          <title id={`${gradientId}-title`}>Sample volunteer participation growth</title>
          <desc id={`${gradientId}-description`}>{months.map((month) => `${month.label}: ${month.count} volunteers`).join(". ")}. These are illustrative figures, not actual attendance.</desc>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".2" /><stop offset="100%" stopColor="currentColor" stopOpacity=".01" /></linearGradient></defs>
          {[0, 1, 2, 3, 4].map((step) => {
            const y = 188 - step / 4 * 154;
            return <g key={step}><line x1="54" x2="522" y1={y} y2={y} className={styles.gridLine} /><text x="38" y={y + 4} textAnchor="end" className={styles.axisLabel}>{maximum * step / 4}</text></g>;
          })}
          <path d={`${line} L 522 188 L 54 188 Z`} fill={`url(#${gradientId})`} />
          <path d={line} className={styles.trendLine} />
          {points.map((point, index) => <g key={months[index].label}>
            {index === selectedIndex && <circle cx={point.x} cy={point.y} r="13" className={styles.pointHalo} />}
            <circle cx={point.x} cy={point.y} r={index === selectedIndex ? 6 : 4.5} className={styles.point} />
            <text x={point.x} y={point.y - 19} textAnchor="middle" className={styles.pointLabel}>{months[index].count}</text>
            <text x={point.x} y="212" textAnchor="middle" className={styles.axisLabel}>{months[index].shortLabel}</text>
          </g>)}
        </svg>
        <div className={styles.monthPicker} role="group" aria-label="Explore a month">
          {months.map((month, index) => <button type="button" key={month.label}
            aria-pressed={selectedIndex === index}
            aria-label={`${month.label}: ${month.count} sample volunteers${index === 2 ? ", current month" : ""}`}
            className={`${styles.monthButton} ${selectedIndex === index ? styles.selected : ""}`}
            onClick={() => setSelectedIndex(index)}>{month.shortLabel}<span>{index === 2 ? "This month" : index === 1 ? "Last month" : "2 months ago"}</span></button>)}
        </div>
      </div>
    </div>
    <p className={styles.footnote}>Preview only: these three months use sample data, not real volunteer records. The percentage compares the selected month with the month before it.</p>
  </section>;
}
