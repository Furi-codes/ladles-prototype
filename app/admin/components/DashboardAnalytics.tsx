"use client";
import Link from 'next/link';
import { loadVolunteerReportData } from '@/lib/actions/corporate';
import { useCallback, useState } from 'react';
import { selectedReportData, selectedReportRows, participationSummary, presetFilter } from '@/lib/reporting';
import { FeatureState, useFeatureData } from './FeatureShared';
import styles from '../admin.module.css';
import visual from './analytics.module.css';
import ParticipationTrend from './ParticipationTrend';

export default function DashboardAnalytics() {
  const [filter] = useState(() => presetFilter('Latest 6 months'));
  const loader = useCallback(() => loadVolunteerReportData(filter), [filter]);
  const { data, error, loading, reload } = useFeatureData(loader);
  const scoped = data ? selectedReportData({ ...data, corporate: [] }, filter) : null;
  const rows = data ? selectedReportRows({ ...data, corporate: [] }, filter) : [];
  const total = (key: 'attendance' | 'individualHours') => rows.reduce((sum, row) => sum + row[key], 0);
  return <div style={{ marginBottom: 20 }}>
    <FeatureState loading={loading} error={error} retry={reload} />
    {scoped && !loading && <div className={visual.chartGrid}>
      <ParticipationTrend data={scoped} filter={filter} />
      <section className={styles.card} aria-labelledby="dashboard-impact">
        <div className={styles.cardHeader}><div><span className={visual.eyebrow}>Volunteer impact</span><h2 id="dashboard-impact" className={styles.cardTitle}>Volunteer participation</h2><p className={styles.cardHint}>{filter.from} to {filter.to}</p></div></div>
        <div className={visual.insights}>
          <p><strong>{participationSummary(scoped, filter).uniqueVolunteers} unique volunteers</strong> with recorded attendance across the period.</p>
          <p><strong>{total('individualHours').toFixed(1)} individual hours</strong> verified from attendance records.</p>
          <p>Volunteer attendance only. Company results are available under Corporate analytics.</p>
          <Link href="/admin/reports" className={styles.primaryButton}>Explore analytics & reports</Link>
          <button className={styles.secondaryButton} onClick={reload}>Refresh impact data</button>
        </div>
      </section>
    </div>}
  </div>;
}
